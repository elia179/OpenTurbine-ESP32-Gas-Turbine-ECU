const assert=require('node:assert/strict'),fs=require('node:fs');
const {gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15600+Math.floor(Math.random()*70);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 async function captured(items,n){for(let i=0;i<3000&&items.length<n;i++)await new Promise(r=>setTimeout(r,5));assert.ok(items.length>=n,'Save request not captured');return items[n-1];}
 for(const [name,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch({headless:true});
  try{for(const gzip of [false,true])for(const surface of ['system','controllers']){
   const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(system\.html|controllers\.html|app\.js|style\.css|theme\.js)(?:\?.*)?$/,async r=>{
    const file=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
   });
   await p.request.post(base+'/__sim/scenario/full');await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',config_locked:false,dev_mode:false}});await p.goto(base+'/'+surface+'.html');
   const key=surface==='system'?'tm_lh':'tot_limit',id='cf-'+key;
   await p.waitForFunction(id=>typeof cfg!=='undefined'&&document.getElementById(id)&&typeof OTSaveConfigPatch==='function'&&runtimeMode==='STANDBY'&&!isLocked,id);
   await p.route('**/api/status',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({max_alloc_heap:40000})}));
   const writes=[],hardware=[];
   await p.route('**/api/config',r=>r.request().method()==='PATCH'?writes.push(r):r.continue());
   await p.route('**/api/hardware?*',r=>r.request().method()==='PATCH'?hardware.push(r):r.continue());
   async function start(value){await p.evaluate(({id,value})=>{const e=document.getElementById(id);e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));collectConfigFields();window.__save=_doSave();},{id,value});}
   const value=surface==='system'?450:760;
   await start(value);await captured(writes,1);
   assert.ok(await p.locator('#btn-save').isDisabled());assert.ok(await p.locator('#btn-discard').isDisabled());
   // Keyboard focus cannot enter a pending editing surface, even after rerender.
   await p.evaluate(id=>{renderForm();_updateWorkspaceState();document.getElementById(id).focus();},id);
   assert.ok(await p.evaluate(id=>document.activeElement!==document.getElementById(id),id));
   await p.keyboard.type('999');assert.equal(await p.locator('#'+id).inputValue(),String(value));
   await p.evaluate(()=>_doSave());assert.equal(writes.length,1);
   await writes[0].fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});await p.evaluate(()=>__save);
   assert.equal(await p.evaluate(()=>_cfgDirty||_cfgSavePending),false);assert.equal(await p.locator('#cfg-form').getAttribute('aria-busy'),'false');
   // A malformed success response must retain the draft and enable a deliberate retry.
   await start(value+10);await(await captured(writes,2)).fulfill({status:200,contentType:'application/json',body:'not JSON'});await p.evaluate(()=>__save);
   assert.ok(await p.evaluate(()=>_cfgDirty));assert.ok(await p.locator('#btn-save').isEnabled());assert.equal(await p.locator('#'+id).inputValue(),String(value+10));
   assert.match(await p.locator('#save-msg').textContent(),/unconfirmed/i);
   await p.evaluate(()=>{window.__save=_doSave();});await(await captured(writes,3)).fulfill({status:400,contentType:'application/json',body:'{"ok":false,"error":"test rejection"}'});await p.evaluate(()=>__save);
   assert.ok(await p.evaluate(()=>_cfgDirty));assert.match(await p.locator('#save-msg').textContent(),/test rejection/);
   await p.evaluate(()=>{window.__save=_doSave();});await(await captured(writes,4)).fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});await p.evaluate(()=>__save);
   assert.equal(await p.evaluate(()=>_cfgDirty),false);
   // Page-owned Hardware rejection must not clear dirty state or send phase two.
   await p.evaluate(surface=>{if(surface==='system'){setSystemHardware('profile_id','Pending test');}else{hwCfg.safety.overtemp=!hwCfg.safety.overtemp;_controllerHardwareDirty=true;_markDirty();}window.__save=_doSave();},surface);
   await(await captured(hardware,1)).fulfill({status:200,contentType:'application/json',body:'{}'});await p.evaluate(()=>__save);
   assert.ok(await p.evaluate(()=>_cfgDirty));assert.equal(writes.length,4);assert.match(await p.locator('#save-msg').textContent(),/unconfirmed/i);
   // Exercise a stalled real helper call through the page save lifecycle.
   await p.evaluate(()=>{_controllerHardwareDirty=false;_systemHardwareDirty=false;const real=window.fetch;window.__realSaveFetch=real;window.fetch=(url,options)=>url==='/api/config'&&options?.method==='PATCH'?new Promise((resolve,reject)=>{window.__stalled=true;options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));}):real(url,options);});
   await p.clock.install();await start(value+20);await p.waitForFunction(()=>window.__stalled);await p.clock.fastForward(15001);await p.evaluate(()=>__save);
   assert.ok(await p.evaluate(()=>_cfgDirty&&!_cfgSavePending));assert.ok(await p.locator('#btn-save').isEnabled());assert.match(await p.locator('#save-msg').textContent(),/unconfirmed/i);assert.equal(writes.length,4);
   if(surface==='system') {
    // A stalled memory-status preflight must eventually allow the save attempt.
    await p.evaluate(()=>{const real=window.__realSaveFetch;window.__statusReads=0;window.fetch=(url,options)=>url==='/api/status'?new Promise((resolve,reject)=>{window.__statusReads++;options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));}):real(url,options);});
    await start(value+30);await p.waitForFunction(()=>window.__statusReads>0);await p.clock.runFor(17000);
    await(await captured(writes,5)).fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});await p.evaluate(()=>__save);
    assert.equal(await p.evaluate(()=>_cfgSavePending||_cfgDirty),false);assert.ok(await p.evaluate(()=>window.__statusReads>0));
   }
   // Preserve the shared helper's object-shaped failure contract for other pages.
   const failure=await p.evaluate(async()=>{window.fetch=async()=>new Response('null',{status:503,headers:{'Content-Type':'application/json'}});const result=await OTSaveConfigPatch({});return {status:result.response.status,data:result.data};});
   assert.deepEqual(failure,{status:503,data:{}});
   assert.deepEqual(errors,[]);await p.close();console.log(`${name} ${gzip?'gzip':'source'} ${surface}: pending edit/duplicate lock survives rerender; malformed/rejected saves retain draft; deliberate retry succeeds; Hardware false ack blocks phase two; timeout unlocks without retry`);
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
