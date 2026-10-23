const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=16600+Math.floor(Math.random()*60);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 for(const engine of [chromium,firefox,webkit]){
  const browser=await engine.launch({headless:true});
  try{for(const gzip of [false,true]){
   const p=await browser.newPage({viewport:{width:800,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(calibration\.html|controllers\.html|hardware\.html|app\.js|theme\.js|style\.css)(?:\?.*)?$/,async r=>{
    const file=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
   });
   await p.request.post(base+'/__sim/reset');await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',oil_raw:400,oil_healthy:true,stop_switch_active:false}});
   await p.goto(base+'/calibration.html');await p.waitForFunction(()=>cfg.hardware&&live.mode==='STANDBY');
   const result=await p.evaluate(async()=>{
    stopGlobalTelemetry();live.oil_raw=400;
    const commands=[],original=postCalCommand;postCalCommand=async body=>{commands.push(body);return {ok:true};};
    const wait=()=>new Promise(resolve=>{const timer=setInterval(()=>{if(oilCalActive){clearInterval(timer);resolve();}},20);});
    try{
     oilCalStart();await wait();live.oil_raw=3000;document.getElementById('oil-pval').value='5';captureOilPoint();oilGoStep3();
     const sensorCommands=commands.slice(),fit={...oilFit};let saved;
     const save=patchHardwareThenConfig;patchHardwareThenConfig=(hw,done,settings)=>saved={hw,settings};saveOilCal();patchHardwareThenConfig=save;
     document.getElementById('oil-pump-assisted').checked=true;oilCalStart();await wait();oilCalStop();
     return {sensorCommands,fit,saved,pumpCommands:commands.slice()};
    }finally{postCalCommand=original;}
   });
   assert.deepEqual(result.sensorCommands,[]);assert.ok(result.fit.c>0);assert.ok(result.saved.settings.calibration.oil_poly);assert.equal(result.saved.settings.oil,undefined);
   assert.ok(result.pumpCommands.some(c=>c.cmd==='SET_OIL_PCT'));
   await p.goto(base+'/controllers.html');await p.waitForFunction(()=>cfg.rules&&typeof renderForm==='function');
   const cards=await p.evaluate(()=>{
    const options=simpleControlOutputs();const assertAvailable=options.some(o=>o.id==='request_fault');
    createControllerForOutput('request_fault');const index=cfg.rules.findIndex(r=>r.target==='request_fault');
    const owner=document.querySelector(`[data-controller-rule="${index}"]`);owner.open=true;
    updateSimpleControl(index,'name','Renamed fault action');
    if(!document.querySelector(`[data-controller-rule="${index}"]`).open)throw Error('Editing collapsed controller');
    const activation=document.querySelector(`[data-controller-rule="${index}"] [aria-label^="Activate:"]`);
    const nested=!!activation?.closest('details:not([data-controller-card])');
    const safety=document.querySelector('[data-protection="egt"]');if(!safety)throw Error('Missing safety fixture');safety.open=true;
    renderForm(true);
    return {available:assertAvailable,nested,visible:!!activation,safety:document.querySelector('[data-protection="egt"]').open};
   });
   assert.ok(cards.available&&cards.visible&&cards.safety);assert.equal(cards.nested,false);
   await p.goto(base+'/hardware.html');await p.waitForFunction(()=>typeof renderBuiltinInputSummary==='function'&&cfg.channel_registry);
   const duplicate=await p.evaluate(()=>{
    cfg.channel_registry.inputs.push({id:'test_oil_switch',name:'Test oil switch',purpose:'oil_zero_switch',driver:1,pin:35,installed:true});
    cfg.di_channels=[{pin:35,role:'oil_zero_switch',label:'Test oil switch'}];renderBuiltinInputSummary();
    return document.getElementById('builtin-inputs').textContent;
   });
   assert.doesNotMatch(duplicate,/Test oil switch/);
   await p.route('**/api/log',r=>r.fulfill({status:200,contentType:'application/json',body:'{damaged'}));
   await p.goto(base+'/log.html');
   await p.waitForFunction(()=>document.getElementById('runs-container')?.textContent.includes('Event log response could not be read'));
   assert.deepEqual(errors,[]);await p.close();
   console.log(engine.name(),gzip?'gzip':'source','sensor-only/no pump writes, two-point fit, optional pump control, fault action, direct timing, safety expansion and mirrored-switch suppression passed');
  }}finally{await browser.close();}
 }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
