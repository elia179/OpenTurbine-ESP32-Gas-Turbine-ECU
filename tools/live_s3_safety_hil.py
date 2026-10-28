"""No-load S3 fuel-isolation campaign using the existing Classic OTBench wiring.

Runs the same overspeed and physical STOP assertions as the Classic campaign,
with S3 endpoints. Requires explicit --allow-write and restores the engine file.
"""
import sys
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'dev/bench/campaign'))
from classic_safety_hil import ClassicSafetyHil


class S3SafetyHil(ClassicSafetyHil):
    expected_target='esp32s3dev'
    default_tester_port='COM3'
    result_prefix='s3'
    expected_stop_pin=15

    def __init__(self):
        super().__init__()
        if self.identity.get('pcb_profile',{}).get('state')!='absent':
            self.tester.close()
            raise RuntimeError('This test requires bare-board OTBench routing')
        if self.identity.get('state')!='STANDBY' or self.identity.get('outputs_active'):
            self.tester.close()
            raise RuntimeError('S3 must be stopped with outputs inactive')

    def profile(self,hw):
        super().profile(hw)
        hw['platform']='esp32s3'
        hw['controls']['stop_pin']=15
        hw['sensors']['n1_rpm']['pin']=14
        hw['actuators']['throttle']['pin']=40
        hw['actuators']['fuel_sol']['pin']=12
        hw['actuators']['igniter']['pin']=21
        for channel in hw['channel_registry']['inputs']:
            if channel['id']=='n1_main':channel['pin']=14
        for channel in hw['channel_registry']['outputs']:
            channel['pin']={'main_fuel':40,'fuel_shutoff':12,'igniter':21}[channel['id']]


if __name__=='__main__':
    if '--allow-write' not in sys.argv:
        raise SystemExit('Requires --allow-write on the confirmed no-load OTBench fixture')
    S3SafetyHil().run()
