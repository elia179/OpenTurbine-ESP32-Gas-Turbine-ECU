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
   let posts=0;const lostResponse=r=>{if(r.request().method()==='POST'){posts++;return r.abort('failed');}return r.continue();};
   const engineFile=/\/api\/ecu_config(?:\?|$)/;
   await p.route(engineFile,lostResponse);
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
   await p.evaluate(()=>{const real=window.fetch;window.fetch=(url,options)=>new URL(url,location.href).pathname==='/api/ecu_config'&&options?.method==='POST'?new Promise((resolve,reject)=>{window.__heldRestore=true;options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));}):real(url,options);});
   await p.clock.install();await p.locator('#cfg-restore-file').setInputFiles(file);await p.locator('#ot-dialog-confirm').click();
   await p.waitForFunction(()=>window.__heldRestore);await p.clock.fastForward(15001);
   await p.waitForFunction(()=>document.getElementById('cfg-backup-state').textContent==='Unconfirmed');
   assert.equal(posts,1);assert.equal(await p.locator('#reboot-overlay.show').count(),0);assert.ok(await p.locator('#cfg-restore-btn').isEnabled());
   await p.unroute(engineFile,lostResponse);
   await p.goto(base+'/system.html');await p.waitForFunction(()=>runtimeMode==='STANDBY');
   let boot=4;
   await p.route('**/api/status',r=>r.fulfill({json:{boot_count:boot,profile_match:true},headers:{'X-OpenTurbine-ECU':'0123456789ab'}}));
   await p.route(engineFile,async r=>{
    if(r.request().method()!=='POST')return r.continue();
    posts++;
    const url=new URL(r.request().url());
    assert.equal(url.searchParams.get('ecu_id'),'0123456789ab');
    assert.equal(url.searchParams.get('boot_count'),'4');
    const response=await r.fetch();assert.equal(response.ok(),true);
    boot++;
    return r.abort('connectionclosed');
   });
   const crossChip=JSON.parse(file.buffer);crossChip.hardware.platform='esp32';
   await p.locator('#cfg-restore-file').setInputFiles({...file,buffer:Buffer.from(JSON.stringify(crossChip))});
   await p.locator('#ot-dialog-confirm').waitFor();
   assert.match(await p.locator('#ot-dialog-message').textContent(),/different chip/);
   await p.locator('#ot-dialog-confirm').click();
   await p.waitForFunction(()=>document.getElementById('cfg-backup-state')?.textContent==='Verified');
   assert.equal(posts,2);
   // Returning to a section from the same document must refresh the editors.
   await p.goto(base+'/system.html');
   await p.waitForFunction(()=>typeof OTShowRebootOverlay==='function' && document.getElementById('system-backup-restore'));
   await p.evaluate(()=>{
    window.beforeRebootDocument=true;
    OTShowRebootOverlay({returnPath:'/system.html#system-backup-restore',expectedEcu:'0123456789ab',seconds:3});
   });
   await p.locator('#reboot-overlay.show').waitFor();
   await p.clock.runFor(3100);
   await p.waitForURL('**/system.html#system-backup-restore');
   await p.waitForFunction(()=>!window.beforeRebootDocument && document.getElementById('system-backup-restore')?.open);
   assert.equal(await p.locator('#reboot-overlay.show').count(),0);
   assert.deepEqual(errors,[]);await p.close();
   console.log(`${name} ${gzip?'gzip':'source'}: confirmation locking/cancel, mode recheck, lost response without false success/retry, bounded stalled POST`);
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
