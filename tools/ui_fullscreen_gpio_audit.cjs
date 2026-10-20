const assert = require('node:assert/strict');
const fs = require('node:fs');
const {gunzipSync} = require('node:zlib');
const {chromium} = require('playwright');

(async () => {
  globalThis.OT_UI_SIM_PORT = 12920 + Math.floor(Math.random()*50);
  await import('./ui_mock_server.mjs');
  const base = `http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
  const browser = await chromium.launch({headless:true});
  try {
    for (const packaged of [false,true]) {
      const context = await browser.newContext({viewport:{width:800,height:1000},hasTouch:true,isMobile:true});
      await context.addInitScript(() => {
        for (const key of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1','ot_gs_dismissed']) localStorage.setItem(key,'1');
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      if (packaged) await page.route(/\/(index\.html|hardware\.html|theme\.js|app\.js|style\.css)(?:\?.*)?$/, async route => {
        const name = new URL(route.request().url()).pathname.split('/').pop();
        await route.fulfill({status:200,contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html',
          body:gunzipSync(fs.readFileSync('data/'+name+'.gz'))});
      });
      await page.request.post(base+'/__sim/reset');
      await page.goto(base+'/index.html');
      const button = page.locator('#dashboard-fullscreen-btn');
      await button.waitFor({state:'visible'});
      await button.tap();
      await page.waitForFunction(() => !!document.fullscreenElement && document.querySelector('#dashboard-fullscreen-btn').textContent === 'Exit fullscreen');
      assert.equal(await button.textContent(),'Exit fullscreen');
      await button.tap();
      await page.waitForFunction(() => !document.fullscreenElement && document.querySelector('#dashboard-fullscreen-btn').getAttribute('aria-pressed') === 'false');
      assert.equal(await button.getAttribute('aria-pressed'),'false');
      await button.tap();
      await page.waitForFunction(() => !!document.fullscreenElement && document.querySelector('#dashboard-fullscreen-btn').textContent === 'Exit fullscreen');
      await page.evaluate(() => document.exitFullscreen());
      await page.waitForFunction(() => document.querySelector('#dashboard-fullscreen-btn').textContent === 'Fullscreen');
      // Browser rejection must be handled without a page error or ECU command.
      await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(Error('denied')); });
      await page.reload();
      await button.waitFor({state:'visible'});
      await button.tap();
      await page.waitForFunction(() => document.body.textContent.includes('This browser could not change fullscreen mode'));

      await page.goto(base+'/hardware.html');
      await page.waitForFunction(() => typeof cfg !== 'undefined' && cfg.platform);
      const result = await page.evaluate(() => {
        const r = registryRoot();
        r.inputs = [{id:'flame_main',name:'Oil safety',purpose:'flame',role:'flame',driver:1,pin:35,min:0,max:4095}];
        r.outputs = []; r.bindings = [];
        cfg.sensors.flame = {enabled:true,pin:35};
        cfg.platform = 'esp32'; GPIO_DB = GPIO_DB_ESP32;
        renderRegistryInventory();
        updateRegistryChannel('input',0,'purpose','low_oil_switch');
        updateRegistryChannel('input',0,'driver',0);
        const c = r.inputs[0];
        const results = {retiredFlame:cfg.sensors.flame.enabled === false,
          purpose:c.purpose,pin:c.pin,pullup:c.pullup,pulldown:c.pulldown,polarity:c.active_high};
        results.bias = registryInputOptionsEditor('input',c,0);
        cfg.di_channels = [{pin:35,role:'low_oil_switch',active_h:false}];
        results.pinClaims = collectPinUsage().get(35).length;
        r.inputs.push({...c,id:'second_switch'});
        results.duplicatePinClaims = collectPinUsage().get(35).length;
        r.inputs.pop();
        cfg.di_channels[0].active_h = true;
        results.oppositePolarityClaims = collectPinUsage().get(35).length;
        cfg.di_channels = [{registry_id:c.id,pin:35,role:'low_oil_switch',active_h:false,debounce_ms:75,active_modes:4},
          {pin:33,role:'estop'}];
        updateRegistryChannel('input',0,'pin',32);
        updateRegistryChannel('input',0,'active_high',true);
        results.movedAdapter = {...cfg.di_channels[0]};
        updateRegistryChannel('input',0,'purpose','flame');
        results.retiredAdapter = cfg.di_channels[0].pin === -1 && !cfg.di_channels[0].registry_id;
        results.independentAdapter = cfg.di_channels[1].pin;
        results.classicNoPull = [34,35,36,39].every(pin => pinHasNoInternalPull(pin));
        results.classicPullAvailable = !pinHasNoInternalPull(33);
        const holder = document.createElement('div');
        holder.innerHTML = digitalSwitchEditor({key:'stop',pin:35,defaultLabel:'Stop',label:'Stop'});
        results.legacyDisabled = holder.querySelectorAll('input[type=checkbox]:disabled').length;
        GPIO_DB = GPIO_DB_ESP32S3;
        results.s3PullAvailable = !pinHasNoInternalPull(35) && !pinHasNoInternalPull(46);
        return results;
      });
      assert.ok(result.retiredFlame); assert.equal(result.purpose,'low_oil_switch');
      assert.equal(result.pin,35); assert.equal(result.pullup,false); assert.equal(result.pulldown,false);
      assert.equal(result.polarity,false);
      assert.match(result.bias,/has no internal pull-up or pull-down/);
      assert.equal((result.bias.match(/checkbox" disabled/g)||[]).length,2);
      assert.equal(result.pinClaims,1); assert.equal(result.duplicatePinClaims,2);
      assert.equal(result.oppositePolarityClaims,2);
      assert.equal(result.movedAdapter.pin,32); assert.equal(result.movedAdapter.active_h,true);
      assert.equal(result.movedAdapter.debounce_ms,75); assert.equal(result.movedAdapter.active_modes,4);
      assert.ok(result.retiredAdapter); assert.equal(result.independentAdapter,33);
      assert.ok(result.classicNoPull && result.classicPullAvailable && result.s3PullAvailable);
      assert.equal(result.legacyDisabled,2);
      const repurposed = await page.evaluate(() => {
        cfg.platform = 'esp32'; GPIO_DB = GPIO_DB_ESP32;
        const r = registryRoot(), failures = [];
        const sensorCases = [['n1_speed','n1_rpm'],['n2_speed','n2_rpm'],['tot','tot'],['tit','tit'],
          ['oil_pressure','oil_press'],['oil_temperature','oil_temp'],['fuel_pressure','fuel_press'],
          ['p1_pressure','p1'],['p2_pressure','p2'],['flame','flame'],['fuel_flow','fuel_flow'],
          ['torque','torque'],['battery_voltage','batt_voltage'],['throttle','throttle_input'],['idle','idle_input']];
        for (const [purpose,key] of sensorCases) {
          const def = registryPurposeDefinition('input',purpose);
          r.inputs = [{id:'old_sensor',name:'Original',purpose,role:def.role,driver:def.drivers[0],pin:35,min:0,max:4095}];
          cfg.sensors[key] = {enabled:true,pin:35};
          updateRegistryChannel('input',0,'purpose','low_oil_switch');
          if (cfg.sensors[key].enabled) failures.push(purpose);
        }
        for (const [purpose,key] of [['main_fuel','throttle'],['starter','starter'],['oil_pump','oil_pump'],
            ['cooling_fan','cool_fan'],['igniter','igniter'],['fuel_shutoff','fuel_sol']]) {
          const def = registryPurposeDefinition('output',purpose);
          r.outputs = [{id:'old_output',name:'Original',purpose,role:def.role,driver:def.drivers[0],pin:25}];
          cfg.actuators[key] = {enabled:true,pin:25};
          updateRegistryChannel('output',0,'purpose','valve');
          if (cfg.actuators[key].enabled) failures.push(purpose);
        }
        return failures;
      });
      assert.deepEqual(repurposed,[],'Stale singleton adapters survived repurposing');
      await page.addInitScript(() => Object.defineProperty(Document.prototype,'fullscreenEnabled',{configurable:true,get:()=>false}));
      await page.goto(base+'/index.html');
      await page.waitForFunction(() => document.documentElement.classList.contains('ot-theme-ready'));
      assert.equal(await button.isVisible(),false,'Unsupported browsers must hide fullscreen');
      assert.deepEqual(errors,[]);
      console.log(`${packaged?'packaged':'source'}: touch fullscreen entry/exit/external exit/rejection; former flame GPIO35 repurpose; safety mirrors and real conflicts; Classic/S3 pull capabilities passed`);
      await context.close();
    }
  } finally { await browser.close(); }
  process.exit(0);
})().catch(e => {console.error(e);process.exit(1);});

