const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15130;await import('./ui_mock_server.mjs');const base='http://127.0.0.1:15130';
 for(const [name,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch();
  try{for(const packed of [false,true]){
   const p=await browser.newPage();await p.addInitScript(()=>{localStorage.setItem('ot_beta_notice_ack_v1','1');localStorage.setItem('ot_theme_onboarded_v1','1');});
   if(packed)await p.route(/\/(?:hardware\.html|app\.js|theme\.js|ui_dialog\.js)(?:\?.*)?$/,r=>{const file=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({contentType:file.endsWith('html')?'text/html':'application/javascript',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});});
   await p.goto(base+'/hardware.html');await p.waitForFunction(()=>typeof _hwLoading!=='undefined'&&!_hwLoading&&typeof OTDialog==='object');
   await p.evaluate(()=>{const outside=document.createElement('button');outside.id='outside-focus-test';outside.textContent='Outside dialog';document.body.appendChild(outside);outside.focus();document.getElementById('save-recap-modal').style.display='flex';});
   for(let n=0;n<12;n++){await p.keyboard.press(n%3===0?'Shift+Tab':'Tab');assert(await p.evaluate(()=>document.getElementById('save-recap-modal').contains(document.activeElement)),'focus escaped save recap');}
   await p.evaluate(()=>{document.getElementById('outside-focus-test').focus();});assert(await p.evaluate(()=>document.getElementById('save-recap-modal').contains(document.activeElement)),'programmatic focus escaped recap');
   await p.evaluate(()=>{document.getElementById('save-recap-modal').style.display='none';window.__dialogResult=OTDialog.confirm('Review before proceeding');});
   for(let n=0;n<10;n++){await p.keyboard.press(n%2?'Shift+Tab':'Tab');assert(await p.evaluate(()=>document.getElementById('ot-app-dialog').contains(document.activeElement)),'focus escaped confirmation');}
   await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>__dialogResult),false);
   assert(await p.evaluate(()=>!document.getElementById('ot-app-dialog').classList.contains('show')));console.log(`${name} ${packed?'compressed':'source'}: save recap and confirmation retain keyboard focus, Escape cancels`);await p.close();
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
