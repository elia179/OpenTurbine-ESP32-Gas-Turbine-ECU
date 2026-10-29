// Reproduce documented controller/sequence recipes with ordinary UI controls.
// Hardware fixtures stand in for the wired, calibrated parts; no physical ECU.
const assert=require('node:assert/strict');
const {clickSaveControls}=require('./save_controls_helper.cjs');
const {chromium}=require('playwright');
const {guidedFixture,example:e}=require('./guided_build_fixture.cjs');
(async()=>{
  globalThis.OT_UI_SIM_PORT=12600+Math.floor(Math.random()*200);
  await import('./ui_mock_server.mjs');const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
  const browser=await chromium.launch({headless:true,...(process.env.OT_BROWSER_EXECUTABLE?{executablePath:process.env.OT_BROWSER_EXECUTABLE}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1200,height:1000}});page.setDefaultTimeout(10000);
    const errors=[];page.on('pageerror',err=>errors.push(err.message));
    await page.addInitScript(()=>{localStorage.setItem('ot_beta_notice_ack_v1','1');localStorage.setItem('ot_theme_onboarded_v1','1');localStorage.setItem('ot_gs_dismissed','1');});
    const initial=await(await page.request.get(base+'/__sim/state')).json();
    const state=guidedFixture(initial,1);state.settings.rules=[];state.hardware.oil_loops=[];state.hardware.controllers.oil_loop=false;
    // The walkthrough starts after Build 1's physical channel/calibration checks.
    // Remove the answers for the controller and sequence tasks tested below.
    for(const tab of ['startup','shutdown']){state.hardware[tab+'_seq']=[];state.hardware[tab+'_enter_actions']=[];state.hardware[tab+'_exit_actions']=[];state.hardware[tab+'_delay_ms']=[];}
    await page.request.post(base+'/api/ecu_config',{data:state});
    await page.request.post(base+'/__sim/data',{data:{mode:'STANDBY',config_locked:false,dev_mode:false,tot:25,n1:0,n2:0,oil:0}});
    const open=async selector=>{const node=page.locator(selector).first();if(await node.getAttribute('open')===null)await node.locator(':scope > summary').click();};
    const labelControl=label=>page.locator('label.cfg-field').filter({has:page.locator('.cfg-label').filter({hasText:new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})}).locator('input,select').first();
    const fill=async(locator,value)=>{await locator.fill(String(value));await locator.press('Tab');};
    const saveControllers=async()=>{
      await clickSaveControls(page);
      const warning=page.getByRole('button',{name:'Save anyway',exact:true});
      if(await warning.isVisible())throw Error('Recipe has unresolved save warnings: '+await page.locator('.ot-dialog-overlay.show').innerText());
      const written=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/config'&&['POST','PATCH'].includes(response.request().method()),{timeout:30000});
      written.catch(()=>{});
      await page.locator('#save-recap-confirm-btn').click();await written;
      await page.waitForFunction(()=>document.querySelector('#save-msg')?.textContent.includes('Saved'));
      await page.reload();await page.locator('#controller-overview').waitFor();
    };
    await page.goto(base+'/controllers.html');await open('.controller-create-card');
    await page.locator('#new-controller-output').selectOption('main_fuel');await page.getByRole('button',{name:'Create controller',exact:true}).click();
    await open('[data-controller-output="main_fuel"]');
    await page.locator('[data-controller-output="main_fuel"]').screenshot({path:'artifacts/guided-recipe-controller.png'});
    await fill(page.getByLabel('Controller name',{exact:true}),'Main Fuel');
    await labelControl('Control method').selectOption({label:'Map input to output'});
    await labelControl('Controlled by').selectOption('operator_throttle');
    for(const [label,value]of [['Input low (%)',0],['Input high (%)',100],['Output low (%)',e.fuel_idle_pct],['Output high (%)',e.fuel_max_pct]])await fill(page.getByLabel(label,{exact:true}),value);
    await page.getByLabel('Activate: Entering Running',{exact:true}).check();await page.getByLabel('Deactivate: Entering Shutdown',{exact:true}).check();await page.getByLabel('Deactivate: Entering Standby',{exact:true}).check();
    await open('.controller-create-card');await page.locator('#new-oil-loop-output').selectOption('oil_pump');await page.locator('#new-oil-loop-pressure').selectOption('oil_pressure_main');await page.getByRole('button',{name:'Create oil-pressure controller',exact:true}).click();
    await open('[data-group="oil-loop-oil_pump"]');await open('[data-group="oil-loop-oil_pump"] .protection-card');
    await labelControl('Pressure target set by').selectOption({label:'Fixed pressure'});await fill(labelControl('Pressure target (bar)'),e.oil_target_bar);
    await fill(labelControl('Low-pressure threshold (bar)'),e.oil_min_bar);await fill(labelControl('Low-pressure confirmation (ms)'),e.oil_confirm_ms);
    await labelControl('If pressure feedback is lost').selectOption({label:'Normal fault shutdown'});await labelControl('If running pressure stays low').selectOption({label:'Normal fault shutdown'});
    await saveControllers();
    let saved=await(await page.request.get(base+'/api/ecu_config')).json();
    assert.equal(saved.settings.rules.length,1);assert.equal(saved.settings.rules[0].output_min,e.fuel_idle_pct/100);assert.equal(saved.hardware.oil_loops[0].target_bar,e.oil_target_bar);
    console.log('Build 1 fuel and oil creators, fields, recap save and reload reproduced.');
    await page.goto(base+'/sequence.html');
    const add=async(tab,title,kind)=>{
      await page.locator('#tab-'+tab).getByRole('button',{name:'+ Add block',exact:true}).click();
      let option=page.locator('#block-picker-list button').filter({has:page.locator('strong').filter({hasText:new RegExp('^'+title+'$')})});
      if(kind)option=option.filter({hasText:kind});await option.click();
      const node=page.locator('#list-'+tab+' > .block-card').last();await node.locator('.block-header').click();return node;
    };
    const field=(node,label)=>node.locator('.param-field').filter({has:page.locator('.param-label').filter({hasText:new RegExp('^(?:.* — )?'+label+'(?: \\(|$)')})}).first().locator('input,select').first();
    const oil=await add('startup','Build Oil Pressure','UNTIL');await fill(field(oil,'Oil pressure target'),e.oil_target_bar);await fill(field(oil,'Minimum pressure before ignition'),e.oil_min_bar);await fill(field(oil,'Timeout'),e.prime_timeout_ms);
    const crank=await add('startup','Set Starter','UNTIL');await fill(field(crank,'Starter demand'),e.starter_pct);await fill(field(crank,'Pre-ignition N1 target'),e.n1_crank_rpm);await fill(field(crank,'Timeout'),e.crank_timeout_ms);
    for(const [title,value]of [['Set Igniter','1'],['Set Fuel Shutoff','1'],['Set Main Fuel Metering',e.fuel_idle_pct]]){
      const node=await add('startup',title,'ACTION'),control=field(node,title==='Set Main Fuel Metering'?'Demand':'Command');
      if(title==='Set Main Fuel Metering')await fill(control,value);else await control.selectOption(value);
    }
    const temp=await add('startup','Confirm Combustion by Temperature','UNTIL');await fill(field(temp,'Target EGT'),e.tot_lightoff_c);await fill(field(temp,'Timeout'),e.lightoff_timeout_ms);
    const checks=await add('startup','Final Startup Checks','CHECK');
    await field(checks,'Require N1').check();await fill(field(checks,'Minimum accepted N1'),e.n1_final_min_rpm);await field(checks,'Require oil pressure').check();await fill(field(checks,'Running Low-Pressure Limit'),e.oil_min_bar);await field(checks,'Require engine temperature').check();await fill(field(checks,'Minimum accepted EGT'),e.tot_lightoff_c);await fill(field(checks,'Stable time required'),e.stable_ms);await fill(field(checks,'Overall timeout'),e.stable_timeout_ms);
    for(const title of ['Set Starter','Set Igniter']){const node=await add('startup',title,'ACTION');if(title==='Set Starter')await fill(field(node,'Demand'),0);else await field(node,'Command').selectOption('0');}
    await add('startup','Final Startup Checks','CHECK');
    assert.equal(await page.locator('#list-startup > .block-card').count(),10);
    // Read-only inspection: compare the ordinary UI's edited state with the guide.
    let result=await page.evaluate(()=>({blocks:hwCfg.startup_seq,settings:cfg,actions:hwCfg.startup_enter_actions,errors:validateSequenceHardwareForSave()}));
    assert.deepEqual(result.errors,[]);assert.equal(result.settings.oil.startup_min_bar,e.oil_min_bar);assert.equal(result.actions[4][0].value,e.fuel_idle_pct/100);assert.equal(result.actions[7][0].value,0);
    console.log('Build 1 ten-block Startup reproduced through the block picker and visible fields.');
    await page.getByRole('button',{name:'Shutdown',exact:true}).click();
    for(const title of ['Immediate Fuel and Ignition Cut','Wait for Rotor to Slow','Cooldown','Wait for Complete Stop'])await add('shutdown',title);
    assert.equal(await page.locator('#list-shutdown > .block-card').count(),4);
    await clickSaveControls(page,'#save-btn');
    const notice=page.locator('.ot-dialog-overlay.show');await notice.waitFor();
    assert.match(await notice.innerText(),/SafetyHold present but no Spool/,'known 2.6.0 advisory is documented, not silently ignored');
    const sequenceWritten=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/config'&&response.request().method()==='PATCH',{timeout:30000});sequenceWritten.catch(()=>{});
    await notice.getByRole('button',{name:'Save anyway',exact:true}).click();await sequenceWritten;
    await page.waitForFunction(()=>document.querySelector('#save-status')?.textContent.includes('Saved'));
    await page.reload();assert.equal(await page.locator('#list-startup > .block-card').count(),10);
    saved=await(await page.request.get(base+'/api/ecu_config')).json();assert.equal(saved.hardware.shutdown_seq.length,4);assert.equal(saved.hardware.startup_enter_actions[7][0].value,0);
    console.log('Both paths saved and reloaded, including explicit starter cut and the documented 2.6.0 advisory.');
    // Build 2/3 field recipes start at their explicit cumulative hardware baseline.
    const second=guidedFixture(initial,2);second.settings.dynamic_idle.fuel_mode=1;second.hardware.controllers.dynamic_idle=false;second.settings.rules[0].output_min=e.fuel_idle_pct/100;
    await page.request.post(base+'/api/ecu_config',{data:second});await page.goto(base+'/controllers.html');
    await open('[data-controller-output="main_fuel"]');await fill(page.getByLabel('Output low (%)',{exact:true}),e.fuel_min_pct);
    await open('[data-built-in="fuel-support"]');await open('[data-built-in="fuel-support"] [data-subcard="Idle"]');await page.locator('#cf-fi_mode').selectOption('4');
    await page.locator('#cf-di_src').selectOption('0');await fill(page.locator('#cf-di_tr'),e.n1_idle_rpm);await fill(page.locator('#cf-di_rl'),e.n1_idle_cutoff_rpm);await fill(page.locator('#cf-di_db'),e.n1_idle_deadband_rpm);await fill(page.locator('#cf-th_mx'),e.fuel_idle_ceiling_pct);
    await open('[data-built-in="fuel-support"] [data-subcard="Idle"] details:has(#cf-di_mx)');await fill(page.locator('#cf-di_mx'),1);await saveControllers();
    saved=await(await page.request.get(base+'/api/ecu_config')).json();assert.equal(saved.settings.dynamic_idle.fuel_mode,4);assert.equal(saved.settings.rules[0].output_min,e.fuel_min_pct/100);
    const third=guidedFixture(initial,3);Object.assign(third.settings.rules[0],{kind:1,name:'Main Fuel',source:'operator_throttle'});
    await page.request.post(base+'/api/ecu_config',{data:third});await page.goto(base+'/controllers.html');await open('[data-controller-output="main_fuel"]');
    await fill(page.getByLabel('Controller name',{exact:true}),'Main Fuel N2 Governor');await labelControl('Control method').selectOption({label:'Hold a feedback target'});await labelControl('Feedback signal').selectOption('n2_main');
    await labelControl('How is the target selected?').selectOption({label:'Fixed value'});await fill(labelControl('Target (RPM)'),e.n2_target_rpm);
    await fill(labelControl('Minimum output (%)'),e.fuel_idle_pct);await fill(labelControl('Maximum output (%)'),e.fuel_max_pct);
    assert.equal(await labelControl('Feedback signal').inputValue(),'n2_main');assert.equal(await labelControl('Minimum output (%)').inputValue(),String(e.fuel_idle_pct));
    await saveControllers();saved=await(await page.request.get(base+'/api/ecu_config')).json();assert.equal(saved.settings.rules.length,1);assert.equal(saved.settings.rules[0].kind,2);assert.equal(saved.settings.rules[0].target_fixed,e.n2_target_rpm);assert.equal(saved.settings.dynamic_idle.fuel_mode,1);
    assert.deepEqual(errors,[]);console.log('Build 2 automatic idle and Build 3 fuel-controller conversion reproduced and persisted without a second owner.');
  }finally{await browser.close();}
  process.exit(0);
})().catch(error=>{console.error(error);process.exit(1);});
