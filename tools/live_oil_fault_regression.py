"""No-load wired oil-switch fault test; Classic DUT, S3 OTBench tester.
Preserves and restores the complete engine file. No push/release actions.
"""
import copy,json,pathlib,sys,time,urllib.request,urllib.error,subprocess,os
sys.path.insert(0,'dev/bench/harness')
from otbench.tester import Tester
BASE='http://192.168.4.1'
S3='--s3' in sys.argv
LABEL='s3' if S3 else 'classic'
PROFILE=os.environ.get('OT_WIFI_PROFILE','OpenTurbine-followup')
def read(route):
 with urllib.request.urlopen(BASE+route,timeout=10) as r:return json.load(r)
def post(route,data):
 q=urllib.request.Request(BASE+route,json.dumps(data).encode(),{'Content-Type':'application/json'},method='PATCH' if route=='/api/config' else 'POST')
 try:
  with urllib.request.urlopen(q,timeout=20) as r:d=json.load(r)
 except urllib.error.HTTPError as e:raise RuntimeError(str(e)+': '+e.read().decode())
 if d.get('ok') is False:raise RuntimeError(str(d))
 return d
def wait(predicate,seconds=50):
 end=time.monotonic()+seconds
 while time.monotonic()<end:
  try:
   value=predicate()
   if value:return value
  except (OSError,ValueError):pass
  time.sleep(.25)
 raise AssertionError('Timed out waiting for ECU')
def reconnect():subprocess.run(['netsh','wlan','connect','name='+PROFILE],stdout=subprocess.DEVNULL)
def channel(id,name,purpose,pin,driver,role=None):
 return dict(id=id,name=name,purpose=purpose,role=role or purpose,pin=pin,driver=driver,installed=True,active_high=True,min=0,max=1)
def main():
 original=read('/api/ecu_config');pathlib.Path('artifacts/followup-'+LABEL+'-before-wired-test.json').write_text(json.dumps(original))
 assert read('/api/device_info')['state']=='STANDBY'
 h=copy.deepcopy(original['hardware']);h['controls'].update(start_pin=13,stop_pin=15 if S3 else 14,start_active_h=False,stop_active_h=False,start_pullup=True,stop_pullup=True)
 h['channel_registry']['inputs']=[channel('bench_oil_switch','Bench low oil switch','low_oil_switch',2 if S3 else 27,0)]
 h['channel_registry']['outputs']=[channel('bench_fuel_valve','Bench fuel valve','fuel_shutoff',12 if S3 else 22,4),channel('bench_igniter','Bench igniter','igniter',21 if S3 else 23,4)]
 h['channel_registry']['bindings']=[dict(key='main_fuel_shutoff',channel='bench_fuel_valve'),dict(key='primary_igniter',channel='bench_igniter')]
 h['di_channels']=[];h['controllers']={key:False for key in h['controllers']};h['oil_loops']=[];h['safety']={key:False for key in h['safety']}
 h['actuators']['status_led'].update(enabled=False,pin=-1)
 h['startup_seq']=['SetOutput','TimedDelay'];h['shutdown_seq']=['ImmediateCut'];h['startup_delay_ms']=[0,1500]
 h['startup_enter_actions']=[[dict(target='bench_fuel_valve',value=1),dict(target='bench_igniter',value=1)],[]]
 for stem,size in [('startup',2),('shutdown',1)]:
  h[stem+'_exit_actions']=[[] for _ in range(size)];h[stem+'_device_target']=['']*size;h[stem+'_ignition_target']=[0]*size;h[stem+'_wait_inputs']=[dict(channel=0,timeout_ms=5000,active=True) for _ in range(size)]
 h['shutdown_enter_actions']=[[]];h['ab_seq']=[];h['ab_shut_seq']=[]
 rule=dict(controller_id=910,name='Bench low oil fault',enabled=True,kind=0,op=0,threshold=.5,hysteresis=0,on_value=1,off_value=0,mode_mask=6,activate_event=1,deactivate_events=24,source='bench_oil_switch',target='request_fault')
 installed=False
 with Tester('COM3' if S3 else 'COM4') as tester:
  tester.set('START',0);tester.set('STOP',0);tester.set('FLAME',0)
  try:
   post('/api/hardware',h);installed=True;time.sleep(7);reconnect();wait(lambda:read('/api/device_info')['state']=='STANDBY')
   post('/api/config',{'controller_schema':1,'rules':[rule]});time.sleep(2)
   wait(lambda:read('/api/config')['rules'][0].get('target')=='request_fault')
   post('/api/start',{})
   wait(lambda:read('/api/data').get('mode')=='RUNNING',20)
   assert tester.get_level('FUEL_SOL')==1 and tester.get_level('IGNITER')==1
   tester.set('FLAME',1)
   fault=wait(lambda:(d if (d:=read('/api/data')).get('fault_latched') or 'CONTROL_RULE' in str(d.get('last_event')) else None),8)
   wait(lambda:tester.get_level('FUEL_SOL')==0 and tester.get_level('IGNITER')==0,5)
   tester.set('FLAME',0);time.sleep(3)
   events=read('/api/log');names=[e.get('ev') for e in events]
   assert 'RUNNING_ENTRY' in names or 'RUNNING' in names,names
   assert any(e.get('code')=='CONTROL_RULE' or 'CONTROL_RULE' in str(e) for e in events),events
   assert 'RUN_SUMMARY' in names,names
   pathlib.Path('artifacts/v260-followup-'+LABEL+'-wired-events.json').write_text(json.dumps(events))
   print(LABEL,'wired fault action: real switch ended RUNNING, both fuel/ignition relay outputs cut, CONTROL_RULE and RUN_SUMMARY persisted and readable.')
  finally:
   tester.set('FLAME',0);tester.set('STOP',0)
   if installed:
    post('/api/ecu_config',original);time.sleep(7);reconnect();wait(lambda:read('/api/device_info')['state']=='STANDBY')
    assert read('/api/hardware')['channel_registry']==original['hardware']['channel_registry']
    print('Original complete engine configuration restored; STANDBY.')
if __name__=='__main__':main()
