const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15127;await import('./ui_mock_server.mjs');const base='http://127.0.0.1:15127',browser=await chromium.launch();
 try{for(const packed of [false,true]){
  const p=await browser.newPage();await p.addInitScript(()=>{localStorage.setItem('ot_beta_notice_ack_v1','1');localStorage.setItem('ot_theme_onboarded_v1','1');});
  if(packed)await p.route(/\/(?:calibration\.html|app\.js|ui_dialog\.js)(?:\?.*)?$/,r=>{const file=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({contentType:file.endsWith('html')?'text/html':'application/javascript',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});});
  await p.goto(base+'/calibration.html');await p.waitForFunction(()=>typeof patchHardware==='function'&&typeof OTSaveHardwarePatch==='function');
  const result=await p.evaluate(async()=>{
   const actualFetch=window.fetch,actualAlert=window.alert;const messages=[];let callbacks=0,writes=0;
   window.alert=message=>messages.push(message);
   try{
    for(const body of ['{}','null','not JSON','{"ok":false,"error":"rejected"}','{"ok":true}']){
     window.fetch=async(url,options)=>options?.method==='PATCH'?(writes++,new Response(body,{status:200})):actualFetch(url,options);
     await patchHardware({channel_registry_calibration:{id:'unassigned-test-input',scale:123.456}},()=>callbacks++);
    }
    return {callbacks,writes,messages};
   }finally{window.fetch=actualFetch;window.alert=actualAlert;}
  });assert.equal(result.callbacks,1);assert.equal(result.writes,5);assert.equal(result.messages.length,4);assert(result.messages.slice(0,3).every(s=>s.includes('unconfirmed')));assert(result.messages[3].includes('rejected'));
  console.log('PASS '+(packed?'compressed':'source')+' calibration callbacks require an explicit save acknowledgement');await p.close();
 }}finally{await browser.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
