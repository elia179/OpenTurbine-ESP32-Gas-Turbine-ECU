"""Sweep an OTBench NAU7802 slave through the actual ECU calibration path.

Requires OTBench 0.15, generic DUT mode, and the existing unloaded I2C loom.
This qualifies the digital path, not the analog bridge or physical mounting.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import sys
import time

from i2c_devices_hil import I2cQualification


class NauLinearity(I2cQualification):
    def prepare_reset_probe(self):
        self.r.apply_profile({"id":"nau_reset", "name":"NAU reset",
                              "build":self.bus_profile}, fast_config=False)
        self.t._reset_board()
        self.t.ping()
        assert self.t.raw("I2CEMU NAU7802 -65537") == "OK"
        assert self.wait_device(0x2A,"NAU7802")[0]
        a,b=self.nau_channels()
        a.update(loadcell_zero=1234567,loadcell_n_per_count=.002,lever_arm_m=.5)
        b.update(loadcell_zero=-65537,loadcell_n_per_count=.0001)
        code,response=self.post_registry([a,b],[])
        if code != 200:
            raise AssertionError(response)

    def sample(self, raw_a, raw_b, force=None, torque=None, timeout=8):
        reply = self.t.raw(f"NAURAW {raw_a} {raw_b}")
        if reply != "OK":
            raise RuntimeError(reply)
        deadline = time.monotonic() + timeout
        last = {}
        while time.monotonic() < deadline:
            data = self.dut.data()
            a = self.registry_value(data, "torque_main")
            b = self.registry_value(data, "thrust_main")
            last = {"torque": a, "thrust": b}
            if (a.get("healthy") and b.get("healthy") and
                    a.get("raw") == raw_a and b.get("raw") == raw_b and
                    (force is None or math.isclose(b.get("value", math.inf), force, abs_tol=.02)) and
                    (torque is None or math.isclose(a.get("value", math.inf), torque, abs_tol=.02))):
                return last
            time.sleep(.08)
        raise AssertionError(f"Expected raw={raw_a,raw_b}, force={force}, torque={torque}; got {last}")

    def run(self):
        self.r.apply_profile({"id": "nau_linearity", "name": "NAU linearity",
                              "build": self.bus_profile}, fast_config=False)
        self.t._reset_board()
        self.t.ping()
        assert self.t.raw("I2CEMU NAU7802 -65537") == "OK"
        found, detail = self.wait_device(0x2A, "NAU7802")
        if not found:
            raise AssertionError(f"NAU not discovered: {detail}")
        torque, thrust = self.nau_channels()
        torque.update(loadcell_zero=1234567, loadcell_n_per_count=.002, lever_arm_m=.5)
        thrust.update(loadcell_zero=0, loadcell_n_per_count=1)
        code, response = self.post_registry([torque, thrust], [])
        if code != 200:
            raise AssertionError(response)
        for polarity in [-1, 1]:
            zero = -polarity * 65537
            known = zero + polarity * 2000000
            unloaded = self.sample(1234567, zero)
            captured_zero = unloaded["thrust"]["raw"]
            loaded = self.sample(1244567, known)
            captured_known = loaded["thrust"]["raw"]
            scale = 200 / (captured_known - captured_zero)
            patch = {"channel_registry_calibration": {
                "id": "thrust_main", "loadcell_zero": captured_zero,
                "loadcell_n_per_count": scale}}
            code, response = self.dut._body("/api/hardware", patch, "PATCH")
            if code != 200:
                raise AssertionError(response)
            self.sample(1244567, known, force=200, torque=10)
            saved = next(c for c in self.dut.hardware()["channel_registry"]["inputs"]
                         if c["id"] == "thrust_main")
            if saved["loadcell_zero"] != zero or not math.isclose(saved["loadcell_n_per_count"], scale, rel_tol=1e-5):
                raise AssertionError(f"Saved calibration changed: {saved}")
            rows = []
            for count in [0, 1, 255, 256, 257, 65535, 65536, 65537, 65538,
                          500000, 1000000, 1500000, 2000000, 2500000, 3000000,
                          2500000, 2000000, 1000000, 10000, 0, -10000]:
                expected = count / 10000
                sample = self.sample(1244567, zero + polarity * count, expected, 10)
                rows.append({"expected_N": expected, "sample": sample})
            self.record(f"ZERO_200N_SWEEP_POLARITY_{polarity}", True,
                        zero=zero, scale=scale, samples=rows)
        # The two channels must stay independent despite different raw sign,
        # calibration, purpose and load changes.
        rows = []
        for a in [-1234567, -1, 0, 1, 65535, 65536, 1234567, 1244567]:
            b = -65537 + 750000
            rows.append(self.sample(a, b, 75, (a - 1234567) * .001))
        self.record("INDEPENDENT_TORQUE_AND_THRUST", True, samples=rows)
        self.sample(1244567, -65537 + 2000000, 200, 10)
        old_boot = self.dut.data().get("boot_count")
        self.serial_port.dtr = False
        self.serial_port.rts = True
        time.sleep(.15)
        self.serial_port.rts = False
        if not self.r.wait_dut_ready_after_hardware_save(previous_boot_count=old_boot):
            raise AssertionError("DUT failed to return after under-load restart")
        self.record("SAVED_CALIBRATION_AFTER_RESTART_UNDER_LOAD", True,
                    loaded=self.sample(1244567, -65537 + 2000000, 200, 10),
                    unloaded=self.sample(1244567, -65537, 0, 10))
        # Saturation must become unhealthy and must not poison later samples.
        assert self.t.raw("NAURAW 1244567 8388607") == "OK"
        ok, data = self.dut.poll_until(lambda d: not self.registry_value(d, "thrust_main").get("healthy", True), timeout=3)
        if not ok:
            raise AssertionError("Saturated thrust stayed healthy")
        recovered = self.sample(1254567, -65537 + 1000000, 100, 20)
        self.record("SATURATION_AND_RECOVERY", True, recovered=recovered)

    def run_rates(self):
        rows = []
        for rate in [10, 20, 40, 80, 320]:
            a, b = self.nau_channels()
            a.update(loadcell_zero=1234567, loadcell_n_per_count=.002, lever_arm_m=.5,
                     loadcell_rate_sps=rate)
            b.update(loadcell_zero=-65537, loadcell_n_per_count=.0001,
                     loadcell_rate_sps=rate)
            assert self.t.raw("NAURAW 1244567 1934463") == "OK"
            code, response = self.post_registry([a, b], [])
            if code != 200:
                raise AssertionError(response)
            values = [self.sample(1244567,1934463,200,10)]
            end = time.monotonic() + 1.5
            while time.monotonic() < end:
                data = self.dut.data()
                channels = [self.registry_value(data,id_) for id_ in ["torque_main","thrust_main"]]
                if not all(c.get("healthy") for c in channels):
                    raise AssertionError(f"Rate {rate} lost channel health: {channels}")
                time.sleep(.08)
            values.append(self.sample(1234567,-65537,0,0))
            rows.append({"rate_sps":rate,"samples":values})
        self.record("ALL_SAMPLE_RATES_DUAL_CHANNEL", True, rates=rows)

    def run_adc_reset(self):
        self.sample(1244567, -65537, 0, 10)
        boot = self.dut.data().get("boot_count")
        assert self.t.raw("NAURESET") == "OK"
        time.sleep(.7) # Previous telemetry must not count as recovery.
        recovered = self.sample(1254567, -65537 + 1000000, 100, 20)
        if self.dut.data().get("boot_count") != boot:
            raise AssertionError("ADC recovery unexpectedly reset the ESP")
        self.record("ADC_ONLY_RESET_REINITIALIZES_WITHOUT_ESP_REBOOT", True,
                    recovered=recovered)


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--rates", action="store_true")
    parser.add_argument("--adc-reset", action="store_true")
    parser.add_argument("--reset-only", action="store_true")
    args = parser.parse_args()
    q = NauLinearity()
    error = None
    restored = False
    after = None
    try:
        if args.reset_only:
            q.prepare_reset_probe()
            q.run_adc_reset()
        else:
            q.run()
            if args.rates:
                q.run_rates()
            if args.adc_reset:
                q.run_adc_reset()
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
        print("ERROR:", error, flush=True)
    finally:
        try:
            restored, after = q.close()
        except Exception as exc:
            error = f"{error or ''}; restore: {type(exc).__name__}: {exc}"
    result = {"firmware": q.device, "tester": q.tester_version, "rows": q.rows,
              "error": error, "restored": restored, "firmware_after": after,
              "serial_tail": q.serial_lines[-150:]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    expected = 1 if args.reset_only else 5 + int(args.rates) + int(args.adc_reset)
    print(f"RESULT: {len(q.rows)}/{expected} groups; restored={restored}; error={error}", flush=True)
    return 0 if len(q.rows) == expected and restored and not error else 1


if __name__ == "__main__":
    raise SystemExit(main())
