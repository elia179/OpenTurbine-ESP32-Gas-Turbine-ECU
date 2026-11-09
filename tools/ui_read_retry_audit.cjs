const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15131;await import('./ui_mock_server.mjs');const base='http://127.0.0.1:15131';
 for(const [name,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch();
  try{for(const packed of [false,true]){
   const p=await browser.newPage();
   await p.addInitScript(()=>{localStorage.setItem('ot_beta_notice_ack_v1','1');localStorage.setItem('ot_theme_onboarded_v1','1');});
   if(packed)await p.route(/\/(?:system\.html|sequence\.html|app\.js|theme\.js|ui_dialog\.js)(?:\?.*)?$/,r=>{const file=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({contentType:file.endsWith('html')?'text/html':'application/javascript',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});});
   await p.request.post(base+'/__sim/scenario/full');
   let configAttempts=0;
   await p.route('**/api/config',r=>++configAttempts<=4?r.fulfill({status:503,headers:{'Retry-After':'1'},json:{error:'Snapshot busy'}}):r.continue());
   await p.goto(base+'/system.html');
   await p.waitForFunction(()=>typeof cfg!=='undefined'&&cfg.profile_id&&typeof _fieldSnap!=='undefined'&&Object.keys(_fieldSnap).length>0,null,{timeout:30000});
   assert.equal(configAttempts,5,'System must recover after four busy replies');
   await p.unroute('**/api/config');
   let hardwareAttempts=0;
   await p.route('**/api/hardware',r=>++hardwareAttempts<=4?r.fulfill({status:503,headers:{'Retry-After':'1'},json:{error:'Snapshot busy'}}):r.continue());
   await p.goto(base+'/sequence.html');
   // Allow renderer startup under the complete multi-browser gate. The
   // transport retry count, Retry-After and operation budgets remain asserted.
   await p.waitForFunction(()=>typeof _seqLoading!=='undefined'&&!_seqLoading&&!document.querySelector('main').inert,null,{timeout:30000}).catch(async error=>{
    console.error('Sequence retry loader diagnostics',JSON.stringify({name,packed,hardwareAttempts,state:await p.evaluate(()=>({loading:typeof _seqLoading==='undefined'?null:_seqLoading,inert:document.querySelector('main')?.inert,text:document.body.innerText.slice(-1500)}))}));throw error;
   });
   assert.equal(hardwareAttempts,5,'Sequence must recover after four busy replies');
   let delayAttempts=0;
   await p.route('**/api/__read_delay',r=>++delayAttempts===1?r.fulfill({status:503,headers:{'Retry-After':'1'},json:{error:'Busy'}}):r.fulfill({json:{ready:true}}));
   const delayed=await p.evaluate(async()=>{const start=Date.now();const result=await OTReadJson('/api/__read_delay');return {result,elapsed:Date.now()-start};});
   assert.deepEqual(delayed.result,{ready:true});assert(delayed.elapsed>=900,'Retry-After must be honoured');assert.equal(delayAttempts,2);
   for(const [path,status,body] of [['rejected',400,'{"error":"Invalid request"}'],['malformed',200,'invalid JSON']]){
    let calls=0;await p.route('**/api/__read_'+path,r=>{calls++;return r.fulfill({status,contentType:'application/json',body});});
    const error=await p.evaluate(async path=>{try{await OTReadJson('/api/__read_'+path);return '';}catch(e){return e.message;}},path);
    assert(error);assert.equal(calls,1,`${path} must not be replayed`);
   }
   let busyCalls=0;await p.route('**/api/__read_busy',r=>{busyCalls++;return r.fulfill({status:503,json:{error:'Still busy'}});});
   const failure=await p.evaluate(async()=>{try{await OTReadJson('/api/__read_busy',{attempts:2});return '';}catch(e){return e.message;}});
   assert.equal(failure,'Still busy');assert.equal(busyCalls,2,'Retry exhaustion must remain bounded');
   busyCalls=0;
   const deadline=await p.evaluate(async()=>{const start=Date.now();try{await OTReadJson('/api/__read_busy',{attempts:10,budgetMs:200});return null;}catch(e){return {message:e.message,elapsed:Date.now()-start};}});
   assert.equal(deadline.message,'Still busy');assert.equal(busyCalls,1);assert(deadline.elapsed<1000,'A Retry-After wait must not exceed the operation budget');
   await p.close();console.log(`PASS ${name} ${packed?'gzip':'source'}: System/Sequence busy recovery, Retry-After, permanent rejection, malformed JSON and bounded exhaustion`);
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
