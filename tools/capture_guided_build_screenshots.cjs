#!/usr/bin/env node
// Capture actual UI from the shared cumulative teaching profile; localhost only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {guidedFixture,example:e}=require('./guided_build_fixture.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'site/assets/images/guided-builds');
const port=12100+Math.floor(Math.random()*300),base=`http://127.0.0.1:${port}`;
(async()=>{
  globalThis.OT_UI_SIM_PORT=port;await import('./ui_mock_server.mjs');
  const browser=await chromium.launch({headless:true,...(process.env.OT_BROWSER_EXECUTABLE?{executablePath:process.env.OT_BROWSER_EXECUTABLE}:{})});
  const errors=[];
  try{
    const page=await browser.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:1.5});
    page.on('pageerror',err=>errors.push(err.message));
    const initial=await(await page.request.get(`${base}/__sim/state`)).json();
    await page.goto(base);await page.evaluate(()=>{
      localStorage.setItem('ot_beta_notice_ack_v1','1');localStorage.setItem('ot_theme_onboarded_v1','1');localStorage.setItem('ot_gs_dismissed','1');localStorage.setItem('ot_theme','carbon');localStorage.setItem('ot_units',JSON.stringify({temp:'C',press:'bar'}));
    });
    const load=async(level,route,{workshops=false,edit}={})=>{
      const state=guidedFixture(initial,level,{workshops});if(edit)edit(state);
      await page.request.post(`${base}/api/ecu_config`,{data:state});
      await page.request.post(`${base}/__sim/data`,{data:{mode:'STANDBY',config_locked:false,dev_mode:false,n1:0,n2:0,tot:25,oil:0,p1:0,throttle:0,throttle_input:0,throttle_input_valid:true,labels:state.hardware.labels,fuel_pump_min_pct:e.fuel_min_pct,last_event:'STANDBY'}});
      await page.goto(`${base}/${route}.html`);
      await page.waitForFunction(()=>document.documentElement.classList.contains('ot-theme-ready'));
      await page.waitForTimeout(220);
      return state;
    };
    const open=async selector=>{const node=page.locator(selector).first();await node.waitFor();if(await node.getAttribute('open')===null)await node.locator(':scope > summary').click();};
    const shot=async(name,selector)=>{
      const node=(typeof selector==='string'?page.locator(selector):selector).first();await node.waitFor({state:'visible'});
      const style=await page.addStyleTag({content:'.save-bar,body>nav{visibility:hidden!important}.cfg-workspace{position:static!important}'});
      await node.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});await style.evaluate(el=>el.remove());console.log('Captured '+name);
    };
    const card=async(id,name)=>{
      const node=page.locator(`[data-registry-id="${id}"]`);await node.getByRole('button',{name:'Edit',exact:true}).click();
      const advanced=node.locator('details').filter({hasText:'Advanced output settings'});if(await advanced.count())await advanced.locator(':scope > summary').click();
      assert.equal(await node.locator('.registry-status-error').count(),0,name+' complete');await shot(name,node);
      await node.getByRole('button',{name:'Done',exact:true}).click();
    };
    for(const level of [1,2,3]){
      await load(level,'hardware');
      const body=await page.locator('body').innerText();assert.ok(!/Pin conflict:|Pin missing/.test(body),`Build ${level} valid pins`);
      await shot(`level-${level}-hardware`,'#hardware-inputs-panel');
      if(level===1){
        for(const name of ['start','stop']){
          const row=page.locator(`[data-workflow-key="${name}"]`);await row.getByRole('button',{name:'Edit',exact:true}).click();await shot(name+'-configured',row);await row.getByRole('button',{name:'Done',exact:true}).click();
        }
        await page.locator('#btn-edit-buses').click();await shot('spi-configured','#hardware-spi-card');await page.locator('#btn-edit-buses').click();
        for(const [id,name]of [['n1_main','n1'],['tot_main','tot'],['operator_throttle','throttle'],['oil_pressure_main','pressure'],['starter','starter'],['main_fuel','fuel'],['igniter','igniter'],['oil_pump','oil-pump'],['fuel_shutoff','shutoff']])await card(id,name+'-configured');
      }
      if(level===2)await card('p1_main','combustor-configured');
      if(level===3)await card('n2_main','n2-configured');
    }
    await load(1,'controllers');await open('[data-controller-output="main_fuel"]');await shot('main-fuel-controller','[data-controller-output="main_fuel"]');
    await open('[data-built-in="fuel-support"]');await open('[data-built-in="fuel-support"] [data-subcard="Idle"]');await shot('automatic-idle-off','[data-built-in="fuel-support"] [data-subcard="Idle"]');
    await load(1,'controllers');await open('[data-group="safety"]');await open('[data-protection="n1"]');assert.equal(await page.locator('#cf-rpm_limit').inputValue(),String(e.n1_trip_rpm));await shot('n1-warnings-configured','[data-protection="n1"]');
    await open('[data-protection="egt"]');await shot('temperature-warnings-configured','[data-protection="egt"]');
    await load(1,'calibration');await shot('throttle-calibration','#throttle-cal-row');await shot('fuel-minimum-calibration','#fuelpump-min-cal-row');
    assert.equal(await page.locator('#oil-pump-assisted').isChecked(),false);await shot('pressure-calibration','#oil-press-cal-row');
    await load(1,'sequence');assert.equal(await page.locator('#list-startup > .block-card').count(),10);assert.match(await page.locator('#list-startup > .block-card').first().innerText(),/≥ 3 bar/);await shot('sequence-engine-startup','#tab-startup');
    await page.getByRole('button',{name:'Shutdown',exact:true}).click();await shot('sequence-engine-shutdown','#tab-shutdown');
    await load(2,'controllers');await open('[data-built-in="fuel-support"]');await open('[data-built-in="fuel-support"] [data-subcard="Idle"]');assert.equal(await page.locator('#cf-di_tr').inputValue(),String(e.n1_idle_rpm));await shot('automatic-idle-configured','[data-built-in="fuel-support"] [data-subcard="Idle"]');
    await load(2,'controllers');await open('[data-group="oil-loop-oil_pump"]');await shot('oil-feedback','[data-group="oil-loop-oil_pump"]');await open('[data-group="oil-loop-oil_pump"] .protection-card');await shot('oil-feedback-settings','[data-group="oil-loop-oil_pump"] .protection-card');
    await open('[data-group="safety"]');await open('[data-protection="p1"]');await shot('pressure-protection','[data-protection="p1"]');
    await open('[data-protection="egt"]');await shot('startup-temperature-protection','[data-protection="egt"] .protection-part:has(#cf-sf_sg_en)');
    await load(2,'index');
    await page.request.post(`${base}/__sim/data`,{data:{p1:4,max_p1:4,has_p1:true,p1_healthy:true,p1_trip_bar:e.p1_trip_bar,trip_enabled:1}});
    await page.waitForFunction(()=>document.querySelector('#p1-card .sensor-limit-marker')?.hidden===false);
    await page.waitForFunction(()=>Number(document.querySelector('#p1')?.textContent)===4);
    assert.equal(await page.locator('#p1-card .gauge-bar').evaluate(el=>el.style.background),'var(--yellow)');
    await shot('dashboard-pressure-limit','#p1-card');
    const switchEdit=state=>{
      state.hardware.channel_registry.inputs.push({id:'oil_circuit_2',name:'Oil circuit 2 switch',purpose:'generic',role:'generic',driver:0,pin:35,active_high:false,pullup:true,min:0,max:1});
      state.settings.rules.push({controller_id:22,name:'Oil circuit 2',enabled:true,kind:0,source:'oil_circuit_2',target:'request_fault',op:0,threshold:.5,hysteresis:0,confirm_ms:500,activate_events:4,deactivate_events:24,mode_mask:4});
    };
    await load(2,'controllers',{edit:switchEdit});await open('[data-controller-id="22"]');await shot('switch-fault-controller','[data-controller-id="22"]');
    await load(2,'sequence',{edit:state=>{switchEdit(state);state.settings.rules.find(r=>r.controller_id===22).activate_events=1;}});await page.waitForFunction(()=>document.querySelector('#controller-pending-blocks')?.textContent.includes('Oil circuit 2'));await shot('controller-block-placement','#controller-pending-blocks');
    await load(3,'controllers');await open('[data-controller-output="main_fuel"]');await shot('n2-governor','[data-controller-output="main_fuel"]');
    // Optional workshops use an explicitly extended fixture, not extra core-build hardware.
    await load(3,'hardware',{workshops:true});
    for(const [id,name]of [['battery_voltage','battery'],['oil_temperature','oil-temperature'],['cooling_fan','fan'],['cover_switch','cover'],['torque_main','torque'],['thrust_main','thrust'],['light_knob','brightness'],['bench_light','light']])await card(id,name+'-configured');
    await page.locator('#btn-edit-buses').click();await shot('i2c-configured','#hardware-i2c-card');await page.locator('#btn-edit-buses').click();
    await page.locator('[data-registry-id="oil_pump"]').getByRole('button',{name:'Edit',exact:true}).click();await shot('current-configured','[data-registry-id="oil_pump"] .registry-subcard:has-text("Current sensing")');
    await load(3,'controllers',{workshops:true});await open('[data-controller-output="cooling_fan"]');await shot('fan-hysteresis','[data-controller-output="cooling_fan"]');await open('[data-controller-output="bench_light"]');await shot('controller-mapping','[data-controller-output="bench_light"]');await shot('controller-states','[data-controller-output="bench_light"] .controller-form-section:has(.automation-states)');
    const light=page.locator('[data-controller-output="bench_light"]');await light.getByRole('textbox',{name:'Controller name',exact:true}).fill('Bench light dimmer');await light.getByRole('textbox',{name:'Controller name',exact:true}).press('Tab');
    await page.locator('#btn-save').click();
    assert.equal(await page.getByRole('button',{name:'Save anyway',exact:true}).isVisible(),false,'optional workshop has no unresolved save warnings');
    await shot('controller-save','#save-recap-modal .save-recap-card');
    await load(3,'controllers',{workshops:true,edit:state=>{state.settings.rules=state.settings.rules.filter(rule=>rule.target!=='bench_light');}});
    await open('.controller-create-card');await page.locator('#new-controller-output').selectOption('bench_light');await shot('controller-create','.controller-create-card');await page.getByRole('button',{name:'Create controller',exact:true}).click();await open('[data-controller-output="bench_light"]');await shot('controller-new','[data-controller-output="bench_light"]');
    await load(3,'calibration',{workshops:true});await shot('phase-torque-calibration','#torque-phase-wizard');await shot('thrust-calibration','#thrust-cal-row');
    // Verify both cumulative development-board plans in the actual Hardware UI.
    for(const board of ['esp32','esp32s3'])for(const level of [1,2,3]){
      const state=guidedFixture(initial,level,{board});await page.request.post(`${base}/api/ecu_config`,{data:state});await page.goto(`${base}/hardware.html`);await page.locator('#hardware-inputs-panel').waitFor();
      assert.ok(!/Pin conflict:|Pin missing/.test(await page.locator('body').innerText()),`${board} Build ${level} GPIO plan`);
    }
    assert.deepEqual(errors,[],'UI captures have no browser errors');
    console.log('All three builds and both board pin plans checked. Engine numbers are teaching assumptions.');
  }finally{await browser.close();}
  process.exit(0);
})().catch(error=>{console.error(error);process.exit(1);});
