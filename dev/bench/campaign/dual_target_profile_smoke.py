"""Dry profile/I/O regression on the existing two-board fixture.

This is deliberately not the full release-signoff or a fueled-run certificate.
Preserves the complete engine file; records the actual installed build ID.
"""
import argparse
import json
import os
from pathlib import Path
import sys
import time

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / 'harness'))
from ten_build_webui_hil import TenBuildRunner, hz


class ProfileSmoke(TenBuildRunner):
    def __init__(self, target, port, expected_version):
        self.target = target
        super().__init__(port)
        self.original_ecu = self.dut._get('/api/ecu_config')
        self.identity = self.dut.device_info()
        self.tester_version = self.t.ping()
        assert self.identity['target'] == ('esp32dev' if target == 'classic' else 'esp32s3dev'), self.identity
        assert self.identity['firmware_version'] == expected_version, self.identity

    def profile(self, hw, variant):
        for bus in ('i2c','spi'):
            hw[bus]['enabled'] = False
            for key in hw[bus]:
                if key.endswith('_pin'):
                    hw[bus][key] = -1
        self.common_turbine(hw, with_throttle_input=False,
                            with_oil=variant != 'turboprop')
        hw['sensors']['idle_input']['rc_pwm'] = True
        self.enable_n1(hw)
        hw['safety']['overspeed'] = True
        if variant != 'turbojet':
            self.enable_n2(hw)
            hw['controllers']['governor'] = True
        if variant == 'turboprop':
            hw['actuators']['prop_pitch'].update(enabled=True, pin=11, type=1,
                freq_hz=5000, res_bits=12, pwm_min_pct=0, pwm_max_pct=100)
        # Keep ignition present during the measured RUNNING window, and make
        # startup long enough that HTTP sampling cannot miss its STARTUP state.
        hw['startup_seq'] = ['OilPumpOn', 'IgniterOn', 'FuelPumpIdle', 'FuelOpen', 'TimedDelay']
        hw['startup_delay_ms'] = [0, 0, 0, 0, 1500]
        if variant == 'turboprop':
            hw['startup_seq'][0] = 'TimedDelay'
        hw['startup_ignition_target'] = [0] * 5
        hw['startup_enter_actions'] = [[] for _ in range(5)]
        hw['startup_exit_actions'] = [[] for _ in range(5)]
        if self.target == 'classic':
            pins = {13:13, 15:14, 14:4, 8:18, 5:32, 40:17, 11:21, 12:22, 21:23, 39:33}
            def remap(value):
                if isinstance(value, dict):
                    for key, item in value.items():
                        if (key == 'pin' or key.endswith('_pin')) and isinstance(item, int) and item >= 0:
                            if item not in pins:
                                raise ValueError(f'Unmapped fixture pin {key}={item}')
                            value[key] = pins[item]
                        else:
                            remap(item)
                elif isinstance(value, list):
                    for item in value:
                        remap(item)
            remap(hw)
            hw['platform'] = 'esp32'

    def test_standard_tools(self, checks, extra_tools):
        hw = self.dut.hardware()
        for actuator, cmd, signal, kind in [
            ('oil_pump','OIL_PRIME','OILPUMP_OUT','pwm'),
            ('fuel_sol','FUEL_SOL_TEST','FUEL_SOL','level'),
            ('igniter','IGN_TEST','IGNITER','level'),
            ('throttle','SET_THROTTLE_PCT','THROTTLE_OUT','servo'),
            ('prop_pitch','PROP_PITCH_TEST','OILPUMP_OUT','pwm')]:
            if hw['actuators'][actuator]['enabled']:
                self.fire_tool(checks, cmd, signal, kind, actuator,
                               fparam=50 if actuator == 'throttle' else 0)
        self.dut.stop()
        self.dut.ensure_mode_standby()

    def test_run(self, checks):
        self.safe_standby()
        self.dut.ensure_dev_mode(True)
        assert not self.dut.data().get('bench_mode'), 'Safety-bypassing Bench Mode must remain off'
        self.t.set('N1', hz(60000))
        self.t.set('N2', hz(30000))
        self.t.set('IDLE_IN', 1500)
        time.sleep(1.2)
        code, reply = self.dut.start()
        self.check(checks, 'normal START accepted', code == 200, str(reply))
        if code != 200:
            snapshot = {'telemetry': self.dut._get('/api/data'), 'status': self.dut.status(),
                        'tester': self.t.state(), 'hardware': self.dut.hardware(),
                        'settings': self.dut.config(), 'reply': reply}
            diag_dir = Path(os.environ.get('OTBENCH_ARTIFACT_DIR', 'artifacts/bench-profile-smoke'))
            diag_dir.mkdir(parents=True, exist_ok=True)
            (diag_dir / f'{self.target}-start-rejection.json').write_text(json.dumps(snapshot, indent=2))
            self.log('Start feedback: ' + str({k:v for k,v in snapshot['telemetry'].items() if 'healthy' in k or 'valid' in k or k in ('n1','n2','idle_input_raw','throttle_input_raw')}))
            raise RuntimeError('Normal START rejected')
        modes = set()
        seen = {'fuel':False, 'igniter':False, 'servo':False}
        deadline = time.monotonic() + 10
        running = None
        while time.monotonic() < deadline:
            live = self.dut.data()
            state = self.t.state()
            modes.add(live['mode'])
            seen['fuel'] |= state.get('FUEL_SOL') == 1
            seen['igniter'] |= state.get('IGNITER') == 1
            seen['servo'] |= (state.get('THROTTLE_OUT_us') or 0) > 1075
            if live['mode'] == 'RUNNING':
                running = live
                if all(seen.values()):
                    break
            time.sleep(.15)
        self.check(checks, 'normal startup reaches RUNNING', {'STARTUP','RUNNING'} <= modes, str(sorted(modes)))
        self.check(checks, 'physical fuel, ignition and fuel servo active', all(seen.values()), str(seen))
        if running:
            time.sleep(2)
            self.check(checks, 'RUNNING remains stable', self.dut.data()['mode'] == 'RUNNING')
        self.t.set('STOP', 1)
        stopped, live = self.dut.poll_until(lambda d: d['mode'] not in ('STARTUP','RUNNING'), timeout=5)
        time.sleep(.5)
        state = self.t.state()
        isolated = state.get('FUEL_SOL') == 0 and state.get('IGNITER') == 0 and (state.get('THROTTLE_OUT_us') or 0) <= 1050
        self.check(checks, 'physical STOP cuts combustion outputs', stopped and isolated, str(state))
        self.t.set('STOP', 0)
        self.t.set('N1', 0)
        self.t.set('N2', 0)
        self.dut.stop()
        self.dut.ensure_mode_standby(timeout=25)

    def restore_original(self):
        self.safe_standby()
        previous_boot = self.dut.data().get('boot_count')
        code, reply = self.dut._post('/api/ecu_config', self.original_ecu)
        if code != 200:
            raise RuntimeError(f'Original engine restore rejected: {reply}')
        if not self.dc._wait_reboot(previous_boot):
            raise RuntimeError('Original engine restore reboot not observed')
        self.restored = self.dut._get('/api/ecu_config') == self.original_ecu
        return self.restored


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', choices=['classic','s3'], required=True)
    parser.add_argument('--port', required=True)
    parser.add_argument('--expected-version', required=True)
    parser.add_argument('--allow-write', action='store_true', required=True)
    parser.add_argument('--result', type=Path, required=True)
    args = parser.parse_args()
    os.environ['OTBENCH_TARGET'] = args.target
    runner = ProfileSmoke(args.target, args.port, args.expected_version)
    snapshot = HERE.parents[2] / 'artifacts' / ('hardware-test-' + args.expected_version) / f'{args.target}-profiles-original.json'
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    snapshot.write_text(json.dumps(runner.original_ecu, indent=2))
    try:
        for variant in ('turbojet','turboshaft','turboprop'):
            runner.run_profile({'id':variant, 'name':variant,
                'build':lambda hw, variant=variant: runner.profile(hw, variant)})
            if runner.results[-1]['status'] != 'pass':
                break
    finally:
        try:
            runner.restore_original()
        finally:
            runner.close()
            payload = {'campaign':'dry_dual_target_profiles', 'device':runner.identity,
                'tester':runner.tester_version,
                'restored':runner.restored, 'profiles':runner.results,
                'limitations':['No fuel, turbine, powered loads or independent scope timing.',
                    'Classic ADC intermediate sweep unavailable with S3 tester.',
                    'Profiles use timed startup, not a causal turbine plant.']}
            payload['complete'] = runner.restored and len(runner.results) == 3 and all(r['status'] == 'pass' for r in runner.results)
            args.result.parent.mkdir(parents=True, exist_ok=True)
            args.result.write_text(json.dumps(payload, indent=2) + '\n')
    print(f"Complete={payload['complete']}; restored={runner.restored}; result={args.result}", flush=True)
    return 0 if payload['complete'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
