const assert=require('node:assert/strict'),fs=require('node:fs');
const {gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15600+Math.floor(Math.random()*70);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 async function captured(items,n){for(let i=0;i<3000&&items.length<n;i++)await new Promise(r=>setTimeout(r,5));assert.ok(items.length>=n,'Save request not captured');return items[n-1];}
 for(const [name,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch({headless:true});
  try{
   for(const packaged of [false,true]){
    const page=await browser.newPage();
    const ecu='http://192.0.2.42';
    const source=packaged?gunzipSync(fs.readFileSync('data/ui_dialog.js.gz')):fs.readFileSync('data_src/ui_dialog.js');
    let profile='First ECU';
    await page.route(`${ecu}/**`,route=>{
     const path=new URL(route.request().url()).pathname;
     if(path==='/ui_dialog.js')return route.fulfill({contentType:'application/javascript',body:source});
     if(['/api/config','/api/hardware'].includes(path))return route.fulfill({json:{profile_id:profile}});
     return route.fulfill({contentType:'text/html',body:'<script src="/ui_dialog.js"></script>'});
    });
    await page.goto(ecu);
    const readProfile=()=>page.evaluate(async()=>{
     const settings=await OTReadJson('/api/config');
     const hardware=await fetch('/api/hardware',{cache:'no-store'}).then(response=>response.json());
     return [settings.profile_id,hardware.profile_id];
    });
    assert.deepEqual(await readProfile(),['First ECU','First ECU']);
    await page.evaluate(()=>{
     for(const path of ['/api/config','/api/hardware'])
      sessionStorage.setItem('ot-page-cache:'+path,JSON.stringify({at:Date.now(),body:'{"profile_id":"First ECU"}'}));
    });
    profile='Second ECU';
    await page.reload();
    assert.deepEqual(await readProfile(),['Second ECU','Second ECU'],'fresh config reads must reach the connected ECU despite an old session cache');
    let settingsReads=0;
    await page.route(ecu+'/api/config', route => {
     if (++settingsReads === 1) return route.abort('connectionclosed');
     return route.fulfill({json:{profile_id:'New settings after save'}});
    });
    assert.equal(await page.evaluate(async()=> (await OTReadJson('/api/config')).profile_id), 'New settings after save');
    assert.equal(settingsReads,2,'an interrupted Settings response must be retried from the beginning');
    await page.close();
   }
   for(const gzip of [false,true])for(const surface of ['system','controllers']){
   const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(system\.html|controllers\.html|app\.js|style\.css|theme\.js|ui_dialog\.js)(?:\?.*)?$/,async r=>{
    const file=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
   });
   await p.request.post(base+'/__sim/scenario/full');await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',config_locked:false,dev_mode:false}});await p.goto(base+'/'+surface+'.html');
   const key=surface==='system'?'tm_lh':'tot_limit',id='cf-'+key;
   await p.waitForFunction(id=>typeof cfg!=='undefined'&&document.getElementById(id)&&typeof OTSaveConfigPatch==='function'&&runtimeMode==='STANDBY'&&!isLocked,id);
   await p.route('**/api/status',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({max_alloc_heap:40000})}));
   const writes=[],hardware=[];
   await p.route(/\/api\/config(?:\?.*)?$/,r=>r.request().method()==='PATCH'?writes.push(r):r.continue());
   await p.route('**/api/hardware?*',r=>r.request().method()==='PATCH'?hardware.push(r):r.continue());
   async function start(value){await p.evaluate(({id,value})=>{const e=document.getElementById(id);e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));collectConfigFields();window.__save=_doSave();},{id,value});}
   const value=surface==='system'?450:760;
   await start(value);
   assert.equal(new URL((await captured(writes,1)).request().url()).searchParams.get('ecu_id'),'0123456789ab');
   assert.ok(await p.locator('#btn-save').isDisabled());assert.ok(await p.locator('#btn-discard').isDisabled());
   // Keyboard focus cannot enter a pending editing surface, even after rerender.
   await p.evaluate(id=>{renderForm();_updateWorkspaceState();document.getElementById(id).focus();},id);
   assert.ok(await p.evaluate(id=>document.activeElement!==document.getElementById(id),id));
   await p.keyboard.type('999');assert.equal(await p.locator('#'+id).inputValue(),String(value));
   await p.evaluate(()=>_doSave());assert.equal(writes.length,1);
   await writes[0].fulfill({json:{ok:true},headers:{'X-OpenTurbine-ECU':'0123456789ab'}});await p.evaluate(()=>__save);
   assert.equal(await p.evaluate(()=>!!OTSetup.state().config),surface==='controllers','only a Controllers save records Controllers progress');
   assert.equal(await p.evaluate(()=>_cfgDirty||_cfgSavePending),false);assert.equal(await p.locator('#cfg-form').getAttribute('aria-busy'),'false');
   // A malformed success response must retain the draft and enable a deliberate retry.
   await start(value+10);await(await captured(writes,2)).fulfill({status:200,contentType:'application/json',body:'not JSON'});await p.evaluate(()=>__save);
   assert.ok(await p.evaluate(()=>_cfgDirty));assert.ok(await p.locator('#btn-save').isEnabled());assert.equal(await p.locator('#'+id).inputValue(),String(value+10));
   assert.match(await p.locator('#save-msg').textContent(),/unconfirmed/i);
   await p.evaluate(()=>{window.__save=_doSave();});await(await captured(writes,3)).fulfill({status:400,contentType:'application/json',body:'{"ok":false,"error":"test rejection"}'});await p.evaluate(()=>__save);
   assert.ok(await p.evaluate(()=>_cfgDirty));assert.match(await p.locator('#save-msg').textContent(),/test rejection/);
   await p.evaluate(()=>{window.__save=_doSave();});await(await captured(writes,4)).fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});await p.evaluate(()=>__save);
   assert.equal(await p.evaluate(()=>_cfgDirty),false);
   // A mixed save must carry both edits in one request and keep the draft on a false acknowledgement.
   await p.evaluate(surface=>{if(surface==='system'){setSystemHardware('profile_id','Pending test');}else{hwCfg.safety.overtemp=!hwCfg.safety.overtemp;_controllerHardwareDirty=true;_markDirty();}},surface);
   await start(value+15);
   const mixed=await captured(hardware,1),body=mixed.request().postDataJSON();
   assert.equal(new URL(mixed.request().url()).searchParams.get('source'),surface);
   assert.equal(new URL(mixed.request().url()).searchParams.get('ecu_id'),'0123456789ab');
   if(surface==='system'){
    assert.equal(body.profile_id,'Pending test');
    assert.equal(body._settings_patch.telemetry.control_loop_hz,value+15);
   }else{
    assert.equal(typeof body.safety.overtemp,'boolean');
    assert.equal(body._settings_patch.engine.tot_limit,value+15);
   }
   await mixed.fulfill({status:200,contentType:'application/json',body:'{}'});await p.evaluate(()=>__save);
   assert.ok(await p.evaluate(()=>_cfgDirty));assert.equal(writes.length,4);assert.match(await p.locator('#save-msg').textContent(),/unconfirmed/i);
   if(surface==='controllers'){
    await p.evaluate(()=>{
     OTSetup.clear();OTSetup.mark('tools');
     window.OTShowRebootOverlay=()=>{};
     window.__save=_doSave();
    });
    const retried=await captured(hardware,2);
    assert.deepEqual(retried.request().postDataJSON(),body);
    await retried.fulfill({json:{ok:true,reboot:true},headers:{'X-OpenTurbine-ECU':'0123456789ab'}});
    await p.evaluate(()=>__save);
    const progress=await p.evaluate(()=>OTSetup.state());
    assert.ok(progress.config,'an acknowledged mixed Controllers save records progress');
    assert.equal(progress.tools,undefined,'the mixed Controllers change invalidates prior actuator-test activity');
   }
   // Exercise a stalled real helper call through the page save lifecycle.
   await p.evaluate(()=>{_controllerHardwareDirty=false;_systemHardwareDirty=false;const real=window.fetch;window.__realSaveFetch=real;window.fetch=(url,options)=>new URL(url,location.href).pathname==='/api/config'&&options?.method==='PATCH'?new Promise((resolve,reject)=>{window.__stalled=true;options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));}):real(url,options);});
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
   const observedSwitch = await p.evaluate(async ({id,value}) => {
     const field=document.getElementById(id);
     field.value=String(value);
     field.dispatchEvent(new Event('input',{bubbles:true}));
     collectConfigFields();
     const identity = id => new Response('{}',{headers:{'X-OpenTurbine-ECU':id}});
     OTSetup.scope(identity('abcdef012345'));
     OTSetup.scope(identity('0123456789ab'));
     let patches = 0;
     window.fetch=async (url, options)=>{
       if (options?.method === 'PATCH') patches++;
       return new Response('{}',{status:503});
     };
     await _doSave();
     return {patches, dirty:_cfgDirty, message:document.getElementById('save-msg').textContent};
   },{id,value:value+45});
   assert.equal(observedSwitch.dirty,true);
   assert.match(observedSwitch.message,/Reload this page/);
   assert.equal(observedSwitch.patches,0);
   await p.route('**/api/hardware',route=>route.fulfill({
    json:{profile_id:'Second ECU'},headers:{'X-OpenTurbine-ECU':'abcdef012345'}
   }));
   await p.reload();
   await p.locator('#cfg-form').getByText(/The connected ECU changed while loading/).waitFor();
   assert.deepEqual(errors,[]);await p.close();console.log(`${name} ${gzip?'gzip':'source'} ${surface}: pending edit/duplicate lock survives rerender; malformed/rejected saves retain draft; deliberate retry succeeds; mixed save uses one request; timeout unlocks without retry`);
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
