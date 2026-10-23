"""Dry Classic check: multi-event control, missing-link suppression and Standby safety."""
import sys,json
from pathlib import Path
sys.path.insert(0,'tools')
from live_startup_temperature_hil import Campaign
class ControllerCampaign(Campaign):
 def recover(self):
  self.temperature(120);self.dut.stop()
  ok,data=self.dut.poll_until(lambda d:d.get('mode') in ('STANDBY','FAULT'),timeout=40,interval=.15)
  assert ok,('Shutdown did not settle',data.get('mode'))
  if data.get('mode')=='FAULT':super().recover()
 def run(self):
  self.dut._reconnect_wifi=self.reconnect;restored=False;error=None
  try:
   self.install()
   ecu=self.dut._get('/api/ecu_config');h=ecu['hardware'];s=ecu['settings']
   h['startup_seq']=['TimedDelay'];h['startup_delay_ms']=[2000]
   for suffix in ['device_target','ignition_target','wait_inputs','enter_actions','exit_actions']:
    h['startup_'+suffix]=[[] if suffix.endswith('actions') else dict(channel=0,timeout_ms=5000,active=True) if suffix=='wait_inputs' else '' if suffix=='device_target' else 0]
   s['controller_schema']=1
   s['rules']=[dict(controller_id=801,name='Bench multi-event fuel',enabled=True,kind=3,target='main_fuel',source='',on_value=.4,off_value=0,mode_mask=6,activate_events=6,deactivate_events=24),
    dict(controller_id=802,name='Bench incomplete ignition',enabled=True,kind=3,target='igniter',source='',on_value=1,off_value=0,mode_mask=6,activate_events=17,deactivate_events=1)]
   boot=self.dut.data().get('boot_count');code,reply=self.dut._post('/api/ecu_config',ecu);assert code==200,(code,reply)
   assert self.dc._wait_reboot(boot);self.dut._data_base=None;self.temperature(120)
   before=self.dut.full_data();assert before['controller_inhibit_mask']==2,before.get('seq_issues')
   assert not before['seq_has_errors'] and not before['seq_has_structural_errors'],before.get('seq_issues')
   assert self.tester.get_level('IGNITER')==0,'Incomplete Standby controller energized ignition'
   code,reply=self.dut.start();assert code==200,(code,reply)
   ok,d=self.dut.poll_until(lambda d:d.get('mode')=='STARTUP',timeout=5,interval=.1);assert ok,d.get('last_event')
   assert self.tester.get_pwm('THROTTLE_OUT')[0]>1300
   ok,d=self.dut.poll_until(lambda d:d.get('mode')=='RUNNING',timeout=6,interval=.1);assert ok,d.get('last_event')
   assert self.tester.get_pwm('THROTTLE_OUT')[0]>1300 and self.tester.get_level('IGNITER')==0
   assert self.dut.config()['rules'][1]['enabled'],'Run suppression changed the saved Enabled setting'
   self.record('multi-event fuel + incomplete Standby controller',True,physical=self.tester.state())
   self.recover();cut,physical=self.cut();assert cut,physical
   self.record('shutdown releases controller safely',True,physical=physical)
  except Exception as exc:error=repr(exc);print(error,flush=True)
  finally:
   try:
    self.recover();self.tester.raw('EMU OFF');self.tester.reset()
    boot=self.dut.data().get('boot_count');code,reply=self.dut._post('/api/ecu_config',self.original_ecu)
    restored=code==200 and self.dc._wait_reboot(boot)
    if restored:restored=self.dut._get('/api/ecu_config')==self.original_ecu
   finally:self.tester.close()
   payload=dict(checks=self.rows,restored=restored,error=error,complete=len(self.rows)==2 and all(r['ok'] for r in self.rows) and restored and not error)
   Path('artifacts/controller-activation-classic-hil.json').write_text(json.dumps(payload,indent=2));print('Controller HIL:',{k:payload[k] for k in ['complete','restored','error']},flush=True)
  return 0 if payload['complete'] else 1
if __name__=='__main__':raise SystemExit(ControllerCampaign().run())
