"""Dry, STANDBY-only proof of hardware-removal hard-trip cleanup.

Requires --allow-write; preserves and restores the complete original engine file.
This is a focused configuration regression, not a complete HIL qualification.
"""
import argparse
import copy
import http.client
import json
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-write', action='store_true', required=True)
    parser.add_argument('--base', default='http://192.168.4.1')
    parser.add_argument('--result', type=Path, required=True)
    parser.add_argument('--sensor', choices=['p1','p2','torque'])
    parser.add_argument('--canonical-ids', action='store_true', help='use conventional IDs instead of preserving the original card ID during purpose changes')
    args = parser.parse_args()

    def request(path, method='GET', data=None):
        req = urllib.request.Request(args.base + path,
            data=None if data is None else json.dumps(data).encode(), method=method,
            headers={'Content-Type': 'application/json', 'Connection': 'close'})
        for attempt in range(4 if method == 'GET' else 1):
            try:
                with urllib.request.urlopen(req, timeout=8 if method == 'GET' else 15) as response:
                    return json.load(response)
            except (OSError, http.client.HTTPException, json.JSONDecodeError):
                if method != 'GET' or attempt == 3:
                    raise
                time.sleep(.5)

    def recover(previous_boot):
        deadline = time.monotonic() + 90
        reconnect_at = 0
        while time.monotonic() < deadline:
            # Give association and DHCP time to finish. Reconnecting every
            # second can restart DHCP and consume AP leases with random MACs.
            if time.monotonic() >= reconnect_at:
                subprocess.run(['netsh', 'wlan', 'connect', 'name=OpenTurbine'],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=8)
                reconnect_at = time.monotonic() + 20
            try:
                d = request('/api/telemetry')
                if d.get('bc', previous_boot) > previous_boot:
                    info = request('/api/device_info')
                    if info['state'] != 'STANDBY' or info['outputs_active']:
                        data = request('/api/data')
                        raise AssertionError({**info, 'details': {key: data.get(key) for key in ['fault_description','hardware_fault','last_event','seq_issues']}})
                    return
            except (OSError, http.client.HTTPException, json.JSONDecodeError):
                pass
            time.sleep(1)
        raise RuntimeError('ECU did not return safely after reboot')

    def write_reboot(path, data, method='PATCH'):
        boot = request('/api/telemetry')['bc']
        response = request(path, method, data)
        assert response.get('ok'), response
        time.sleep(4)
        if response.get('reboot'):
            recover(boot)
        else:
            info = request('/api/device_info')
            assert info['state'] == 'STANDBY' and not info['outputs_active'], info

    info = request('/api/device_info')
    assert info['target'] in {'esp32dev','esp32s3dev'} and info['firmware_version'] == '2.5.2', info
    assert info['state'] == 'STANDBY' and not info['outputs_active'], info
    original = request('/api/ecu_config')
    args.result.parent.mkdir(parents=True, exist_ok=True)
    backup_root = Path(__file__).resolve().parents[3] / 'artifacts' / 'hardware-test-2.5.2'
    backup_root.mkdir(parents=True, exist_ok=True)
    backup = backup_root / (args.result.stem + '.original.json')
    backup.write_text(json.dumps(original, indent=2), encoding='utf8')
    inputs = original['hardware']['channel_registry']['inputs']
    p1 = [c for c in inputs if c.get('purpose') == 'p1_pressure']
    assert len(p1) == 1 and not any(c.get('purpose') in {'p2_pressure', 'torque'} for c in inputs), 'requires existing P1 and no P2/torque sensor'
    checks = []
    restored = False
    failure = None
    cases = [('p1_pressure','p1','p1_trip_bar'), ('p2_pressure','p2','p2_trip_bar'), ('torque','torque','torque_trip_nm')]
    selected = [case for case in cases if not args.sensor or case[1] == args.sensor]
    try:
        for purpose, sensor, field in selected:
            # Reuse only the existing P1 ADC connection. Each purpose is tested
            # separately; no jumpers, outputs or additional pins are assigned.
            hardware = copy.deepcopy(original['hardware'])
            row = next(c for c in hardware['channel_registry']['inputs'] if c['id'] == p1[0]['id'])
            if args.canonical_ids:
                row['id'] = sensor + '_main'
            row['purpose'] = purpose
            row['role'] = 'torque' if sensor == 'torque' else 'pressure'
            for _, key, _ in cases:
                hardware['sensors'][key]['enabled'] = key == sensor
            hardware['sensors'][sensor]['pin'] = row['pin']
            write_reboot('/api/hardware?source=hardware', hardware)
            expected = {key: 3 if key == field else 0 for _, _, key in cases}
            write_reboot('/api/config', {'safety': {key: 3 for _, _, key in cases}})
            saved = request('/api/config')['safety']
            assert all(saved[key] == value for key, value in expected.items()), saved
            checks.append(sensor + ': configured trip retained and unavailable trips disarmed')
            configured = request('/api/ecu_config')
            current = request('/api/hardware')
            current['channel_registry']['inputs'] = [c for c in current['channel_registry']['inputs'] if c['id'] != row['id']]
            current['sensors'][sensor]['enabled'] = False
            write_reboot('/api/hardware?source=hardware', current)
            settings = request('/api/config')
            assert all(settings['safety'][key] == 0 for key in expected), settings['safety']
            assert settings['engine'] == original['settings']['engine'], 'unrelated engine tuning changed'
            checks.append(sensor + ': removal disables its trip after reboot; engine tuning preserved')
            print(checks[-2], flush=True)
            print(checks[-1], flush=True)
            write_reboot('/api/ecu_config', configured, 'POST')
            restored_settings = request('/api/config')
            assert all(restored_settings['safety'][key] == value for key, value in expected.items()), restored_settings['safety']
            checks.append(sensor + ': complete engine-file restore reinstates the sensor and its positive trip')
            print(checks[-1], flush=True)
    except Exception as error:
        failure = str(error)
        raise
    finally:
        write_reboot('/api/ecu_config', original, 'POST')
        after = request('/api/ecu_config')
        assert after['hardware'] == original['hardware'], 'original hardware not restored'
        assert after['settings'] == original['settings'], 'original settings not restored'
        restored = True
        args.result.write_text(json.dumps({'device': info, 'checks': checks,
            'restored': restored, 'complete': len(checks) == 3 * len(selected),
            'purpose_ids_preserved': not args.canonical_ids,
            'failure': failure}, indent=2), encoding='utf8')
    print('Hard-trip removal HIL passed; original engine file restored.', flush=True)


if __name__ == '__main__':
    main()
