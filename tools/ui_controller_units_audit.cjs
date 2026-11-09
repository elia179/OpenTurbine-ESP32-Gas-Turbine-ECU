const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
const {guidedFixture}=require('./guided_build_fixture.cjs');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15600+Math.floor(Math.random()*100);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 for(const [name,engine] of Object.entries({chromium,firefox,webkit})){
  const browser=await engine.launch({headless:true});
  try{for(const gzip of [false,true]){
   const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{for(const key of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1','ot_gs_dismissed'])localStorage.setItem(key,'1');localStorage.setItem('ot_units',JSON.stringify({temp:'C',press:'bar'}));});
   if(gzip)await page.route(/\/(controllers\.html|app\.js|style\.css|theme\.js)(?:\?.*)?$/,async r=>{
    const file=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
   });
   await page.request.post(base+'/__sim/reset');
   const initial=await(await page.request.get(base+'/__sim/state')).json(),state=guidedFixture(initial,2);
   const pressure=state.hardware.channel_registry.inputs.find(row=>row.purpose==='oil_pressure');
   const temp=state.hardware.channel_registry.inputs.find(row=>row.purpose==='tot');
   const pump=state.hardware.channel_registry.outputs.find(row=>row.purpose==='oil_pump');
   state.hardware.channel_registry.outputs.push({...pump,id:'pressure_lamp',name:'Pressure lamp',purpose:'generic',driver:4,pin:41},{...pump,id:'temperature_lamp',name:'Temperature lamp',purpose:'generic',driver:4,pin:42},{...pump,id:'pressure_valve',name:'Pressure valve',purpose:'generic',driver:5,pin:38});
   state.settings.rules.push({controller_id:45,name:'Pressure lamp',enabled:true,kind:0,source:pressure.id,target:'pressure_lamp',threshold:4.5,hysteresis:.25,op:0,mode_mask:4},
    {controller_id:46,name:'Temperature lamp',enabled:true,kind:0,source:temp.id,target:'temperature_lamp',threshold:60.25,hysteresis:5.5,op:0,mode_mask:4},
    {controller_id:47,name:'Pressure valve',enabled:true,kind:2,source:pressure.id,target:'pressure_valve',target_source_type:0,target_fixed:4,target_low:3,target_high:5,output_min:0,output_max:1,response_gain:.02,integral_gain:.005,integral_limit:.3,deadband:.1,mode_mask:4});
   Object.assign(state.settings.dynamic_idle,{fuel_mode:3,input_id:temp.id,input_low:10.1234567,input_high:100.9876543});
   state.settings.safety.p1_trip_bar=4.567891;
   state.settings.cluster.oil_warn_bar=1.23456789;
   delete state.settings.safety.p1_trip_enabled; // Older files derive enable from their retained limit.
   state.hardware.oil_loops[0].target_bar=4.512345;
   await page.request.post(base+'/api/ecu_config',{data:state});
   await page.request.post(base+'/__sim/data',{data:{mode:'STANDBY',config_locked:false,dev_mode:false}});
   await page.goto(base+'/controllers.html');await page.locator('[data-controller-id="46"]').waitFor({state:'attached'});
   await page.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
   assert.equal(await page.locator('[data-group="safety"] #cf-pb_min').count(),1);
   assert.equal(await page.locator('#throttle #cf-pb_min').count(),0);
   const original=await page.evaluate(()=>({cfg:JSON.stringify(cfg),loops:JSON.stringify(hwCfg.oil_loops)}));
   await page.locator('#cf-sf_p1en').uncheck();await page.evaluate(()=>collectConfigFields());
   await page.locator('#cf-sf_p1en').check();await page.evaluate(()=>collectConfigFields());
   assert.equal(await page.evaluate(()=>Object.hasOwn(cfg.safety,'p1_trip_enabled')),false,'undoing a legacy toggle restores the original representation');
   for(let i=0;i<3;i++){
    await page.evaluate(()=>{setConfigPressUnit('psi');setConfigTempUnit('F');setConfigPressUnit('bar');setConfigTempUnit('C');});
    assert.equal(await page.evaluate(()=>_buildChanges().length),0,JSON.stringify(await page.evaluate(()=>_buildChanges())));
    assert.deepEqual(await page.evaluate(()=>{collectConfigFields();return {cfg:JSON.stringify(cfg),loops:JSON.stringify(hwCfg.oil_loops)};}),original,'display precision must not overwrite saved values');
   }
   await page.evaluate(()=>{setConfigPressUnit('psi');setConfigTempUnit('F');document.querySelectorAll('details').forEach(el=>el.open=true);});
   const oil=page.locator('[data-group="oil-loop-oil_pump"]');
   assert.ok(Math.abs(Number(await oil.getByLabel('Pressure target (PSI)',{exact:true}).inputValue())-4.512345*14.5038)<.001);
   assert.ok(Math.abs(Number(await oil.getByLabel('Response gain (per PSI)',{exact:true}).inputValue())-1.8/14.5038)<1e-7);
   const pressureRule=page.locator('[data-controller-id="45"]'),temperatureRule=page.locator('[data-controller-id="46"]');
   assert.ok(Math.abs(Number(await pressureRule.getByLabel('Switch point (PSI)',{exact:true}).inputValue())-4.5*14.5038)<1e-8);
   assert.ok(Math.abs(Number(await temperatureRule.getByLabel('Switch point (°F)',{exact:true}).inputValue())-140.45)<1e-8);
   assert.ok(Math.abs(Number(await temperatureRule.getByLabel('Hysteresis (°F)',{exact:true}).inputValue())-9.9)<1e-8);
   const feedback=page.locator('[data-controller-id="47"]');
   assert.ok(Math.abs(Number(await feedback.getByLabel('Immediate response (% / PSI)',{exact:true}).inputValue())-2/14.5038)<1e-10);
   await feedback.getByLabel('Immediate response (% / PSI)',{exact:true}).fill('0.5');await feedback.getByLabel('Immediate response (% / PSI)',{exact:true}).press('Tab');
   await page.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
   assert.ok(Math.abs(await page.evaluate(()=>cfg.rules.find(row=>row.controller_id===47).response_gain)-.5*14.5038/100)<1e-12);
   await oil.getByLabel('Pressure target (PSI)',{exact:true}).fill('60');await oil.getByLabel('Pressure target (PSI)',{exact:true}).press('Tab');
   await page.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
   await temperatureRule.getByLabel('Switch point (°F)',{exact:true}).fill('212');await temperatureRule.getByLabel('Switch point (°F)',{exact:true}).press('Tab');
   await page.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
   await temperatureRule.getByLabel('Hysteresis (°F)',{exact:true}).fill('18');await temperatureRule.getByLabel('Hysteresis (°F)',{exact:true}).press('Tab');
   const edited=await page.evaluate(()=>({oil:hwCfg.oil_loops[0].target_bar,temp:cfg.rules.find(row=>row.controller_id===46),recap:_controllerRuleChanges()}));
   assert.ok(Math.abs(edited.oil-60/14.5038)<1e-10);assert.equal(edited.temp.threshold,100);assert.equal(edited.temp.hysteresis,10);
   assert.ok(edited.recap.some(row=>row.now==='212 °F'));assert.ok(edited.recap.some(row=>row.now==='18 °F'));
   await page.evaluate(()=>{setConfigPressUnit('bar');setConfigTempUnit('C');});
   assert.equal(await page.evaluate(()=>cfg.safety.p1_trip_bar),4.567891);
   if(gzip)await page.route(/\/system\.html(?:\?.*)?$/,r=>r.fulfill({status:200,contentType:'text/html',body:gunzipSync(fs.readFileSync('data/system.html.gz'))}));
   await page.goto(base+'/system.html');await page.locator('#ota-file').waitFor({state:'attached'});
   await page.evaluate(()=>{
    const picker=document.getElementById('ota-file'),files=new DataTransfer();files.items.add(new File(['picker-test'],'picker-test.bin'));picker.files=files.files;window.unitTestPicker=picker;
    setConfigPressUnit('psi');setConfigTempUnit('F');setConfigPressUnit('bar');setConfigTempUnit('C');collectConfigFields();
   });
   assert.equal(await page.evaluate(()=>window.unitTestPicker===document.getElementById('ota-file')),true);
   assert.equal(await page.evaluate(()=>document.getElementById('ota-file').files[0].name),'picker-test.bin');
   assert.equal(await page.evaluate(()=>cfg.cluster.oil_warn_bar),1.23456789);
   assert.equal(await page.evaluate(()=>_buildChanges().length),0);
   await page.evaluate(()=>{setConfigPressUnit('psi');setWorkspaceFilter('explore');document.querySelectorAll('details').forEach(el=>el.open=true);});
   await page.locator('#cf-cl_ow').fill('20.3');await page.locator('#cf-cl_ow').press('Tab');
   await page.evaluate(()=>saveConfig());
   assert.equal(await page.locator('#save-recap-modal').isVisible(),true,'valid engineering values must reach review even between spinner steps');
   assert.ok(Math.abs(await page.evaluate(()=>cfg.cluster.oil_warn_bar)-20.3/14.5038)<1e-12);
   assert.equal(await page.evaluate(()=>hwCfg.mavlink?.enabled===true),false,'preparing display references must not enable the link');
   await page.evaluate(()=>document.getElementById('save-recap-modal').style.display='none');
   await page.locator('#cf-cl_ow').fill('-5');await page.locator('#cf-cl_ow').press('Tab');
   await page.evaluate(()=>saveConfig());
   assert.equal(await page.locator('#save-recap-modal').isVisible(),false,'unit conversion must retain range validation');
   assert.deepEqual(errors,[]);await page.close();console.log(`${name} ${gzip?'gzip':'source'}: consistent units, absolute/delta temperatures, exact saved values and maintenance state passed`);
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(error=>{console.error(error);process.exit(1)});
