#!/usr/bin/env node
// Real UI, deterministic learning inventories; never connects to an ECU.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'site/assets/images/guided-builds');
const port = 12100 + Math.floor(Math.random() * 300);
const base = `http://127.0.0.1:${port}`;
const clone = value => JSON.parse(JSON.stringify(value));

function fixture(original, level) {
  const state = clone(original);
  const h = state.hardware;
  const inputs = new Set(['n1_main', 'tot_main', 'operator_throttle']);
  const outputs = new Set(['starter', 'main_fuel', 'igniter']);
  if (level >= 2) { inputs.add('oil_pressure_main'); ['oil_pump', 'fuel_shutoff'].forEach(id => outputs.add(id)); }
  if (level >= 3) { ['n2_main', 'oil_temperature', 'battery_voltage','torque_main','thrust_main'].forEach(id => inputs.add(id)); outputs.add('cooling_fan'); }
  h.profile_id = `guided-level-${level}`;
  h.profile_desc = `Simulated guided build Level ${level}`;
  h.platform = 'esp32s3';
  h.channel_registry.inputs = h.channel_registry.inputs.filter(c => inputs.has(c.id));
  h.channel_registry.outputs = h.channel_registry.outputs.filter(c => outputs.has(c.id));
  h.channel_registry.outputs.forEach(c => { c.has_current=false; c.current_pin=-1; c.has_flow_monitor=false; });
  if (level >= 2) {
    h.channel_registry.outputs.push({ id:'bench_light', name:'Bench light', purpose:'generic', role:'generic', driver:5, pin:38, min:0, max:1, pwm_freq_hz:1000, pwm_res_bits:10, safe_demand:0, boot_safe_demand:0 });
    h.channel_registry.inputs.push({ id:'light_knob', name:'Brightness knob', purpose:'generic', role:'generic', driver:1, pin:8, min:0, max:4095, analog_zero_mv:0, analog_mv_per_unit:3300, invert:false });
  }
  if (level >= 3) h.channel_registry.inputs.push({ id:'cover_switch', name:'Cover closed', purpose:'digital_switch', role:'digital_switch', driver:0, pin:35, active_high:false, pullup:true, min:0, max:1 });
  const pins = { n1_main:6, n2_main:40, operator_throttle:1, oil_pressure_main:2, battery_voltage:4, oil_temperature:7, main_fuel:16, starter:15, igniter:17, oil_pump:21, fuel_shutoff:18, cooling_fan:39 };
  for (const c of [...h.channel_registry.inputs, ...h.channel_registry.outputs]) if (c.id in pins) c.pin = pins[c.id];
  Object.assign(h.channel_registry.inputs.find(c => c.id === 'operator_throttle'), { driver:1, min:0, max:4095, analog_zero_mv:0, analog_mv_per_unit:3300 });
  Object.assign(h.channel_registry.inputs.find(c => c.id === 'tot_main'), { temp_interface:2, spi_clk:12, spi_miso:13, spi_cs:14, spi_mosi:-1 });
  Object.assign(h.channel_registry.outputs.find(c => c.id === 'main_fuel'), { driver:5, min:0, max:1, pwm_freq_hz:1000, pwm_res_bits:10 });
  h.channel_registry.outputs.find(c => c.id === 'main_fuel').name='Main Fuel Metering';
  if (level >= 2) Object.assign(h.channel_registry.inputs.find(c=>c.id==='oil_pressure_main'),{analog_zero_mv:200,analog_mv_per_unit:160});
  if (level >= 3) {
    Object.assign(h.channel_registry.inputs.find(c => c.id === 'oil_temperature'), { temp_interface:5, pin:7, temp_resolution:12 });
    Object.assign(h.channel_registry.inputs.find(c => c.id === 'battery_voltage'), { name:'Battery Voltage', analog_divider:80/12, max:Math.round(2400/3300*4095) });
    Object.assign(h.channel_registry.inputs.find(c => c.id === 'torque_main'), { driver:2,pin:41,torque_interface:2,phase_pin:42,pulses_per_unit:1,phase_pulses_per_unit:1,phase_speed_source:0,phase_zero_deg:0,phase_deg_per_nm:0.01,filter_alpha:0.25 });
    Object.assign(h.channel_registry.outputs.find(c => c.id === 'oil_pump'), { has_current:true, current_pin:5, current_mv_a:2000, current_zero_v:0, current_max_a:0 });
  }
  h.channel_registry.bindings = h.channel_registry.bindings.filter(b => inputs.has(b.channel) || outputs.has(b.channel));
  h.spi = { enabled:true, sck_pin:12, miso_pin:13, mosi_pin:-1 };
  h.i2c = { enabled:level>=3, sda_pin:level>=3?11:-1, scl_pin:level>=3?47:-1, interrupt_pin:-1, frequency_hz:100000 };
  h.controls = { stop_pin:10, start_pin:9, stop_active_h:false, stop_pullup:true, start_active_h:false, start_pullup:true };
  h.di_channels = [];
  const sensorIDs = { n1_rpm:'n1_main', n2_rpm:'n2_main', tot:'tot_main', oil_press:'oil_pressure_main', oil_temp:'oil_temperature', batt_voltage:'battery_voltage', throttle_input:'operator_throttle' };
  for (const [key, c] of Object.entries(h.sensors)) { c.enabled = inputs.has(sensorIDs[key]); if (c.enabled && sensorIDs[key] in pins) c.pin = pins[sensorIDs[key]]; }
  Object.assign(h.sensors.tot, { chip:'max31855', clk:12, miso:13, cs:14, mosi:-1 });
  Object.assign(h.sensors.throttle_input, { rc_pwm:false });
  if (level >= 3) Object.assign(h.sensors.oil_temp, { chip:'ds18b20', pin:7, resolution:12 });
  const actuatorIDs = { throttle:'main_fuel', starter:'starter', igniter:'igniter', oil_pump:'oil_pump', fuel_sol:'fuel_shutoff', cool_fan:'cooling_fan' };
  for (const [key, c] of Object.entries(h.actuators)) { c.enabled = outputs.has(actuatorIDs[key]); c.has_current=false; c.current_pin=-1; c.has_flow_monitor=false; if (c.enabled) c.pin = pins[actuatorIDs[key]]; }
  Object.assign(h.actuators.throttle, { type:1 });
  h.actuators.oil_pump.has_flow_monitor = false;
  if (level >= 3) Object.assign(h.actuators.oil_pump, { has_current:true, current_pin:5, current_mv_a:2000, current_zero_v:0, current_max_a:0 });
  h.controllers = { oil_loop:level >= 2, dynamic_idle:false, governor:false };
  h.safety = { overspeed:false, n2_overspeed:false, overtemp:false, low_oil:false, oil_zero:false, flameout:false, hot_start:false, oil_temp_high:false, fuel_press_low:false, batt_low:false, surge:false };
  h.startup_seq = []; h.shutdown_seq = []; h.ab_seq = []; h.ab_shut_seq = [];
  h.cluster_serial.enabled = false; h.mavlink.enabled = false; h.buzzer.enabled = false;
  state.settings.rules = level >= 2 ? [{ enabled:true, name:'Knob to bench light', kind:1, source:'light_knob', target:'bench_light', sensor:17, actuator:64, input_min:0, input_max:1, output_min:0, output_max:1, on_value:1, off_value:0, mode_mask:1 }] : [];
  state.settings.relight.enabled=false;
  state.settings.starter_control ||= {};
  state.settings.starter_control.pulsed_assist_enabled=false;
  state.settings.tools ||= {};
  state.settings.tools.start_test_pct=30;
  state.settings.throttle.fuel_pump_min_pct=0; // Dummy load, not measured pump data.
  state.settings.dynamic_idle.fuel_mode=1;
  Object.assign(state.settings.calibration,{throttle_min_raw:0,throttle_max_raw:4095});
  state.settings.profile_id = h.profile_id;
  // Numerical fixture values only exercise the UI. These are not engine settings.
  return state;
}

