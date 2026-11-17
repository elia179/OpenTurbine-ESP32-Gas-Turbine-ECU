const assert = require('node:assert/strict');
const fs = require('node:fs');
const {gunzipSync} = require('node:zlib');
const {chromium, firefox, webkit} = require('playwright');

(async () => {
  globalThis.OT_UI_SIM_PORT = 16955 + Math.floor(Math.random() * 25);
  await import('./ui_mock_server.mjs');
  const base = 'http://127.0.0.1:' + globalThis.OT_UI_SIM_PORT;
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    try {
      for (const packaged of [false,true]) {
        const page = await browser.newPage();
        if (packaged) {
          await page.route(/\/(log\.html|app\.js|ui_dialog\.js|theme\.js|style\.css)(?:\?.*)?$/, route => {
            const file = new URL(route.request().url()).pathname.slice(1);
            const contentType = file.endsWith('.html') ? 'text/html'
              : file.endsWith('.js') ? 'application/javascript' : 'text/css';
            return route.fulfill({contentType,body:gunzipSync(fs.readFileSync('data/' + file + '.gz'))});
          });
        }
        await page.request.post(base + '/__sim/reset');
        await page.request.post(base + '/__sim/data',{data:{mode:'STANDBY',config_locked:false}});
        await page.request.patch(base + '/api/config',{data:{
          session_log:{interval_ms:1000,wet_glow:true,registry_inputs:['unavailable_saved_input']},
        }});
        const hardware = await (await page.request.get(base + '/api/hardware')).json();
        hardware.channel_registry.inputs.push({id:'test_pressure',name:'Test pressure',
          purpose:'general_pressure',role:'pressure',driver:1,pin:32});
        await page.request.patch(base + '/api/hardware',{data:{channel_registry:hardware.channel_registry}});
        const patches = [];
        let held;
        let reject = true;
        await page.route(/\/api\/config(?:\?.*)?$/, route => {
          if (route.request().method() !== 'PATCH') return route.continue();
          patches.push({body:route.request().postDataJSON(),target:new URL(route.request().url()).searchParams.get('ecu_id')});
          if (reject) { held = route; return; }
          return route.continue();
        });
        await page.goto(base + '/log.html');
        await page.locator('#tab-session').click();
        await page.waitForFunction(() => _sessionSettingsLoaded && !_sessionTabLoad);
        const interval = page.locator('#session-log-interval');
        const save = page.locator('#session-save-btn');
        await interval.fill('1250');
        await page.locator('#tab-events').click();
        await page.locator('#tab-session').click();
        await page.waitForFunction(() => !_sessionTabLoad);
        assert.equal(await interval.inputValue(),'1250');
        await page.evaluate(() => {window.saveErrors = []; window.alert = message => saveErrors.push(message);});
        await save.click();
        await page.waitForFunction(() => _sessionSavePending);
        assert.equal(await save.isDisabled(),true);
        await page.evaluate(() => saveSessionCfg());
        assert.equal(patches.length,1);
        await held.fulfill({status:409,json:{error:'test save rejection'}});
        await page.waitForFunction(() => !_sessionSavePending && saveErrors.length === 1);
        assert.equal(await interval.inputValue(),'1250');
        assert.equal(await save.isEnabled(),true);
        assert.match(await page.evaluate(() => saveErrors[0]),/test save rejection/);
        reject = false;
        const saved = page.locator('#session-save-msg');
        await save.click();
        await saved.filter({hasText:'Saved'}).waitFor();
        assert.deepEqual(patches.slice(0,2), Array.from({length:2},() =>
          ({target:'0123456789ab',body:{session_log:{interval_ms:1250}}})));
        let settings = await (await page.request.get(base + '/api/config')).json();
        assert.equal(settings.session_log.wet_glow,true);
        assert.deepEqual(settings.session_log.registry_inputs,['unavailable_saved_input']);

        await page.locator('[data-registry-log-id="test_pressure"]').check();
        await save.click();
        await saved.filter({hasText:'Saved'}).waitFor();
        assert.deepEqual(patches[2].body,{session_log:{registry_inputs:['unavailable_saved_input','test_pressure']}});
        await interval.fill('1600');
        await page.request.post(base + '/__sim/data',{data:{mock_ecu_id:'abcdef012345'}});
        await save.click();
        await page.waitForFunction(() => saveErrors.length === 2);
        assert.match(await page.evaluate(() => saveErrors[1]),/connected ECU changed/);
        assert.equal(patches[3].target,'0123456789ab');
        assert.equal(await interval.inputValue(),'1600');
        settings = await (await page.request.get(base + '/api/config')).json();
        assert.equal(settings.session_log.interval_ms,1250);
        await page.close();
      }
      console.log(engine.name() + ': logging drafts survive rejections and tab switches, preserve other selections, and stay tied to their ECU.');
    } finally {
      await browser.close();
    }
  }
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
