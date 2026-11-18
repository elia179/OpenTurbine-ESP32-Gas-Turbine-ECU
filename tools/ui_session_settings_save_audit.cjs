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
        let reboot = false;
        await page.route(/\/api\/config(?:\?.*)?$/, route => {
          if (route.request().method() !== 'PATCH') return route.continue();
          patches.push({body:route.request().postDataJSON(),target:new URL(route.request().url()).searchParams.get('ecu_id')});
          if (reject) { held = route; return; }
          if (reboot) {
            return route.fetch().then(async response =>
              route.fulfill({response,json:{...await response.json(),reboot:true}}));
          }
          return route.continue();
        });
        let statusUnavailable = true;
        await page.route('**/api/session/status', route => statusUnavailable
          ? route.fulfill({status:500,json:{error:'test status read failure'}}) : route.continue());
        await page.route('**/api/log',route=>route.fulfill({status:423,json:{error:'Log viewing requires STANDBY with standby logging disabled'}}));
        await page.goto(base + '/log.html');
        await page.locator('#runs-container').filter({hasText:/STANDBY or FAULT.*Log periodic snapshots while in standby.*Session Data/}).waitFor();
        await page.locator('#tab-session').click();
        await page.locator('#persistence-health').filter({hasText:'Use Refresh to retry'}).waitFor();
        await page.waitForFunction(() => !_sessionTabLoad);
        assert.equal(await page.locator('#session-save-btn').isDisabled(),true);
        statusUnavailable = false;
        const refresh = page.locator('#pane-session button').filter({hasText:/^Refresh$/i}).first();
        assert.equal(await page.getByRole('button',{name:'Clear event log'}).isVisible(),false);
        await page.locator('#log-refresh').click();
        await page.waitForFunction(() => _sessionSettingsLoaded && !_sessionTabLoad);
        const interval = page.locator('#session-log-interval');
        const save = page.locator('#session-save-btn');
        await interval.fill('1250');
        await page.locator('#session-unsaved').waitFor();
        await page.locator('nav a[href^="/tools.html"]').click();
        await page.getByText('Logging settings have unsaved changes. Leave and discard them?').waitFor();
        await page.locator('#ot-dialog-cancel').click();
        assert.equal(await interval.inputValue(),'1250');
        if (!packaged) {
          await page.request.post(base + '/__sim/data',{data:{mode:'RUNNING',config_locked:true}});
          await page.locator('#session-lock-msg').filter({hasText:'STANDBY or FAULT'}).waitFor();
          assert.equal(await save.isDisabled(),true);
          await page.request.post(base + '/__sim/data',{data:{mode:'STANDBY',config_locked:false}});
          await page.locator('#session-save-btn:not([disabled])').waitFor();
          assert.equal(await interval.inputValue(),'1250');
        }
        await refresh.click();
        await page.waitForFunction(() => !_sessionTabLoad);
        assert.equal(await interval.inputValue(),'1250');
        await page.locator('#tab-events').click();
        assert.equal(await page.getByRole('button',{name:'Clear event log'}).isVisible(),true);
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
        await page.locator('#session-unsaved').waitFor({state:'hidden'});
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
        await page.request.post(base + '/__sim/data',{data:{mock_ecu_id:'0123456789ab'}});
        await page.evaluate(() => {
          const showReboot = window.OTShowRebootOverlay;
          window.OTShowRebootOverlay = options => showReboot({...options,seconds:3});
        });
        reboot = true;
        await save.click();
        await page.locator('#reboot-overlay.show').waitFor();
        await page.waitForURL('**/log.html?view=session');
        await page.waitForFunction(() => _sessionSettingsLoaded && !_sessionTabLoad);
        assert.equal(await interval.inputValue(),'1600');
        assert.equal(await page.locator('#pane-session').isVisible(),true);
        await page.close();
      }
      console.log(engine.name() + ': logging saves preserve drafts and ECU identity, and return to Session Data after a restart.');
    } finally {
      await browser.close();
    }
  }
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
