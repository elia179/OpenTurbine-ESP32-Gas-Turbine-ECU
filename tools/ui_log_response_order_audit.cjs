const assert=require('node:assert/strict'),fs=require('node:fs');
const {gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15100+Math.floor(Math.random()*70);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 const csv=(n,value=700)=>'t_ms,tot_c\n'+Array.from({length:n},(_,i)=>`${i*100},${value}`).join('\n');
 async function captured(items,n){for(let i=0;i<200&&items.length<n;i++)await new Promise(r=>setTimeout(r,5));assert.ok(items.length>=n,'Read request not captured');return items[n-1];}
 const reply=(r,body,status=200)=>r.fulfill({status,contentType:'application/json',body});
 for(const [name,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch({headless:true});
  try{for(const gzip of [false,true]){
   const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(log\.html|app\.js|style\.css|theme\.js)(?:\?.*)?$/,async r=>{
    const file=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
   });
   await p.request.post(base+'/__sim/reset');await p.goto(base+'/log.html');await p.locator('#tab-session').click();
   await p.waitForFunction(()=>typeof _sessionTabLoad!=='undefined'&&_sessionTabLoad===null);
   const lists=[],current=[],past=[];
   await p.route('**/api/session/list',r=>{lists.push(r);});
   await p.route('**/api/session/log*',r=>{(new URL(r.request().url()).searchParams.has('run')?past:current).push(r);});
   await p.evaluate(()=>{renderSessionCsvPreview('t_ms,tot_c\n0,600\n100,700');window.__listA=loadSessionList();});
   await captured(lists,1);await p.evaluate(()=>{window.__listB=loadSessionList();});
   await reply(await captured(lists,2),'[42]');await p.evaluate(()=>__listB);
   await reply(lists[0],'[]');await p.evaluate(()=>__listA);
   assert.match(await p.locator('#session-list-wrap').innerText(),/Run #42/);assert.equal(await p.evaluate(()=>_sessionRows.length),2);
   await p.evaluate(()=>{window.__listC=loadSessionList();});await reply(await captured(lists,3),'{}');await p.evaluate(()=>__listC);
   assert.match(await p.locator('#session-list-wrap').innerText(),/Failed to load/);assert.doesNotMatch(await p.locator('#session-list-wrap').innerText(),/No session files/);
   await p.evaluate(()=>{window.__listD=loadSessionList();});await reply(await captured(lists,4),'[99]');await p.evaluate(()=>__listD);
   assert.match(await p.locator('#session-list-wrap').innerText(),/Run #99/);
   await p.evaluate(()=>{window.__currentA=loadSessionPreview();});await captured(current,1);
   await p.evaluate(()=>{window.__currentB=loadSessionPreview();});await reply(await captured(current,2),csv(2));await p.evaluate(()=>__currentB);
   await reply(current[0],'{"error":"old request failed"}',404);await p.evaluate(()=>__currentA);
   assert.match(await p.locator('#session-rows').innerText(),/2 rows/);assert.ok(await p.locator('#session-current-download').isEnabled());assert.equal(await p.evaluate(()=>_sessionRows.length),2);
   // Current-file availability can update without replacing a selected past run.
   await p.evaluate(()=>{window.__currentC=loadSessionPreview();});await captured(current,3);
   await p.evaluate(()=>{window.__past=previewSession(77);});await reply(await captured(past,1),csv(2,777));await p.evaluate(()=>__past);
   await reply(current[2],csv(5,500));await p.evaluate(()=>__currentC);
   assert.match(await p.locator('#session-rows').innerText(),/5 rows/);assert.equal(await p.evaluate(()=>_sessionPreviewRun),77);assert.equal(await p.evaluate(()=>_sessionRows.length),2);
   assert.match(await p.locator('#session-preview-msg').innerText(),/Run #77/);assert.deepEqual(errors,[]);await p.close();
   console.log(`${name} ${gzip?'gzip':'source'}: stale list/empty/error responses ignored, invalid list explained, current availability and selected historical preview remain consistent`);
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
