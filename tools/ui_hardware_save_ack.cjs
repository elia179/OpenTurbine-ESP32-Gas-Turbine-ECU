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
  const result=await p.evaluate(async()=>{
   const actualFetch=window.fetch,actualAlert=window.alert;const messages=[];let reboots=0,writes=0;
   window.alert=message=>messages.push(message);showRebootOverlay=()=>reboots++;
   const result=[];
   try{
    for(const body of ['{}','null','not JSON','{"ok":false,"error":"rejected"}','{"ok":true}']){
     cfg.profile_desc='edited draft';dirty();
     window.fetch=async(url,options)=>options?.method==='PATCH'?(writes++,new Response(body,{status:200})):actualFetch(url,options);
     const pending=_doSave();if(!document.querySelector('main').inert||!document.getElementById('btn-discard').disabled)throw Error('pending editor not locked');await _doSave();await pending;if(_hwSavePending||document.querySelector('main').inert)throw Error('editor not restored');result.push({body,dirty:_hwDirty,status:document.getElementById('save-msg').textContent});
    }
    return {result,reboots,writes,messages};
   }finally{window.fetch=actualFetch;window.alert=actualAlert;}
  });assert.equal(result.reboots,1);assert.equal(result.writes,5);assert(result.result.slice(0,4).every(r=>r.dirty));assert.equal(result.result[4].dirty,false);assert(result.result.slice(0,3).every(r=>r.status.includes('unconfirmed')));
  console.log('PASS '+(packed?'compressed':'source')+' hardware preserves drafts and requires an explicit save acknowledgement');await p.close();
 }}finally{await browser.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
