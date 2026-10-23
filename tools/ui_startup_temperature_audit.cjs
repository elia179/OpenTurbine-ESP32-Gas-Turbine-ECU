const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=17900+Math.floor(Math.random()*100);await import('./ui_mock_server.mjs');const base=`http://127.0.0.1:${OT_UI_SIM_PORT}`;
 for(const engine of [chromium,firefox,webkit])for(const gzip of [false,true]){
  const browser=await engine.launch({headless:true});try{
   const p=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(controllers\.html|app\.js|theme\.js|style\.css)(?:\?.*)?$/,async r=>{const file=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});});
   await p.request.post(base+'/__sim/reset');await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',dev_mode:false,stop_switch_active:false,extra_cooldown_active:false}});await p.request.patch(base+'/api/config',{data:{sequence:{startup:{startup_egt_guard_enabled:false,startup_egt_limit_c:900,startup_egt_dwell_c:800,startup_egt_dwell_ms:1000}}}});
   await p.goto(base+'/controllers.html');await p.waitForFunction(()=>document.querySelector('#cf-sf_sg_en'));await p.evaluate(()=>openProtection('egt'));
   const card=p.locator('[data-protection="egt"]');await card.waitFor({state:'visible'});
   assert.equal(await card.locator('.protection-part').count(),4);assert.equal(await p.locator('#cf-sf_st').isDisabled(),false);
   const startup=card.locator('.protection-part-startup').filter({has:p.locator('#cf-sf_sg_en')});
   assert.match(await startup.locator(':scope > p').first().innerText(),/also apply during Startup/);
   await p.locator('#cf-sf_sg_en').check();assert.equal(await p.locator('#cf-sf_st').isDisabled(),false);
   assert.match(await startup.locator(':scope > p').first().innerText(),/resume in Running/);
   await p.locator('#cf-sf_st').fill('950');await p.locator('#cf-sf_sd').fill('850');await p.locator('#cf-sf_sm').fill('2000');
   const state=await p.evaluate(()=>{collectConfigFields();return cfg.sequence.startup;});
   assert.equal(state.startup_egt_guard_enabled,true);assert.equal(state.startup_egt_limit_c,950);assert.equal(state.startup_egt_dwell_c,850);assert.equal(state.startup_egt_dwell_ms,2000);
   await p.locator('#cf-sf_st').fill('960');
   const independent=await p.evaluate(()=>{const before=cfg.throttle.pullback_egt;setSafetyEnabled('overtemp',!hwCfg.safety.overtemp);return {before,after:cfg.throttle.pullback_egt,open:document.querySelector('[data-protection="egt"]').open};});
   assert.equal(independent.before,independent.after);assert.equal(independent.open,true);assert.equal(await p.locator('#cf-sf_st').inputValue(),'960');
   const validation=await p.evaluate(async()=>{cfg.sequence.startup.startup_egt_limit_c=0;cfg.sequence.startup.startup_egt_dwell_c=0;const alert=OTDialog.alert;let text='';OTDialog.alert=async msg=>{text=msg;};try{return {ok:await validateBeforeSave(cfg),text};}finally{OTDialog.alert=alert;}});assert.equal(validation.ok,false);assert.match(validation.text,/Startup temperature.*threshold/);
   await p.evaluate(()=>{cfg.sequence.startup.startup_egt_limit_c=950;cfg.sequence.startup.startup_egt_dwell_c=850;renderForm(true);_applyAllVisibility();applyView();openProtection('egt');});
   await p.screenshot({path:`artifacts/protection-${engine.name()}-${gzip?'gzip':'source'}.png`,fullPage:false});
   await p.setViewportSize({width:390,height:844});await p.evaluate(()=>openProtection('egt'));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.equal(await card.locator('#cf-sf_sg_en').count(),1);assert.deepEqual(errors,[]);
   console.log(engine.name(),gzip?'gzip':'source','startup guard controls, fallback explanation, independent shutdown/limiting, validation, expansion retention and mobile layout passed');
  }finally{await browser.close();}
 }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
