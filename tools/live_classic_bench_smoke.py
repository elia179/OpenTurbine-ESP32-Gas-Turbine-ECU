"""Role-reversed no-load I/O check: classic DUT, S3 OTBench on COM4."""
import copy
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, 'dev/bench/harness')
from otbench.tester import Tester

BASE = 'http://192.168.4.1'

def read(route):
    with urllib.request.urlopen(BASE + route, timeout=8) as response:
        return json.load(response)

def post(route, value):
    req = urllib.request.Request(BASE + route, json.dumps(value).encode(),
                                 {'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f'{route}: HTTP {error.code}: {error.read().decode(errors="replace")[:500]}') from error
    if result.get('ok') is False:
        raise RuntimeError(f'{route} rejected: {result}')
    return result

def wait_for(predicate, seconds=35):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            value = predicate()
            if value:
                return value
        except (OSError, ValueError):
            pass
        time.sleep(.2)
    raise AssertionError('timed out waiting for classic ECU state')

def command(name):
    return post('/api/command', {'cmd': name})

def channel_from(source, ident, name, role, purpose, driver, pin):
    channel = copy.deepcopy(source)
    channel.update(id=ident, name=name, role=role, purpose=purpose,
                   driver=driver, pin=pin, active_high=True, invert=False)
    channel['has_current'] = False
    channel['current_pin'] = -1
    return channel

def check():
    info = read('/api/device_info')
    assert info['target'] == 'esp32dev' and info['state'] == 'STANDBY'
    assert not info['outputs_active']
    backup_arg = next((arg.split('=', 1)[1] for arg in sys.argv[1:]
                       if arg.startswith('--original=')), None)
    original = (json.loads(pathlib.Path(backup_arg).read_text(encoding='utf-8-sig'))['hardware']
                if backup_arg else read('/api/hardware'))
    assert original['actuators']['status_led']['enabled'] is False
    registry = original['channel_registry']
    base_fuel = next(row for row in registry['outputs'] if row['id'] == 'main_fuel')
    base_oil = next(row for row in registry['outputs'] if row['id'] == 'oil_pump_main')
    base_igniter = next(row for row in registry['outputs'] if row['id'] == 'igniter')
    if not backup_arg and any(row['id'] == 'glow_plug' and row['pin'] == 22
                              for row in registry['outputs']):
        raise RuntimeError('The temporary fixture is already installed; pass --original=<saved engine file>')
    fixture = copy.deepcopy(original)
    fixture['channel_registry']['outputs'] = [
        channel_from(base_fuel, 'main_fuel', 'Main Fuel Metering', 'fuel', 'main_fuel', 6, 17),
        channel_from(base_oil, 'oil_pump_main', 'Oil Pump', 'oil_pump', 'oil_pump', 5, 21),
        channel_from(base_igniter, 'igniter', 'Igniter', 'igniter', 'igniter', 4, 23),
        channel_from(base_igniter, 'glow_plug', 'Glow Plug', 'glow_plug', 'glow_plug', 4, 22),
    ]
    fixture['actuators']['status_led'].update(enabled=False, pin=-1)
    # The existing STOP jumper is S3 GPIO15 ↔ classic GPIO14.
    fixture['controls'].update(start_pin=13, stop_pin=14)
    installed = False
    try:
        current = read('/api/hardware')
        if [(row['id'], row['pin']) for row in current['channel_registry']['outputs']] != [
            ('main_fuel', 17), ('oil_pump_main', 21), ('igniter', 23), ('glow_plug', 22)
        ]:
            post('/api/hardware', fixture)
        installed = True
        wait_for(lambda: (h if (h := read('/api/hardware'))['actuators']['glow_plug']['pin'] == 22 else None))
        time.sleep(3)
        assert read('/api/device_info')['state'] == 'STANDBY'
        with Tester('COM4') as tester:
            assert tester.ping().startswith('OK OTBench')
            tester.set('STOP', 1)
            try:
                wait_for(lambda: read('/api/data').get('stop_switch_active'))
            finally:
                tester.set('STOP', 0)
            wait_for(lambda: read('/api/data').get('stop_switch_active') is False)
            print('Classic wired STOP input asserted and released.')

            command('IGN_TEST')
            wait_for(lambda: read('/api/data').get('igniter_on'))
            assert tester.get_level('IGNITER') == 1
            wait_for(lambda: read('/api/data').get('igniter_on') is False, 6)
            assert tester.get_level('IGNITER') == 0
            print('Classic igniter relay reached S3 tester and timed out.')

            command('OIL_PRIME')
            wait_for(lambda: read('/api/data').get('oil_pct', 0) > 0)
            assert tester.get('OILPUMP_OUT').get('duty', 0) > .05
            wait_for(lambda: read('/api/data').get('oil_pct', 0) == 0, 9)
            print('Classic oil-pump PWM reached S3 tester and stopped.')

            command('GLOW_TEST')
            wait_for(lambda: read('/api/data').get('glow_plug_pct', 0) > 0)
            assert tester.get_level('FUEL_SOL') == 1, 'mapped glow GPIO22 not seen at tester'
            wait_for(lambda: read('/api/data').get('glow_plug_pct', 0) == 0, 14)
            assert tester.get_level('FUEL_SOL') == 0
            print('Classic glow relay reached S3 tester and timed out.')
    finally:
        if installed:
            for attempt in range(20):
                try:
                    post('/api/hardware', original)
                    break
                except RuntimeError as error:
                    if 'HTTP 409' not in str(error) or attempt == 19:
                        raise
                    time.sleep(1)
            wait_for(lambda: (h if (h := read('/api/hardware'))['channel_registry'] == registry else None), 50)
            final = read('/api/device_info')
            assert final['state'] == 'STANDBY' and not final['outputs_active']
            assert not read('/api/hardware')['actuators']['status_led']['enabled']
            print('Original classic hardware restored; STANDBY, outputs inactive, LED disabled.')

if __name__ == '__main__':
    check()
