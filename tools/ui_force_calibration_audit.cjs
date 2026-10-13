const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const port = 12400 + Math.floor(Math.random()*400);
const base = `http://127.0.0.1:${port}`;
const roots = [process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean);
const executablePath = roots.flatMap(root=>[
  path.join(root,'Google','Chrome','Application','chrome.exe'),
  path.join(root,'Microsoft','Edge','Application','msedge.exe')
]).find(file=>fs.existsSync(file));
const close = (a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
(async()=>{
  globalThis.OT_UI_SIM_PORT=port;
  await import('./ui_mock_server.mjs');
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  try {
    const page=await browser.newPage();
    const errors=[],alerts=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',async dialog=>{alerts.push(dialog.message());await dialog.dismiss();});
    const state=async()=> (await page.request.get(base+'/__sim/state')).json();
    const stimulus=async(kind,raw,healthy=true)=>{
      assert.ok((await page.request.post(base+'/__sim/data',{data:{[kind+'_raw']:raw,[kind+'_healthy']:healthy,[kind]:0}})).ok());
      await page.waitForFunction(({kind,raw,healthy})=>live[kind+'_raw']===raw && live[kind+'_healthy']===healthy,{kind,raw,healthy});
    };
    const setup=async(channel,kind,raw,healthy=true)=>{
      await page.request.post(base+'/__sim/reset');
      assert.ok((await page.request.patch(base+'/api/hardware',{data:{channel_registry:{inputs:[channel],outputs:[],bindings:[]}}})).ok());
      await page.request.post(base+'/__sim/data',{data:{[kind+'_raw']:raw,[kind+'_healthy']:healthy,[kind]:0}});
      await page.goto(base+'/calibration.html');
      await page.waitForFunction(({kind,raw})=>typeof cfg!=='undefined' && calibrationConnected() && live[kind+'_raw']===raw && !!_loadCellCal[kind].mode,{kind,raw});
      await page.locator('#'+kind+'-loadcell-wizard').waitFor({state:'visible'});
    };
    const capture=async kind=>page.locator('#'+kind+'-loadcell-wizard button',{hasText:'Capture zero'}).click();
    const save=async(kind,known,unit,arm)=>{
      await page.locator('#'+kind+'-lc-known').fill(String(known));
      await page.locator('#'+kind+'-lc-unit').selectOption(unit);
      if(arm!==undefined) await page.locator('#'+kind+'-lc-arm').fill(String(arm));
      await page.locator('#'+kind+'-loadcell-wizard button',{hasText:'Capture known load'}).click();
    };
    const saved=async kind=>page.waitForFunction(kind=>document.getElementById(kind+'-lc-status').textContent.startsWith('Saved:'),kind);
    const hx={id:'torque_main',name:'Torque',purpose:'torque',role:'torque',driver:1,
      installed:true,pin:34,torque_interface:1,hx711_clk:25,hx711_zero:0,hx711_scale:1,min:0,max:4095};
    await setup(hx,'torque',10000);
    assert.match(await page.locator('#torque-loadcell-wizard').textContent(),/HX711/);
    assert.equal(await page.locator('#torque-adc-wizard').isVisible(),false);
    await capture('torque');
    await stimulus('torque',210000);
    await save('torque',5,'kg'); // arm is required; no accidental default 1 m.
    assert.equal((await state()).hardware.channel_registry.inputs[0].hx711_scale,1);
    assert.match(await page.locator('#ot-dialog-message').textContent(),/lever arm/);
    await page.locator('#ot-dialog-confirm').click();
    await stimulus('torque',9000);
    await save('torque',5,'kg',0.2);
    assert.match(await page.locator('#ot-dialog-message').textContent(),/A\+/);
    await page.locator('#ot-dialog-confirm').click();
    assert.equal((await state()).hardware.channel_registry.inputs[0].hx711_scale,1);
    await stimulus('torque',210000,false);
    await save('torque',5,'kg',0.2);
    assert.equal((await state()).hardware.channel_registry.inputs[0].hx711_scale,1);
    await page.locator('#ot-dialog-confirm').click();
    await stimulus('torque',210000);
    await save('torque',5,'kg',0.2); await saved('torque');
    let channel=(await state()).hardware.channel_registry.inputs[0];
    assert.equal(channel.hx711_zero,10000);close(channel.hx711_scale,5*9.80665*0.2/200000);
    assert.equal(channel.loadcell_n_per_count,undefined);
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:'artifacts/force-calibration-hx-mobile.png',fullPage:true});
    await page.locator('#torque-loadcell-wizard').screenshot({path:'artifacts/force-calibration-hx-wizard-mobile.png'});
    await page.reload();
    await page.waitForFunction(()=>cfg?.hardware?.channel_registry?.inputs[0]?.hx711_zero===10000);
    assert.equal(await page.evaluate(()=>_loadCellCal.torque.zero),null);
    const analog={id:'thrust_main',name:'Thrust',purpose:'thrust',role:'thrust',driver:1,
      installed:true,pin:35,min:0,max:4095,analog_zero_mv:0,analog_mv_per_unit:10};
    await setup(analog,'thrust',500,false); // Raw capture can repair incorrect existing scaling.
    assert.match(await page.locator('#thrust-loadcell-wizard').textContent(),/Analog/);
    await capture('thrust'); await stimulus('thrust',1500,false);
    await save('thrust',10,'N'); await saved('thrust');
    channel=(await state()).hardware.channel_registry.inputs[0];
    assert.deepEqual(channel.calibration_points,[{raw:0,value:-5},{raw:4095,value:35.95}]);
    // The stored full-ADC line handles loads above the known calibration point.
    const evaluate=raw=>channel.calibration_points[0].value+raw/4095*(channel.calibration_points[1].value-channel.calibration_points[0].value);
    close(evaluate(500),0);close(evaluate(1500),10);close(evaluate(2500),20);
    await page.reload();
    await page.waitForFunction(()=>cfg?.hardware?.channel_registry?.inputs[0]?.calibration_points?.length===2);
    assert.equal(await page.evaluate(()=>_loadCellCal.thrust.zero),null);
    const tla={...analog,driver:9,pin:-1,i2c_address:16,device_channel:2,i2c_reference_mv:5000};
    await setup(tla,'thrust',3000);
    await capture('thrust');
    assert.match(await page.locator('#thrust-lc-status').textContent(),/3663 mV/);
    await stimulus('thrust',2000);
    await save('thrust',2,'kg');await saved('thrust');
    channel=(await state()).hardware.channel_registry.inputs[0];
    close(channel.calibration_points[0].value,3*2*9.80665);
    close(channel.calibration_points[1].value,(4095-3000)*(-2*9.80665/1000));
    assert.equal(channel.i2c_reference_mv,5000);
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const nau={id:'thrust_main',name:'Thrust',purpose:'thrust',role:'thrust',driver:10,
      installed:true,pin:-1,i2c_address:42,device_channel:0,loadcell_zero:0,loadcell_n_per_count:1};
    await setup(nau,'thrust',1000);await capture('thrust');await stimulus('thrust',500);
    await save('thrust',1,'lbf');await saved('thrust');
    channel=(await state()).hardware.channel_registry.inputs[0];
    assert.equal(channel.loadcell_zero,1000);close(channel.loadcell_n_per_count,-4.4482216153/500);
    assert.equal(channel.calibration_points,undefined);
    // Other TLA2528 voltage-based calibration controls must use its 5 V reference.
    const adc=(id,purpose,role,device_channel)=>({id,purpose,role,name:id,driver:9,installed:true,
      pin:-1,i2c_address:16,device_channel,i2c_reference_mv:5000,min:0,max:4095});
    const channels=[adc('tla_gate','sequence_gate','digital_switch',0),
      adc('tla_flame','flame','flame',1),adc('tla_p1','p1_pressure','pressure',2),
      adc('tla_battery','battery_voltage','voltage',3),adc('tla_torque','torque','torque',4),
      adc('tla_oil','oil_pressure','pressure',5)];
    await page.request.post(base+'/__sim/reset');
    await page.request.patch(base+'/api/hardware',{data:{channel_registry:{inputs:channels,outputs:[],bindings:[]}}});
    await page.request.post(base+'/__sim/data',{data:{batt_voltage_raw:2048,batt_voltage_healthy:true,torque_raw:819,torque_healthy:true}});
    await page.goto(base+'/calibration.html');
    await page.waitForFunction(()=>cfg?.hardware?.channel_registry?.inputs[0]?.id==='tla_gate' && calibrationConnected() && live.batt_voltage_raw===2048);
    const gate=page.locator('[data-channel-id="tla_gate"]');
    assert.equal(await gate.locator('[data-adc-threshold]').getAttribute('max'),'5000');
    await gate.locator('[data-adc-threshold]').fill('4000');
    await gate.locator('[data-adc-hysteresis]').fill('100');
    await gate.locator('button',{hasText:/^Save$/}).click();
    await page.waitForFunction(()=>document.querySelector('[data-channel-id="tla_gate"] [data-adc-status]').textContent==='Saved.');
    channel=(await state()).hardware.channel_registry.inputs.find(c=>c.id==='tla_gate');
    assert.equal(channel.digital_threshold_raw,3276);assert.equal(channel.digital_hysteresis_raw,82);
    assert.equal(await page.locator('#flame-thr-direct').getAttribute('max'),'5000');
    await page.locator('#flame-thr-direct').fill('2000');await page.locator('#flame-hyst-direct').fill('100');
    await page.locator('[onclick="saveFlameThresholdDirect()"]').click();
    await page.waitForFunction(()=>document.getElementById('flame-status').textContent.startsWith('Main flame threshold set'));
    channel=(await state()).hardware.channel_registry.inputs.find(c=>c.id==='tla_flame');
    assert.equal(channel.digital_threshold_raw,1638);assert.equal(channel.digital_hysteresis_raw,82);
    await page.locator('#p1-mode-factory').click();
    assert.equal(await page.locator('#p1-v-max').getAttribute('max'),'5');
    await page.locator('#p1-v-zero').fill('0.5');await page.locator('#p1-v-max').fill('4.5');
    await page.locator('#p1-v-valmax').fill('10');
    await page.locator('[onclick="p12Save(\'p1\')"]').click();
    await page.waitForFunction(()=>document.getElementById('p1-cal-status').textContent.startsWith('✓ Saved:'));
    channel=(await state()).hardware.channel_registry.inputs.find(c=>c.id==='tla_p1');
    assert.deepEqual(channel.calibration_points,[{raw:410,value:0},{raw:3686,value:10}]);
    close(channel.analog_mv_per_unit,400);
    if(await page.locator('#ot-dialog-confirm').isVisible()) await page.locator('#ot-dialog-confirm').click();
    await page.locator('#bv-known-v').fill('10');
    await page.locator('[onclick="captureBattVolt()"]').click();
    await page.locator('#btn-bv-save').click();
    await page.waitForFunction(()=>cfg.hardware.channel_registry.inputs.find(c=>c.id==='tla_battery').analog_divider===4);
    channel=(await state()).hardware.channel_registry.inputs.find(c=>c.id==='tla_battery');assert.equal(channel.analog_divider,4);
    await page.locator('[onclick="captureTorqueZero()"]').click();await page.locator('#torque-fullscale').fill('100');
    await page.locator('#btn-torque-save').click();
    await page.waitForFunction(()=>document.getElementById('torque-status').textContent.startsWith('Saved: scale='));
    channel=(await state()).hardware.channel_registry.inputs.find(c=>c.id==='tla_torque');
    close(channel.analog_zero_mv,1000);close(channel.analog_mv_per_unit,50);
    const oilSlope=await page.evaluate(()=>{
      oilPts=[{raw:819,b:0}];document.getElementById('oil-mv-bar').value='500';oilUseDatasheet();return oilFit.c;
    });
    close(oilSlope,5000/4095/500);
    assert.equal(await page.evaluate(()=>adcMv(4095,{driver:1,i2c_reference_mv:5000})),3300);
    assert.deepEqual(errors,[]);
    console.log('Force calibration UI passed: actual wizard clicks and persisted/reloaded HX711 coefficients, required lever arm, invalid/unhealthy HX input rejection, native/TLA thrust curves, rising/falling polarity, above-reference loads, mobile layout, NAU regression and TLA 5 V thresholds/pressure/battery/torque/oil calibration.');
  } finally {await browser.close();}
  process.exit(0);
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
