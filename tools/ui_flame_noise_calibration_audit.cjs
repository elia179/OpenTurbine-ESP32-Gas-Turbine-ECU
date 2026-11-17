const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { chromium } = require('playwright');

(async () => {
  globalThis.OT_UI_SIM_PORT = 16800 + Math.floor(Math.random() * 40);
  await import('./ui_mock_server.mjs');
  const base = 'http://127.0.0.1:' + globalThis.OT_UI_SIM_PORT;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    if (process.env.OT_UI_PACKAGED === '1') {
      const html = gunzipSync(fs.readFileSync(path.join(__dirname,'../data/calibration.html.gz')));
      await page.route(/\/calibration\.html(?:\?.*)?$/, route => route.fulfill({contentType:'text/html', body:html}));
    }
    await page.request.post(base + '/__sim/data', {data:{mode:'STANDBY', igniter_on:false, igniter2_on:false}});
    await page.goto(base + '/calibration.html');
    await page.waitForFunction(() => hasFreshCalibrationTelemetry() && live.mode === 'STANDBY');
    const result = await page.evaluate(async () => {
      stopGlobalTelemetry();
      hasFreshCalibrationTelemetry = () => true;
      OTDialog.confirm = async () => true;
      let commands = 0;
      postCalCommand = async packet => {
        if (packet.cmd === 'IGN_TEST') commands++;
        return {ok:true};
      };
      const mode = document.getElementById('flame-noise-mode');
      const status = document.getElementById('flame-status');
      const save = document.getElementById('btn-flame-save');
      const read = async (value, frames) => {
        mode.value = value;
        live.igniter_on = live.igniter2_on = false;
        nextCalibrationFrame = async () => {
          const [on, raw, secondary = false] = frames.shift();
          live.flame_raw = raw;
          return {igniter_on:on, igniter2_on:secondary};
        };
        await captureFlameNoise();
        return {noise:flameNoise, canSave:!save.disabled, message:status.textContent};
      };
      const spark = await read('igniter', [[true,100],[true,180],[true,140],[false,900],[false,1100]]);
      const short = await read('igniter', [[true,130],[false,10],[false,10],[false,10],[false,10]]);
      const quiet = await read('quiet', [[false,10],[true,500],[false,20],[false,30],[false,800,true]]);
      return {spark,short,quiet,commands};
    });
    assert.equal(result.commands,2);
    assert.equal(result.spark.noise,180);
    assert.equal(result.spark.canSave,true);
    assert.equal(result.short.noise,null);
    assert.equal(result.short.canSave,false);
    assert.match(result.short.message,/test duration in Tools/);
    assert.equal(result.quiet.noise,20);
    assert.equal(result.quiet.canSave,true);
    console.log('Flame noise calibration passed: only matching igniter-state frames contribute, and a short test leaves Save disabled.');
  } finally {
    await browser.close();
  }
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
