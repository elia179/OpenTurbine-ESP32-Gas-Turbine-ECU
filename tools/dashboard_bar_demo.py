"""Drive the wired S3 OTBench N1/N2 pulse outputs for the Classic dashboard demo.

The ECU must be a no-load bench unit with N1/N2 safety disabled. This program
never commands START or any ECU actuator; stop it to return both RPM lines to 0.
"""
import argparse
import math
import pathlib
import sys
import time
import json
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'dev' / 'bench' / 'harness'))
from otbench.tester import Tester


def check_ecu(base):
    def read(path):
        with urllib.request.urlopen(base + path, timeout=4) as response:
            return json.load(response)

    info = read('/api/device_info')
    data = read('/api/data')
    hardware = read('/api/hardware')
    if info.get('target') != 'esp32dev' or info.get('firmware_version') != '2.4.2':
        raise RuntimeError('the connected ECU is not the expected Classic 2.4.2 bench target')
    if info.get('state') != 'STANDBY' or info.get('outputs_active'):
        raise RuntimeError('ECU is not in STANDBY with all outputs inactive')
    if data.get('rpm_limit_active') or data.get('n2_limit_active'):
        raise RuntimeError('N1/N2 shutdown protection is active; refusing advisory overshoot demo')
    if hardware.get('actuators', {}).get('status_led', {}).get('enabled'):
        raise RuntimeError('status LED is enabled')
    if not data.get('has_n1') or not data.get('has_n2'):
        raise RuntimeError('both physical RPM inputs must be configured')
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', default='COM4')
    parser.add_argument('--n1-limit', type=float, default=60000)
    parser.add_argument('--n2-limit', type=float, default=50000)
    parser.add_argument('--ecu', default='http://192.168.4.1')
    args = parser.parse_args()
    if args.n1_limit <= 0 or args.n2_limit <= 0:
        parser.error('both dashboard reference limits must be positive')
    initial = check_ecu(args.ecu)
    if initial.get('rpm_limit') != args.n1_limit or initial.get('n2_limit') != args.n2_limit:
        parser.error('requested limits do not match the live ECU dashboard references')

    with Tester(args.port) as tester:
        print(tester.ping(), flush=True)
        tester.set('START', 0)
        tester.set('STOP', 0)
        started = time.monotonic()
        last_check = started
        try:
            while True:
                now = time.monotonic()
                if now - last_check >= 5:
                    current = check_ecu(args.ecu)
                    if current.get('rpm_limit') != args.n1_limit or current.get('n2_limit') != args.n2_limit:
                        raise RuntimeError('the ECU dashboard references changed during the demo')
                    last_check = now
                # 40%-112% of the configured references in a 30-second loop.
                # The matching ECU profile treats both colours as visual
                # advisories, so crossing 100% cannot trigger a shutdown.
                fraction = 0.76 + 0.36 * math.sin(2 * math.pi * (now - started) / 30)
                tester.set('N1', f'{args.n1_limit * fraction / 60:.1f}')
                tester.set('N2', f'{args.n2_limit * fraction / 60:.1f}')
                time.sleep(0.25)
        finally:
            tester.set('N1', 0)
            tester.set('N2', 0)


if __name__ == '__main__':
    main()
