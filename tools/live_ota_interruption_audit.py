"""Unloaded-fixture check: abandoned OTA must release maintenance without reset."""
import argparse
import hashlib
import json
from pathlib import Path
import socket
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("target", choices=["esp32dev", "esp32s3dev", "esp32s3n8r2"])
    parser.add_argument("--base", default="http://192.168.4.1")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--allow-write", action="store_true", required=True)
    args = parser.parse_args()

    def get(path):
        for attempt in range(5):
            try:
                with urllib.request.urlopen(args.base+path, timeout=5) as response:
                    return json.load(response)
            except (OSError, urllib.error.URLError, json.JSONDecodeError):
                if attempt == 4:
                    raise
                time.sleep(.5)

    info = get("/api/device_info")
    assert info["target"] == args.target and info["state"] == "STANDBY"
    assert not info["outputs_active"] and info["ota_allowed"]
    before = get("/api/ecu_config")
    boot = get("/api/data")["boot_count"]
    image = Path(f".pio3/{args.target}/firmware.bin").read_bytes()
    rows = []
    for mode in ["between_chunks", "inside_http_body"]:
        start = time.monotonic()
        if mode == "between_chunks":
            request = urllib.request.Request(args.base+"/api/firmware_chunk?offset=0&final=0",
                data=image[:4096], method="POST", headers={"Connection":"close",
                    "Content-Type":"application/octet-stream"})
            with urllib.request.urlopen(request, timeout=15) as response:
                assert response.status == 202 and json.load(response).get("ok") is True
        else:
            host = urlparse(args.base)
            with socket.create_connection((host.hostname,host.port or 80), timeout=10) as sock:
                headers = ("POST /api/firmware_chunk?offset=0&final=0 HTTP/1.1\r\n"
                    f"Host: {host.netloc}\r\nContent-Length: 4096\r\n"
                    "Content-Type: application/octet-stream\r\nConnection: close\r\n\r\n").encode()
                sock.sendall(headers+image[:1024])
                time.sleep(.5)
                # Close before the declared body is complete.
        # Verify maintenance actually started, including the partial-body case.
        # A GET does not refresh the firmware upload's idle timer.
        busy_observed = False
        try:
            with urllib.request.urlopen(args.base+"/api/device_info",timeout=3) as response:
                busy_observed = not json.load(response).get("ota_allowed",True)
        except (OSError,urllib.error.URLError):
            busy_observed = True # The maintenance middleware aborts disposable GETs.
        assert busy_observed, "The interruption did not enter maintenance mode"
        # Send no further upload chunks beyond the ECU's 30-second idle limit.
        time.sleep(35)
        recovered = get("/api/device_info")
        assert recovered["state"] == "STANDBY" and recovered["ota_allowed"]
        assert recovered["build_id"] == info["build_id"] and not recovered["outputs_active"]
        assert get("/api/data")["boot_count"] == boot
        assert get("/api/ecu_config") == before
        rows.append({"mode":mode,"elapsed_s":round(time.monotonic()-start,2),
                     "passed":True,"maintenance_observed":busy_observed,
                     "no_reboot":True,"configuration_unchanged":True})
        print("PASS",mode,"maintenance recovered without reboot",flush=True)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps({"device":info,"firmware_sha256":hashlib.sha256(image).hexdigest(),
        "rows":rows,"passed":True},indent=2),encoding="utf-8")


if __name__ == "__main__":
    main()
