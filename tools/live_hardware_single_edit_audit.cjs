// Idle-bench integration proof: change only an existing glow pilot-fuel delay.
// Never enables hardware or commands an output. Restores the original engine file.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {execFileSync}=require('node:child_process');const {chromium}=require('playwright');
if(!process.argv.includes('--allow-write'))throw Error('Requires explicit idle-bench --allow-write');
const base=process.argv.find(a=>/^http/.test(a))||'http://192.168.4.1';
const out=process.env.OT_AUDIT_OUT||'artifacts/v255-qualification';
const profile=process.env.OT_WIFI_PROFILE||'OpenTurbine';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function get(route){
 for(let i=0;i<3;i++)try{const r=await fetch(base+route,{headers:{Connection:'close'},signal:AbortSignal.timeout(3500)});assert.ok(r.ok,route+': '+r.status);return await r.json();}
 catch(e){if(i===2)throw e;if(process.platform==='win32')execFileSync('netsh',['wlan','connect',`name=${profile}`],{stdio:'ignore'});await pause(700);}
}
async function returned(oldBoot){
 for(let i=0;i<50;i++){
  if(i&&i%3===0&&process.platform==='win32')execFileSync('netsh',['wlan','connect',`name=${profile}`],{stdio:'ignore'});
  try{const d=await get('/api/data');if(d.boot_count!==oldBoot)return await get('/api/ecu_config');}catch(_){}
  await pause(700);
 }throw Error('ECU did not return after the expected restart');
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const info=await get('/api/device_info');
 assert.equal(info.firmware_version,fs.readFileSync('src/system/version.h','utf8').match(/#define\s+OT_VERSION\s+"([^"]+)"/)[1]);assert.equal(info.state,'STANDBY');assert.equal(info.outputs_active,false);
 const original=await get('/api/ecu_config');
 fs.writeFileSync(`${out}/${info.target}-single-edit-original.json`,JSON.stringify(original,null,2));
 const oldMs=original.hardware.actuators?.glow_plug?.fuel_delay_ms;
 assert.ok(Number.isFinite(oldMs),'Fixture requires the serialized delay; do not install or enable a new output');
 const newMs=oldMs<3599000?oldMs+1000:oldMs-1000;
 const browser=await chromium.launch({headless:true});let modified=false,passed=false;
 try{
  const p=await browser.newPage({viewport:{width:800,height:1000},hasTouch:true});
  await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
  await p.goto(base+'/hardware.html',{waitUntil:'domcontentloaded',timeout:45000});
  await p.waitForFunction(()=>typeof cfg!=='undefined'&&/Loaded.*no unsaved changes/.test(document.querySelector('#save-msg')?.textContent||''),null,{timeout:45000});
  await p.evaluate(ms=>setRegistryWetGlowDelaySeconds(ms/1000),newMs);
  const changes=await p.evaluate(()=>_buildChanges());
  assert.equal(changes.length,1,JSON.stringify(changes));assert.match(changes[0].label,/Pilot-fuel delay/);
  const expected=structuredClone(original.hardware);expected.actuators.glow_plug.fuel_delay_ms=newMs;
  // The S3 bench file retains disabled Cluster TX on the live oil-temperature
  // pin. Save intentionally releases such inactive aliases before review.
  // Permit only that independently verified cleanup, and require review rows.
  const activePins=await p.evaluate(()=>Array.from(collectUsedPins().keys(),Number));
  const released=[];
  if(!expected.cluster_serial?.enabled)for(const key of ['tx_pin','rx_pin']){
   const pin=expected.cluster_serial?.[key];
   if(pin>=0&&activePins.includes(pin)){released.push({key,pin});expected.cluster_serial[key]=-1;}
  }
  await p.locator('#btn-save').click();await p.locator('#save-recap-modal').waitFor({state:'visible'});
  const reviewed=await p.evaluate(()=>_buildChanges());
  assert.equal(reviewed.length,1+released.length,JSON.stringify(reviewed));
  for(const {key,pin} of released)assert.ok(reviewed.some(r=>r.label.includes('OT Cluster serial')&&r.label.includes(key==='tx_pin'?'TX GPIO':'RX GPIO')&&r.was===`GPIO${pin}`&&r.now==='Not assigned'));
  const boot=(await get('/api/data')).boot_count;
  const response=p.waitForResponse(r=>r.url().includes('/api/hardware?source=hardware')&&r.request().method()==='PATCH',{timeout:30000});
  modified=true;await p.locator('#save-recap-confirm-btn').click();const r=await response;assert.ok(r.ok(),await r.text());
  const saved=await returned(boot);assert.equal(saved.hardware.actuators.glow_plug.fuel_delay_ms,newMs);
  assert.deepEqual(saved.hardware.channel_registry,original.hardware.channel_registry);
  assert.deepEqual(saved.settings,original.settings);
  assert.deepEqual(saved.hardware,expected,'Only the delay and explicitly reviewed inactive-pin cleanup may change');
  passed=true;
  console.log(`${info.target}: delay-only edit and real save passed (${oldMs} -> ${newMs} ms); no name, enable, channel or settings change; ${released.length} conflicting disabled serial pin(s) explicitly reviewed and released.`);
 }finally{
  await browser.close();
  if(modified){
   const boot=(await get('/api/data')).boot_count;
   const r=await fetch(base+'/api/ecu_config',{method:'POST',headers:{'Content-Type':'application/json',Connection:'close'},body:JSON.stringify(original),signal:AbortSignal.timeout(30000)});
   assert.ok(r.ok,await r.text());const restored=await returned(boot);assert.deepEqual(restored,original);
   const final=await get('/api/device_info');assert.equal(final.state,'STANDBY');assert.equal(final.outputs_active,false);
   fs.writeFileSync(`${out}/${info.target}-single-edit-result.json`,JSON.stringify({passed,device:info,oldMs,newMs,originalRestored:true},null,2));
   console.log('Complete original engine configuration restored exactly; outputs inactive.');
  }
 }
})().catch(e=>{console.error(e);process.exit(1)});
