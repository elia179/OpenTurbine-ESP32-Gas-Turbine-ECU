"""No-load OTBench test of separate fault/status indicators; restores engine file.

Classic uses S3 tester COM4; S3 uses Classic tester COM3. Existing jumpers:
FUEL_SOL reads status, IGNITER reads fault, FLAME injects a digital fault.
Requires --allow-write; never use with engine loads attached.
"""
import argparse
import copy
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT/'dev/bench/harness'), str(ROOT/'dev/bench/campaign')]
from otbench.dut import DUT
from otbench.dutconfig import DutConfig
from otbench.tester import Tester
from reversed_digital_sensor_hil import ReversedDigitalSensorHil
from ten_build_webui_hil import chan_input


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--allow-write',action='store_true',required=True)
    parser.add_argument('--target',choices=['classic','s3'],required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    classic=args.target=='classic'
    dut=DUT();dc=DutConfig(dut)
    info=dut.device_info()
    assert info['target']==('esp32dev' if classic else 'esp32s3dev')
    assert info['state']=='STANDBY' and not info['outputs_active']
    assert info.get('pcb_profile',{}).get('state')=='absent','This test requires bare-board OTBench routing'
    assert info['firmware_version']=='2.6.1','This campaign targets the 2.6.1 indicator implementation'
    original=dut._get('/api/ecu_config')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.with_suffix('.backup.json').write_text(json.dumps(original,indent=2),encoding='utf-8')
    status_pin,fault_pin,input_pin,stop_pin=(22,23,27,26) if classic else (12,21,2,15)
    rows=[];restored=False
    with Tester('COM4' if classic else 'COM3') as tester:
        tester.set('FLAME',0)
        try:
            temporary=copy.deepcopy(original);hw=temporary['hardware'];settings=temporary['settings']
            ReversedDigitalSensorHil.quiet_profile(hw)
            hw['platform']='esp32' if classic else 'esp32s3'
            hw['controls'].update(start_pin=-1,stop_pin=stop_pin,stop_active_h=False,stop_pullup=True)
            hw['actuators']['status_led'].update(enabled=True,pin=status_pin,type=0,mode=0,active_h=True)
            hw['actuators']['fault_led']={'enabled':True,'pin':fault_pin,'active_h':True}
            hw['channel_registry']['inputs']=[chan_input('fixture_fault','Fixture Fault','fault','fault',0,input_pin,active_high=True)]
            hw['startup_seq']=['TimedDelay'];hw['startup_delay_ms']=[60000]
            hw['shutdown_seq']=['ImmediateCut'];hw['shutdown_delay_ms']=[0]
            settings['rules']=[]
            settings['dynamic_idle']['fuel_mode']=0
            before=dut.data().get('boot_count')
            print('Installing isolated indicator fixture...',flush=True)
            code,detail=dut._post('/api/ecu_config',temporary)
            assert code==200 and dc._wait_reboot(before),detail
            loaded=dut.hardware()
            assert loaded['actuators']['fault_led']==hw['actuators']['fault_led']
            assert dut.ensure_mode_standby()[0]
            assert dut.ensure_dev_mode(True),'Developer Mode required for dry fixture'
            assert dut.ensure_bench_mode(True),'Bench Mode required for this actuator-free indicator fixture'
            print('Starting dry indicator-only sequence...',flush=True)
            code,detail=dut.start();assert code==200,detail
            ok,data=dut.poll_until(lambda d:d.get('mode')=='STARTUP',timeout=5)
            assert ok,data
            print('Injecting wired digital fault...',flush=True)
            tester.set('FLAME',1)
            ok,data=dut.poll_until(lambda d:d.get('mode')=='FAULT',timeout=8)
            assert ok,data
            levels=[];end=time.monotonic()+2.5
            while time.monotonic()<end:
                levels.append((tester.get_level('FUEL_SOL'),tester.get_level('IGNITER')))
                time.sleep(.025)
            transitions=lambda index:sum(a[index]!=b[index] for a,b in zip(levels,levels[1:]))
            status_changes,fault_changes=transitions(0),transitions(1)
            assert fault_changes>=10,(status_changes,fault_changes)
            assert status_changes<=5,(status_changes,fault_changes)
            rows.append({'name':'fault blinks separately; status keeps normal cadence','passed':True,'status_transitions':status_changes,'fault_transitions':fault_changes})
            tester.set('FLAME',0);time.sleep(.1)
            assert dut.ensure_mode_standby()[0]
            time.sleep(.2)
            assert tester.get_level('IGNITER')==0
            rows.append({'name':'clearing fault turns dedicated indicator off','passed':True})
            print(json.dumps(rows),flush=True)
        finally:
            tester.set('FLAME',0)
            dut.ensure_mode_standby()
            print('Restoring original engine file...',flush=True)
            before=dut.data().get('boot_count')
            code,detail=dut._post('/api/ecu_config',original)
            restored=code==200 and dc._wait_reboot(before)
            if restored:
                actual=dut._get('/api/ecu_config')
                restored=actual['hardware']==original['hardware'] and actual['settings']==original['settings']
            args.output.write_text(json.dumps({'identity':info,'rows':rows,'restored':restored},indent=2),encoding='utf-8')
            assert restored,'Original engine file did not restore exactly'
    print('Separate fault/status indicator HIL passed; original configuration restored.',flush=True)


if __name__=='__main__':main()
