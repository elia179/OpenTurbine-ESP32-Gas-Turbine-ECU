// Isolated simulator only: display settings must never write ECU configuration.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {gunzipSync} = require('node:zlib');
const {chromium} = require('playwright');

(async () => {
  const port = 12900 + Math.floor(Math.random()*200);
  globalThis.OT_UI_SIM_PORT = port;
  await import('./ui_mock_server.mjs');
  const browser = await chromium.launch({headless:true,
    ...(process.env.OT_BROWSER_EXECUTABLE ? {executablePath:process.env.OT_BROWSER_EXECUTABLE} : {})});
  try {
    for (const bundle of ['source','packaged']) {
      const page = await browser.newPage({viewport:{width:1200,height:1000}});
      const errors = [], writes = [];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('request',request=>{
        if (request.method() !== 'GET') writes.push(request.url());
      });
      if (bundle === 'packaged') await page.route(/\/(app\.js|style\.css|index\.html)(?:\?.*)?$/,async route=>{
        const name = path.basename(new URL(route.request().url()).pathname);
        await route.fulfill({status:200,contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html',
          body:gunzipSync(fs.readFileSync(path.resolve(__dirname,'../data',name+'.gz')))});
      });
      await page.addInitScript(()=>{
        localStorage.setItem('ot_beta_notice_ack_v1','1');
        localStorage.setItem('ot_theme_onboarded_v1','1');
        localStorage.setItem('ot_gs_dismissed','1');
      });
      await page.goto(`http://127.0.0.1:${port}/index.html`);
      await page.waitForSelector('#oil-card .sensor-view-scale');
      const cards = ['oil','p1','p2','fuel-press','batt','torque','thrust','glow-current','igniter-current','igniter2-current','oilpump-current','fuel-flow'];
      for (const key of cards) {
        assert.equal(await page.locator(`#${key}-card .sensor-view`).count(),1,key);
        assert.equal(await page.locator(`#${key}-card canvas[role="img"]`).count(),1,key);
        const meter = page.locator(`#${key}-card [role="meter"]`);
        assert.ok(Number(await meter.getAttribute('aria-valuemax')) > Number(await meter.getAttribute('aria-valuemin')),key);
      }
      assert.equal(await page.locator('#di-state-items .sensor-view').count(),0);
      assert.ok(await page.locator('.registry-input-card .sensor-view').count() >= 2);
      const scale = page.getByRole('button',{name:'Set Oil pressure display range',exact:true});
      assert.match(await scale.textContent(),/^0–5 bar · auto$/);
      await scale.click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Low',{exact:true}).fill('5');
      await dialog.getByLabel('High',{exact:true}).fill('4');
      await dialog.getByRole('button',{name:'Save display range'}).click();
      assert.match(await dialog.getByRole('status').textContent(),/High must be greater/);
      await dialog.getByLabel('Low',{exact:true}).fill('0');
      await dialog.getByLabel('High',{exact:true}).fill('6');
      await dialog.getByRole('button',{name:'Save display range'}).click();
      assert.match(await scale.textContent(),/^0–6 bar · fixed$/);
      const width = await page.locator('#oil-card .sensor-view .gauge-bar').evaluate(el=>parseFloat(el.style.width));
      assert.ok(Math.abs(width-2.15/6*100)<0.01);
      await page.evaluate(()=>setPressUnit('psi'));
      assert.match(await scale.textContent(),/87\.02 PSI · fixed/);
      await page.evaluate(()=>setPressUnit('bar'));
      await page.reload();
      await page.waitForSelector('#oil-card .sensor-view-scale');
      assert.match(await scale.textContent(),/^0–6 bar · fixed$/);
      await scale.click();
      await page.keyboard.press('Escape');
      assert.equal(await scale.evaluate(el=>el===document.activeElement),true);
      // Direct helper calls exercise faults and bounded sampling without touching an ECU.
      const result = await page.evaluate(()=>{
        const card = document.getElementById('oil-card');
        const arr = registryInputSparkSeries('view:oil');
        arr.length=0;
        for(let i=0;i<40;i++) renderSensorView(card,'oil','Oil pressure',i/10,true,'pressure',true);
        const count = arr.length;
        renderSensorView(card,'oil','Oil pressure',2,false,'pressure',true);
        const fault = {count:arr.length,now:card.querySelector('[role="meter"]').getAttribute('aria-valuenow'),width:card.querySelector('.sensor-view .gauge-bar').style.width};
        renderSensorView(card,'oil','Oil pressure',2,true,'pressure',true);
        const recovered = arr.length;
        const signed = sensorViewRange('signed-test',[-10,20]);
        const zero = sensorViewRange('zero-test',[0]);
        return {count,fault,recovered,signed,zero};
      });
      assert.equal(result.count,30);
      assert.deepEqual(result.fault,{count:0,now:null,width:'0%'});
      assert.equal(result.recovered,1);
      assert.ok(result.signed.min<0 && result.signed.max>20);
      assert.deepEqual(result.zero,{min:0,max:1,manual:false});
      await scale.click();
      await dialog.getByRole('button',{name:'Use auto range'}).click();
      assert.match(await scale.textContent(),/auto/);
      for (const theme of ['carbon','ember','slate','midnight','contrast','daylight']) {
        await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
        for (const width of [320,390,768,1200]) {
          await page.setViewportSize({width,height:1000});
          await scale.click();
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${theme}/${width} page overflow`);
          assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true,`${theme}/${width} dialog overflow`);
          await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
        }
      }
      assert.deepEqual(writes,[],'Display range controls must not send commands or configuration writes');
      assert.deepEqual(errors,[]);
      console.log(`${bundle}: 12 sensor bars/trends, additional inputs, units, persistence, faults/recovery, 30-sample bound, keyboard and 24 responsive/theme checks pass; no ECU writes.`);
      await page.close();
    }
  } finally {await browser.close();}
  process.exit(0);
})().catch(error=>{console.error(error);process.exit(1);});
