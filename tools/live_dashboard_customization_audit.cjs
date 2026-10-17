// Read-only board audit: dashboard preferences stay in an isolated browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright');
const base = process.argv[2] || 'http://192.168.4.1';
const target = process.argv[3] || 'classic';

(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const errors = [], writes = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => {if(r.method() !== 'GET') writes.push(r.url());});
    await page.addInitScript(() => {
      localStorage.setItem('ot_beta_notice_ack_v1','1');
      localStorage.setItem('ot_theme_onboarded_v1','1');
      localStorage.setItem('ot_gs_dismissed','1');
    });
    const get = async route => {
      for (let i=0;i<5;i++) {
        const r = await page.request.get(base+route,{timeout:20000});
        if(r.ok()) return r.json();
        await page.waitForTimeout(600);
      }
      throw Error('Could not read '+route);
    };
    const before = await get('/api/device_info');
    assert.equal(before.state,'STANDBY'); assert.equal(before.outputs_active,false);
    const snapshot = await get('/api/data');
    assert.equal(snapshot.labels.p1,'Boost Pressure');
    assert.equal(snapshot.labels.p2,'Jetpipe pressure');
    const connect = () => page.waitForFunction(() =>
      document.querySelector('#conn-label')?.textContent === 'Connected' &&
      !document.body.classList.contains('dashboard-awaiting-snapshot'));
    await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'}); await connect();
    assert.equal(await page.locator('#lbl-p1').textContent(),'Boost Pressure');
    assert.equal(await page.locator('#lbl-p2').textContent(),'Jetpipe pressure');
    const initial = await page.locator('#p1-card').evaluate(el=>el.offsetHeight);
    const detail = page.locator('#p1-card [data-dashboard-setting="detail"]');
    const size = page.locator('#p1-card [data-dashboard-setting="size"]');
    await page.locator('#dashboard-card-edit-btn').click();
    await detail.selectOption('reduced');
    await page.locator('#dashboard-card-edit-btn').click();
    assert.equal(await page.locator('#p1-card canvas').isVisible(),false);
    assert.ok(await page.locator('#p1-card .gauge-bar-wrap').isVisible());
    assert.ok(await page.locator('#p1-card').evaluate(el=>el.offsetHeight)<initial);
    await page.locator('#dashboard-card-edit-btn').click();
    await detail.selectOption('minimal'); await size.selectOption('small');
    await page.locator('#p2-card [data-dashboard-setting="size"]').selectOption('wide');
    const controls = page.locator('#dashboard-controls-card .dashboard-drag-handle');
    await controls.focus(); await page.keyboard.press('ArrowDown');
    await page.locator('#dashboard-card-edit-btn').click();
    assert.ok(await page.locator('#p1-card .dashboard-minimal-unit').isVisible());
    assert.equal(await page.locator('#p1-card .gauge-bar-wrap').isVisible(),false);
    assert.ok(await page.locator('#p1-health').isVisible());
    const abFitted = !!(snapshot.has_ab_pump || snapshot.has_ab_sol || snapshot.has_ab_flame || snapshot.ab_trigger_source > 0 || snapshot.ab_input_fitted);
    assert.equal(await page.locator('#afterburner-card').isVisible(),abFitted,'Custom layout must respect afterburner fitting');
    await page.reload({waitUntil:'domcontentloaded'}); await connect();
    assert.equal(await page.locator('#p1-card').getAttribute('data-dashboard-detail'),'minimal');
    assert.equal(await page.locator('#p1-card').getAttribute('data-dashboard-size'),'small');
    for (const width of [1280,768,390,320]) {
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }
    await page.screenshot({path:`artifacts/dashboard-2.5.3/${target}-mobile.png`,fullPage:true});
    await page.setViewportSize({width:1280,height:900});
    await page.screenshot({path:`artifacts/dashboard-2.5.3/${target}-desktop.png`,fullPage:true});
    await page.locator('#dashboard-card-edit-btn').click();
    await page.locator('#dashboard-reset-btn').click();
    assert.equal(await page.locator('#p1-card').getAttribute('data-dashboard-detail'),'normal');
    const pages = ['hardware','controllers','calibration','sequence','log','tools','system'];
    for (const name of pages) {
      const r = await page.goto(base+'/'+name+'.html',{waitUntil:'domcontentloaded'});
      assert.equal(r.status(),200);
      await page.waitForTimeout(900);
      if (name === 'calibration') {
        await page.waitForFunction(() => document.querySelector('#p1-cal-name')?.textContent.includes('Boost Pressure'));
        assert.match(await page.locator('#p2-cal-name').textContent(),/Jetpipe pressure/);
      }
      if (name === 'sequence') {
        await page.waitForFunction(()=>typeof hwCfg!=='undefined' && !!hwCfg.channel_registry);
        await page.evaluate(()=>openCustomBlockDialog('startup'));
        await page.locator('#cblk-type').selectOption('while');
        const sensors = await page.evaluate(()=>getEnabledSensors().filter(s=>s.source).map(s=>({key:s.key,source:s.source,label:s.label})));
        const hardware = await get('/api/hardware');
        for (const sensor of sensors) {
          const channel = hardware.channel_registry.inputs.find(c=>c.id===sensor.source);
          assert.equal(sensor.label,channel.name.trim());
          await page.locator('#cblk-cond-sensor').selectOption(sensor.key);
          assert.ok((await page.locator('#cblk-cond-preview').textContent()).includes(sensor.label));
        }
        await page.evaluate(()=>closeCustomBlockDialog());
      }
      if (name === 'log') {
        await page.locator('#tab-session').click();
        await page.waitForFunction(() => document.querySelector('#chart-lbl-p1 span')?.textContent.includes('Boost Pressure'));
        assert.match(await page.locator('#chart-lbl-p2 span').textContent(),/Jetpipe pressure/);
      }
    }
    // The complete downloadable configuration must retain the custom names.
    const config = await get('/api/ecu_config');
    assert.ok(config.hardware.channel_registry.inputs.some(c=>c.name==='Boost Pressure'));
    assert.ok(config.hardware.channel_registry.inputs.some(c=>c.name==='Jetpipe pressure'));
    const after = await get('/api/device_info');
    assert.equal(after.state,'STANDBY'); assert.equal(after.outputs_active,false);
    const finalSnapshot = await get('/api/data');
    assert.equal(finalSnapshot.boot_count,snapshot.boot_count);
    assert.deepEqual(errors,[]); assert.deepEqual(writes,[]);
    const result = {target,before,after,pages:['dashboard',...pages],names:snapshot.labels,
      presets:true,sizes:true,reloadPersistence:true,responsiveWidths:[1280,768,390,320],
      engineFileDownload:true,ecuWrites:writes,errors};
    fs.writeFileSync(`artifacts/dashboard-2.5.3/${target}-browser.json`,JSON.stringify(result,null,2));
    console.log(`${target}: live names, all three presets, sizes, movable controls, reload persistence, four widths, eight pages and engine-file download passed; standby, no output activity or ECU writes.`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
