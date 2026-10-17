const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {gunzipSync} = require('node:zlib');
const {chromium} = require('playwright');

(async () => {
  // Guard the firmware regression too: legacy labels previously overwrote the
  // fitted registry names after they had already been copied.
  const config = fs.readFileSync(path.join(__dirname,'../src/system/HardwareConfig.cpp'),'utf8');
  assert.ok(config.indexOf('if (doc["labels"].is<JsonObjectConst>())') <
    config.indexOf('if (pressure1->name[0]) strlcpy(labelP1'));
  globalThis.OT_UI_SIM_PORT = 12600 + Math.floor(Math.random()*100);
  await import('./ui_mock_server.mjs');
  const base = `http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
  const browser = await chromium.launch({headless:true});
  try {
    for (const bundle of ['source','packaged']) {
      const context = await browser.newContext({viewport:{width:1280,height:900}});
      await context.addInitScript(() => {
        localStorage.setItem('ot_beta_notice_ack_v1','1');
        localStorage.setItem('ot_theme_onboarded_v1','1');
        localStorage.setItem('ot_gs_dismissed','1');
      });
      const page = await context.newPage();
      const errors = [], writes = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => {if(r.method() !== 'GET' && new URL(r.url()).pathname.startsWith('/api/')) writes.push(r.url());});
      if (bundle === 'packaged') await page.route(/\/(app\.js|style\.css|index\.html)(?:\?.*)?$/, async route => {
        const name = path.basename(new URL(route.request().url()).pathname);
        await route.fulfill({status:200, contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html',
          body:gunzipSync(fs.readFileSync(path.join(__dirname,'../data',name+'.gz')))});
      });
      await page.request.post(base+'/__sim/reset');
      const fixture = {
        labels:{p1:'Boost Pressure',p2:'Jetpipe pressure',tot:'Exhaust temperature'},
        registry_inputs:[
          {id:'p1_main',purpose:'p1_pressure',role:'pressure',name:'Boost Pressure',value:1,healthy:true},
          {id:'p2_main',purpose:'p2_pressure',role:'pressure',name:'Jetpipe pressure',value:.1,healthy:true},
          {id:'load',purpose:'thrust',role:'thrust',name:'Test stand thrust',value:330,healthy:true},
          {id:'aux',purpose:'general_pressure',role:'pressure',name:'Aux_pressure <test>',value:.2,healthy:true}
        ],
        registry_outputs:[{id:'aux_output',name:'Test_valve',purpose:'generic',role:'generic',
          driver:5,demand:.3,has_current:true,current_amps:1,current_healthy:true}]
      };
      await page.request.post(base+'/__sim/data',{data:fixture});
      await page.goto(base+'/index.html');
      await page.waitForSelector('#p1-card .sensor-view');
      await page.waitForSelector('#registry-card-aux .dashboard-card-settings',{state:'attached'});
      assert.equal(await page.locator('#lbl-p1').textContent(),'Boost Pressure');
      assert.equal(await page.locator('#lbl-p2').textContent(),'Jetpipe pressure');
      assert.equal(await page.locator('#lbl-thrust').textContent(),'Test stand thrust');
      assert.match(await page.locator('#registry-card-aux .label').textContent(),/Aux_pressure <test>/);
      assert.equal(await page.locator('#registry-card-aux test').count(),0);
      assert.equal(await page.locator('#p1-card').getAttribute('data-dashboard-detail'),'normal');
      assert.ok(await page.locator('#p1-card canvas').isVisible());
      const normalHeight = await page.locator('#p1-card').evaluate(el => el.offsetHeight);
      await page.locator('#dashboard-card-edit-btn').click();
      const detail = id => page.locator('#'+id+' [data-dashboard-setting="detail"]');
      const size = id => page.locator('#'+id+' [data-dashboard-setting="size"]');
      await detail('p1-card').selectOption('reduced');
      await page.locator('#dashboard-card-edit-btn').click();
      assert.equal(await page.locator('#p1-card canvas').isVisible(),false);
      assert.ok(await page.locator('#p1-card .gauge-bar-wrap').isVisible());
      assert.ok(await page.locator('#p1-card').evaluate(el => el.offsetHeight) < normalHeight);
      // A reduced card must never touch its canvas, even as live values update.
      await page.evaluate(() => {
        const canvas = document.querySelector('#p1-card canvas');
        canvas.getContext = () => {throw Error('Hidden sparkline was drawn');};
      });
      await page.waitForTimeout(1200);
      await page.locator('#dashboard-card-edit-btn').click();
      await detail('p1-card').selectOption('minimal');
      await size('p1-card').selectOption('small');
      await size('p2-card').selectOption('wide');
      await detail('registry-card-aux').selectOption('minimal');
      await size('registry-card-aux').selectOption('small');
      await detail('registry-output-card-aux_output').selectOption('minimal');
      // Move the original control block, retaining the original buttons and
      // handlers. It can be reordered but cannot accidentally be hidden.
      assert.equal(await page.locator('#dashboard-controls-card .dashboard-hide-card').count(),0);
      const controlsHandle = page.locator('#dashboard-controls-card .dashboard-drag-handle');
      await controlsHandle.focus(); await page.keyboard.press('ArrowDown');
      const order = await page.evaluate(() => [...document.querySelector('#dashboard-custom-cards').children].map(c => c.id));
      await page.locator('#dashboard-card-edit-btn').click();
      assert.ok(await page.locator('#btn-stop').isVisible());
      assert.equal(await page.locator('#p1-card .gauge-bar-wrap').isVisible(),false);
      assert.equal(await page.locator('#p1-card .peak-val').isVisible(),false);
      assert.ok(await page.locator('#p1-card .dashboard-minimal-unit').isVisible());
      assert.ok(await page.locator('#p1-health').isVisible());
      assert.ok(await page.locator('#registry-card-aux .dashboard-minimal-unit').isVisible());
      assert.equal(await page.locator('#registry-output-card-aux_output .output-current').isVisible(),false);
      assert.equal(await page.locator('#registry-output-card-aux_output .value').textContent(),'30.0%');
      await page.reload();
      await page.waitForSelector('#p1-card[data-dashboard-detail="minimal"]');
      assert.equal(await page.locator('#p2-card').getAttribute('data-dashboard-size'),'wide');
      assert.deepEqual(await page.evaluate(() => [...document.querySelector('#dashboard-custom-cards').children].map(c => c.id)),order);
      // Dynamic channels keep the same DOM node and preferences across updates.
      await page.evaluate(() => window._auditAux = document.querySelector('#registry-card-aux'));
      await page.waitForTimeout(1200);
      assert.ok(await page.evaluate(() => window._auditAux === document.querySelector('#registry-card-aux')));
      await page.locator('#unit-press-btn').click();
      assert.equal(await page.locator('#p1-card .dashboard-minimal-unit').textContent(),'PSI');
      for (const width of [1280,768,390,320]) {
        await page.setViewportSize({width,height:900});
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),`${bundle}/${width} overflow`);
      }
      await page.locator('#dashboard-card-edit-btn').click();
      for (const select of await page.locator('[data-dashboard-setting="size"]:visible').all())
        await select.selectOption('small');
      await page.locator('#dashboard-card-edit-btn').click();
      const overflow = await page.evaluate(() => [...document.querySelectorAll('#dashboard-custom-cards > *')]
        .filter(el => el.getBoundingClientRect().right > innerWidth || el.scrollWidth > el.clientWidth+1)
        .map(el => ({id:el.id,width:el.clientWidth,scroll:el.scrollWidth})));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),'Small card overflow: '+JSON.stringify(overflow));
      await page.screenshot({path:`artifacts/dashboard-${bundle}-minimal-mobile.png`,fullPage:true});
      await page.request.post(base+'/__sim/data',{data:{p1_healthy:false,mode:'FAULT',fault_description:'Test sensor fault'}});
      await page.waitForFunction(() => document.querySelector('#p1-health').classList.contains('fault'));
      assert.equal((await page.locator('#p1').textContent()).trim(),'—');
      assert.ok(await page.locator('#fault-card').isVisible());
      await page.locator('#dashboard-card-edit-btn').click();
      await page.locator('#dashboard-reset-btn').click();
      assert.equal(await page.locator('#dashboard-custom-section').isVisible(),false);
      assert.equal(await page.locator('#p1-card').getAttribute('data-dashboard-detail'),'normal');
      assert.equal(await page.locator('#dashboard-controls-card').evaluate(el => el.parentElement.tagName),'MAIN');
      await page.evaluate(() => localStorage.setItem('ot_dashboard_card_order_v1',JSON.stringify(['p2-card','p1-card'])));
      await page.reload();
      await page.waitForSelector('#dashboard-custom-cards #p1-card');
      const migrated = await page.locator('#dashboard-custom-cards').evaluate(el => [...el.children].map(card => card.id));
      assert.ok(migrated.indexOf('dashboard-controls-card') < migrated.indexOf('p2-card'),'Old layouts must retain controls ahead of readings');
      assert.ok(migrated.indexOf('p2-card') < migrated.indexOf('p1-card'),'Old card order changed during migration');
      // Absent hardware must stay absent after cards move out of their groups.
      const optional = ['afterburner-card','governor-card','actuator-outputs-card','switch-inputs-card'];
      const flags = {has_ab_pump:false,has_ab_sol:false,has_ab_flame:false,ab_trigger_source:0,ab_input_fitted:false,
        has_governor:false,has_starter:false,has_starter_en:false,has_fuel_sol:false,has_igniter:false,
        has_igniter2:false,has_glow_plug:false,has_bleed_valve:false,has_prop_pitch:false,has_fuel_pump2:false,
        has_cool_fan:false,has_airstarter:false,has_oil_scavenge:false,di_channels:[],registry_inputs:[]};
      await page.request.post(base+'/__sim/data',{data:flags});
      await page.waitForFunction(()=>document.getElementById('afterburner-card').style.display==='none');
      for (const id of optional) assert.equal(await page.locator('#'+id).isVisible(),false,id+' should be absent in custom layout');
      await page.request.post(base+'/__sim/data',{data:{has_ab_sol:true,has_governor:true,has_starter:true,
        registry_inputs:[{id:'audit_switch',name:'Bench switch',role:'digital_switch',purpose:'generic',value:1,healthy:true}]}});
      await page.waitForFunction(()=>document.getElementById('afterburner-card').style.display!=='none');
      for (const id of optional) assert.ok(await page.locator('#'+id).isVisible(),id+' should reappear when fitted');
      assert.deepEqual(writes,[],'Dashboard preferences must not write ECU configuration or issue commands');
      assert.deepEqual(errors,[]);
      console.log(`${bundle}: names, presets, sizes, browser persistence, dynamic card reuse, movable controls, units, faults, responsive layout and reset passed; no ECU writes.`);
      await context.close();
    }
  } finally {await browser.close();}
  process.exit(0);
})().catch(error => {console.error(error);process.exit(1);});
