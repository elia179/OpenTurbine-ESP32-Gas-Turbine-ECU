const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
const {guidedFixture}=require('./guided_build_fixture.cjs');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15400+Math.floor(Math.random()*100);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 for(const [name,engine] of Object.entries({chromium,firefox,webkit})) {
  const browser=await engine.launch({headless:true});
  try{for(const gzip of [false,true]) {
   const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{for(const key of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1','ot_gs_dismissed'])localStorage.setItem(key,'1');});
   if(gzip)await page.route(/\/(controllers\.html|app\.js|style\.css|theme\.js)(?:\?.*)?$/,async r=>{
    const file=new URL(r.request().url()).pathname.split('/').pop();
    await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
   });
   await page.request.post(base+'/__sim/reset');
   const initial=await(await page.request.get(base+'/__sim/state')).json(),state=guidedFixture(initial,2);
   const pump=state.hardware.channel_registry.outputs.find(row=>row.purpose==='oil_pump');
   state.hardware.channel_registry.outputs.push({...pump,id:'oil_pump_2',name:'Second oil pump',pin:38});
   const first=state.hardware.oil_loops[0];
   Object.assign(first,{low_pressure_response:3,feedback_loss_response:2,immediate_pump_run_s:9});
   state.hardware.oil_loops.push({...first,id:'oil2',pump_output:'oil_pump_2',low_pressure_response:1,feedback_loss_response:3});
   await page.request.post(base+'/api/ecu_config',{data:state});
   await page.request.post(base+'/__sim/data',{data:{mode:'STANDBY',config_locked:false,dev_mode:false}});
   await page.goto(base+'/controllers.html');await page.locator('#oil-loop-protection-1').waitFor({state:'attached'});
   await page.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
   const controller=page.locator('[data-group="oil-loop-oil_pump"]'),protection=page.locator('#oil-loop-protection-0');
   assert.equal(await controller.getByLabel('If running pressure stays low').count(),0);
   assert.equal(await controller.getByLabel('Low-pressure threshold (bar)').count(),0);
   assert.equal(await controller.getByLabel('If pressure feedback is lost').count(),1);
   assert.equal(await protection.getByLabel('Low-pressure threshold (bar)').count(),1);
   assert.equal(await protection.getByLabel('Pump-only time after immediate stop (s)').inputValue(),'9');
   assert.equal(await page.locator('[data-group="oil-loop-oil_pump_2"]').getByLabel('Pump-only time after immediate stop (s)').count(),1);
   assert.equal(await page.locator('[data-group="safety"] #oil-loop-protection-1').count(),1);
   assert.ok(!/This output can affect starting, combustion, or shutdown/.test(await page.locator('body').innerText()));
   await protection.getByLabel('Low-pressure threshold (bar)').fill('1.7');
   await protection.getByLabel('Low-pressure threshold (bar)').press('Tab');
   assert.equal(await page.evaluate(()=>hwCfg.oil_loops[0].low_pressure_bar),1.7);
   assert.equal(await page.evaluate(()=>hwCfg.oil_loops[1].low_pressure_bar),first.low_pressure_bar);
   await page.evaluate(async()=>{OTDialog.confirm=async()=>true;await saveConfig();});
   await page.locator('#save-recap-confirm-btn').click();
   await page.waitForFunction(()=>!_controllerHardwareDirty&&!_cfgSavePending);
   await page.reload();await page.locator('#oil-loop-protection-1').waitFor({state:'attached'});
   assert.equal(await page.evaluate(()=>hwCfg.oil_loops[0].low_pressure_bar),1.7);
   assert.equal(await page.evaluate(()=>hwCfg.oil_loops[1].low_pressure_bar),first.low_pressure_bar);
   await page.setViewportSize({width:390,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
   const warnings=await page.evaluate(async()=>{
    const messages=[];OTDialog.alert=async text=>messages.push(text);OTDialog.confirm=async text=>{messages.push(text);return true;};
    const n1=controllerInputs('n1_speed')[0];
    hwCfg.channel_registry.inputs.push({...n1,id:'test_n2',name:'Power shaft',purpose:'n2_speed'});
    hwCfg.controllers.dynamic_idle=true;cfg.dynamic_idle.fuel_mode=4;
    cfg.dynamic_idle.source=1;cfg.dynamic_idle.target_rpm=5000;cfg.dynamic_idle.rpm_limit=12000;
    cfg.engine.n2_rpm_limit=60000;cfg.engine.min_rpm=15000;cfg.safety.underspeed_enabled=true;
    cfg.oil.map_min=10;cfg.oil.map_max=1;
    await validateBeforeSave(cfg);const n2=messages.join('\n');messages.length=0;
    cfg.dynamic_idle.source=0;await validateBeforeSave(cfg);const n1Active=messages.join('\n');messages.length=0;
    cfg.safety.underspeed_enabled=false;await validateBeforeSave(cfg);return {n2,n1Active,n1Off:messages.join('\n')};
   });
   assert.doesNotMatch(warnings.n2,/N1 idle target|Normal Running Oil Pressure/);
   assert.match(warnings.n1Active,/N1 idle target.*enabled N1 underspeed trip/);
   assert.doesNotMatch(warnings.n1Off,/N1 idle target/);
   await page.evaluate(()=>{hwCfg.oil_loops[0].pressure_input='missing';renderForm(true);_applyAllVisibility();applyView();document.querySelectorAll('details').forEach(el=>el.open=true);});
   assert.match(await protection.locator(':scope > summary').innerText(),/Pressure input unavailable/);
   assert.equal(await protection.locator(':scope > summary [data-enabled]').getAttribute('data-enabled'),'false');
   assert.deepEqual(errors,[]);await page.close();
   console.log(`${name} ${gzip?'gzip':'source'}: two oil circuits, protection placement, fallback and save/reload passed`);
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
