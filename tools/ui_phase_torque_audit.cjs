const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const port = 12200 + Math.floor(Math.random() * 400);
const base = `http://127.0.0.1:${port}`;
function installedBrowser() {
  const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  return roots.flatMap(root => [
    path.join(root,'Google','Chrome','Application','chrome.exe'),
    path.join(root,'Microsoft','Edge','Application','msedge.exe')
  ]).find(candidate => fs.existsSync(candidate));
}

(async () => {
  globalThis.OT_UI_SIM_PORT = port;
  await import('./ui_mock_server.mjs');
  const executablePath = installedBrowser();
  const browser = await chromium.launch({headless:true,...(executablePath ? {executablePath} : {})});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/hardware.html`);
    await page.waitForFunction(() => typeof updateRegistryChannel === 'function' && !!cfg);
    const result = await page.evaluate(() => {
      const r = registryRoot();
      r.inputs = [{id:'torque_main',name:'Torque',purpose:'torque',role:'torque',driver:1,
        installed:true,pin:34,min:0,max:4095,analog_mv_per_unit:10}];
      r.bindings = [];
      cfg.sensors ||= {};
      cfg.sensors.n1_rpm = {enabled:false,pin:-1};
      cfg.sensors.n2_rpm = {enabled:false,pin:-1};
      updateRegistryChannel('input',0,'torque_interface',2);
      const torque = r.inputs[0];
      const defaultSource = torque.phase_speed_source;
      updateRegistryChannel('input',0,'phase_pin',35);
      const subcards = registryPhaseTorqueSubcards('input',torque,0);
      const torqueStatus = registryStatus(torque);
      const pickupCountDefault = torque.phase_pulses_per_unit;
      updateRegistryChannel('input',0,'phase_pulses_per_unit',2);
      const mismatch = registryStatus(torque);
      updateRegistryChannel('input',0,'pulses_per_unit',2);
      const matched = registryStatus(torque);
      updateRegistryChannel('input',0,'phase_pulses_per_unit',1);
      updateRegistryChannel('input',0,'pulses_per_unit',1);
      updateRegistryChannel('input',0,'phase_speed_source',1);
      const n1Options = document.createElement('select');
      n1Options.innerHTML = registryPurposeOptions('input','generic',null);
      const n1Blocked = n1Options.querySelector('option[value="n1_speed"]')?.disabled;
      const n2Available = !n1Options.querySelector('option[value="n2_speed"]')?.disabled;
      const n1Mirror = {...cfg.sensors.n1_rpm};
      r.inputs.push({id:'n1_main',name:'N1',purpose:'n1_speed',role:'speed',driver:2,
        installed:true,pin:32,min:0,max:100000,pulses_per_unit:1});
      const conflict = registryStatus(torque);
      r.inputs.pop();
      updateRegistryChannel('input',0,'phase_speed_source',2);
      const n1Cleared = cfg.sensors.n1_rpm.enabled === false;
      const n2Mirror = {...cfg.sensors.n2_rpm};
      updateRegistryChannel('input',0,'phase_speed_source',0);
      const torqueOnly = torque.phase_speed_source === 0 && cfg.sensors.n2_rpm.enabled === false;
      updateRegistryChannel('input',0,'phase_speed_source',3);
      const torqueSpeed = r.inputs.find(row => row.mirror_of === torque.id);
      const torqueSpeedValid = torque.phase_speed_source === 3 && torqueSpeed?.id === 'torque_shaft_speed' &&
        torqueSpeed?.purpose === 'shaft_speed' && torqueSpeed?.role === 'speed' &&
        torqueSpeed?.pin === torque.pin && torqueSpeed?.pulses_per_unit === torque.pulses_per_unit;
      cfg.i2c = {enabled:false};
      cfg._i2c_discovery = {devices:[]};
      const torqueDriverOptions = registryDriverOptions('input', torque.driver, 'torque', 'torque');
      const savedInputs = r.inputs;
      const torquePresets = REGISTRY_INPUT_PRESETS.filter(p => p.purpose === 'torque');
      const torqueIndex = REGISTRY_INPUT_PRESETS.findIndex(p => p.purpose === 'torque');
      const generalIndex = REGISTRY_INPUT_PRESETS.findIndex(p => p.purpose === 'general_torque');
      r.inputs = [];
      cfg.i2c = {enabled:true};
      cfg._i2c_discovery = {devices:[{type:'NAU7802',address:42,present:true},{type:'TLA2528',address:72,present:true}]};
      _registryAddDirection = 'input';
      createRegistryChannelFromPreset(torqueIndex, null);
      const primaryOptions = registryTorqueInterfaceEditor('input',r.inputs[0],0);
      updateRegistryTorqueSensorType(0,'phase');
      updateRegistryChannel('input',0,'phase_speed_source',3);
      updateRegistryTorqueSensorType(0,'nau7802');
      const createdNauTorque = {...r.inputs[0]};
      const staleCompanion = r.inputs.some(row => row.mirror_of === createdNauTorque.id);
      createRegistryChannelFromPreset(generalIndex, null);
      createRegistryChannelFromPreset(generalIndex, null);
      const generalNames = r.inputs.filter(row => row.purpose === 'general_torque').map(row => row.name);
      updateRegistryTorqueSensorType(1,'tla2528');
      const generalTla = {...r.inputs[1]};
      r.inputs = savedInputs;
      cfg.i2c = {enabled:false};
      cfg._i2c_discovery = {devices:[]};
      return {defaultSource,subcards,torqueStatus,pickupCountDefault,mismatch,matched,n1Blocked,n2Available,n1Mirror,
        conflict,n1Cleared,n2Mirror,torqueOnly,torqueSpeedValid,torqueDriverOptions,createdNauTorque,
        torquePresets,primaryOptions,staleCompanion,generalNames,generalTla,
        chip:registryPurposeDefinition('input','chip_detector'),
        pressure:registryPurposeDefinition('input','diff_press_switch'),
        namedPresets:REGISTRY_INPUT_PRESETS.filter(p =>
          ['chip_detector','diff_press_switch'].includes(p.purpose)),
        generalPurpose:registryPurposeDefinition('input','general_torque')};
    });
    assert.equal(result.defaultSource,0,'phase torque must default to torque-only');
    assert.equal(result.torqueStatus.kind,'ok');
    assert.equal(result.pickupCountDefault,1);
    assert.equal(result.mismatch.kind,'error');
    assert.match(result.mismatch.text,/tooth counts differ/i);
    assert.equal(result.matched.kind,'ok');
    assert.match(result.subcards,/Torque pickup pulses per shaft revolution/);
    assert.match(result.subcards,/Reference shaft pickup/);
    assert.match(result.subcards,/Torque phase pickup/);
    assert.match(result.subcards,/N1 speed/);
    assert.match(result.subcards,/N2 speed/);
    assert.match(result.subcards,/Torque shaft speed/);
    assert.equal(result.n1Blocked,true);
    assert.equal(result.n2Available,true);
    assert.deepEqual(result.n1Mirror,{enabled:true,pin:34,ppr:1});
    assert.equal(result.conflict.kind,'error');
    assert.match(result.conflict.text,/already has a speed sensor/);
    assert.equal(result.n1Cleared,true);
    assert.deepEqual(result.n2Mirror,{enabled:true,pin:34,ppr:1});
    assert.equal(result.torqueOnly,true);
    assert.equal(result.torqueSpeedValid,true);
    assert.match(result.torqueDriverOptions,/NAU7802 load cell — enable I2C bus/);
    assert.match(result.torqueDriverOptions,/value="10" disabled/);
    assert.equal(result.torquePresets.length,1,'one primary Torque add card');
    assert.match(result.primaryOptions,/NAU7802 I2C load cell/);
    assert.match(result.primaryOptions,/TLA2528 analog input/);
    assert.match(result.primaryOptions,/Shaft torsion by phase difference/);
    assert.equal(result.staleCompanion,false,'switching away from phase must remove its virtual speed');
    assert.deepEqual({driver:result.createdNauTorque.driver,address:result.createdNauTorque.i2c_address,
      channel:result.createdNauTorque.device_channel,gain:result.createdNauTorque.loadcell_gain,
      rate:result.createdNauTorque.loadcell_rate_sps,lever:result.createdNauTorque.lever_arm_m},
      {driver:10,address:42,channel:0,gain:128,rate:80,lever:1});
    assert.deepEqual(result.generalNames,['Torque Sensor','Torque Sensor 2']);
    assert.equal(result.generalTla.driver,9);
    assert.equal(result.generalPurpose?.role,'torque');
    for (const named of [result.chip,result.pressure]) {
      assert.equal(named.role,'digital_switch');
      assert.deepEqual(named.drivers,[0,1,8,9]);
    }
    assert.equal(result.namedPresets.length,2);
    assert.ok(result.namedPresets.every(p => p.role === 'digital_switch' &&
      !p.force_safe_on_fault && !p.min_run_demand));
    await page.evaluate(() => {
      _registryEditOpen.add(registryEditKey('input',0));
      renderRegistryInventory();
    });
    for (const width of [390,1366]) {
      await page.setViewportSize({width,height:844});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 24,`phase torque editor overflows ${width}px viewport by ${overflow}px`);
      await page.locator('#registry-inputs').screenshot({
        path:path.join(__dirname,'..','artifacts',`phase_torque_${width}.png`)
      });
    }
    const n1Toggle = page.locator('label.hw-toggle:has-text("N1 speed") input').first();
    const n2Toggle = page.locator('label.hw-toggle:has-text("N2 speed") input').first();
    const torqueShaftToggle = page.locator('label.hw-toggle:has-text("Torque shaft speed") input').first();
    await n1Toggle.click();
    assert.equal(await n1Toggle.isChecked(),true);
    await n2Toggle.click();
    assert.equal(await n1Toggle.isChecked(),false,'N1 must visibly clear when N2 is selected');
    assert.equal(await n2Toggle.isChecked(),true);
    await n2Toggle.click();
    assert.equal(await n1Toggle.isChecked(),false);
    assert.equal(await n2Toggle.isChecked(),false);
    await torqueShaftToggle.click();
    assert.equal(await torqueShaftToggle.isChecked(),true);
    assert.equal(await n1Toggle.isChecked(),false);
    assert.equal(await n2Toggle.isChecked(),false);
    const selectable = {id:'torque_shaft_speed',name:'Torque Shaft Speed',purpose:'shaft_speed',
      role:'speed',driver:2,installed:true,pin:34,pulses_per_unit:1,mirror_of:'torque_main'};
    await page.goto(`${base}/controllers.html`);
    await page.waitForFunction(() => typeof simpleControlInputs === 'function');
    const controllerInputs = await page.evaluate(input => {
      hwCfg.channel_registry = {inputs:[input],outputs:[]};
      return simpleControlInputs().map(row => row.id);
    }, selectable);
    assert.ok(controllerInputs.includes('torque_shaft_speed'));
    await page.goto(`${base}/sequence.html`);
    await page.waitForFunction(() => typeof getEnabledSensors === 'function');
    const sequenceInputs = await page.evaluate(input => {
      hwCfg.channel_registry = {inputs:[input],outputs:[]};
      return getEnabledSensors().map(row => row.source || row.key);
    }, selectable);
    assert.ok(sequenceInputs.includes('torque_shaft_speed'));
    await page.goto(`${base}/`);
    await page.waitForFunction(() => typeof applyData === 'function');
    const dashboard = await page.evaluate(() => {
      applyData({has_torque:true,torque:42.5,torque_healthy:true,turbo_power_w:13352,
        registry_inputs:[
          {id:'torque_main',name:'Torque',purpose:'torque',role:'torque',healthy:true,value:42.5,phase_speed_source:3},
          {id:'torque_shaft_speed',name:'Torque Shaft Speed',purpose:'shaft_speed',role:'speed',healthy:true,value:3000,mirror_of:'torque_main'}
        ]});
      return {
        speed:document.getElementById('torque-speed')?.textContent,
        speedVisible:document.getElementById('torque-speed-row')?.style.display !== 'none',
        power:document.getElementById('turbo-power')?.textContent,
        powerVisible:document.getElementById('torque-power-row')?.style.display !== 'none',
        duplicate:!!document.querySelector('[data-registry-input-id="torque_shaft_speed"]')
      };
    });
    assert.deepEqual(dashboard,{speed:'3,000',speedVisible:true,power:'13.35',powerVisible:true,duplicate:false});
    const torqueOnlyDashboard = await page.evaluate(() => {
      applyData({has_torque:true,torque:12,torque_healthy:true,turbo_power_w:0,
        registry_inputs:[
          {id:'torque_main',name:'Torque',purpose:'torque',role:'torque',healthy:true,value:12,phase_speed_source:0}
        ]});
      return {
        speedVisible:document.getElementById('torque-speed-row')?.style.display !== 'none',
        powerVisible:document.getElementById('torque-power-row')?.style.display !== 'none'
      };
    });
    assert.deepEqual(torqueOnlyDashboard,{speedVisible:false,powerVisible:false},
      'compact numeric zero must not expose speed/power for a torque-only phase sensor');
    await page.goto(`${base}/calibration.html`);
    await page.waitForFunction(() => typeof capturePhaseTorqueZero === 'function' && !!cfg);
    const calibration = await page.evaluate(() => {
      const channel = {id:'torque_main',purpose:'torque',torque_interface:2,
        pulses_per_unit:2,phase_zero_deg:0,phase_deg_per_nm:1};
      cfg.hardware ||= {};
      cfg.hardware.channel_registry = {inputs:[channel]};
      const patches = [];
      patchHardware = (patch,onOk) => { patches.push(patch); onOk(); };
      live = {torque_healthy:true,torque_phase_rpm:0,torque_raw:3000000};
      capturePhaseTorqueZero();
      const stoppedPatches = patches.length;
      live.torque_phase_rpm = 600;
      capturePhaseTorqueZero();
      live.torque_raw = 5000000;
      document.getElementById('torque-phase-known').value = '50';
      savePhaseTorqueKnown();
      return {patches,stoppedPatches,zero:channel.phase_zero_deg,sensitivity:channel.phase_deg_per_nm};
    });
    assert.equal(calibration.zero,3);
    assert.equal(calibration.stoppedPatches,0);
    assert.equal(calibration.sensitivity,0.04);
    assert.deepEqual(calibration.patches.map(p => p.channel_registry_calibration),[
      {id:'torque_main',phase_zero_deg:3},
      {id:'torque_main',phase_deg_per_nm:0.04}
    ]);
    const runningCalibration = await page.evaluate(() => {
      const channel = cfg.hardware.channel_registry.inputs[0];
      channel.phase_zero_deg = 0; channel.phase_deg_per_nm = 1;
      _phaseTorqueZeroDeg = null;
      const patches = [];
      patchHardware = (patch,onOk) => { patches.push(patch); onOk(); };
      live = {mode:'RUNNING',torque_healthy:true,torque_phase_rpm:600,torque_raw:3000000};
      capturePhaseTorqueZero();
      _phaseTorqueZeroDeg = null; // exercise tab storage across page navigation
      live.torque_raw = 5000000;
      document.getElementById('torque-phase-known').value = '50';
      savePhaseTorqueKnown();
      const duringRun = patches.length;
      const pending = pendingPhaseTorqueCalibration();
      savePendingPhaseTorqueCalibration();
      const stillRunning = patches.length;
      live.mode = 'STANDBY';
      savePendingPhaseTorqueCalibration();
      return {duringRun,stillRunning,pending,patches,zero:channel.phase_zero_deg,
        sensitivity:channel.phase_deg_per_nm,cleared:!pendingPhaseTorqueCalibration()};
    });
    assert.equal(runningCalibration.duringRun,0);
    assert.equal(runningCalibration.stillRunning,0);
    assert.equal(runningCalibration.pending.zero_deg,3);
    assert.equal(runningCalibration.pending.deg_per_nm,0.04);
    assert.deepEqual(runningCalibration.patches.map(p => p.channel_registry_calibration),[
      {id:'torque_main',phase_zero_deg:3,phase_deg_per_nm:0.04}
    ]);
    assert.equal(runningCalibration.zero,3);
    assert.equal(runningCalibration.sensitivity,0.04);
    assert.equal(runningCalibration.cleared,true);
    assert.deepEqual(errors,[]);
    console.log('Phase torque UI audit passed: subcards, explicit speed toggles, one-source conflicts, calibration, ordinary named switches and narrow/desktop layout.');
  } finally {
    await browser.close();
  }
  process.exit(0);
})().catch(error => { console.error(error.stack || error); process.exit(1); });
