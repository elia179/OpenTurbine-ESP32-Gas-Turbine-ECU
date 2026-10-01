// Isolated simulator: UI unit conversion, explicit idle choices and persistence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {gunzipSync} = require('node:zlib');
const {chromium} = require('playwright');
(async()=>{
  const port=13000+Math.floor(Math.random()*200), base=`http://127.0.0.1:${port}`;
  globalThis.OT_UI_SIM_PORT=port; await import('./ui_mock_server.mjs');
  const browser=await chromium.launch({headless:true,executablePath:process.env.OT_BROWSER_EXECUTABLE});
  try {
    for(const bundle of ['source','packaged']) {
      const page=await browser.newPage({viewport:{width:1200,height:1000}}), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{
        localStorage.setItem('ot_beta_notice_ack_v1','1');
        localStorage.setItem('ot_theme_onboarded_v1','1');
        localStorage.setItem('ot_gs_dismissed','1');
      });
      if(bundle==='packaged') await page.route(/\/(controllers\.html|app\.js|style\.css)(?:\?.*)?$/,async route=>{
        const name=path.basename(new URL(route.request().url()).pathname);
        await route.fulfill({status:200,contentType:name.endsWith('.html')?'text/html':name.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync(path.resolve(__dirname,'../data',name+'.gz')))});
      });
      await page.request.post(`${base}/__sim/reset`);
      const initial=await (await page.request.get(`${base}/__sim/state`)).json();
      initial.hardware.controllers.dynamic_idle=false;
      initial.settings.dynamic_idle.fuel_mode=0;
      initial.settings.rules[0].output_min=.12345;
      initial.settings.rules[0].output_max=.98765;
      await page.request.post(`${base}/api/ecu_config`,{data:initial});
      await page.request.post(`${base}/__sim/data`,{data:{mode:'STANDBY',config_locked:false}});
      await page.goto(`${base}/controllers.html`);
      await page.locator('#cf-fi_mode').waitFor({state:'attached'});
      await page.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
      assert.match(await page.locator('[data-configured-idle-source]').innerText(),/Idle input/);
      const low=page.getByLabel('Input low (%)',{exact:true}), high=page.getByLabel('Input high (%)',{exact:true});
      assert.equal(await low.inputValue(),'0'); assert.equal(await high.inputValue(),'100');
      assert.equal(await page.getByLabel('Output low (%)',{exact:true}).inputValue(),'12.345');
      await high.fill('87.65'); await high.press('Tab');
      assert.ok(Math.abs(await page.evaluate(()=>cfg.rules[0].input_max)-.8765)<1e-12);
      await page.getByLabel('Output low (%)',{exact:true}).fill('12.3456');
      await page.getByLabel('Output low (%)',{exact:true}).press('Tab');
      assert.ok(Math.abs(await page.evaluate(()=>cfg.rules[0].output_min)-.123456)<1e-12);
      assert.deepEqual(errors,[]);
      // An edited unrelated field must survive rerendering the idle choice.
      await page.locator('#cf-th_mx').fill('47.25');
      await page.locator('#cf-fi_mode').selectOption('2');
      await page.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
      await page.locator('#cf-fi_fixed').fill('32.25');
      await page.locator('#cf-fi_fixed').press('Tab');
      assert.match(await page.locator('[data-configured-idle-source]').innerText(),/Fixed · 32.25%/);
      assert.equal(await page.evaluate(()=>cfg.throttle.idle_max_pct),47.25);
      assert.equal(await page.locator('[data-idle-floor-note]').count(),1);
      const saved=await page.evaluate(()=>({hardware:hwCfg,settings:cfg}));
      await page.request.post(`${base}/api/ecu_config`,{data:saved});
      await page.reload();
      assert.equal(await page.locator('#cf-fi_mode').inputValue(),'2');
      assert.equal(await page.locator('#cf-fi_fixed').inputValue(),'32.25');
      await page.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
      await page.locator('#cf-fi_fixed').fill('0'); await page.locator('#cf-fi_fixed').press('Tab');
      assert.equal(await page.locator('[data-idle-floor-note]').count(),0);
      await page.locator('#cf-fi_mode').selectOption('1');
      assert.equal(await page.locator('[data-idle-floor-note]').count(),0);
      assert.equal(await page.locator('#cf-fi_fixed').count(),0);
      assert.match(await page.locator('[data-configured-idle-source]').innerText(),/Off · no idle floor/);
      await page.locator('#cf-fi_mode').selectOption('4');
      assert.equal(await page.evaluate(()=>hwCfg.controllers.dynamic_idle),true);
      assert.equal(await page.locator('.automatic-idle-settings').count(),1);
      await page.locator('#cf-fi_mode').selectOption('3');
      assert.equal(await page.evaluate(()=>hwCfg.controllers.dynamic_idle),false);
      assert.equal(await page.locator('.automatic-idle-settings').count(),0);
      await page.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
      assert.equal(await page.locator('#cf-fi_input').inputValue(),'');
      assert.match(await page.locator('#cf-fi_input').innerText(),/Automatic: configured Idle Input/);
      assert.equal(await page.locator('#cf-fi_low').count(),0,'automatic uses the calibrated Idle Input');
      await page.locator('#cf-fi_input').selectOption('operator_throttle');
      assert.equal(await page.locator('#cf-fi_high').inputValue(),'100');
      await page.locator('#cf-fi_high').fill('87.65'); await page.locator('#cf-fi_high').press('Tab');
      assert.ok(Math.abs(await page.evaluate(()=>cfg.dynamic_idle.input_high)-.8765)<1e-12);
      assert.match(await page.locator('[data-configured-idle-source]').innerText(),/0–87.65 %/);
      await page.locator('#cf-fi_input').selectOption('battery_voltage');
      await page.locator('#cf-fi_low').fill('10.5'); await page.locator('#cf-fi_low').press('Tab');
      await page.locator('#cf-fi_high').fill('14.25'); await page.locator('#cf-fi_high').press('Tab');
      assert.equal(await page.locator('#cf-fi_low').getAttribute('aria-label'),'Idle Input Low (V)');
      assert.match(await page.locator('[data-configured-idle-source]').innerText(),/10.5–14.25 V/);
      const changes=await page.evaluate(()=>_buildChanges());
      assert.ok(changes.some(row=>row.label==='Idle / Idle Input Channel' && /Batt/i.test(row.now)));
      assert.ok(changes.some(row=>row.label==='Idle / Idle Input High' && row.now==='14.25 V'));
      // Every theme: unsaved changes use the edit accent, not an amber warning
      // glow across the whole section. Errors retain a separate red marker.
      for (const theme of ['carbon','ember','slate','midnight','contrast','daylight']) {
        await page.evaluate(theme=>OTTheme.set(theme),theme);
        await page.waitForTimeout(200);
        assert.equal(await page.locator('#cf-fi_input').evaluate(el=>getComputedStyle(el).borderTopColor),await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()).then(async accent=>page.evaluate(accent=>{const el=document.createElement('span');el.style.color=accent;document.body.append(el);const color=getComputedStyle(el).color;el.remove();return color},accent)));
        assert.equal(await page.locator('#cf-fi_mode').evaluate(el=>getComputedStyle(el.closest('.config-group')).boxShadow),'none');
      }
      const selected=await page.evaluate(()=>({hardware:hwCfg,settings:cfg}));
      await page.request.post(`${base}/api/ecu_config`,{data:selected}); await page.reload();
      await page.locator('#cf-fi_input').waitFor({state:'attached'});
      await page.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
      assert.equal(await page.locator('#cf-fi_input').inputValue(),'battery_voltage');
      assert.equal(await page.locator('#cf-fi_low').inputValue(),'10.5');
      assert.equal(await page.locator('#cf-fi_high').inputValue(),'14.25');
      await page.locator('#cf-fi_high').fill('10.5'); await page.locator('#cf-fi_high').press('Tab');
      const prompts=await page.evaluate(async()=>{
        const messages=[], original=OTDialog.alert;
        OTDialog.alert=async message=>messages.push(message);
        try {await validateBeforeSave(cfg);} finally {OTDialog.alert=original;}
        return messages;
      });
      assert.ok(prompts.some(message=>/Idle Input Low and High must differ/.test(message)));
      await page.locator('#cf-fi_high').fill('14.25'); await page.locator('#cf-fi_high').press('Tab');
      // Removal must expose the unresolved saved selection, never choose a
      // different registry row or silently revert to the dedicated Idle Input.
      await page.evaluate(()=>{
        hwCfg.channel_registry.inputs=hwCfg.channel_registry.inputs.filter(row=>row.id!=='battery_voltage');
        renderForm(true); document.querySelectorAll('details').forEach(el=>el.open=true);
      });
      assert.equal(await page.locator('#cf-fi_input').inputValue(),'battery_voltage');
      assert.match(await page.locator('[data-configured-idle-source]').innerText(),/Selected input unavailable/);
      const missing=await page.evaluate(async()=>{
        const messages=[],original=OTDialog.alert; OTDialog.alert=async message=>messages.push(message);
        try {await validateBeforeSave(cfg);} finally {OTDialog.alert=original;} return messages;
      });
      assert.ok(missing.some(message=>/choose a fitted input channel/.test(message)));
      await page.locator('#cf-fi_input').selectOption('operator_throttle');
      for(const width of [320,390,768,1200]) {
        await page.setViewportSize({width,height:1000});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${bundle}: overflow at ${width}`);
      }
      assert.deepEqual(errors,[]);
      // Automatic settings must be visible in the default configured filter,
      // including incomplete hardware. Merely seeing a heading is not a test.
      await page.setViewportSize({width:1200,height:1000});
      async function openIdleState(state) {
        await page.request.post(`${base}/api/ecu_config`,{data:state});
        await page.reload(); await page.locator('#cf-fi_mode').waitFor({state:'attached'});
        await page.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
      }
      const automatic=structuredClone(initial);
      automatic.settings.dynamic_idle.fuel_mode=4;
      automatic.hardware.controllers.dynamic_idle=true;
      automatic.settings.throttle.idle_max_pct=35;
      automatic.settings.dynamic_idle.max_multiplier=1.5;
      await openIdleState(automatic);
      assert.match(await page.locator('[data-configured-idle-source]').innerText(),/35% base ceiling × 1.5 range multiplier = 52.5%/);
      assert.match(await page.locator('[data-configured-idle-source]').innerText(),/0%–52.5%/);
      assert.equal(await page.locator('#cf-fi_mode option').count(),4);
      assert.doesNotMatch(await page.locator('#cf-fi_mode').innerText(),/Existing|feedback/);
      assert.equal(await page.getByRole('checkbox',{name:'Automatic Idle',exact:true}).count(),0);
      for(const key of ['di_src','di_tr','di_db','di_rl','di_mode','di_ru','di_mx'])
        assert.ok(await page.locator('#cf-'+key).isVisible(),`${bundle}: automatic ${key} visible`);
      assert.equal(await page.locator('#cf-di_tp').isVisible(),false);
      assert.equal(await page.locator('#cf-di_lk').isVisible(),false);
      await page.locator('#cf-di_src').selectOption('2');
      assert.ok(await page.locator('#cf-di_tp').isVisible());
      assert.equal(await page.locator('#cf-di_tr').isVisible(),false);
      assert.match(await page.locator('[data-configured-idle-source]').innerText(),/Automatic Idle · Pressure 1/);
      assert.ok(await page.getByRole('heading',{name:'Feedback control',exact:true}).isVisible());
      for (const theme of ['carbon','ember','slate','midnight','contrast','daylight']) {
        await page.evaluate(theme=>OTTheme.set(theme),theme);
        for (const width of [320,390,768,1200]) {
          await page.setViewportSize({width,height:1000});
          const layout=await page.evaluate(()=>{
            const bounds=key=>document.getElementById('cf-'+key).closest('.cfg-field').getBoundingClientRect();
            const mode=bounds('fi_mode'), ceiling=bounds('th_mx'), method=bounds('di_mode'), source=bounds('di_src');
            const root=document.querySelector('.idle-setup');
            return {modeY:mode.y,ceilingY:ceiling.y,methodWidth:method.width,sourceWidth:source.width,overflow:root.scrollWidth-root.clientWidth,border:getComputedStyle(root.querySelector('.idle-mode-grid')).borderTopWidth};
          });
          assert.ok(layout.overflow<=1,`${bundle}/${theme}/${width}: idle layout overflow`);
          assert.equal(layout.border,'0px','do not add divider strips to every grid');
          if(width>700) {
            assert.ok(Math.abs(layout.modeY-layout.ceilingY)<2,'mode and fuel ceiling belong in one row');
            assert.ok(layout.methodWidth>layout.sourceWidth*1.8,'method should span the feedback group');
          } else assert.ok(layout.ceilingY>layout.modeY,'mobile fields must stack');
        }
      }
      await page.setViewportSize({width:1200,height:1000});
      await page.locator('#cf-di_mode').selectOption('1');
      assert.ok(await page.locator('#cf-di_pde').isVisible());
      assert.equal(await page.locator('#cf-di_de').isVisible(),false);
      const incomplete=structuredClone(automatic);
      incomplete.hardware.channel_registry.inputs=incomplete.hardware.channel_registry.inputs.filter(row=>!['n1_speed','n2_speed','p1_pressure','p2_pressure'].includes(row.purpose));
      await openIdleState(incomplete);
      assert.ok(await page.locator('#cf-di_src').isVisible(),'missing hardware must not erase settings');
      assert.ok(await page.locator('#cf-di_tr').isVisible());
      assert.match(await page.locator('[data-configured-idle-source]').innerText(),/setup incomplete.*fitted N1 speed/s);
      assert.ok(await page.getByRole('link',{name:'Configure hardware',exact:true}).isVisible());
      assert.equal(await page.locator('.automatic-idle-settings .cfg-inactive-note:visible').count(),0,'missing-hardware explanation should appear once, not below every field');
      assert.doesNotMatch(await page.locator('body').innerText(),/Automatic Idle must be enabled in Hardware > Controllers/);
      const rejection=await page.evaluate(async()=>{const messages=[],old=OTDialog.alert; OTDialog.alert=async text=>messages.push(text);try{await validateBeforeSave(cfg);}finally{OTDialog.alert=old;}return messages;});
      assert.ok(rejection.some(text=>/Automatic Idle needs.*N1/.test(text)));
      const oldAutomatic=structuredClone(automatic);oldAutomatic.settings.dynamic_idle.fuel_mode=0;
      await openIdleState(oldAutomatic);
      assert.equal(await page.locator('#cf-fi_mode').inputValue(),'4');
      assert.ok(await page.locator('#cf-di_src').isVisible());
      assert.equal(await page.evaluate(()=>{collectConfigFields();return cfg.dynamic_idle.fuel_mode;}),0,'display inference must not rewrite old files');
      const oldInput=structuredClone(initial);
      await openIdleState(oldInput);
      assert.equal(await page.locator('#cf-fi_mode').inputValue(),'3');
      assert.equal(await page.evaluate(()=>{collectConfigFields();return cfg.dynamic_idle.fuel_mode;}),0);
      const oldSequence=structuredClone(initial);
      oldSequence.hardware.channel_registry.inputs=oldSequence.hardware.channel_registry.inputs.filter(row=>row.purpose!=='idle');
      oldSequence.hardware.startup_seq=['FuelPumpIdle','TimedDelay'];
      await openIdleState(oldSequence);
      assert.equal(await page.locator('#cf-fi_mode').inputValue(),'0');
      assert.equal(await page.locator('#cf-fi_mode option[value="0"]').getAttribute('hidden'),'');
      assert.match(await page.locator('[data-configured-idle-source]').innerText(),/mode choice/);
      assert.equal(await page.evaluate(()=>{collectConfigFields();return cfg.dynamic_idle.fuel_mode;}),0);
      await page.locator('#cf-th_mx').fill('42');await page.locator('#cf-th_mx').press('Tab');
      const review=await page.evaluate(async()=>{const messages=[],old=OTDialog.alert;OTDialog.alert=async text=>messages.push(text);try{await validateBeforeSave(cfg);}finally{OTDialog.alert=old;}return messages;});
      assert.ok(review.some(text=>/Choose a Running Idle Mode/.test(text)));
      await page.locator('#cf-fi_mode').selectOption('2');
      assert.equal(await page.locator('#cf-fi_mode option').count(),4);
      assert.equal(await page.evaluate(()=>cfg.dynamic_idle.fuel_mode),2);
      assert.deepEqual(errors,[]);
      console.log(`${bundle}: idle modes, automatic settings, missing hardware, old-file preservation/review, units, persistence and responsive layout passed`);
      await page.close();
    }
  } finally {await browser.close();}
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
