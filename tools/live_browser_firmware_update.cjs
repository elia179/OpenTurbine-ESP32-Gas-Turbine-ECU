// Flash the current same-target image through the actual System page on an unloaded fixture.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {joinFixtureWifi}=require('./fixture_wifi_helper.cjs');
const {chromium}=require('playwright');
if(!process.argv.includes('--allow-write'))throw Error('Requires --allow-write on the confirmed unloaded fixture');
const target=process.argv[2],out=process.argv[3],base='http://192.168.4.1';
assert(['esp32dev','esp32s3dev'].includes(target));assert(out);
let recoveredReadRetries=0;
const read=async path=>{for(let n=0;n<5;n++){try{const r=await fetch(base+path,{headers:{Connection:'close'},signal:AbortSignal.timeout(15000)});if(r.status===503&&n<4){recoveredReadRetries++;await new Promise(r=>setTimeout(r,500));continue;}assert(r.ok,`${path}: ${r.status}`);return await r.json();}catch(error){if(error instanceof assert.AssertionError||error instanceof SyntaxError||n===4)throw error;recoveredReadRetries++;await new Promise(r=>setTimeout(r,500));}}};
(async()=>{
 const before=await read('/api/ecu_config');let info=await read('/api/device_info');assert.equal(info.target,target);assert.equal(info.outputs_active,false);
 // A preceding web update can still be settling through an unloaded shutdown.
 // Observe it; never upload while active or bypass the ECU's maintenance gate.
 for(let n=0;info.state==='SHUTDOWN'&&!info.outputs_active&&n<90;n++){await new Promise(r=>setTimeout(r,1000));info=await read('/api/device_info');}
 assert(['STANDBY','FAULT'].includes(info.state),'unsafe initial engine state');assert.equal(info.outputs_active,false);
 const bootBefore=(await read('/api/data')).boot_count;
 const image=fs.readFileSync(`.pio3/${target}/firmware.bin`);assert.equal(image.readUInt32LE(32),0xABCD5432);const expectedBuild=image.subarray(176,184).toString('hex');
 const browser=await chromium.launch();let finalText;const errors=[];const chunks=[];
 try{
  const p=await browser.newPage();p.on('pageerror',e=>{errors.push(e.message);console.log('Browser error: '+e.message);});p.on('request',r=>{if(r.url().includes('/api/firmware_chunk')){chunks.push(r.url());if(chunks.length===1||chunks.length%80===0)console.log(target+': update chunk '+chunks.length);}});
  await p.addInitScript(()=>{for(const key of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(key,'1');});
  await p.goto(base+'/system.html',{waitUntil:'domcontentloaded',timeout:45000});
  await p.waitForFunction(state=>runtimeMode===state&&document.getElementById('ota-file')&&!document.querySelector('main').inert&&typeof cfg!=='undefined'&&cfg.profile_id&&typeof _fieldSnap!=='undefined'&&Object.keys(_fieldSnap).length>0&&typeof startSystemOTA==='function',info.state,{timeout:30000});
  assert(await p.locator('#ota-btn').isEnabled(),'Updater must be interactive before file selection');
  console.log(target+': System editor ready; selecting firmware.');
  await p.locator('#ota-file').setInputFiles(`.pio3/${target}/firmware.bin`);
  await p.waitForTimeout(300);console.log('Update state: '+JSON.stringify(await p.evaluate(()=>({state:document.getElementById('ota-state')?.textContent,message:document.getElementById('ota-msg')?.textContent,dialogs:[...document.querySelectorAll('[role=dialog]')].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.textContent)}))));
  await p.waitForFunction(()=>/^(Done|Error)/.test(document.getElementById('ota-state')?.textContent||''),null,{timeout:300000});
  finalText=await p.locator('#ota-state').textContent();assert(finalText.startsWith('Done'),await p.locator('#ota-msg').textContent());assert.deepEqual(errors,[]);
 }finally{await browser.close();}
 let final,verified=false;
 for(let n=0;n<25;n++){
  await new Promise(r=>setTimeout(r,2000));
  try{
   if(process.platform==='win32'&&n%3===0)joinFixtureWifi(before.hardware.profile_id);
   final=await read('/api/device_info');if(final.target===target&&final.state===info.state&&!final.outputs_active&&final.build_id===expectedBuild&&(await read('/api/data')).boot_count!==bootBefore){
    const after=await read('/api/ecu_config');assert.deepEqual(after,before);verified=true;break;
   }
  }catch(error){if(n===24)throw error;}
 }
 assert(verified&&final&&final.target===target&&final.state===info.state&&!final.outputs_active);assert(chunks.length>1);
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(`${out}/${target}-browser-ota.json`,JSON.stringify({passed:true,before:info,after:final,finalText,chunks:chunks.length,errors,configurationUnchanged:true,expectedBuild,recoveredReadRetries},null,2));
 console.log(`${target}: actual System firmware updater accepted ${chunks.length} chunks, reported success, reconnected and preserved the complete engine file.`);
})().catch(e=>{console.error(e);process.exit(1)});
