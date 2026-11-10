const assert = require('node:assert/strict');
const fs = require('node:fs');
const { gunzipSync } = require('node:zlib');
const { chromium, firefox, webkit } = require('playwright');

(async () => {
  globalThis.OT_UI_SIM_PORT = 14994;
  await import('./ui_mock_server.mjs');
  const base = 'http://127.0.0.1:14994';
  const channel = {
    id: 'oil_pressure_main', purpose: 'oil_pressure', role: 'pressure', driver: 9,
    cal_range: [200, 2000], raw: 2700, value: 5, healthy: true
  };
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    try {
      for (const packed of [false, true]) {
        const page = await browser.newPage();
        await page.addInitScript(() => {
          for (const key of ['ot_beta_notice_ack_v1', 'ot_theme_onboarded_v1', 'ot_gs_dismissed']) localStorage.setItem(key, '1');
        });
        if (packed) await page.route(/\/(index\.html|calibration\.html|app\.js|theme\.js|style\.css|ui_dialog\.js)(?:\?.*)?$/, route => {
          const name = new URL(route.request().url()).pathname.slice(1);
          const contentType = name.endsWith('.html') ? 'text/html' : name.endsWith('.js') ? 'application/javascript' : 'text/css';
          return route.fulfill({ contentType, body: gunzipSync(fs.readFileSync(`data/${name}.gz`)) });
        });
        await page.request.post(base + '/__sim/reset');
        await page.request.post(base + '/__sim/data', { data: {
          mode: 'RUNNING', has_oil_press: true, oil: 5, oil_raw: 2700, oil_healthy: true,
          oil_running_min: 3.6, oil_running_min_active: true, registry_inputs: [channel]
        } });
        for (const route of ['/index.html', '/calibration.html']) {
          await page.goto(base + route);
          const dashboard = route === '/index.html';
          await page.waitForFunction(dash => dash ? _dashboardSnapshotReady :
            window.applyData?._calibrationExtended === true && _restFallbackTimer !== null, dashboard);
          await page.evaluate(async () => {
            _telemetryPauseDepth++;
            if (!await OTWaitForTelemetryIdle(5000)) throw Error('Telemetry did not drain');
          });
          const full = await (await page.request.get(base + '/api/data')).json();
          await page.evaluate(d => applyData(d), full);
          const note = page.locator(`${dashboard ? '#oil-card' : '#oil-press-cal-row'} .calibration-coverage-note`);
          assert.match(await note.textContent(), /estimated/);
          const number = page.locator(dashboard ? '#oil' : '#cal-oil');
          assert.equal(await number.textContent(), dashboard ? '5.0' : '5.000 bar');
          for (const [raw, value, healthy, estimated] of [[2000, 3.6, true, false], [100, -0.2, true, true], [4095, 5, false, false], [2700, 5, true, true]]) {
            const v = Array(73).fill(0);
            v[6] = Math.round(value * 100); v[51] = raw;
            await page.evaluate(frame => applyData(frame), { cv: 2, m: 2, v, f: healthy ? 1 << 7 : 0, iv: [value], ir: [raw], ih: healthy ? 1 : 0 });
            if (dashboard && !estimated) assert.equal(await note.count(), 0);
            else assert.equal((await note.textContent()).includes('estimated'), estimated,
              `${engine.name()} ${packed ? 'packaged' : 'source'} ${route}, raw=${raw}, healthy=${healthy}`);
            if (dashboard && healthy) assert.equal(await number.textContent(), value.toFixed(1));
          }
        }
        await page.close();
      }
    } finally { await browser.close(); }
    console.log(`${engine.name()}: calibration coverage, live extrapolation and invalid-signal recovery passed in source and packaged UI.`);
  }
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
