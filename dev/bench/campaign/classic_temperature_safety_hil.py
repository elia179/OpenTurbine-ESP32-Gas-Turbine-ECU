"""Dry Classic temperature protection with S3 SPI stimulus and physical outputs.

The SPI fixture temporarily borrows START/STOP/N1 links, so this campaign uses
API START/STOP. The separate Classic safety campaign verifies physical switches.
"""
import json
import os
from copy import deepcopy
from datetime import datetime
from pathlib import Path
import time

from classic_safety_hil import ClassicSafetyHil
from ten_build_webui_hil import chan_input


class ClassicTemperatureSafety(ClassicSafetyHil):
    def __init__(self):
        super().__init__()
        self.identity = self.dut.device_info()
        assert self.identity['target'] == 'esp32dev', self.identity
        assert self.identity['firmware_version'] == os.environ.get('OTBENCH_EXPECT_VERSION', '2.5.2'), self.identity
        self.result_path = Path(self.result_path).with_name(
            'classic_temperature_safety_' + datetime.now().strftime('%Y%m%d_%H%M%S') + '.json')

    def install(self):
        self.tester.reset()
        assert self.tester.raw('EMU MAX6675 120').startswith('OK')
        temporary = deepcopy(self.original_ecu)
        hw, settings = temporary['hardware'], temporary['settings']
        self.profile(hw)
        hw['controls'].update(start_pin=-1, stop_pin=26, stop_pullup=True, stop_active_h=False)
        hw['sensors']['n1_rpm'].update(enabled=False, pin=-1)
        hw['spi'].update(enabled=True, sck_pin=13, miso_pin=4, mosi_pin=-1)
        hw['sensors']['tot'].update(enabled=True, chip='max6675', tc_type='K', clk=13, cs=14, miso=4, mosi=-1)
        reg = hw['channel_registry']
        reg['inputs'] = [chan_input('tot_main', 'TOT', 'temperature', 'tot', 1, -1,
            temp_interface=1, spi_clk=13, spi_cs=14, spi_miso=4, spi_mosi=-1, tc_type='K')]
        reg['bindings'] = [b for b in reg['bindings'] if b['key'] != 'primary_n1']
        for key in hw['safety']:
            hw['safety'][key] = key in ('hot_start', 'overtemp')
        hw['startup_delay_ms'][-1] = int(os.environ.get('OTBENCH_TEMP_STARTUP_MS','2000'))
        settings['rules'] = []
        settings['dynamic_idle']['fuel_mode'] = 0
        settings['engine'].update(min_rpm=0, tot_limit=700)
        settings['throttle'].update(ramp_up_ms=0, ramp_down_ms=0, fuel_pump_min_pct=30)
        settings['sequence']['startup'].update(pre_start_egt_limit_c=200, startup_egt_limit_c=500, startup_egt_guard_enabled=True, startup_egt_immediate_enabled=True, startup_egt_dwell_enabled=False, startup_egt_dwell_c=0, startup_egt_dwell_ms=800)
        settings['safety'].update(check_interval_ms=20,p1_trip_enabled=False,p2_trip_enabled=False,torque_trip_enabled=False,underspeed_enabled=False)
        previous_boot = self.dut.data().get('boot_count')
        code, reply = self.dut._post('/api/ecu_config', temporary)
        if code != 200 or not self.dc._wait_reboot(previous_boot):
            raise RuntimeError(f'Temperature fixture rejected: {reply}')
        armed = self.dut.hardware()['safety']
        assert armed['hot_start'] and armed['overtemp'], armed
        self.dut.ensure_dev_mode(True)
        self.temperature(120)

    def temperature(self, value):
        assert self.tester.raw(f'EMU MAX6675 {value}').startswith('OK')
        deadline = time.monotonic() + 5
        # Require a new complete sample: rotating compact groups can still
        # contain the pre-reboot value immediately after changing the fixture.
        while time.monotonic() < deadline:
            data = self.dut.full_data()
            if data.get('tot_healthy') and abs(float(data.get('tot') or 0) - value) < 2:
                return
            time.sleep(.1)
        raise RuntimeError(f'Temperature stimulus did not settle: {data.get("tot")}')

    def recover(self):
        self.temperature(120)
        self.dut.stop()
        settled, data = self.dut.poll_until(lambda d: d.get('mode') in ('STANDBY','FAULT'),
            timeout=10, interval=.15)
        if not settled:
            raise RuntimeError(f'Test shutdown did not settle: {data.get("mode")}')
        # Read coherent fault flags rather than a rotating compact cache before
        # clearing the acknowledged test fault; a second START must be fresh.
        if self.dut.full_data().get('mode') == 'FAULT':
            ready, data = self.dut.poll_until(lambda d: d.get('fault_clear_allowed'),
                timeout=6, interval=.15)
            if not ready:
                raise RuntimeError(f'Test fault is not clearable: {data.get("fault_description")}')
            code, reply = self.dut.clear_fault()
            if code != 200:
                raise RuntimeError(f'Test fault clear rejected: {reply}')
            ok, data = self.dut.poll_until(lambda d: d.get('mode') == 'STANDBY',
                timeout=5, interval=.15)
            if not ok:
                raise RuntimeError(f'Test fault clear did not apply: {data.get("last_event")}')
            return
        ok, data = self.dut.ensure_mode_standby()
        if not ok:
            raise RuntimeError(f'Test recovery did not reach STANDBY: {data.get("mode")}')

    def cut(self):
        time.sleep(.15)
        state = self.tester.state()
        return (state.get('FUEL_SOL') == 0 and state.get('IGNITER') == 0 and
            900 <= (state.get('THROTTLE_OUT_us') or 0) <= 1050), state

    def active(self):
        state = self.tester.state()
        return (state.get('FUEL_SOL') == 1 and state.get('IGNITER') == 1 and
            (state.get('THROTTLE_OUT_us') or 0) > 1200), state

    def run(self):
        restored = False
        error = None
        try:
            self.install()
            self.temperature(300)
            code, reply = self.dut.start()
            cut, state = self.cut()
            blocked = reply.get('ok') is False and 'pre-start' in str(reply).lower()
            self.record('hot start blocked', blocked and cut, response=reply, physical=state)
            self.recover()
            for name, threshold, wanted in (
                ('startup overtemperature', 600, 'STARTUP'),
                ('running overtemperature', 800, 'RUNNING'),
            ):
                code, reply = self.dut.start()
                ok, data = self.dut.poll_until(lambda d: d.get('mode') == wanted, timeout=8, interval=.1)
                active, before = self.active()
                if code != 200 or not ok or not active:
                    raise RuntimeError(f'{name}: positive output baseline failed: {reply} {data.get("mode")} {before}')
                assert self.tester.raw(f'EMU MAX6675 {threshold}').startswith('OK')
                tripped, data = self.dut.poll_until(lambda d: d.get('mode') not in ('STARTUP','RUNNING'), timeout=5, interval=.1)
                cut, after = self.cut()
                fault = str(data.get('fault_description') or '')
                self.record(name, tripped and ('over-temperature' in fault.lower() or 'OVERTEMP' in fault) and cut,
                    fault=fault, before=before, after=after)
                self.recover()
        except Exception as exc:
            error = f'{type(exc).__name__}: {exc}'
            print(error, flush=True)
        finally:
            try:
                self.recover()
                self.tester.raw('EMU OFF')
                self.tester.reset()
                previous_boot = self.dut.data().get('boot_count')
                code, reply = self.dut._post('/api/ecu_config', self.original_ecu)
                restored = code == 200 and self.dc._wait_reboot(previous_boot)
                restored = restored and self.dut._get('/api/ecu_config') == self.original_ecu
                self.dut.ensure_dev_mode(False)
            finally:
                self.tester.close()
                payload = {'device':self.identity, 'tester':self.tester_version,
                    'checks':self.rows, 'restored':restored, 'error':error,
                    'complete':len(self.rows) == 3 and all(r['ok'] for r in self.rows) and restored and not error}
                self.result_path.write_text(json.dumps(payload, indent=2) + '\n')
        print(f'Complete={payload["complete"]}; restored={restored}; result={self.result_path}', flush=True)
        return 0 if payload['complete'] else 1


if __name__ == '__main__':
    raise SystemExit(ClassicTemperatureSafety().run())
