const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15128;await import('./ui_mock_server.mjs');const base='http://127.0.0.1:15128',browser=await chromium.launch();
 try{for(const packed of [false,true]){
  const p=await browser.newPage();await p.addInitScript(()=>{localStorage.setItem('ot_beta_notice_ack_v1','1');localStorage.setItem('ot_theme_onboarded_v1','1');});
  if(packed)await p.route(/\/(?:hardware\.html|app\.js|ui_dialog\.js)(?:\?.*)?$/,r=>{const file=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({contentType:file.endsWith('html')?'text/html':'application/javascript',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});});
  await p.request.post(base+'/__sim/reset');
  let releaseLoad,heldLoad=false;await p.route('**/api/hardware',async r=>{if(r.request().method()==='GET'&&!heldLoad){heldLoad=true;await new Promise(resolve=>releaseLoad=resolve);}return r.continue();});
  await p.goto(base+'/hardware.html');await p.waitForFunction(()=>typeof loadHardware==='function');
  assert(await p.locator('main').evaluate(el=>el.inert),'Hardware must remain locked until baseline is loaded');
  for(let n=0;!releaseLoad&&n<100;n++)await new Promise(resolve=>setTimeout(resolve,5));assert(releaseLoad,'initial Hardware request absent');releaseLoad();
  await p.waitForFunction(()=>typeof _doSave==='function'&&typeof OTSavePatch==='function'&&document.getElementById('save-msg').textContent==='Loaded — no unsaved changes'&&!document.querySelector('main').inert);
  assert.deepEqual(await p.evaluate(()=>[
   friendlyHardwareSaveError({error:'Another configuration update is in progress'}),
   friendlyHardwareSaveError({error:'Hardware patch rejected',detail:'Custom device setting out of range'})
  ]),['Another configuration update is in progress','Hardware patch rejected. Custom device setting out of range']);
  const result=await p.evaluate(async()=>{
   const actualFetch=window.fetch,actualAlert=window.alert;const messages=[];let reboots=0,writes=0;
   window.alert=message=>messages.push(message);showRebootOverlay=()=>reboots++;
   const result=[];
   try{
    for(const body of ['{}','null','not JSON','{"ok":false,"error":"rejected"}','{"ok":true,"reboot":true}']){
     cfg.profile_desc='edited draft';dirty();
     window.fetch=async(url,options)=>{
      if(options?.method!=='PATCH')return actualFetch(url,options);
      if(new URL(url,location.href).searchParams.get('ecu_id')!=='0123456789ab')throw Error('Hardware save omitted its ECU');
      writes++;
      return new Response(body,{status:200});
     };
     const pending=_doSave();if(!document.querySelector('main').inert||!document.getElementById('btn-discard').disabled)throw Error('pending editor not locked');await _doSave();await pending;if(_hwSavePending||document.querySelector('main').inert)throw Error('editor not restored');result.push({body,dirty:_hwDirty,status:document.getElementById('save-msg').textContent});
    }
    for (const ecu of ['abcdef012345','0123456789ab']) {
     cfg.profile_desc='stored with lost response';dirty();
     let submitted;
     window.fetch=async(url,options)=>{
      if(options?.method==='PATCH'){writes++;submitted=JSON.parse(options.body);throw new TypeError('Connection lost');}
      if(new URL(url,location.href).pathname==='/api/ecu_config')
       return new Response(JSON.stringify({hardware:submitted}),{headers:{'X-OpenTurbine-ECU':ecu}});
      return actualFetch(url,options);
     };
     await _doSave();
     if(_hwDirty!==(ecu!=='0123456789ab'))throw Error('Lost save response was not scoped to the original ECU: '+document.getElementById('save-msg').textContent);
     if(!_hwDirty&&!document.getElementById('save-msg').textContent.includes('Saved to ECU storage'))throw Error('Stored save was not confirmed');
    }
    OTSetup.scope(new Response('{}',{headers:{'X-OpenTurbine-ECU':'abcdef012345'}}));
    cfg.profile_desc='draft from the original ECU';dirty();await _doSave();
    if(!_hwDirty||!document.getElementById('save-msg').textContent.includes('Reload this page'))throw Error('Hardware did not keep the blocked draft');
    return {result,reboots,writes,messages};
   }finally{window.fetch=actualFetch;window.alert=actualAlert;}
  });assert.equal(result.reboots,1);assert.equal(result.writes,7);assert(result.result.slice(0,4).every(r=>r.dirty));assert.equal(result.result[4].dirty,false);assert(result.result.slice(0,3).every(r=>r.status.includes('unconfirmed')));
  console.log('PASS '+(packed?'compressed':'source')+' hardware preserves drafts and verifies an interrupted save on the same ECU');await p.close();
 }}finally{await browser.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
