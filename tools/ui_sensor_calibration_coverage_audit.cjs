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
          if (!dashboard) {
            const pressureUnit = page.locator('#unit-press-btn');
            await page.evaluate(() => {
              document.getElementById('oil-pval').value = '3.5';
              document.getElementById('oilt-known-temp').value = '20';
            });
            await pressureUnit.click();
            assert.match(await number.textContent(), /72\.519 PSI/);
            const upperP1 = await page.evaluate(() => ((cfg.calibration?.p1_val_max ?? 10) * 14.5038).toFixed(1) + ' PSI');
            assert.equal(await page.locator('#p1-bar-max-label').textContent(), upperP1);
            assert.ok(Math.abs(Number(await page.locator('#oil-pval').inputValue()) - 3.5 * 14.5038) < 1e-8);
            assert.match(await page.locator('#oil-zero-reference option').last().textContent(), /PSI/);
            const savedReference = await page.evaluate(() => {
              const field = document.getElementById('p1-ref-bar');
              field.value = 3 * 14.5038;
              live.p1_raw = 1500;
              calibrationFrameBoot = 4;
              calibrationFrameAt = performance.now();
              p12CaptureRef('p1');
              p12CalMode('p1', 'factory');
              if (!document.getElementById('p1-capture-ambient').hidden ||
                  document.getElementById('p1-zero-reference').closest('#p1-mode-physical-panel'))
                throw Error('Datasheet mode must leave the pressure reference available.');
              p12CalMode('p1', 'physical');
              return _p12State.p1.refBar;
            });
            assert.ok(Math.abs(savedReference - 3) < 1e-8);
            await pressureUnit.click();
            assert.ok(Math.abs(Number(await page.locator('#oil-pval').inputValue()) - 3.5) < 1e-8);
            const temperatureUnit = page.locator('#unit-temp-btn');
            await temperatureUnit.click();
            assert.equal(await page.locator('#oilt-known-temp').inputValue(), '68');
            assert.equal(await page.locator('[data-temperature-label="150"]').textContent(), '302 °F');
            await temperatureUnit.click();
            assert.equal(await page.locator('#oilt-known-temp').inputValue(), '20');
            await page.evaluate(async () => {
              const originalSave = saveCalibrationPatch;
              const originalAlert = window.alert;
              const alerts = [], writes = [];
              window.alert = message => alerts.push(message);
              saveCalibrationPatch = (_registry, _apply, patch) => writes.push(patch.calibration);
              try {
                const wizards = [
                  ['fuel_press_raw', 'fuelpress-zero-reference', 'fp-ref-bar', 'fuel_press_val_max', fpCapZero, fpCapRef, fpSaveCal],
                  ...['p1','p2'].map(ch => [ch+'_raw',ch+'-zero-reference',ch+'-ref-bar',ch+'_val_max',
                    () => p12CaptureZero(ch), () => p12CaptureRef(ch), () => p12Save(ch)]),
                ];
                for (const [raw, ambientId, refId, key, captureZero, captureRef, save] of wizards) {
                  const ambient = document.getElementById(ambientId), reference = document.getElementById(refId);
                  ambient.value = '0'; reference.value = '3';
                  calibrationFrameBoot = 4; calibrationFrameAt = performance.now();
                  live[raw] = 500; captureZero();
                  live[raw] = 1500; captureRef();
                  const before = writes.length;
                  ambient.value = '1.01325';
                  await save();
                  if (writes.length !== before || !alerts.at(-1)?.includes('Capture ambient again'))
                    throw Error(raw + ' accepted changed ambient');
                  ambient.value = '0'; reference.value = '4';
                  await save();
                  if (writes.length !== before || !alerts.at(-1)?.includes('Capture the reference again'))
                    throw Error(raw + ' accepted changed reference');
                  captureRef();
                  await save();
                  if (writes.length !== before + 1 || writes.at(-1)[key] !== 4)
                    throw Error(raw + ' did not save the recaptured reference');
                  reference.value = '3';
                }
              } finally { saveCalibrationPatch = originalSave; window.alert = originalAlert; }
            });
            const results = await page.evaluate(() => {
              const alerts = [];
              window.alert = message => alerts.push(message);
              cfg.hardware.channel_registry = {inputs:[],outputs:[],bindings:[]};
              document.getElementById('p1-ref-bar').value = '3';
              document.getElementById('p2-ref-bar').value = '3';
              document.getElementById('ff-ref-val').value = '3';
              document.getElementById('ign-cur-ref-a').value = '3';
              const wizards = [
                ['fuel_press_raw', fpCapZero, fpCapRef, fpSaveCal, () => [fpRawZero, fpRawRef]],
                ['p1_raw', () => p12CaptureZero('p1'), () => p12CaptureRef('p1'), () => p12Save('p1'),
                  () => [_p12State.p1.zeroRaw, _p12State.p1.refRaw]],
                ['p2_raw', () => p12CaptureZero('p2'), () => p12CaptureRef('p2'), () => p12Save('p2'),
                  () => [_p12State.p2.zeroRaw, _p12State.p2.refRaw]],
                ['fuel_flow_raw', ffCaptureZero, ffCaptureRef, ffSave, () => [_ffState.zeroRaw, _ffState.refRaw]],
                ['igniter_current_raw', () => curCaptureZero('ign'), () => curCaptureRef('ign'), () => curSave('ign'),
                  () => [_curState.ign.zeroRaw, _curState.ign.refRaw]],
              ];
              calibrationFrameBoot = 4;
              const results = wizards.map(([key, captureZero, captureReference, save, read]) => {
                calibrationFrameAt = performance.now();
                live[key] = 500; captureZero();
                live[key] = 1500; captureReference();
                const captured = read();
                live[key] = null; captureReference();
                const failedReference = read();
                save();
                const blockedSave = /Capture both/i.test(alerts.at(-1));
                live[key] = 1600; captureReference();
                live[key] = null; captureZero();
                return {captured, failedReference, blockedSave, failedZero:read()};
              });
              for (const [key, captureZero] of wizards.slice(0,4)) {
                calibrationFrameAt = performance.now();
                live[key] = 500;
                captureZero();
              }
              const {cv, ...snapshot} = live;
              applyData({...snapshot, boot_count:5});
              const afterRestart = wizards.slice(0,4).map(wizard => wizard[4]().map(value => value ?? null));
              calibrationFrameAt = -Infinity;
              live.fuel_press_raw = 600;
              fpCapZero();
              return {results,afterRestart,stalledFuelPressure:fpRawZero};
            });
            assert.deepEqual(results.afterRestart,Array.from({length:4},()=>[null,null]));
            assert.equal(results.stalledFuelPressure,null);
            for (const result of results.results) {
              assert.deepEqual(result.captured, [500, 1500]);
              assert.equal(result.failedReference[0], 500);
              assert.equal(result.failedReference[1] ?? null, null);
              assert.equal(result.blockedSave, true);
              assert.equal(result.failedZero[0] ?? null, null);
              assert.equal(result.failedZero[1], 1600);
            }
            const flame = await page.evaluate(async () => {
              document.getElementById('flame-noise-mode').value = 'quiet';
              cfg.hardware.channel_registry.inputs = [{id:'flame_tla',purpose:'flame',driver:9}];
              const sample = {id:'flame_tla',raw:200,raw_fresh:true};
              live.registry_inputs = [sample];
              live.flame_raw = 450;
              const readFrame = nextCalibrationFrame;
              nextCalibrationFrame = async () => ({igniter_on:false, igniter2_on:false});
              try {
                await captureFlameNoise();
                const save = document.getElementById('btn-flame-save');
                const first = {threshold:Number(save.dataset.thr),disabled:save.disabled};
                sample.raw_fresh = false;
                await captureFlameNoise();
                return {first,afterStale:{threshold:save.dataset.thr ?? null,disabled:save.disabled}};
              } finally {
                nextCalibrationFrame = readFrame;
              }
            });
            assert.deepEqual(flame, {first:{threshold:600,disabled:false}, afterStale:{threshold:null,disabled:true}});
          }
        }
        await page.close();
      }
    } finally { await browser.close(); }
    console.log(`${engine.name()}: calibration coverage, live extrapolation and invalid-signal recovery passed in source and packaged UI.`);
  }
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
