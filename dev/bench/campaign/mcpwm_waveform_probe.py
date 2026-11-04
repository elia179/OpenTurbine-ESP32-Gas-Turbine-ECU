"""Run only on the confirmed unloaded two-development-board fixture.

Requires dev/bench/pwm_probe installed on S3. Driver readbacks are simulated;
MCPWM waveforms/peripheral allocation are real. Restore ECU firmware afterwards.
"""
import argparse,json,sys,time
from pathlib import Path
import serial
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'harness'))
from otbench.tester import Tester

def main():
 ap=argparse.ArgumentParser(description=__doc__)
 ap.add_argument('--allow-write',action='store_true',required=True)
 ap.add_argument('--dut-port',default='COM4');ap.add_argument('--tester-port',default='COM3')
 ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
 rows=[];error=None
 dut=serial.Serial(baudrate=115200,timeout=.1);dut.port=args.dut_port;dut.dtr=False;dut.rts=False;dut.open()
 def cmd(s):
  dut.reset_input_buffer();dut.write((s+'\n').encode());end=time.monotonic()+2
  while time.monotonic()<end:
   line=dut.readline().decode(errors='replace').strip()
   if line.startswith(('OK','ERR','STATUS')):return line
  raise RuntimeError('Probe did not reply: '+s)
 def require(name,ok,detail):
  rows.append({'name':name,'passed':bool(ok),'detail':detail});print(('PASS ' if ok else 'FAIL ')+name+': '+str(detail),flush=True)
  if not ok:raise AssertionError(name)
 try:
  with Tester(args.tester_port) as tester:
   for hz in (1000,5000,10000,20000):
    dut.rts=True;time.sleep(.15);dut.rts=False;time.sleep(1);dut.reset_input_buffer()
    require(f'{hz} attach',cmd(f'FREQ {hz}')=='OK FREQ','all six MCPWM timers')
    require(f'{hz} arm',cmd('ARM_NO_LOAD')=='OK ARM','six simultaneous LEDC outputs')
    time.sleep(.7);status=cmd('STATUS')
    require(f'{hz} ready/coexistence','STATUS ready' in status and 'timers=6 ledc=6 ledc_ok=1' in status,status)
    for duty in (.25,.5,.75):
     cmd(f'SET {duty}');time.sleep(.06);samples=[tester.get('OILPUMP_OUT') for _ in range(3)]
     ok=any(abs(float(x.get('hz',0))-hz)<=hz*.15 and abs(float(x.get('duty',0))-duty)<=.07 for x in samples)
     require(f'{hz} duty {duty}',ok,samples)
    for duty in (0,1,0):
     cmd(f'SET {duty}');time.sleep(.03);sample=tester.get('OILPUMP_OUT')
     require(f'{hz} static {duty}',sample.get('level')==duty and float(sample.get('hz',0))==0,sample)
    cmd('SET 0.5');time.sleep(.04);cmd('FAULT');time.sleep(1.1);status=cmd('STATUS');sample=tester.get('OILPUMP_OUT')
    require(f'{hz} reported fault off','STATUS fault' in status and 'latch=3' in status and sample.get('level')==0,{'status':status,'pin':sample})
    require(f'{hz} explicit clear',cmd('CLEAR')=='OK CLEAR','no automatic rearm')
    time.sleep(.1);sample=tester.get('OILPUMP_OUT');require(f'{hz} clear remains off',sample.get('level')==0,sample)
    cmd('SET 0.5');time.sleep(.05);cmd('STALL');status=cmd('STATUS');sample=tester.get('OILPUMP_OUT')
    require(f'{hz} stall off','STATUS fault' in status and sample.get('level')==0,{'status':status,'pin':sample})
    require(f'{hz} stall cannot clear',cmd('CLEAR')=='ERR CLEAR','requires hardware reset')
   dut.rts=True;time.sleep(.15);dut.rts=False;time.sleep(1)
   require('mixed frequencies attach',cmd('MIXED')=='OK MIXED','six independent rates')
   require('mixed frequencies arm',cmd('ARM_NO_LOAD')=='OK ARM','six LEDC outputs also attached')
   time.sleep(.7);require('mixed ready','STATUS ready' in cmd('STATUS'),'one-shot group synchronization')
   cmd('SET 0.5')
   for wait in (.08,1.5):
    time.sleep(wait)
    for signal,hz in [('OILPUMP_OUT',5000),('THROTTLE_OUT',2500)]:
     samples=[tester.get(signal) for _ in range(3)]
     require('independent '+signal+' after '+str(wait),any(abs(float(x.get('hz',0))-hz)<=hz*.15 for x in samples),samples)
   cmd('SET 0')
 except Exception as exc:
  error=str(exc);raise
 finally:
  try:cmd('SET 0')
  except Exception:pass
  dut.close();args.output.parent.mkdir(parents=True,exist_ok=True)
  args.output.write_text(json.dumps({'rows':rows,'error':error,'complete':bool(rows) and not error,'limits':['Only OILPUMP_OUT wire independently captures waveform; other timers validated by allocation.', 'Driver/expander replies simulated, no real MOSFET/current/phase-skew qualification.']},indent=2),encoding='utf-8')
if __name__=='__main__':main()
