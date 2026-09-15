"""Physical two-pickup 2.4 phase-torque acceptance on the wired bench.

The tester's PHASE command clocks both existing RPM jumpers from one clock.
This script checks measured frequency/angle, independent pickup loss,
calibration, all optional shaft-speed choices, and cross-owner rejection.
It leaves the DUT with Torque Shaft Speed enabled and the signals running.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import time
import urllib.error
import urllib.request

import serial


def get(base, path):
    with urllib.request.urlopen(base + path, timeout=12) as response:
        return json.load(response)


def post(base, path, document):
    request = urllib.request.Request(
        base + path, data=json.dumps(document, separators=(",", ":")).encode(),
        method="POST", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


def reconnect(base, profile):
    for attempt in range(40):
        if attempt % 4 == 0:
            subprocess.run(["netsh", "wlan", "connect", f"name={profile}",
                            f"ssid={profile}", "interface=Wi-Fi"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           check=False)
        try:
            info = get(base, "/api/device_info")
            if info.get("firmware_version") != "2.4.0-dev":
                raise AssertionError(f"unexpected DUT version: {info}")
            return
        except (OSError, TimeoutError, urllib.error.URLError):
            time.sleep(.8)
    raise AssertionError("DUT did not return from configuration reboot")


def by_id(hw, channel_id):
    return next(c for c in hw["channel_registry"]["inputs"] if c["id"] == channel_id)


def set_source(hw, source):
    inputs = hw["channel_registry"]["inputs"]
    torque = by_id(hw, "torque_main")
    torque["phase_speed_source"] = source
    inputs[:] = [c for c in inputs if c["id"] != "torque_shaft_speed"]
    for key in ("n1_rpm", "n2_rpm"):
        hw["sensors"][key]["enabled"] = False
        hw["sensors"][key]["pin"] = -1
    if source in (1, 2):
        key = "n1_rpm" if source == 1 else "n2_rpm"
        hw["sensors"][key].update(enabled=True, pin=torque["pin"], ppr=1)
    if source == 3:
        inputs.append(dict(id="torque_shaft_speed", name="Torque Shaft Speed",
                           role="speed", purpose="shaft_speed", driver=2,
                           installed=True, pin=torque["pin"],
                           mirror_of="torque_main", pulses_per_unit=1,
                           min=0, max=200000))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", default="COM4")
    parser.add_argument("--base", default="http://192.168.4.1")
    parser.add_argument("--wifi-profile", default="OpenTurbine")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    uart = serial.Serial(baudrate=115200, timeout=.3)
    uart.port, uart.dtr, uart.rts = args.port, False, False
    uart.open()
    time.sleep(.3)
    uart.read(1000)
    passed = []

    def tester(command):
        uart.write((command + "\n").encode())
        deadline = time.monotonic() + 3
        while time.monotonic() < deadline:
            line = uart.readline().decode(errors="replace").strip()
            if line == "OK":
                return
            if line.startswith("ERR"):
                raise AssertionError(f"tester {command}: {line}")
        raise AssertionError(f"tester timed out: {command}")

    def record(name, condition, detail=""):
        assert condition, f"{name}: {detail}"
        passed.append(name)
        print(f"PASS {name}: {detail}", flush=True)

    def save(hw):
        code, body = post(base, "/api/hardware", hw)
        assert code == 200 and '"ok":true' in body, f"save rejected: {code} {body}"
        reconnect(base, args.wifi_profile)
        return get(base, "/api/hardware")

    def sample():
        time.sleep(1.6)
        return get(base, "/api/data")

    def companion(d):
        return next((c for c in d["registry_inputs"] if c["id"] == "torque_shaft_speed"), None)

    try:
        reconnect(base, args.wifi_profile)
        hw = get(base, "/api/hardware")
        record("phase installation", by_id(hw, "torque_main")["torque_interface"] == 2,
               f"ref={by_id(hw, 'torque_main')['pin']} phase={by_id(hw, 'torque_main')['phase_pin']}")
        if by_id(hw, "torque_main")["phase_speed_source"] != 3:
            set_source(hw, 3)
            hw = save(hw)
        tester("PHASE 5 72 3")
        d = sample()
        speed = companion(d)
        record("5 Hz same-timer capture", bool(speed and speed["healthy"] and
               abs(speed["value"] - 300) < 8), f"RPM={speed}")
        record("angular torque and power", d["torque_healthy"] and
               abs(d["torque"] - 36) < 3 and abs(d["turbo_power_w"] - 1131) < 130,
               f"torque={d['torque']} power={d['turbo_power_w']}")
        tester("PHASE 10 36 3")
        d = sample()
        speed = companion(d)
        record("10 Hz speed changes without torque recalibration",
               bool(speed and speed["healthy"] and abs(speed["value"] - 600) < 15 and
                    d["torque_healthy"] and abs(d["torque"] - 18) < 3),
               f"RPM={speed['value'] if speed else None} torque={d['torque']}")
        tester("PHASE 10 36 1")
        d = sample()
        speed = companion(d)
        record("missing phase preserves reference speed",
               bool(speed and speed["healthy"] and abs(speed["value"] - 600) < 15 and
                    not d["torque_healthy"] and d["turbo_power_w"] is None))
        tester("PHASE 10 36 2")
        d = sample()
        speed = companion(d)
        record("missing reference invalidates both",
               bool(speed and not speed["healthy"] and not d["torque_healthy"]))
        tester("PHASE 10 36 3")

        hw = get(base, "/api/hardware")
        by_id(hw, "torque_main")["phase_zero_deg"] = 36
        hw = save(hw)
        d = sample()
        record("zero phase calibration", d["torque_healthy"] and abs(d["torque"]) < 3,
               f"torque={d['torque']}")
        by_id(hw, "torque_main").update(phase_zero_deg=0, phase_deg_per_nm=3)
        hw = save(hw)
        d = sample()
        record("direct sensitivity / known-torque point",
               d["torque_healthy"] and abs(d["torque"] - 12) < 3,
               f"torque={d['torque']}")
        by_id(hw, "torque_main").update(phase_zero_deg=0, phase_deg_per_nm=2)

        set_source(hw, 0)
        hw = save(hw)
        d = sample()
        record("torque-only publishes no speed or power",
               d["torque_healthy"] and companion(d) is None and
               d["turbo_power_w"] is None, f"torque={d['torque']}")
        for source, name in ((1, "N1"), (2, "N2")):
            set_source(hw, source)
            hw = save(hw)
            d = sample()
            key = "n1" if source == 1 else "n2"
            record(f"explicit {name} speed and power", d[f"{key}_healthy"] and
                   abs(d[key] - 600) < 15 and d["turbo_power_w"] is not None,
                   f"{key}={d[key]} power={d['turbo_power_w']}")
            conflicting = json.loads(json.dumps(hw))
            conflicting["channel_registry"]["inputs"].append(dict(
                id=f"other_{key}", name=f"Other {name}", role="speed",
                purpose=f"{key}_speed", driver=2, installed=True, pin=27,
                pulses_per_unit=1, min=0, max=100000))
            code, body = post(base, "/api/hardware", conflicting)
            reconnect(base, args.wifi_profile)
            record(f"{name} duplicate owner rejected", code != 200 and
                   by_id(get(base, "/api/hardware"), "torque_main")["phase_speed_source"] == source,
                   f"HTTP {code}: {body[:100]}")

        set_source(hw, 3)
        hw = save(hw)
        d = sample()
        speed = companion(d)
        record("virtual torque shaft speed restored", bool(speed and speed["healthy"] and
               abs(speed["value"] - 600) < 15))
        print(f"{len(passed)} physical checks passed; DUT left at torque shaft speed", flush=True)
    finally:
        uart.close()


if __name__ == "__main__":
    main()
