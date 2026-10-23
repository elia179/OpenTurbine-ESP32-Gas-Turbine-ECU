"""Dry Classic startup/Running temperature protection with S3 MAX6675 stimulus.
Restores the exact engine file captured immediately before this campaign.
"""
import os,sys,time,json,subprocess
from pathlib import Path
os.environ['OTBENCH_EXPECT_VERSION']='2.6.0'
os.environ['OTBENCH_TEMP_STARTUP_MS']='8000'
sys.path.insert(0,'dev/bench/campaign')
from classic_temperature_safety_hil import ClassicTemperatureSafety
class Campaign(ClassicTemperatureSafety):
 def reconnect(self,force=False):
  state=subprocess.run(['netsh','wlan','show','interfaces'],capture_output=True,text=True).stdout
  if force or 'disconnected' in state:
   now=time.monotonic()
   if now-getattr(self,'_reconnect_at',0)>12:
    self._reconnect_at=now;subprocess.run(['netsh','wlan','connect','name=OpenTurbine-followup'],stdout=subprocess.DEVNULL)
 def patch(self,**values):
  if 'startup_egt_dwell_c' in values:values['startup_egt_dwell_enabled']=values['startup_egt_dwell_c']>0

  boot=self.dut.data().get('boot_count');code,reply=self.dut.patch('/api/config',{'sequence':{'startup':values}})
  assert code==200,(code,reply)
  assert self.dc._wait_reboot(boot),'Expected Classic save/reboot did not settle'
  self.dut._data_base=None;self.temperature(120)
 def start_active(self):
  self.temperature(120);code,reply=self.dut.start();assert code==200,(code,reply)
  ok,d=self.dut.poll_until(lambda d:d.get('mode')=='STARTUP',timeout=5,interval=.08)
  assert ok,d.get('last_event')
  assert self.active()[0],'Missing positive physical fuel baseline'
 def expect_trip(self,code):
  ok,d=self.dut.poll_until(lambda d:code in str(d.get('fault_description')),timeout=5,interval=.08)
  cut,physical=self.cut();assert ok and cut,(d.get('fault_description'),physical)
  self.record(code,True,physical=physical)
  self.recover()
 def run(self):
  self.dut._reconnect_wifi=self.reconnect
  restored=False;error=None
  try:
   self.install();self.start_active();self.temperature(500);self.expect_trip('STARTUP_OVERTEMP')
   self.patch(startup_egt_dwell_c=400,startup_egt_dwell_ms=3000)
   self.start_active();started=time.monotonic();self.tester.raw('EMU MAX6675 440');time.sleep(.25)
   early=self.dut.full_data()
   assert time.monotonic()-started<2.5,'Early dwell sample arrived too late to establish timing'
   assert early['mode']=='STARTUP',('Dwell tripped too soon',early.get('fault_description'))
   self.temperature(300);time.sleep(.15);self.temperature(440);self.expect_trip('STARTUP_TEMP_DWELL')
   self.start_active();self.temperature(120)
   ok,d=self.dut.poll_until(lambda d:d.get('mode')=='RUNNING',timeout=12,interval=.1);assert ok,d.get('last_event')
   self.temperature(750);self.expect_trip('OVERTEMP')
   self.patch(startup_egt_guard_enabled=False)
   self.start_active();self.temperature(750);self.expect_trip('OVERTEMP')
  except Exception as exc:
   error=repr(exc);print(error,flush=True)
  finally:
   try:
    self.recover();self.tester.raw('EMU OFF');self.tester.reset()
    boot=self.dut.data().get('boot_count');code,reply=self.dut._post('/api/ecu_config',self.original_ecu)
    print('Restore response:',code,reply,flush=True)
    restored=code==200 and self.dc._wait_reboot(boot)
    if restored:restored=self.dut._get('/api/ecu_config')==self.original_ecu
   finally:self.tester.close()
   payload=dict(checks=self.rows,restored=restored,error=error,complete=len(self.rows)==4 and all(r['ok'] for r in self.rows) and restored and not error)
   Path('artifacts/startup-temperature-classic-hil.json').write_text(json.dumps(payload,indent=2))
   print('Temperature HIL:',{k:payload[k] for k in ['complete','restored','error']},flush=True)
  return 0 if payload['complete'] else 1
if __name__=='__main__':raise SystemExit(Campaign().run())
