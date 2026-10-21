const assert=require('node:assert/strict'),fs=require('node:fs');
const {gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=14900+Math.floor(Math.random()*70);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 for(const [name,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch({headless:true});
  try{for(const gzip of [false,true]){
   const p=await browser.newPage({viewport:{width:400,height:1000}}),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1','ot_tool_confirmations_skip_all'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(tools\.html|app\.js|style\.css|theme\.js)(?:\?.*)?$/,async r=>{
    const file=new URL(r.request().url()).pathname.split('/').pop();
    await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
   });
   await p.request.post(base+'/__sim/reset');await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',extra_cooldown_active:false,stop_switch_active:false}});
   await p.request.patch(base+'/api/config',{data:{tools:{glow_test_ms:1000}}});
   await p.request.patch(base+'/api/hardware',{data:{actuators:{glow_plug:{enabled:true,type:2,pin:17,fuel_pin:16}}}});
   await p.goto(base+'/tools.html');await p.waitForFunction(()=>toolsTelemetryAvailable&&document.querySelector('#btn-GLOW_TEST')?.disabled===false);
   await p.evaluate(()=>{stopToolsTelemetry();window.__toolAlerts=[];window.alert=m=>__toolAlerts.push(String(m));});
   let held,count=0;
   await p.route('**/api/command',r=>{held=r;count++;});
   await p.locator('#btn-GLOW_TEST').click();await p.waitForFunction(()=>toolRequestPending);
   assert.ok(await p.locator('#btn-GLOW_TEST').isDisabled());assert.ok(await p.locator('#btn-test-settings').isDisabled());
   await p.evaluate(()=>runTool('GLOW_ONLY_TEST'));assert.equal(count,1,'A pending request must not be sent twice');
   await p.evaluate(()=>saveTestSettings());assert.match(await p.locator('#test-settings-status').innerText(),/Wait for the current test/);
   await held.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
   await p.waitForFunction(()=>activeId==='GLOW_TEST'&&!toolRequestPending);assert.ok(await p.locator('#btn-test-settings').isDisabled());
   await p.evaluate(()=>setToolsConnection(false));assert.equal(await p.locator('#state-GLOW_TEST').innerText(),'Status unavailable');
   await p.clock.install();await p.clock.runFor(1200);
   assert.doesNotMatch(await p.locator('#state-GLOW_TEST').innerText(),/Done|Ready/);
   assert.ok(await p.locator('#btn-GLOW_TEST').isDisabled());assert.equal(count,1);
   await p.evaluate(()=>{setToolsConnection(true);applyData({mode:'STANDBY',stop_switch_active:false});localStorage.removeItem('ot_tool_confirmations_skip_all');});
   // A STOP transition while the confirmation is open must prevent dispatch.
   await p.locator('#btn-GLOW_TEST').click();await p.locator('#ot-dialog-confirm').waitFor({state:'visible'});
   await p.evaluate(()=>applyData({mode:'STANDBY',stop_switch_active:true}));await p.locator('#ot-dialog-confirm').click();
   assert.equal(count,1);assert.match(await p.evaluate(()=>__toolAlerts.at(-1)),/STOP/);
   await p.evaluate(()=>{applyData({mode:'STANDBY',stop_switch_active:false});localStorage.setItem('ot_tool_confirmations_skip_all','1');});
   // Abort an unanswered request at the bounded timeout; never auto-retry it.
   held=null;await p.locator('#btn-GLOW_TEST').click();await p.waitForFunction(()=>toolRequestPending);
   assert.equal(count,2);await p.clock.runFor(8100);
   await p.waitForFunction(()=>!toolRequestPending&&!toolsTelemetryAvailable);
   assert.equal(await p.evaluate(()=>activeId),null);assert.match(await p.evaluate(()=>__toolAlerts.at(-1)),/may have started/);
   await held.abort().catch(()=>{});await p.clock.runFor(20000);assert.equal(count,2);
   // HTTP 200 without an ECU acknowledgement must not start a fake countdown.
   await p.evaluate(()=>setToolsConnection(true));held=null;await p.locator('#btn-GLOW_TEST').click();await p.waitForFunction(()=>toolRequestPending);
   await held.fulfill({status:200,contentType:'application/json',body:'{}'});
   await p.waitForFunction(()=>!toolRequestPending&&!toolsTelemetryAvailable);assert.equal(await p.evaluate(()=>activeId),null);
   assert.equal(count,3);
   // A de-energizing command remains available even with an outstanding
   // request and unavailable telemetry; it must not release the other owner.
   const stopRequest=p.waitForRequest(r=>r.url().endsWith('/api/command'));
   held=null;
   const stopping=p.evaluate(()=>{toolRequestPending=true;return postToolCommand({cmd:'EXTRA_COOLDOWN',iParam:0});}).catch(e=>({error:e.message}));
   await stopRequest;
   for(let i=0;i<100&&!held;i++)await new Promise(r=>setTimeout(r,5));
   assert.ok(held,'Stop route was not captured');
   await held.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});assert.equal((await stopping).ok,true);
   assert.equal(count,4);assert.equal(await p.evaluate(()=>toolRequestPending),true);
   await p.evaluate(async()=>{toolRequestPending=false;await pollToolsTelemetry();});
   assert.ok(await p.locator('#btn-GLOW_TEST').isEnabled());assert.equal(count,4,'Reconnect must not resend commands');
   // Replay the actual device transport, not only the simulator's expanded JSON.
   const compact=JSON.parse(fs.readFileSync('tools/fixtures/compact-telemetry-v2.json','utf8'));
   let frame=compact;
   await p.route('**/api/telemetry',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(frame)}));
   await p.evaluate(()=>pollToolsTelemetry());assert.equal(await p.evaluate(()=>toolsTelemetryAvailable),true);assert.ok(await p.locator('#btn-GLOW_TEST').isEnabled());
   frame={...compact,m:2};await p.evaluate(()=>pollToolsTelemetry());assert.equal(await p.evaluate(()=>engineMode),'RUNNING');assert.ok(await p.locator('#btn-GLOW_TEST').isDisabled());
   frame={...compact,f:(compact.f|(1<<22))>>>0};await p.evaluate(()=>pollToolsTelemetry());assert.ok(await p.locator('#btn-GLOW_TEST').isDisabled());assert.match(await p.locator('#btn-GLOW_TEST').getAttribute('title'),/STOP/);
   for(const invalid of [{...compact,v:[]},{...compact,cv:3},{...compact,h:undefined},{mode:'nonsense'}]){
    frame=invalid;await p.evaluate(()=>pollToolsTelemetry());assert.equal(await p.evaluate(()=>toolsTelemetryAvailable),false);assert.ok(await p.locator('#btn-GLOW_TEST').isDisabled());
   }
   frame=compact;await p.evaluate(()=>pollToolsTelemetry());assert.ok(await p.locator('#btn-GLOW_TEST').isEnabled());assert.equal(count,4);
   assert.deepEqual(errors,[]);await p.close();
   console.log(`${name} ${gzip?'gzip':'source'}: single pending request, settings lock, fresh confirmation checks, offline status, bounded lost-ack timeout, no retries and malformed-ack rejection passed`);
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
