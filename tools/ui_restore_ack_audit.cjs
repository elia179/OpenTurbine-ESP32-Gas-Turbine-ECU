const assert=require('node:assert/strict'),fs=require('node:fs');
const {gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15300+Math.floor(Math.random()*70);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 for(const [name,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch({headless:true});
  try{for(const gzip of [false,true]){
   const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(system\.html|app\.js|style\.css|theme\.js)(?:\?.*)?$/,async r=>{
    const file=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
   });
   await p.request.post(base+'/__sim/scenario/minimal');await p.goto(base+'/system.html');
   await p.waitForFunction(()=>typeof runtimeMode!=='undefined'&&runtimeMode==='STANDBY');
   const file={name:'engine.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(await(await p.request.get(base+'/api/ecu_config')).json()))};
   let posts=0;await p.route('**/api/ecu_config',r=>{if(r.request().method()==='POST'){posts++;return r.abort('failed');}return r.continue();});
   // Lock before confirmation: a second selection must not queue another dialog or write.
   await p.locator('#cfg-restore-file').setInputFiles(file);await p.locator('#ot-dialog-confirm').waitFor();
   assert.ok(await p.locator('#cfg-restore-btn').isDisabled());
   await p.locator('#cfg-restore-file').setInputFiles(file);assert.equal(posts,0);
   await p.locator('#ot-dialog-cancel').click();
   assert.ok(await p.locator('#cfg-restore-btn').isEnabled());assert.equal(await p.locator('#cfg-restore-file').inputValue(),'');
   // Starting while the modal was open must block the previously permitted restore.
   await p.locator('#cfg-restore-file').setInputFiles(file);await p.locator('#ot-dialog-confirm').waitFor();
   await p.evaluate(()=>{runtimeMode='RUNNING';});await p.locator('#ot-dialog-confirm').click();
   await p.waitForFunction(()=>document.getElementById('cfg-backup-state').textContent==='Blocked');assert.equal(posts,0);
   await p.evaluate(()=>{runtimeMode='STANDBY';});
   // A lost response is an unknown outcome, never successful merely because status is reachable.
   await p.locator('#cfg-restore-file').setInputFiles(file);await p.locator('#ot-dialog-confirm').click();
   await p.waitForFunction(()=>document.getElementById('cfg-backup-state').textContent==='Unconfirmed');
   assert.equal(posts,1);assert.match(await p.locator('#cfg-backup-msg').textContent(),/not sent again.*download the current engine file/i);
   assert.equal(await p.locator('#reboot-overlay.show').count(),0);assert.ok(await p.locator('#cfg-restore-btn').isEnabled());
   // A stalled POST is bounded too. Use a controlled fetch that only rejects on actual abort.
   await p.evaluate(()=>{const real=window.fetch;window.fetch=(url,options)=>url==='/api/ecu_config'&&options?.method==='POST'?new Promise((resolve,reject)=>{window.__heldRestore=true;options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));}):real(url,options);});
   await p.clock.install();await p.locator('#cfg-restore-file').setInputFiles(file);await p.locator('#ot-dialog-confirm').click();
   await p.waitForFunction(()=>window.__heldRestore);await p.clock.fastForward(15001);
   await p.waitForFunction(()=>document.getElementById('cfg-backup-state').textContent==='Unconfirmed');
   assert.equal(posts,1);assert.equal(await p.locator('#reboot-overlay.show').count(),0);assert.ok(await p.locator('#cfg-restore-btn').isEnabled());
   assert.deepEqual(errors,[]);await p.close();
   console.log(`${name} ${gzip?'gzip':'source'}: confirmation locking/cancel, mode recheck, lost response without false success/retry, bounded stalled POST`);
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