(async () => {
  fs.mkdirSync(output, { recursive:true });
  globalThis.OT_UI_SIM_PORT = port;
  await import('./ui_mock_server.mjs');
  const browser = await chromium.launch({ headless:true, ...(process.env.OT_BROWSER_EXECUTABLE ? { executablePath:process.env.OT_BROWSER_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport:{ width:1600, height:1100 } });
    const initial = await (await page.request.get(`${base}/__sim/state`)).json();
    await page.goto(`${base}/index.html`);
    await page.evaluate(() => {
      localStorage.setItem('ot_beta_notice_ack_v1','1'); localStorage.setItem('ot_theme_onboarded_v1','1');
      localStorage.setItem('ot_gs_dismissed','1'); localStorage.setItem('ot_theme','carbon');
      localStorage.setItem('ot_units',JSON.stringify({temp:'C',press:'bar'}));
    });
    for (const level of [1,2,3]) {
      await page.request.post(`${base}/api/ecu_config`, { data:fixture(initial,level) });
      await page.request.post(`${base}/__sim/data`, { data:{mode:'STANDBY',last_event:'STANDBY',uptime_s:0} });
      await page.goto(`${base}/hardware.html`);
      await page.locator('#hardware-inputs-panel').waitFor();
      await page.locator('#hardware-inputs-panel').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const text = await page.locator('body').innerText();
      if (/Pin conflict:|Pin missing/.test(text)) throw new Error(`Level ${level} fixture has unresolved GPIO assignments`);
      await page.screenshot({ path:path.join(output, `level-${level}-hardware.png`) });
    }
    // Capture the software steps, not just inventories. All writes stay in this simulator.
    await page.setViewportSize({width:1440,height:1250});
    const load = async (level, route, edit) => {
      const state = fixture(initial, level);
      if (edit) edit(state);
      await page.request.post(`${base}/api/ecu_config`, {data:state});
      await page.request.post(`${base}/__sim/data`, {data:{fuel_pump_min_pct:state.settings.throttle.fuel_pump_min_pct}});
      await page.goto(`${base}/${route}.html`);
      await page.waitForFunction(() => document.documentElement.classList.contains('ot-theme-ready'));
      // Shared CSS and configuration arrive separately; do not photograph
      // native button colours part-way through their short theme transition.
      await page.waitForTimeout(200);
    };
    const shot = async (name, selector) => {
      const target = page.locator(selector).first();
await target.waitFor({state:'visible'});
      if (name.startsWith('idle-input-') || name === 'automatic-idle-configured') {
        const chrome=await page.addStyleTag({content:'.save-bar,body>nav{visibility:hidden!important}.cfg-workspace{position:static!important}'});
        await target.screenshot({path:path.join(output,name+'.png')});
        await chrome.evaluate(el=>el.remove());
        console.log('Captured '+name); return;
      }
      if (['main-fuel-controller','bench-fuel-zero-configured','controller-create','controller-new','controller-mapping','controller-states','oil-feedback','oil-feedback-settings','fan-hysteresis','sequence-bench-fuel-action','fuel-minimum-calibration','throttle-calibration','pressure-calibration','automatic-idle-off','fixed-running-idle','engine-backup-restore','phase-torque-calibration','thrust-calibration'].includes(name)) {
        const chrome=await page.addStyleTag({content:'.save-bar,body>nav{visibility:hidden!important}'});
        await target.screenshot({path:path.join(output,name+'.png')});
        await chrome.evaluate(el=>el.remove());
        console.log('Captured '+name); return;
      }
      await target.evaluate(el=>el.scrollIntoView({block:'start'}));
      await page.evaluate(()=>window.scrollBy(0,-270));
      await page.screenshot({path:path.join(output,name+'.png')});
      console.log('Captured '+name);
    };
    const open = async selector => {
      const d=page.locator(selector).first();
      if (!(await d.getAttribute('open') !== null)) await d.locator(':scope > summary').click();
    };
    const cardShot = async (name, row) => {
      await row.getByRole('button',{name:'Edit',exact:true}).click();
      const advanced=row.locator('details').filter({hasText:'Advanced output settings'});
      if(await advanced.count()) await advanced.locator(':scope > summary').click();
      if (await row.locator('.registry-status-error').count()) throw new Error(name+' has incomplete hardware: '+await row.innerText());
      const chrome=await page.addStyleTag({content:'.save-bar,body>nav{visibility:hidden!important}'});
      await row.screenshot({path:path.join(output,name+'.png')});
      await chrome.evaluate(el=>el.remove());
      console.log('Captured '+name);
      await row.getByRole('button',{name:'Done',exact:true}).click();
    };
    for (const level of [1,2,3]) {
      await load(level,'hardware');
      if(level===1) {
        await cardShot('stop-configured',page.locator('[data-workflow-key="stop"]'));
        await cardShot('start-configured',page.locator('[data-workflow-key="start"]'));
      }
      await page.locator('#btn-edit-buses').click();
      if(level===1) await page.locator('#hardware-spi-card').screenshot({path:path.join(output,'spi-configured.png')});
      if(level===3) await page.locator('#hardware-i2c-card').screenshot({path:path.join(output,'i2c-configured.png')});
      await page.locator('#btn-edit-buses').click();
      const captures=level===1?[['n1_main','n1'],['tot_main','tot'],['operator_throttle','throttle'],['starter','starter'],['main_fuel','fuel'],['igniter','igniter']]:level===2?[['oil_pressure_main','pressure'],['oil_pump','oil-pump'],['fuel_shutoff','shutoff'],['light_knob','brightness'],['bench_light','light']]:[['n2_main','n2'],['battery_voltage','battery'],['oil_temperature','oil-temperature'],['cooling_fan','fan'],['cover_switch','cover'],['torque_main','torque'],['thrust_main','thrust']];
      for (const [id,name] of captures) await cardShot(name+'-configured',page.locator(`[data-registry-id="${id}"]`));
      if(level===3) {
        const pump=page.locator('[data-registry-id="oil_pump"]');
        await pump.getByRole('button',{name:'Edit',exact:true}).click();
        await pump.locator('.registry-subcard').filter({hasText:'Current sensing'}).screenshot({path:path.join(output,'current-configured.png')});
      }
    }
    await load(1,'sequence',state=>{
      const h=state.hardware;
      h.startup_seq=['SetOutput','TimedDelay','SetOutput','SetOutput','TimedDelay','SetOutput','SetOutput','SetOutput'];
      h.startup_delay_ms=[0,1000,0,0,2000,0,0,0];
      h.startup_enter_actions=[[{act:8,target:'starter',value:0.2}],[],[{act:9,target:'igniter',value:1}],[{act:6,target:'main_fuel',value:0.2}],[],[{act:6,target:'main_fuel',value:0}],[{act:9,target:'igniter',value:0}],[{act:8,target:'starter',value:0}]];
      h.startup_exit_actions=h.startup_seq.map(()=>[]);
      h.shutdown_seq=['ImmediateCut','SetOutput','SetOutput','SetOutput'];
      h.shutdown_delay_ms=[0,0,0,0];
      h.shutdown_enter_actions=[[],[{act:6,target:'main_fuel',value:0}],[{act:9,target:'igniter',value:0}],[{act:8,target:'starter',value:0}]];
      h.shutdown_exit_actions=h.shutdown_seq.map(()=>[]);
      state.settings.rules=[{enabled:true,name:'Bench fuel stays off in Running',kind:3,target:'main_fuel',source:'',actuator:3,on_value:0,mode_mask:4}];
    });
    await page.locator('#tab-startup').screenshot({path:path.join(output,'sequence-bench-startup.png')});
    await page.locator('#list-startup .block-header').nth(3).click();
    await shot('sequence-bench-fuel-action','#list-startup > .block-card:nth-child(4)');
    await page.getByRole('button',{name:'Shutdown',exact:true}).click();
    await page.locator('#tab-shutdown').screenshot({path:path.join(output,'sequence-bench-shutdown.png')});
    await load(1,'controllers',state=>{state.settings.rules=[{enabled:true,name:'Bench fuel stays off in Running',kind:3,target:'main_fuel',source:'',actuator:3,on_value:0,mode_mask:4}];});
    await open('[data-controller-output="main_fuel"]');
    await open('[data-controller-output="main_fuel"] .protection-card');
    await shot('bench-fuel-zero-configured','[data-controller-output="main_fuel"]');
    await load(1,'controllers',state=>{state.settings.engine.rpm_limit=1000;state.settings.engine.tot_limit=60;state.settings.engine.tot_safe_margin=5;});
    await open('[data-group="safety"]');
    await open('[data-protection="n1"]');
    const protectionChrome=await page.addStyleTag({content:'.save-bar,body>nav{visibility:hidden!important}'});
    await page.locator('[data-protection="n1"]').screenshot({path:path.join(output,'n1-warnings-configured.png')});
    await open('[data-protection="egt"]');
    await page.locator('[data-protection="egt"]').screenshot({path:path.join(output,'temperature-warnings-configured.png')});
    await protectionChrome.evaluate(el=>el.remove());
    await page.request.post(`${base}/__sim/data`,{data:{mode:'STANDBY',n1:900,tot:54,max_n1:900,max_tot:54,n1_rpm_accel:0,rpm_limit:1000,tot_limit:60,rpm_limit_active:false,egt_limit_active:false,egt_source:0}});
    await page.goto(`${base}/index.html`);
    await page.locator('#n1-approach-warn').waitFor({state:'visible'});
    await page.locator('#n1-card').screenshot({path:path.join(output,'dashboard-n1-advisory.png')});
    await page.locator('#tot-card').screenshot({path:path.join(output,'dashboard-temperature-advisory.png')});
    if (process.env.OT_CAPTURE_ONLY === 'configured-inputs') { await browser.close(); process.exit(0); }
    await load(1,'calibration');
    for (const id of ['btn-fp-sweep','btn-fp-test','btn-fp-min-save']) {
      assert.equal(await page.locator('#'+id).isEnabled(),true,id+' must be available before the sweep');
      assert.equal(await page.locator('#'+id).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(38, 38, 41)',id+' must finish its Carbon theme transition before capture');
    }
    assert.equal(await page.locator('#btn-fp-stop').isEnabled(),false,'Stop is unavailable until a sweep starts');
    assert.equal(await page.locator('#th-lo').innerText(),'0 mV');
    assert.equal(await page.locator('#th-hi').innerText(),'3300 mV');
    await shot('fuel-minimum-calibration','#fuelpump-min-cal-row');
    assert.equal(await page.locator('#fp-min-saved').textContent(),'0.0');
    await shot('throttle-calibration','#throttle-cal-row');
    // Prove the grey Stop control is a workflow state, not missing hardware.
    // Commands go only to this isolated simulator, never a physical pump.
    await page.locator('#btn-fp-sweep').click();
    assert.equal(await page.locator('#btn-fp-stop').isEnabled(),true);
    assert.equal(await page.locator('#btn-fp-sweep').isEnabled(),false);
    await page.locator('#btn-fp-stop').click();
    assert.equal(await page.locator('#btn-fp-sweep').isEnabled(),true);
    console.log('Calibration readiness and sweep/stop state checks passed.');
    await load(1,'tools');
    await shot('manual-tests','#card-START_TEST');
    await page.locator('#btn-test-settings').click();
    await shot('tool-settings','#test-settings-modal');
    await load(1,'controllers');
    await shot('controllers-overview','#controller-overview');
    await open('.controller-create-card');
    await page.locator('#new-controller-output').selectOption('main_fuel');
    await page.getByRole('button',{name:'Create controller',exact:true}).click();
    await open('[data-controller-output="main_fuel"]');
    await shot('main-fuel-controller','[data-controller-output="main_fuel"]');
    await open('[data-built-in="fuel-support"]');
    await open('[data-built-in="fuel-support"] [data-subcard="Idle"]');
    assert.equal(await page.locator('#cf-fi_mode').inputValue(),'1');
    await shot('automatic-idle-off','[data-built-in="fuel-support"] [data-subcard="Idle"]');
    await page.locator('#cf-fi_mode').selectOption('2');
    await page.locator('#cf-fi_fixed').fill('12.5');
    await page.locator('#cf-fi_fixed').press('Tab');
    await shot('fixed-running-idle','[data-built-in="fuel-support"] [data-subcard="Idle"]');
    await load(1,'controllers',state=>{
      state.hardware.channel_registry.inputs.push({id:'operator_idle',name:'Idle Input',purpose:'idle',role:'operator',driver:1,pin:3,min:0,max:4095,analog_zero_mv:0,analog_mv_per_unit:3300});
      state.hardware.sensors.idle_input={enabled:true,pin:3,rc_pwm:false};
      Object.assign(state.settings.dynamic_idle,{fuel_mode:3,input_id:'',input_low:0,input_high:1});
      state.settings.throttle.idle_max_pct=12.5;
      Object.assign(state.settings.calibration,{idle_min_raw:0,idle_max_raw:4095});
    });
    await open('[data-built-in="fuel-support"]');
    await open('[data-built-in="fuel-support"] [data-subcard="Idle"]');
    assert.equal(await page.locator('#cf-fi_input').inputValue(),'');
    await shot('idle-input-auto','[data-built-in="fuel-support"] [data-subcard="Idle"]');
    await page.locator('#cf-fi_input').selectOption('operator_idle');
    assert.equal(await page.locator('#cf-fi_high').inputValue(),'100');
    await page.waitForTimeout(200);
    await shot('idle-input-selected','[data-built-in="fuel-support"] [data-subcard="Idle"]');
    await load(1,'controllers',state=>{
      state.hardware.controllers.dynamic_idle=true;
      Object.assign(state.settings.dynamic_idle,{fuel_mode:4,source:0,target_rpm:600,rpm_limit:800,deadband_rpm:50,max_multiplier:1,idle_mode:0});
      state.settings.throttle.idle_max_pct=12.5;
    });
    await open('[data-built-in="fuel-support"]');
    await open('[data-built-in="fuel-support"] [data-subcard="Idle"]');
    assert.ok(await page.locator('#cf-di_src').isVisible());
    assert.ok(await page.locator('#cf-di_tr').isVisible());
    await shot('automatic-idle-configured','[data-built-in="fuel-support"] [data-subcard="Idle"]');
    await load(1,'system');
    await open('#system-maintenance');
    await open('#system-backup-restore');
    await shot('engine-backup-restore','#system-backup-restore');
    await load(3,'calibration');
    await shot('phase-torque-calibration','#torque-phase-wizard');
    await shot('thrust-calibration','#thrust-cal-row');
    await load(1,'controllers');
    await page.locator('summary').filter({hasText:'Shutdown & Protection'}).click();
    await shot('protection-overview','details[open]');
    await load(1,'sequence');
    await page.locator('#tab-startup').getByRole('button',{name:'+ Add block',exact:true}).click();
    await shot('sequence-picker','#block-picker-dlg');
    await page.locator('#block-picker-list button').filter({hasText:'Starter'}).first().click();
    await page.locator('#list-startup .block-header').first().click();
    await shot('sequence-feedback-wait','#list-startup');
    await load(1,'sequence');
    await page.locator('#tab-startup').getByRole('button',{name:'+ Add block',exact:true}).click();
    await page.locator('#block-picker-list button').filter({hasText:'Set Igniter'}).first().click();
    await page.locator('#list-startup .block-header').first().click();
    await shot('sequence-output','#list-startup');
    await load(2,'calibration');
    await shot('pressure-calibration','#oil-press-cal-row');
    await load(2,'controllers',state=>{state.settings.rules=[];state.settings.controller_schema=1;state.hardware.oil_loops=[{enabled:true,id:'oil1',pump_output:'oil_pump',pressure_input:'oil_pressure_main',target_bar:2.5}];state.hardware.controllers.oil_loop=true;});
    await open('.controller-create-card');
    await page.locator('#new-controller-output').selectOption('bench_light');
    await shot('controller-create','.controller-create-card');
    await page.getByRole('button',{name:'Create controller',exact:true}).click();
    await open('[data-controller-output="bench_light"]');
    await shot('controller-new','[data-controller-output="bench_light"]');
    await load(2,'controllers');
    await open('[data-controller-output="bench_light"]');
    await shot('controller-mapping','[data-controller-output="bench_light"]');
    await open('[data-controller-output="bench_light"] .protection-card');
    await shot('controller-states','[data-controller-output="bench_light"] .protection-card');
    await page.getByRole('textbox',{name:'Controller name',exact:true}).fill('Brightness knob to bench light');
    await page.getByRole('textbox',{name:'Controller name',exact:true}).press('Tab');
    await page.locator('#btn-save').click();
    await page.waitForTimeout(150);
    if (await page.locator('.ot-dialog-overlay.show').isVisible()) {
      console.log('Save validation:',await page.locator('.ot-dialog-overlay.show').innerText());
      const continueButton=page.getByRole('button',{name:'Save anyway',exact:true});
      if (!(await continueButton.isVisible())) throw new Error('Fix the screenshot fixture before saving');
      await shot('controller-warnings','.ot-dialog-overlay.show');
      // Acknowledge only inside this isolated documentation simulator.
      await continueButton.click();
    }
    await shot('controller-save','#save-recap-modal');
    await load(2,'controllers',state=>{state.hardware.oil_loops=[];state.hardware.controllers.oil_loop=false;});
    await open('.controller-create-card');
    await page.getByRole('button',{name:'Create oil-pressure controller',exact:true}).click();
    await open('[data-group="oil-loop-oil_pump"]');
    await shot('oil-feedback','[data-group="oil-loop-oil_pump"]');
    await open('[data-group="oil-loop-oil_pump"] .protection-card');
    await shot('oil-feedback-settings','[data-group="oil-loop-oil_pump"] .protection-card');
    await load(3,'controllers',state=>{state.settings.rules.push({enabled:true,name:'Bench cooling fan',kind:0,source:'oil_temperature',target:'cooling_fan',op:0,threshold:30,hysteresis:2,on_value:1,off_value:0,mode_mask:1});});
    await open('[data-controller-output="cooling_fan"]');
    await shot('fan-hysteresis','[data-controller-output="cooling_fan"]');
  } finally { await browser.close(); }
  console.log('Captured simulated guided-build inventories. These are UI examples, not engine configurations.');
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
