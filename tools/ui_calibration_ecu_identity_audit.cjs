const assert = require('node:assert/strict');
const fs = require('node:fs');
const {gunzipSync} = require('node:zlib');
const {chromium, firefox, webkit} = require('playwright');

(async () => {
  globalThis.OT_UI_SIM_PORT = 16910 + Math.floor(Math.random() * 40);
  await import('./ui_mock_server.mjs');
  const base = 'http://127.0.0.1:' + globalThis.OT_UI_SIM_PORT;
  const firstEcu = '0123456789ab';
  const secondEcu = 'abcdef012345';

  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    try {
      for (const packaged of [false, true]) {
        const page = await browser.newPage();
        if (packaged) {
          await page.route(/\/(calibration\.html|app\.js|theme\.js|style\.css|ui_dialog\.js)(?:\?.*)?$/, route => {
            const file = new URL(route.request().url()).pathname.slice(1);
            const contentType = file.endsWith('.html') ? 'text/html'
              : file.endsWith('.js') ? 'application/javascript' : 'text/css';
            return route.fulfill({contentType, body:gunzipSync(fs.readFileSync('data/' + file + '.gz'))});
          });
        }
        const writes = [];
        let target = firstEcu;
        let switchedDuringInit = false;
        await page.route(/\/api\/(config|hardware)(?:\?.*)?$/, async route => {
          const url = new URL(route.request().url());
          const path = url.pathname;
          if (route.request().method() === 'PATCH') {
            const ecu = url.searchParams.get('ecu_id');
            writes.push({path, ecu});
            if (ecu !== target)
              return route.fulfill({status:409, json:{error:'The connected ECU changed. Reload before saving.'}});
            return route.fulfill({json:{ok:true}, headers:{'X-OpenTurbine-ECU':target}});
          }
          if (switchedDuringInit && path === '/api/hardware') {
            const response = await route.fetch();
            return route.fulfill({response, headers:{...response.headers(),'x-openturbine-ecu':secondEcu}});
          }
          return route.continue();
        });
        await page.request.post(base + '/__sim/reset');
        await page.goto(base + '/calibration.html');
        await page.waitForFunction(ecu => calibrationHardwareEcu === ecu && !!cfg.hardware, firstEcu);
        const attempt = kind => page.evaluate(async kind => {
          const alerts = [];
          window.alert = message => alerts.push(message);
          let applied = 0;
          const markApplied = () => applied++;
          const settings = {calibration:{fuel_flow_val_max:12.3}};
          const hardware = {channel_registry_calibration:{id:'oil_flow',pulses_per_unit:321}};
          if (kind === 'settings') await patchConfig(settings, 'Settings saved', markApplied);
          else if (kind === 'hardware') await patchHardware(hardware, markApplied);
          else await saveCalibrationPatch(hardware, markApplied, settings, 'Combined saved', markApplied);
          return {applied, alerts};
        }, kind);
        assert.equal((await attempt('settings')).applied, 1);
        assert.equal((await attempt('hardware')).applied, 1);
        assert.equal((await attempt('combined')).applied, 2);
        assert.deepEqual(writes, ['/api/config','/api/hardware','/api/hardware'].map(path => ({path, ecu:firstEcu})));

        // Swap only the destination of the actual PATCH, after the browser read.
        target = secondEcu;
        const late = await attempt('settings');
        assert.equal(late.applied, 0);
        assert.match(late.alerts[0], /connected ECU changed/);
        assert.deepEqual(writes[3], {path:'/api/config', ecu:firstEcu});

        // After the page sees the second ECU, returning to the first still requires reload.
        await page.request.post(base + '/__sim/data', {data:{mock_ecu_id:secondEcu}});
        await page.evaluate(() => OTReadJson('/api/config'));
        await page.request.post(base + '/__sim/data', {data:{mock_ecu_id:firstEcu}});
        await page.evaluate(() => OTReadJson('/api/config'));
        for (const kind of ['settings','hardware','combined']) {
          const blocked = await attempt(kind);
          assert.equal(blocked.applied, 0);
          assert.match(blocked.alerts[0], /Reload Calibration/);
        }
        assert.equal(writes.length, 4);

        switchedDuringInit = true;
        await page.reload();
        await page.locator('.error-banner').filter({hasText:'Could not identify a single ECU'}).waitFor();
        await page.close();
      }
      console.log(engine.name() + ': calibration rejected mixed setup and a changed ECU across all save paths in source and packaged UI.');
    } finally {
      await browser.close();
    }
  }
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
