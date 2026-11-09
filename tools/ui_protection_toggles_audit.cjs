const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=18300+Math.floor(Math.random()*100);await import('./ui_mock_server.mjs');const base=`http://127.0.0.1:${OT_UI_SIM_PORT}`;
 for(const engine of [chromium,firefox,webkit])for(const gzip of [false,true]){
  const b=await engine.launch();try{
   const p=await b.newPage({viewport:{width:1280,height:960}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(controllers\.html|app\.js|theme\.js|style\.css)(?:\?.*)?$/,async r=>{const f=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+f+'.gz'))});});
   await p.request.post(base+'/__sim/reset');await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',dev_mode:false,stop_switch_active:false,extra_cooldown_active:false}});
   await p.request.patch(base+'/api/config',{data:{safety:{p1_trip_bar:4.1,p2_trip_bar:5,torque_trip_nm:100},sequence:{startup:{startup_egt_guard_enabled:false,startup_egt_limit_c:900,startup_egt_dwell_c:800,startup_egt_dwell_ms:1000}}}});
   await p.goto(base+'/controllers.html');await p.waitForFunction(()=>document.querySelector('#cf-sf_p1en'));
   async function toggle(selector, checked){
    // Exercise native keyboard activation after focus. Pointer navigation is
    // covered separately; smooth scrolling can otherwise move the label
    // between Playwright's pointer-down and pointer-up in Firefox.
    const control=p.locator(selector);await control.focus();
    if(await control.isChecked()!==checked)await control.press('Space');
    assert.equal(await control.isChecked(),checked);
   }
   async function open(key){
    await p.evaluate(key=>openProtection(key),key);
    // The shortcut scrolls smoothly. Wait for its user-visible destination,
    // rather than clicking a checkbox while it is still crossing the sticky nav.
    await p.waitForFunction(key=>{
     const top=document.querySelector(`[data-protection="${key}"]`).getBoundingClientRect().top;
     let end=0;for(const header of document.querySelectorAll('body>nav,.cfg-workspace')){
      const style=getComputedStyle(header);if(['sticky','fixed'].includes(style.position))end=Math.max(end,(parseFloat(style.top)||0)+header.getBoundingClientRect().height);
     }
     return top>=end+8&&top<end+25;
    },key);
   }
   for(const [id,en,limit] of [['p1','sf_p1en','sf_p1t'],['p2','sf_p2en','sf_p2t'],['torque','sf_tqen','sf_tqt']]){
    await open(id);const old=await p.locator('#cf-'+limit).inputValue();
    assert.ok(await p.locator('#cf-'+en).isChecked(),'legacy positive threshold must stay enabled');
    await toggle('#cf-'+en, false);assert.equal(await p.locator('#cf-'+limit).inputValue(),old);assert.ok(await p.locator('#cf-'+limit).isEnabled());
    assert.match(await p.locator(`[data-protection="${id}"] [data-trip-state]`).innerText(),/OFF.*retained/);
    await toggle('#cf-'+en, true);assert.match(await p.locator(`[data-protection="${id}"] [data-trip-state]`).innerText(),/ON/);
   }
   for(const [id,key] of [['n1','pb_n1e'],['n2','pb_n2e'],['egt','pb_egte'],['p1','pb_p1e'],['p2','pb_p2e'],['torque','pb_tqe']]){
    await open(id);assert.equal(await p.locator('#cf-'+key+' option').count(),2);
    await p.locator('#cf-'+key).selectOption('1');await toggle('#cf-'+key+'_on', true);
    assert.match(await p.locator(`[data-protection="${id}"] .protection-modes`).innerText(),/ON.*Predictive/);
    await toggle('#cf-'+key+'_on', false);assert.equal(await p.locator('#cf-'+key).inputValue(),'1');
    assert.ok(await p.locator('#cf-'+key).isEnabled());assert.match(await p.locator(`[data-protection="${id}"] .protection-modes`).innerText(),/Fuel limiting: OFF/);
   }
   await open('egt');assert.ok(await p.locator('#cf-sf_st').isEnabled());
   await toggle('#cf-sf_sg_en', true);await toggle('#cf-sf_st_en', false);await toggle('#cf-sf_sd_en', true);
   assert.equal(await p.locator('#cf-sf_st').inputValue(),'900');assert.equal(await p.locator('#cf-sf_sd').inputValue(),'800');
   const collected=await p.evaluate(()=>{collectConfigFields();return {safety:cfg.safety,startup:cfg.sequence.startup,throttle:cfg.throttle,changes:_buildChanges()};});
   assert.equal(collected.startup.startup_egt_immediate_enabled,false);
   assert.equal(collected.startup.startup_egt_dwell_enabled,undefined,'An unchanged legacy dwell enable remains derived from its positive threshold');
   assert.equal(await p.locator('#cf-sf_sd_en').isChecked(),true);
   assert.equal(collected.throttle.pullback_p1,undefined,'An off/on/off edit must not materialize an unchanged legacy disabled flag');assert.equal(collected.throttle.pullback_p1_mode,1);
   assert.ok(collected.changes.some(c=>c.key==='pb_p1e'));assert.ok(collected.changes.some(c=>c.key==='sf_st_en'));
   await p.locator('[data-protection="egt"] a[href="#cf-tot_limit"]').click();assert.ok(await p.locator('#cf-tot_limit').isVisible());
   await p.setViewportSize({width:390,height:844});await open('p1');
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
   console.log(engine.name(),gzip?'gzip':'source','all six limiter toggles, trip toggles, retained values/methods, legacy state, startup subguards, review tracking, links and mobile passed');
  }finally{await b.close();}
 }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
