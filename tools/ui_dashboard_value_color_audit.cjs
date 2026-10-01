// Local simulator only: numeric colors must not alter protection or bar logic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { chromium } = require('playwright');

(async () => {
  const port = 12500 + Math.floor(Math.random() * 300);
  globalThis.OT_UI_SIM_PORT = port;
  await import('./ui_mock_server.mjs');
  const executablePath = process.env.OT_BROWSER_EXECUTABLE;
  const browser = await chromium.launch({headless:true, ...(executablePath ? {executablePath} : {})});
  try {
    for (const bundle of ['source','packaged']) {
    const page = await browser.newPage({viewport:{width:1200,height:900}});
    if (bundle === 'packaged') {
      await page.route(/\/(app\.js|style\.css|index\.html)(?:\?.*)?$/, async route => {
        const name = path.basename(new URL(route.request().url()).pathname);
        const body = gunzipSync(fs.readFileSync(path.resolve(__dirname,'../data',`${name}.gz`)));
        const contentType = name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html';
        await route.fulfill({status:200,contentType,body});
      });
    }
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem('ot_beta_notice_ack_v1','1');
      localStorage.setItem('ot_theme_onboarded_v1','1');
      localStorage.setItem('ot_gs_dismissed','1');
    });
    await page.goto(`http://127.0.0.1:${port}/index.html`);
    await page.waitForFunction(() => typeof setLowLimitStatus === 'function');
    const results = await page.evaluate(() => {
      const results = [];
      for (const theme of ['carbon','ember','slate','midnight','contrast','daylight']) {
        document.documentElement.dataset.theme = theme;
        const neutral = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
        const red = getComputedStyle(document.documentElement).getPropertyValue('--red').trim();
        const probe = document.createElement('span');
        document.body.appendChild(probe);
        probe.style.color = neutral;
        const neutralRgb = getComputedStyle(probe).color;
        probe.style.color = red;
        const redRgb = getComputedStyle(probe).color;
        for (const id of ['oil','fuel-press','batt-voltage']) {
          for (const safety of [false,true]) {
            for (const ratio of [0.8,1,1.01,1.04,1.07,1.15,1.21,2]) {
              setLowLimitStatus(id,ratio * 10,10,true,safety);
              const el = document.getElementById(id);
              results.push({theme,id,ratio,color:getComputedStyle(el).color,
                expected:ratio <= 1 ? redRgb : neutralRgb,
                title:el.title,safety});
            }
            for (const [value,min,enabled] of [[8,10,false],[NaN,10,true],[8,0,false]]) {
              setLowLimitStatus(id,value,min,enabled,safety);
              results.push({theme,id,color:getComputedStyle(document.getElementById(id)).color,expected:neutralRgb});
            }
          }
        }
        // Maximum readings already follow the same numeric rule.
        for (const id of ['n1','n2','tot','tit','oil-temp']) {
          for (const ratio of [0.5,0.85,0.97,1,1.1]) {
            setShutdownGaugeBar(`${id}-gauge-bar`,ratio * 100,100,true);
            const bar = document.getElementById(`${id}-gauge-bar`);
            results.push({theme,id,color:getComputedStyle(document.getElementById(id)).color,
              expected:ratio >= 1 ? redRgb : neutralRgb,marker:bar.parentElement.classList.contains('shutdown-limit-high')});
          }
        }
        probe.remove();
      }
      return results;
    });
    for (const result of results) {
      assert.equal(result.color,result.expected,JSON.stringify(result));
      if ('marker' in result) assert.equal(result.marker,true);
      if ('title' in result) assert.match(result.title,result.safety ? /Enabled minimum/ : /advisory only/);
    }
    // Exercise actual telemetry rendering, not just the helper functions.
    await page.request.post(`http://127.0.0.1:${port}/__sim/data`,{data:{
      mode:'RUNNING',oil:2.4,oil_running_min:1.4,batt_voltage:12.4,batt_volt_min:10.5,
      has_oil_press:true,has_batt_voltage:true,oil_healthy:true,batt_healthy:true
    }});
    await page.reload();
    await page.waitForFunction(() => document.getElementById('batt-voltage').textContent === '12.4');
    for (const id of ['oil','batt-voltage']) assert.equal(await page.locator(`#${id}`).evaluate(el=>el.style.color),'');
    await page.request.post(`http://127.0.0.1:${port}/__sim/data`,{data:{oil:1.3,batt_voltage:10.4}});
    await page.waitForFunction(() => document.getElementById('batt-voltage').style.color === 'var(--red)');
    for (const id of ['oil','batt-voltage']) assert.equal(await page.locator(`#${id}`).evaluate(el=>el.style.color),'var(--red)');
    await page.request.post(`http://127.0.0.1:${port}/__sim/data`,{data:{oil:2.4,batt_voltage:12.4}});
    await page.waitForFunction(() => document.getElementById('batt-voltage').style.color === '');
    assert.deepEqual(errors,[]);
    console.log(`Dashboard ${bundle} value colors pass ${results.length} theme/boundary checks and telemetry fault/recovery checks.`);
    await page.close();
    }
  } finally { await browser.close(); }
  process.exit(0);
})().catch(e => {console.error(e);process.exit(1);});
