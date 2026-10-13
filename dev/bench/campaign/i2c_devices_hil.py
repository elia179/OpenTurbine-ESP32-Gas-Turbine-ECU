"""Physical shared-I2C HIL using OTBench 0.12+ and existing harness jumpers.

The tester temporarily uses DUT GPIO13/15 (S3) or GPIO13/4 (Classic) as an I2C
bus and emulates one supported accessory at a time. It proves discovery, assignment
truth, live input conversion, TCA output writes, disconnect/reconnect health,
and NAU7802 torque/thrust calibration. Original hardware/config are restored.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
from datetime import datetime

import serial

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "harness"))

from ten_build_webui_hil import TenBuildRunner, chan_input, chan_output  # noqa: E402


class I2cQualification:
    def __init__(self):
        self.serial_lines: list[str] = []
        self.serial_stop = threading.Event()
        self.serial_port = serial.Serial(baudrate=115200, timeout=0.15)
        self.serial_port.port = os.environ.get("OPENTURBINE_DUT_PORT", "COM4")
        self.serial_port.dtr = False
        self.serial_port.rts = False
        self.serial_port.open()
        self.serial_thread = threading.Thread(target=self._capture_serial, daemon=True)
        self.serial_thread.start()
        self.r = TenBuildRunner(port=os.environ.get("OTBENCH_PORT", "COM3"))
        self.dut, self.t = self.r.dut, self.r.t
        self.original_ecu = self.dut._get("/api/ecu_config")
        self.device = self.dut.device_info()
        self.tester_version = self.t.ping()
        self.rows: list[dict] = []

    def _capture_serial(self):
        while not self.serial_stop.is_set():
            raw = self.serial_port.readline()
            if not raw:
                continue
            line = raw.decode("utf-8", errors="replace").strip()
            if line:
                self.serial_lines.append(line)
                print("[DUT]", line, flush=True)

    def record(self, name, ok, **detail):
        self.rows.append({"name": name, "ok": bool(ok), "detail": detail})
        print(f"[{'PASS' if ok else 'FAIL'}] {name}: {detail}", flush=True)

    def reset_i2c_tester(self):
        """Reset the synthetic slave before changing its I2C address."""
        self.t._reset_board()
        version = self.t.ping().split()[-1]
        if tuple(int(part) for part in version.split('.')) < (0, 12):
            raise RuntimeError("OTBench did not return after I2C emulator reset")

    def start_tca(self, input_value: int):
        """Start the synthetic TCA and prove the tester actually enabled it."""
        replies = []
        for _ in range(5):
            reply = self.t.raw(f"I2CEMU TCA9554 {input_value}")
            status = self.t.raw("I2CEMU STATUS")
            replies.append({"reply": reply, "status": status})
            if reply == "OK" and "mode=1" in status:
                return True, replies
            time.sleep(0.25)
        return False, replies

    def bus_profile(self, hw):
        profile = hw.get("_pcb_profile", {})
        if profile.get("state") == "valid":
            raise RuntimeError(
                "The shared-wire I2C fixture requires generic hardware mode; "
                "back up and temporarily clear the pcbprof partition first"
            )
        # The hardware schema intentionally requires dedicated physical
        # START/STOP inputs. Park them on otherwise-unused harness pins while
        # their normal jumpers carry the temporary I2C bus.
        classic = os.environ.get("OTBENCH_TARGET", "s3").lower() == "classic"
        hw["platform"] = "esp32" if classic else "esp32s3"
        hw["controls"].update(start_pin=-1 if classic else 12,
                              stop_pin=26 if classic else 21,
                              stop_active_h=False, stop_pullup=True,
                              stop_pulldown=False)
        # OTBench's slave uses GPIO13/14 on either chip. In the reversed
        # loom S3 GPIO14 is the N1 wire to Classic GPIO4.
        hw["i2c"].update(enabled=True, sda_pin=13, scl_pin=4 if classic else 15,
                         interrupt_pin=-1, frequency_hz=100000)

    def wait_device(self, address, type_name, present=True, timeout=12):
        deadline, last = time.time() + timeout, {}
        while time.time() < deadline:
            # Discovery is intentionally a small live endpoint. GET hardware
            # is the saved topology and no longer carries changing scan state.
            last = self.dut._get("/api/i2c_discovery")
            found = next((d for d in last.get("devices", [])
                          if int(d.get("address", -1)) == address and
                          d.get("type") == type_name), None)
            if bool(found and found.get("present")) == present:
                return True, found or {}
            time.sleep(0.35)
        return False, last

    def post_registry(self, inputs, outputs):
        hw = self.dut.hardware()
        hw.pop("_i2c_discovery", None)
        hw["channel_registry"]["inputs"] = inputs
        hw["channel_registry"]["outputs"] = outputs
        # Match the Hardware UI's dependency cleanup when replacing a core
        # sensor card. Runtime serialization mirrors canonical I2C purposes
        # into these flags; removing the card must remove that mirror too.
        input_purposes = {c.get("purpose") for c in inputs}
        for legacy_key, purpose in (
            ("oil_press", "oil_pressure"), ("fuel_press", "fuel_pressure"),
            ("p1", "p1_pressure"), ("p2", "p2_pressure"),
            ("batt_voltage", "battery_voltage"),
        ):
            if purpose not in input_purposes:
                hw["sensors"][legacy_key]["enabled"] = False
                hw["sensors"][legacy_key]["pin"] = -1
        previous_boot = self.dut.data().get("boot_count")
        code, response = self.dut._post("/api/hardware", hw)
        if code == 200:
            if not self.r.wait_dut_ready_after_hardware_save(previous_boot_count=previous_boot):
                raise RuntimeError("DUT did not return after I2C registry save")
            applied = self.dut.hardware()
            print("  applied I2C=", applied.get("i2c"),
                  "inputs=", [c.get("id") for c in applied.get("channel_registry", {}).get("inputs", [])],
                  "outputs=", [c.get("id") for c in applied.get("channel_registry", {}).get("outputs", [])],
                  flush=True)
        return code, response

    @staticmethod
    def registry_value(data, id_):
        return next((row for row in data.get("registry_inputs", [])
                     if row.get("id") == id_), {})

    @staticmethod
    def nau_channels():
        torque = chan_input("torque_main", "Torque", "torque", "torque",
                            10, -1, i2c_address=0x2A, device_channel=0,
                            loadcell_zero=100000, loadcell_n_per_count=0.002,
                            lever_arm_m=0.5, loadcell_gain=128,
                            loadcell_rate_sps=80, filter_alpha=1)
        thrust = chan_input("thrust_main", "Thrust", "thrust", "thrust",
                            10, -1, i2c_address=0x2A, device_channel=1,
                            loadcell_zero=100000, loadcell_n_per_count=0.002,
                            lever_arm_m=0, loadcell_gain=128,
                            loadcell_rate_sps=80, filter_alpha=1)
        return torque, thrust

    def run_nau_only(self):
        self.r.apply_profile({"id": "i2c_bus_only", "name": "I2C bus only",
                              "build": self.bus_profile}, fast_config=False)
        self.t._reset_board()
        self.t.ping()
        emu_reply = self.t.raw("I2CEMU NAU7802 102000")
        found, detail = self.wait_device(0x2A, "NAU7802")
        self.record("NAU7802_DISCOVERED", found and emu_reply == "OK",
                    emulator=emu_reply, discovery=detail)
        # Restart the synthetic slave's deterministic transaction model just
        # before the reboot that initializes assigned load-cell channels.
        self.t.raw("I2CEMU NAU7802 102000")
        torque, thrust = self.nau_channels()
        code, response = self.post_registry([torque, thrust], [])
        samples = []
        deadline = time.time() + 12
        while time.time() < deadline:
            data = self.dut.data()
            samples.append({
                "torque": self.registry_value(data, "torque_main"),
                "thrust": self.registry_value(data, "thrust_main"),
                "discovery": self.dut._get("/api/i2c_discovery"),
                "emulator": self.t.raw("I2CEMU STATUS"),
            })
            if (samples[-1]["torque"].get("healthy") and
                    samples[-1]["thrust"].get("healthy")):
                break
            time.sleep(0.5)
        last = samples[-1] if samples else {}
        ok = (
            code == 200 and last.get("torque", {}).get("healthy") and
            last.get("thrust", {}).get("healthy") and
            1.9 <= float(last["torque"].get("value", 0)) <= 2.1 and
            3.9 <= float(last["thrust"].get("value", 0)) <= 4.1
        )
        status = self.t.raw("I2CEMU STATUS")
        self.record("NAU7802_ANALOG_STARTUP", "nau_init_ok=1" in status and
                    "nau_cal=03" in status, status=status)
        self.record("NAU7802_TORQUE_AND_THRUST_CALIBRATION", ok,
                    code=code, response=response, last=last,
                    sample_count=len(samples))

    def run(self):
        if os.environ.get("I2C_ONLY_NAU") == "1":
            self.run_nau_only()
            return
        self.r.apply_profile({"id": "i2c_bus_only", "name": "I2C bus only",
                              "build": self.bus_profile})

        # TCA9554: discovery, binary input, generic output test and heartbeat loss.
        self.reset_i2c_tester()
        started, start_replies = self.start_tca(1)
        found, detail = self.wait_device(0x20, "TCA9554")
        self.record("TCA9554_DISCOVERED", started and found,
                    emulator=start_replies, discovery=detail)
        tca_in = chan_input("i2c_switch", "I2C Switch", "digital_switch",
                            "digital_switch", 8, -1, min=0, max=1,
                            i2c_address=0x20, device_channel=0)
        tca_out = chan_output("i2c_relay", "I2C Relay", "generic", "generic",
                              11, -1, i2c_address=0x20, device_channel=1,
                              safe_demand=0, force_safe_on_fault=True)
        code, response = self.post_registry([tca_in], [tca_out])
        self.record("TCA9554_ASSIGNMENT_SAVED", code == 200, code=code, response=response)
        ok, data = self.dut.poll_until(
            lambda d: (r := self.registry_value(d, "i2c_switch")).get("healthy") and
                      r.get("value") == 1, timeout=8, interval=0.1)
        self.record("TCA9554_INPUT_HIGH", ok, input=self.registry_value(data, "i2c_switch"))

        code, response = self.dut.command("REGISTRY_OUTPUT_TEST", fParam=1, iParam=0)
        time.sleep(0.35)
        active_status = self.t.raw("I2CEMU STATUS")
        time.sleep(3.1)
        safe_status = self.t.raw("I2CEMU STATUS")
        active = "tca_out=02" in active_status
        safe = "tca_out=00" in safe_status
        self.record("TCA9554_OUTPUT_TEST_AND_SAFE_RETURN",
                    code == 200 and active and safe, code=code, response=response,
                    active=active_status, safe=safe_status)

        self.t.raw("I2CEMU OFF 0")
        missing, data = self.dut.poll_until(
            lambda d: not self.registry_value(d, "i2c_switch").get("healthy", True),
            timeout=3, interval=0.08)
        code, response = self.dut.command("REGISTRY_OUTPUT_TEST", fParam=1, iParam=0)
        self.record("TCA9554_DISCONNECT_FAILS_INPUT_AND_BLOCKS_OUTPUT",
                    missing and code != 200, input=self.registry_value(data, "i2c_switch"),
                    tool_code=code, response=response)
        # Classic Arduino Wire cannot reliably tear down and recreate an I2C
        # slave peripheral in-place. Reset the synthetic peripheral just as a
        # real disconnected module would power-cycle; START/STOP were moved off
        # these fixture pins above, so this cannot command the DUT.
        self.reset_i2c_tester()
        restarted, reconnect_replies = self.start_tca(0)
        found, reconnect_discovery = self.wait_device(0x20, "TCA9554", timeout=12)
        ok, data = self.dut.poll_until(
            lambda d: (r := self.registry_value(d, "i2c_switch")).get("healthy") and
                      r.get("value") == 0, timeout=5, interval=0.1)
        self.record("TCA9554_RECONNECT_AND_LOW_INPUT", restarted and found and ok,
                    input=self.registry_value(data, "i2c_switch"),
                    discovery=reconnect_discovery,
                    emulator_start=reconnect_replies,
                    emulator=self.t.raw("I2CEMU STATUS"))

        if os.environ.get("I2C_ONLY_TCA") == "1":
            return

        # Hardware must remain the truth: an absent new NAU7802 cannot be assigned.
        self.t.raw("I2CEMU OFF 0")
        absent_nau, _ = self.nau_channels()
        hw = self.dut.hardware()
        hw.pop("_i2c_discovery", None)
        hw["channel_registry"]["inputs"] = [absent_nau]
        hw["channel_registry"]["outputs"] = []
        code, response = self.dut._post("/api/hardware", hw)
        self.record("ABSENT_NEW_I2C_DEVICE_REJECTED",
                    code == 409 and "not connected" in str(response).lower(),
                    code=code, response=response)

        # TLA2528: real command-register protocol and calibrated pressure value.
        self.reset_i2c_tester()
        self.t.raw("I2CEMU TLA2528 2048")
        found, detail = self.wait_device(0x10, "TLA2528")
        self.record("TLA2528_DISCOVERED", found, discovery=detail)
        tla = chan_input("p1_main", "P1 Pressure", "pressure", "p1_pressure",
                         9, -1, i2c_address=0x10, device_channel=3,
                         i2c_reference_mv=3300, analog_zero_mv=0,
                         analog_mv_per_unit=1000, filter_alpha=1,
                         min=0, max=4095)
        code, response = self.post_registry([tla], [])
        ok, data = self.dut.poll_until(
            lambda d: (r := self.registry_value(d, "p1_main")).get("healthy") and
                      1.55 <= float(r.get("value", 0)) <= 1.75,
            timeout=8, interval=0.1)
        self.record("TLA2528_LIVE_CALIBRATED_INPUT", code == 200 and ok,
                    code=code, input=self.registry_value(data, "p1_main"))
        self.t.raw("I2CEMU OFF 0")
        missing, data = self.dut.poll_until(
            lambda d: not self.registry_value(d, "p1_main").get("healthy", True),
            timeout=3, interval=0.08)
        self.record("TLA2528_DISCONNECT_INVALIDATES_INPUT", missing,
                    input=self.registry_value(data, "p1_main"))

        # NAU7802: initialization/calibration, signed 24-bit samples, both
        # channels, and torque lever-arm vs direct thrust conversion.
        # Reset the tester-side slave peripheral between different addresses.
        # This does not reset or touch the DUT; it avoids a known Arduino-ESP32
        # slave-address reinitialization quirk in the synthetic test device.
        self.reset_i2c_tester()
        emu_reply = self.t.raw("I2CEMU NAU7802 102000")
        found, detail = self.wait_device(0x2A, "NAU7802")
        self.record("NAU7802_DISCOVERED", found and emu_reply == "OK",
                    emulator=emu_reply, discovery=detail)
        self.t.raw("I2CEMU NAU7802 102000")
        torque, thrust = self.nau_channels()
        code, response = self.post_registry([torque, thrust], [])
        ok, data = self.dut.poll_until(
            lambda d: (
                (a := self.registry_value(d, "torque_main")).get("healthy") and
                (b := self.registry_value(d, "thrust_main")).get("healthy") and
                1.9 <= float(a.get("value", 0)) <= 2.1 and
                3.9 <= float(b.get("value", 0)) <= 4.1
            ), timeout=10, interval=0.1)
        status = self.t.raw("I2CEMU STATUS")
        self.record("NAU7802_ANALOG_STARTUP", "nau_init_ok=1" in status and
                    "nau_cal=03" in status, status=status)
        self.record("NAU7802_TORQUE_AND_THRUST_CALIBRATION", code == 200 and ok,
                    code=code, torque=self.registry_value(data, "torque_main"),
                    thrust=self.registry_value(data, "thrust_main"),
                    torque_raw=data.get("torque_raw"), thrust_raw=data.get("thrust_raw"))
        self.t.raw("I2CEMU OFF 0")
        missing, data = self.dut.poll_until(
            lambda d: not self.registry_value(d, "torque_main").get("healthy", True) and
                      not self.registry_value(d, "thrust_main").get("healthy", True),
            timeout=3, interval=0.08)
        self.record("NAU7802_DISCONNECT_INVALIDATES_BOTH_CHANNELS", missing,
                    torque=self.registry_value(data, "torque_main"),
                    thrust=self.registry_value(data, "thrust_main"))

    def close(self):
        try:
            self.t.raw("I2CEMU OFF 0")
        except Exception:
            pass
        self.t.set("START", 0)
        self.t.set("STOP", 0)
        self.t.set("N1", 0)
        self.dut.stop()
        self.dut.ensure_mode_standby()
        previous_boot = self.dut.data().get("boot_count")
        code, response = self.dut._post("/api/ecu_config", self.original_ecu)
        restored = code == 200 and self.r.dc._wait_reboot(previous_boot)
        if restored:
            restored = self.dut._get("/api/ecu_config") == self.original_ecu
        firmware_after = self.dut.device_info().get("firmware_version", "unknown")
        self.r.close()
        self.serial_stop.set()
        self.serial_thread.join(timeout=1)
        self.serial_port.close()
        return restored, firmware_after


def main():
    # Boot serial streams may contain arbitrary bytes; Windows' legacy stdout
    # encoding must not terminate the diagnostic capture thread.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    q = I2cQualification()
    error = None
    restored = False
    firmware_after = None
    try:
        q.run()
    except Exception as exc:  # noqa: BLE001
        error = f"{type(exc).__name__}: {exc}"
        print("ERROR:", error, flush=True)
    finally:
        try:
            restored, firmware_after = q.close()
        except Exception as exc:  # noqa: BLE001
            print("RESTORE ERROR:", exc, flush=True)
    result = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "firmware": q.r.firmware_before,
        "device": q.device,
        "tester": q.tester_version,
        "firmware_after": firmware_after,
        "rows": q.rows, "restored": restored, "error": error,
        "serial_tail": q.serial_lines[-300:],
    }
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results",
                        "i2c_devices_hil_" + datetime.now().strftime("%Y%m%d_%H%M%S") + ".json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)
    passed = sum(1 for row in q.rows if row["ok"])
    print(f"RESULT: {passed}/{len(q.rows)} I2C checks passed; restored={restored}; error={error}")
    print("Results:", os.path.abspath(path))
    # Keep focused diagnostics useful as real gates too; the full campaign has
    # fourteen checks; focused TCA reconnect has six and NAU startup has three.
    expected = (3 if os.environ.get("I2C_ONLY_NAU") == "1" else
                6 if os.environ.get("I2C_ONLY_TCA") == "1" else 14)
    return 0 if len(q.rows) == expected and passed == len(q.rows) and restored and not error else 1


if __name__ == "__main__":
    raise SystemExit(main())
