"""Short no-load S3/OTBench signal check; requires the classic tester on COM3."""
import json
import sys
import time
import urllib.request

sys.path.insert(0, 'dev/bench/harness')
from otbench.tester import Tester

BASE = 'http://192.168.4.1'

def read(route):
    with urllib.request.urlopen(BASE + route, timeout=8) as response:
        return json.load(response)

def command(name):
    body = json.dumps({'cmd': name}).encode()
    req = urllib.request.Request(BASE + '/api/command', body,
                                 {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=8) as response:
        result = json.load(response)
    if result.get('ok') is False:
        raise RuntimeError(f'{name} rejected: {result}')

def wait_value(key, predicate, seconds=3):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        value = read('/api/data').get(key)
        if predicate(value):
            return value
        time.sleep(.1)
    raise AssertionError(f'{key} did not reach expected state')

def check():
    info = read('/api/device_info')
    cfg = read('/api/ecu_config')
    assert info['target'] == 'esp32s3dev' and info['state'] == 'STANDBY'
    assert not info['outputs_active']
    assert cfg['hardware']['actuators']['status_led']['enabled'] is False
    assert cfg['hardware']['actuators']['glow_plug']['pin'] == 4
    assert cfg['hardware']['actuators']['igniter']['pin'] == 21
    assert cfg['hardware']['actuators']['oil_pump']['pin'] == 11
    assert cfg['hardware']['controls']['stop_pin'] == 15
    with Tester('COM3') as tester:
        assert tester.ping().startswith('OK OTBench')
        assert tester.get_level('IGNITER') == 0
        tester.set('STOP', 1)
        try:
            wait_value('stop_switch_active', bool)
        finally:
            tester.set('STOP', 0)
        wait_value('stop_switch_active', lambda v: v is False)
        print('Wired STOP input asserted and released.')

        command('IGN_TEST')
        wait_value('igniter_on', bool)
        assert tester.get_level('IGNITER') == 1, 'wired igniter output did not go high'
        wait_value('igniter_on', lambda v: v is False, 5)
        assert tester.get_level('IGNITER') == 0, 'igniter did not turn off'
        print('Igniter relay command reached tester and shut off on time.')

        command('OIL_PRIME')
        wait_value('oil_pct', lambda v: isinstance(v, (int, float)) and v > 0)
        assert tester.get('OILPUMP_OUT').get('duty', 0) > .05, 'wired oil PWM not seen'
        wait_value('oil_pct', lambda v: v == 0, 8)
        print('Oil-pump PWM reached tester and stopped.')

        command('GLOW_TEST')
        wait_value('glow_plug_pct', lambda v: isinstance(v, (int, float)) and v > 0)
        wait_value('glow_plug_pct', lambda v: v == 0, 14)
        print('Unloaded GPIO4 glow relay demand turned on and timed out (telemetry only).')

    final = read('/api/device_info')
    assert final['state'] == 'STANDBY' and not final['outputs_active']
    assert not read('/api/ecu_config')['hardware']['actuators']['status_led']['enabled']
    print('S3 no-load bench smoke passed; STANDBY, outputs inactive, LED disabled.')

if __name__ == '__main__':
    check()
