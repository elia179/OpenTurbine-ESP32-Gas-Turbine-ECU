const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const base=process.argv[2]||'http://192.168.4.1',sleep=ms=>new Promise(r=>setTimeout(r,ms));
function request(path,method='GET',data){
 const script="import sys,json,urllib.request,urllib.error; data=json.load(sys.stdin); q=urllib.request.Request(sys.argv[1],data=json.dumps(data).encode() if sys.argv[2]!='GET' else None,headers={'Content-Type':'application/json'},method=sys.argv[2]);\ntry:\n r=urllib.request.urlopen(q,timeout=15); print(json.dumps({'status':r.status,'data':json.load(r)}))\nexcept urllib.error.HTTPError as e: print(json.dumps({'status':e.code,'data':json.loads(e.read())}))";
 return JSON.parse(execFileSync('python',['-c',script,base+path,method],{input:JSON.stringify(data??null),encoding:'utf8'}));
}
async function read(path){if(path==='/api/ecu_config')return {hardware:await read('/api/hardware'),settings:await read('/api/config')};const r=request(path);assert.equal(r.status,200);return r.data;}
async function patch(path,data){
 for(let n=0;n<20;n++){
  const r=request(path,'PATCH',data);if(r.status===409&&n<19){await sleep(100);continue;}
  assert.ok(r.status>=200&&r.status<300&&r.data.ok!==false,JSON.stringify(r.data));return r.data;
 }
}
(async()=>{
 const original=await read('/api/ecu_config'),info=await read('/api/device_info');
 assert.equal(info.state,'STANDBY');assert.equal(info.outputs_active,false);
 fs.writeFileSync('artifacts/adc-reverse-classic-before-test.json',JSON.stringify(original));
 const before=original.hardware.channel_registry.inputs.find(c=>c.installed!==false&&c.purpose==='throttle');assert.ok(before&&before.driver===1);
 const browser=await chromium.launch({headless:true});let touched=false;
 try{
  const page=await browser.newPage(),errors=[],commands=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname==='/api/command')commands.push(r.postData());});
  await page.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
  await page.goto(base+'/calibration.html?v=20261023p');
  await page.waitForFunction(()=>typeof saveOperatorCalibration==='function'&&cfg?.hardware&&Number.isFinite(operatorAdcRaw(live,'throttle')),null,{timeout:30000});
  await page.evaluate(()=>{window.__messages=[];window.alert=m=>window.__messages.push(String(m));});
  for(const reversed of [true,false]){
   touched=true;
   await page.evaluate(reversed=>{window.__messages=[];throttleInputType='adc';thMin=reversed?4095:0;thMax=reversed?0:4095;saveThrottle();},reversed);
   await page.waitForFunction(()=>window.__messages.length,null,{timeout:30000});
   const messages=await page.evaluate(()=>window.__messages);assert.ok(messages.some(m=>m.startsWith('Throttle calibrated:')),JSON.stringify(messages));
   await sleep(400);
   const saved=await read('/api/ecu_config'),c=saved.hardware.channel_registry.inputs.find(c=>c.id===before.id);
   assert.equal(c.min,reversed?41:82);assert.equal(c.max,reversed?4013:4054);assert.equal(!!c.invert,reversed);
   assert.equal(saved.settings.calibration.throttle_min_raw,reversed?4013:82);
   assert.equal(saved.settings.calibration.throttle_max_raw,reversed?41:4054);
   await page.reload();await page.waitForFunction(()=>calibrationConnected()&&Number.isFinite(operatorAdcRaw(live,'throttle')),null,{timeout:30000});
   const shown=await page.evaluate(()=>({bar:parseFloat(document.getElementById('bar-th').style.width),percent:parseFloat(document.getElementById('cal-th-pct').textContent),raw:operatorAdcRaw(live,'throttle')}));
   assert.ok(Math.abs(shown.bar-shown.percent)<=.51,JSON.stringify(shown));
   const data=await read('/api/data'),sample=data.registry_inputs.find(c=>c.id===before.id);
   assert.ok(Number.isInteger(sample.raw),'full telemetry lost raw counts');
   const expected=Math.max(0,Math.min(1,(sample.raw-c.min)/(c.max-c.min)));
   assert.equal(sample.healthy,true);assert.ok(Math.abs(sample.value-(reversed?1-expected:expected))<.002);
   console.log(reversed?'Reversed':'Normal','ADC calibration saved and reloaded; physical sample',sample.raw,'controller input',sample.value,'bar agrees with percentage.');
  }
  assert.deepEqual(commands,[]);assert.deepEqual(errors,[]);
 }finally{
  await browser.close();
  if(touched){
   const restore={id:before.id,min:before.min,max:before.max,invert:!!before.invert,calibration_points:before.calibration_points||[]};
   await patch('/api/hardware',{channel_registry_calibration:restore});
   const c=original.settings.calibration;
   await patch('/api/config',{calibration:{throttle_min_raw:c.throttle_min_raw,throttle_max_raw:c.throttle_max_raw}});
   await sleep(400);assert.deepEqual(await read('/api/ecu_config'),original);
   const state=await read('/api/device_info');assert.equal(state.state,'STANDBY');assert.equal(state.outputs_active,false);
   console.log('Original complete engine configuration restored; no actuator commands; STANDBY, outputs inactive.');
  }
 }
})().catch(e=>{console.error(e);process.exit(1)});
