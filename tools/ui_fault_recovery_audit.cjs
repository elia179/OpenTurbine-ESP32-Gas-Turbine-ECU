const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib'),{chromium,firefox,webkit}=require('playwright');
(async()=>{globalThis.OT_UI_SIM_PORT=18773;await import('./ui_mock_server.mjs');const base='http://127.0.0.1:18773';
for(const engine of [chromium,firefox,webkit])for(const compressed of [false,true]){const browser=await engine.launch();try{
const p=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
if(compressed)await p.route(/\/(app\.js|index\.html|style\.css|theme\.js)(?:\?.*)?$/,async r=>{const file=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});});
await p.request.post(base+'/__sim/reset');
const initial={mode:'FAULT',fault_description:'DI fault: channel 1 triggered',fault_latched:true,fault_clear_allowed:true,stop_switch_active:false,limited_start_allowed:false,limited_start_sensor:'TOT',di_channels:[{state:true,pin:35,label:'Low Oil <left>',role:'oil_zero_switch'}],seq_has_errors:false,seq_has_structural_errors:false,extra_cooldown_active:false};
await p.request.post(base+'/__sim/data',{data:initial});await p.goto(base+'/index.html');await p.waitForFunction(()=>_lastData?.fault_latched===true);
assert.equal(await p.locator('#btn-start').isDisabled(),false);assert.match(await p.locator('#fault-desc-text').innerText(),/Low Oil <left>.*GPIO 35.*confirmation/);
assert(await p.locator('#fault-hardware-link').isVisible());assert(await p.locator('#fault-limits-link').isVisible());assert(!(await p.locator('#fault-calibration-link').isVisible()));assert(!(await p.locator('#fault-tools-link').isVisible()));assert.match(await p.locator('#fault-limits-link').getAttribute('href'),/#protection-low_oil$/);
assert.equal(await p.locator('#fault-desc-text left').count(),0);
let commands=[];let acknowledge=true;
await p.route('**/api/command',async route=>{const body=route.request().postDataJSON();commands.push(body.cmd);if(acknowledge)await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',fault_description:'',fault_latched:false,fault_clear_allowed:false,limited_start_allowed:true,tot_healthy:false,limited_start_sensor:'TOT'}});await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});});
await p.evaluate(()=>{OTDialog.confirm=async()=>false;});await p.locator('#btn-start').click();assert.deepEqual(commands,[]);assert(!(await p.locator('#start-confirm-overlay').isVisible()));
await p.evaluate(()=>{OTDialog.confirm=async()=>true;});await p.locator('#btn-start').click();await p.waitForFunction(()=>document.querySelector('#start-confirm-overlay').style.display==='flex');
assert.deepEqual(commands,['CLEAR_FAULT']);assert.equal(await p.locator('#btn-confirm-start').textContent(),'Start Reduced Power');assert.match(await p.locator('#start-confirm-checks').innerText(),/unrelated interlock/);assert.match(await p.locator('#fault-title').textContent(),/Reduced-power start available/);assert(await p.locator('#fault-card').evaluate(e=>e.classList.contains('reduced-start-available')));
// No engine start has happened merely by clearing the fault or opening review.
const started=[];await p.route('**/api/start-limited',async r=>{started.push('limited');await r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});});await p.route('**/api/start',async r=>{started.push('normal');await r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});});
assert.deepEqual(started,[]);await p.locator('#btn-confirm-start').click();await p.waitForTimeout(200);assert.deepEqual(started,['limited']);
// A fault that cannot be acknowledged stays blocked; a remaining fault is
// never treated as STANDBY just because a command was queued successfully.
await p.request.post(base+'/__sim/data',{data:{...initial,fault_clear_allowed:false}});await p.evaluate(async()=>applyData(await(await fetch('/api/data')).json()));assert(await p.locator('#btn-start').isDisabled());
await p.request.post(base+'/__sim/data',{data:initial});await p.evaluate(async()=>{applyData(await(await fetch('/api/data')).json());OTDialog.confirm=async()=>true;});acknowledge=false;
await p.evaluate(()=>{window._testAlerts=[];OTDialog.alert=async message=>{window._testAlerts.push(message);};});await p.locator('#btn-start').click();await p.waitForFunction(()=>window._testAlerts.some(a=>/not returned to STANDBY/.test(a)));assert.deepEqual(started,['limited']);
const modern=await p.evaluate(()=>({oil:faultDescriptionText({fault_description:'OIL_SWITCH: Oil 2'}),input:faultDescriptionText({fault_description:'INPUT_FAULT: Safety switch'}),lost:faultDescriptionText({fault_description:'INPUT_UNAVAILABLE: Remote oil switch'})}));assert.match(modern.oil,/Oil 2.*oil-pressure switch/);assert.match(modern.input,/Safety switch.*Hardware/);assert.match(modern.lost,/became unavailable/);
// Non-switch faults retain the existing calibration/limit/tool actions.
await p.evaluate(async()=>{_telemetryPauseDepth++;await waitForGlobalTelemetryIdle(4000);stopGlobalTelemetry();});
await p.evaluate(()=>applyData({mode:'FAULT',fault_description:'OVERSPEED',fault_latched:true,fault_clear_allowed:false}));assert(!(await p.locator('#fault-hardware-link').isVisible()));assert(await p.locator('#fault-calibration-link').isVisible());assert(await p.locator('#fault-tools-link').isVisible());
for(const width of [1280,800,390]){await p.setViewportSize({width,height:960});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
assert.deepEqual(errors,[]);console.log(engine.name()+' '+(compressed?'gzip':'source')+': named switch diagnostics, contextual links, acknowledgment/cancel, fresh-state verification, separate reduced-start confirmation, blocked clear and mobile passed');
}finally{await browser.close();}}})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
