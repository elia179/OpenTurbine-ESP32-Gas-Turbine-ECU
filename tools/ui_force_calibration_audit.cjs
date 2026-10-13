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
    assert.deepEqual(errors,[]);
    console.log('Force calibration UI passed: actual wizard clicks and persisted/reloaded HX711 coefficients, required lever arm, invalid/unhealthy HX input rejection, native/TLA thrust curves, rising/falling polarity, above-reference loads, mobile layout and NAU regression.');
  } finally {await browser.close();}
  process.exit(0);
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
