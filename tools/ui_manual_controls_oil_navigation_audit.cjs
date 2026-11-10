const assert=require('node:assert/strict');
const {chromium,firefox,webkit}=require('playwright');
const fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {guidedFixture}=require('./guided_build_fixture.cjs');
(async()=>{
 globalThis.OT_UI_SIM_PORT=14972;await import('./ui_mock_server.mjs');
 const base='http://127.0.0.1:'+OT_UI_SIM_PORT;
 const initial=await(await fetch(base+'/__sim/state')).json();
 await fetch(base+'/api/ecu_config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(guidedFixture(initial,2))});
 await fetch(base+'/__sim/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'STANDBY',config_locked:false})});
 for(const engine of [chromium,firefox,webkit]){
  const browser=await engine.launch();try{
   const page=await browser.newPage({viewport:{width:1024,height:600}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   if(process.env.OT_UI_PACKAGED==='1')await page.route(/\/(controllers\.html|hardware\.html|system\.html|sequence\.html|index\.html|app\.js|theme\.js|style\.css)(?:\?.*)?$/,r=>{
    const file=new URL(r.request().url()).pathname.slice(1);
    return r.fulfill({status:200,contentType:file.endsWith('html')?'text/html':file.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
   });
   await page.addInitScript(()=>{for(const key of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1','ot_gs_dismissed'])localStorage.setItem(key,'1');});
   await page.goto(base+'/system.html');await page.locator('#ot-auto-scroll-controls').waitFor({state:'attached'});
   await page.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);});
   await page.locator('#ot-auto-scroll-controls').uncheck();
   for(const route of ['controllers','hardware','sequence','system']){
    await page.goto(base+'/'+route+'.html');
    await page.waitForFunction(()=>window.OTScrollControls&&document.body.classList.contains('ot-controls-collapsed'));
    await page.locator('.ot-save-handle').waitFor({state:'visible'});
    if(route==='controllers'||route==='system')assert.equal(await page.locator('.cfg-workspace').evaluate(el=>getComputedStyle(el).position),'fixed','compact header leaves no in-flow gap');
    assert.match(await page.locator('.ot-save-handle').innerText(),/Show controls/i);
    for(const y of [400,200,0,600]){
     await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(90);
     assert.ok(await page.locator('body').evaluate(el=>el.classList.contains('ot-controls-collapsed')),route+' scroll does not reopen');
    }
    await page.setViewportSize({width:1280,height:1100});
    assert.ok(await page.locator('body').evaluate(el=>el.classList.contains('ot-controls-collapsed')),route+' tall resize preserves compact preference');
    await page.locator('.ot-save-handle').click();
    await page.waitForTimeout(280);
    assert.ok(!await page.locator('body').evaluate(el=>el.classList.contains('ot-controls-collapsed')));
    assert.match(await page.locator('.ot-save-handle').innerText(),/Hide controls/i);
    await page.evaluate(()=>{const b=document.querySelector('.ot-managed-save');b.classList.add('is-dirty');});
    await page.locator('.ot-save-handle').click();
    await page.waitForTimeout(280);
    assert.match(await page.locator('.ot-save-handle').innerText(),/Unsaved changes/i);
    await page.evaluate(()=>{const b=document.querySelector('.ot-managed-save');const s=b.querySelector('.save-msg,.save-status,#save-status');if(s)s.textContent='Cannot save: test validation';});
    await page.waitForTimeout(60);
    assert.ok(await page.locator('body').evaluate(el=>el.classList.contains('ot-controls-collapsed')),route+' validation does not reopen controls');
    console.log(engine.name(),route,'manual scroll/resize/reveal/dirty/error policy passed');
   }
   await page.goto(base+'/controllers.html#oil-pressure-control');
   await page.locator('#oil-loop-controller-0').waitFor({state:'attached'});
   assert.equal(await page.locator('#protection-low_oil #cf-oil_rm').count(),0,'do not expose an ignored global threshold for a named loop');
   await page.evaluate(()=>{hwCfg.oil_loops.push({id:'retired_pump',pump_output:'removed_pump',pressure_input:'removed_sensor',enabled:false});markControllerHardwareDirty();});
   const orphan=page.locator('[data-group^="oil-orphan-"]');
   await orphan.waitFor({state:'attached'});
   await orphan.locator('summary').click();
   await orphan.getByRole('button',{name:'Remove pressure controller'}).click();
   assert.equal(await orphan.count(),0);
   assert.ok(await page.evaluate(()=>!hwCfg.oil_loops.some(l=>l.id==='retired_pump')));
   await page.evaluate(()=>{
    const saved=JSON.parse(JSON.stringify(hwCfg.oil_loops));
    const row=saved[0];
    hwCfg.oil_loops=[{...row,id:'oil2',pump_output:'removed_pump',enabled:false}];
    addControllerOilLoop(row.pump_output,row.pressure_input);
    const ids=hwCfg.oil_loops.map(l=>l.id);
    if(ids.length!==2 || new Set(ids).size!==2)throw new Error('Removing/recreating a controller must allocate a unique ID');
    hwCfg.oil_loops=saved;markControllerHardwareDirty();
   });
   await page.evaluate(()=>revealConfigDeepLink());
   await page.waitForFunction(()=>document.querySelector('[id^="oil-loop-controller-"].deep-link-target'));
   assert.ok(await page.locator('#oil-loop-controller-0').evaluate(el=>el.open));
   assert.ok(await page.locator('body').evaluate(el=>el.classList.contains('ot-controls-collapsed')));
   await page.evaluate(()=>{setConfigSearch('unrelated search phrase');document.getElementById('cfg-search').value='unrelated search phrase';location.hash='oil-pressure-protection';});
   await page.waitForFunction(()=>document.querySelector('[id^="oil-loop-protection-"].deep-link-target'));
   assert.ok(await page.locator('#oil-loop-protection-0').evaluate(el=>el.open));
   assert.equal(await page.locator('#cfg-search').inputValue(),'');
   await page.request.post(base+'/__sim/data',{data:{oil_config_conflicts:[{loop:0,pump:'Main oil pump',target_bar:3.6,limit_bar:4,shutdown:true},{loop:1,pump:'Second oil pump',target_bar:2,limit_bar:3,shutdown:false}]}});
   await page.goto(base+'/index.html');
   await page.locator('#oil-config-warnings p').first().waitFor({state:'visible'});
   assert.equal(await page.locator('#oil-config-warnings p').count(),2);
   assert.match(await page.locator('#oil-config-warnings p').first().innerText(),/3.6.*shutdown.*4.0/);
   assert.equal(new URL(await page.locator('#oil-config-warnings a').last().getAttribute('href'),base).hash,'#oil-loop-protection-1');
   await page.request.post(base+'/__sim/data',{data:{oil_config_conflicts:[]}});
   await page.waitForFunction(()=>document.getElementById('oil-config-warnings').hidden);
   await page.request.post(base+'/__sim/data',{data:{mode:'FAULT',fault_description:'OIL_PRESSURE_LOW: Second oil pump',fault_latched:true,oil_fault_loop:1}});
   await page.waitForFunction(()=>document.getElementById('fault-limits-link').href.includes('#oil-loop-protection-1'));
   await page.request.post(base+'/__sim/data',{data:{mode:'STANDBY',fault_description:'',fault_latched:false,oil_fault_loop:null}});
   await page.goto(base+'/sequence.html#oil-arm-min');
   await page.locator('.param-field[data-pkey="oil_arm_min_bar"].deep-link-target').waitFor({state:'visible'});
   await page.goto(base+'/system.html');await page.locator('#ot-auto-scroll-controls').waitFor({state:'attached'});
   await page.locator('.ot-save-handle').click();await page.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));
   await page.locator('#ot-auto-scroll-controls').check();
   await page.waitForFunction(()=>!document.body.classList.contains('ot-manual-controls'));
   await page.goto(base+'/controllers.html');
   await page.waitForFunction(()=>window.OTScrollControls);
   assert.ok(!await page.locator('body').evaluate(el=>el.classList.contains('ot-manual-controls')));
   assert.deepEqual(errors,[]);
  }finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
