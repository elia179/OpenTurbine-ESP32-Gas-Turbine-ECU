#!/usr/bin/env python3
"""Reliably install generated web assets without replacing LittleFS.

The ECU deliberately accepts small, ordered requests so a Classic ESP32 never
has to buffer the complete UI. Individual chunks are offset-idempotent, so a
lost response can be retried without writing the same flash range twice.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import time
import urllib.parse
import urllib.error
import urllib.request


ASSETS = (
    "calibration.html.gz", "controllers.html.gz", "hardware.html.gz",
    "index.html.gz", "log.html.gz", "sequence.html.gz", "app.js.gz",
    "style.css.gz", "system.html.gz", "theme.js.gz", "ui_dialog.js.gz",
    "tools.html.gz",
)


def post_chunk(endpoint: str, name: str, offset: int, payload: bytes, final: bool,
               timeout: float) -> dict:
    query = urllib.parse.urlencode({"name": name, "offset": offset,
                                    "final": 1 if final else 0})
    request = urllib.request.Request(
        endpoint + "?" + query, data=payload, method="POST",
        headers={"Content-Type": "application/octet-stream",
                 "Connection": "close"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        result = json.loads(response.read().decode("utf-8"))
    if not result.get("ok"):
        raise RuntimeError(result.get("error") or "asset chunk was rejected")
    return result


def upload_once(base: str, data_dir: Path, chunk_size: int, timeout: float,
                replay_first: bool, replay_final: bool) -> None:
    endpoint = base.rstrip("/") + "/api/web_asset_chunk"
    total = sum((data_dir / name).stat().st_size for name in ASSETS)
    sent = 0
    replay_checked = False
    for name in ASSETS:
        payload = (data_dir / name).read_bytes()
        for offset in range(0, len(payload), chunk_size):
            chunk = payload[offset:offset + chunk_size]
            final = offset + len(chunk) == len(payload)
            last_error = None
            for attempt in range(5):
                try:
                    post_chunk(endpoint, name, offset, chunk, final, timeout)
                    break
                except urllib.error.HTTPError:
                    # Explicit ECU rejection is authoritative; only retry when
                    # it is unknown whether the response was delivered.
                    raise
                except Exception as error:
                    last_error = error
                    if attempt == 4:
                        raise
                    time.sleep(0.8)
            else:  # pragma: no cover - loop either breaks or raises
                raise last_error
            if replay_first and not replay_checked and not final:
                replay = post_chunk(endpoint, name, offset, chunk, final, timeout)
                if not replay.get("replayed"):
                    raise RuntimeError(f"Web asset chunk replay was not acknowledged: {replay}")
                replay_checked = True
                print("first chunk replay acknowledged; ", end="", flush=True)
            if replay_final and name == ASSETS[-1] and final:
                replay = post_chunk(endpoint, name, offset, chunk, final, timeout)
                if not replay.get("replayed") or not replay.get("reboot"):
                    raise RuntimeError(f"Final web asset replay was not acknowledged: {replay}")
                print("final chunk replay acknowledged; ", end="", flush=True)
            sent += len(chunk)
            print(f"\r{sent * 100 // total:3d}%  {name:<24}", end="", flush=True)
            time.sleep(0.08)
    print()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://192.168.4.1")
    parser.add_argument("--data", type=Path, default=Path("data"))
    parser.add_argument("--attempts", type=int, default=3)
    parser.add_argument("--chunk-size", type=int, default=4096)
    parser.add_argument("--timeout", type=float, default=20)
    parser.add_argument(
        "--replay-first",
        action="store_true",
        help="bench proof: resend the first non-final chunk and require an idempotent acknowledgement",
    )
    parser.add_argument(
        "--replay-final",
        action="store_true",
        help="bench proof: resend the completed generation's final chunk before reboot",
    )
    args = parser.parse_args()

    missing = [name for name in ASSETS if not (args.data / name).is_file()]
    if missing:
        raise SystemExit("missing generated assets: " + ", ".join(missing))
    for attempt in range(1, args.attempts + 1):
        try:
            upload_once(args.base, args.data, args.chunk_size, args.timeout,
                        args.replay_first, args.replay_final)
            print("Web assets accepted; ECU is restarting.")
            return 0
        except Exception as error:
            if attempt == args.attempts:
                raise
            print(f"\nAttempt {attempt} interrupted: {error}")
            print("Waiting for the ECU to release the incomplete generation…")
            time.sleep(35)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
