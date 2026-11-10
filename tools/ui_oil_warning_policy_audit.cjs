const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
const {guidedFixture}=require('./guided_build_fixture.cjs');
(async()=>{
 globalThis.OT_UI_SIM_PORT=14975;await import('./ui_mock_server.mjs');
 const base='http://127.0.0.1:'+OT_UI_SIM_PORT;
 const initial=await(await fetch(base+'/__sim/state')).json(),fixture=guidedFixture(initial,1);
 fixture.hardware.controllers.dynamic_idle=false;fixture.settings.dynamic_idle.fuel_mode=1;
 for(const engine of [chromium,firefox,webkit])for(const packed of [false,true]){
  const browser=await engine.launch();try{
   const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{for(const key of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1','ot_gs_dismissed'])localStorage.setItem(key,'1');});
   if(packed)await page.route(/\/(controllers\.html|sequence\.html|app\.js|theme\.js|ui_dialog\.js|style\.css)(?:\?.*)?$/,r=>{
    const name=new URL(r.request().url()).pathname.slice(1);
    return r.fulfill({status:200,contentType:name.endsWith('html')?'text/html':name.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+name+'.gz'))});
   });
   await page.request.post(base+'/api/ecu_config',{data:fixture});
   await page.request.post(base+'/__sim/data',{data:{mode:'STANDBY',config_locked:false,dev_mode:false}});
   await page.goto(base+'/controllers.html');await page.locator('#oil-loop-controller-0').waitFor({state:'attached'});
   const cases=await page.evaluate(async()=>{
    const originalCfg=JSON.parse(JSON.stringify(cfg)),originalHw=JSON.parse(JSON.stringify(hwCfg));
    const originalAlert=OTDialog.alert,originalConfirm=OTDialog.confirm;
    let captures=[];OTDialog.alert=async(message,options)=>{captures.push({message,options,error:true});};
    OTDialog.confirm=async(message,options)=>{captures.push({message,options});return false;};
    const cases=[
     ['active conflict',1,()=>{}],
     ['master off',0,()=>hwCfg.controllers.oil_loop=false],
     ['independent windmilling owner may reuse pressure tuning while normal master is off',0,()=>{hwCfg.controllers.oil_loop=false;Object.assign(cfg.standby_oil,{enabled:true,output_id:hwCfg.oil_loops[0].pump_output,source:0,feed_bar:2,feed_pct:30,rpm_limit:1000});}],
     ['master absent',0,()=>delete hwCfg.controllers.oil_loop],
     ['loop off',0,()=>hwCfg.oil_loops[0].enabled=false],
     ['loop activation absent',0,()=>delete hwCfg.oil_loops[0].enabled],
     ['pump purpose changed',0,()=>hwCfg.channel_registry.outputs.find(r=>r.id===hwCfg.oil_loops[0].pump_output).purpose='generic'],
     ['mirrored pump is not an independent controller',0,()=>hwCfg.channel_registry.outputs.find(r=>r.id===hwCfg.oil_loops[0].pump_output).mirror_of='another_pump'],
     ['no controllers',0,()=>hwCfg.oil_loops=[]],
     ['missing pump',0,()=>hwCfg.oil_loops[0].pump_output='removed'],
     ['missing pressure',0,()=>hwCfg.oil_loops[0].pressure_input='removed'],
     ['uninstalled pressure',0,()=>hwCfg.channel_registry.inputs.find(r=>r.purpose==='oil_pressure').installed=false],
     ['protection off, legacy 99 bar retained',0,()=>hwCfg.oil_loops[0].low_pressure_response=0],
     ['sub-centibar edits use actual stored precision',0,()=>{hwCfg.oil_loops[0].target_bar=4.001;hwCfg.oil_loops[0].low_pressure_bar=4.009;}],
     ['float32 boundary preserves the one-centibar difference',1,()=>{hwCfg.oil_loops[0].target_bar=4.099;hwCfg.oil_loops[0].low_pressure_bar=4.1;}],
     ['equal target and threshold',0,()=>hwCfg.oil_loops[0].target_bar=4],
     ['fixed target ignores unused high endpoint',0,()=>{hwCfg.oil_loops[0].target_bar=5;hwCfg.oil_loops[0].target_high_bar=1;}],
     ['mapped target checks lower endpoint',1,()=>{hwCfg.oil_loops[0].target_source=1;hwCfg.oil_loops[0].target_bar=5;hwCfg.oil_loops[0].target_high_bar=3;}],
     ['only the second pump conflicts',1,()=>{const first=hwCfg.oil_loops[0],pump=hwCfg.channel_registry.outputs.find(r=>r.id===first.pump_output);first.target_bar=5;hwCfg.channel_registry.outputs.push({...pump,id:'second_oil_pump',name:'Second oil pump',pin:25});hwCfg.oil_loops.push({...first,id:'oil2',pump_output:'second_oil_pump',target_bar:3});}],
     ['absent startup keeps genuine running warning',1,()=>{hwCfg.startup_seq=[];cfg.oil.startup_pressure=.1;cfg.oil.startup_min_bar=99;}],
     ['absent startup, inactive retained pressure settings',0,()=>{hwCfg.startup_seq=[];hwCfg.controllers.oil_loop=false;hwCfg.safety.low_oil=false;cfg.oil.startup_pressure=.1;cfg.oil.startup_min_bar=99;}],
     ['disabled loops do not resurrect general zero warning',0,()=>{hwCfg.oil_loops[0].enabled=false;cfg.oil.running_min=0;}],
    ];
    try{
     for(const [label,count,mutate] of cases){
      cfg=JSON.parse(JSON.stringify(originalCfg));hwCfg=JSON.parse(JSON.stringify(originalHw));
      hwCfg.controllers.oil_loop=true;Object.assign(hwCfg.oil_loops[0],{enabled:true,target_source:0,target_bar:3.6,target_high_bar:3.6,low_pressure_bar:4,low_pressure_response:2});
      cfg.oil.running_min=99;cfg.oil.map_min=.1;cfg.oil.map_max=.1;
      mutate();renderForm(true);_applyAllVisibility();runValidation();
      const warnings=oilPressureTargetWarnings();if(warnings.length!==count)throw Error(label+': wrong conflict count '+warnings.length);
      if(document.querySelectorAll('[data-warnkey^="warn-oil-loop-"]').length!==count)throw Error(label+': wrong inline warnings');
      captures=[];await validateBeforeSave(cfg);
      const text=captures.map(row=>row.message).join('\n');
      if(captures.some(row=>row.error))throw Error(label+': unrelated save error '+text);
      if(/running pressure target/.test(text)!==!!count)throw Error(label+': save dialog disagrees '+text);
      if(label.includes('disabled loops')&&/General oil pressure protection/.test(text))throw Error(label+': dormant general threshold warning');
      if(count){const links=captures.flatMap(row=>row.options.links||[]);for(const w of warnings)if(!links.some(row=>row.url==='/controllers.html#oil-loop-controller-'+w.index)||!links.some(row=>row.url==='/controllers.html#oil-loop-protection-'+w.index))throw Error(label+': missing exact links');}
     }
    }finally{OTDialog.alert=originalAlert;OTDialog.confirm=originalConfirm;cfg=originalCfg;hwCfg=originalHw;renderForm(true);}
    return cases.length;
   });
   // A real dialog link must preserve the current editor draft and reveal a
   // filtered, collapsed destination without a full page reload.
   await page.evaluate(()=>{
    const field=document.getElementById('cf-tot_limit');field.value=Number(field.value)+5;field.dispatchEvent(new Event('input',{bubbles:true}));_markDirty();
    setConfigSearch('nothing matches this search');
    OTDialog.alert('Review oil protection',{links:[{url:'/controllers.html#oil-loop-protection-0',label:'Open affected pump protection'}]});
   });
   await page.locator('#ot-dialog-links button').click();
   await page.waitForFunction(()=>document.querySelector('#oil-loop-protection-0.deep-link-target'));
   assert.equal(await page.locator('#cfg-search').inputValue(),'');
   assert.ok(await page.evaluate(()=>_cfgDirty),'same-page warning link keeps unsaved draft');
   assert.ok(await page.locator('#oil-loop-protection-0').evaluate(el=>el.open));
   await page.evaluate(()=>{OTDialog.alert('Review startup',{links:[{url:'/sequence.html#oil-arm-min',label:'Open startup oil pressure'}]});});
   await page.locator('#ot-dialog-links button').click();
   await page.locator('#ot-dialog-cancel').waitFor({state:'visible'});
   await page.locator('#ot-dialog-cancel').click();
   assert.ok(page.url().includes('/controllers.html'),'cross-page dialog link retains the unsaved-change guard');
   assert.ok(await page.evaluate(()=>_cfgDirty));
   await page.evaluate(()=>{setConfigSearch('hidden by another search');OTDialog.alert('Review temperature',{links:[{target:'#cf-tot_limit',label:'Open temperature limit'}]});});
   await page.locator('#ot-dialog-links button').click();
   await page.waitForFunction(()=>document.getElementById('cf-tot_limit')?.closest('.cfg-field').classList.contains('deep-link-target'));
   assert.equal(await page.locator('#cf-tot_limit').isVisible(),true);
   assert.ok(await page.evaluate(()=>_cfgDirty));
   await page.evaluate(()=>{hwCfg.controllers.oil_loop=false;renderForm(false);location.hash='oil-pressure-protection';});
   await page.waitForFunction(()=>document.getElementById('protection-low_oil')?.classList.contains('deep-link-target'));
   assert.ok(await page.locator('#protection-low_oil').evaluate(el=>el.open));
   // No OilPrime/StarterSpin means the old oil-arm link explains the absent
   // step rather than silently landing on a tab with no such setting.
   const noStartup=JSON.parse(JSON.stringify(fixture));noStartup.hardware.startup_seq=[];noStartup.hardware.startup_delay_ms=[];noStartup.hardware.startup_enter_actions=[];noStartup.hardware.startup_exit_actions=[];
   await page.request.post(base+'/api/ecu_config',{data:noStartup});
   await page.goto(base+'/sequence.html#oil-arm-min');
   await page.locator('#sequence-link-notice').waitFor({state:'visible'});
   assert.match(await page.locator('#sequence-link-notice').innerText(),/not used by a step/);
   assert.ok(await page.evaluate(()=>{
    hwCfg.channel_registry.outputs=hwCfg.channel_registry.outputs.filter(row=>row.purpose!=='oil_pump');
    if(hwCfg.actuators?.oil_pump)hwCfg.actuators.oil_pump.enabled=false;
    return !_validateSequence([]).some(message=>/oil.priming|OilPrime|oil lubrication/i.test(message));
   }),'no oil-pump hardware means no missing oil-prime advice');
   await page.request.post(base+'/api/ecu_config',{data:fixture});
   await page.goto(base+'/sequence.html?warning-case=restored#step-startup-OilPrime');
   await page.locator('.block-card[data-block="OilPrime"].deep-link-target .block-params.open').waitFor({state:'visible',timeout:5000}).catch(async e=>{console.log(await page.evaluate(()=>({hash:location.hash,seq:hwCfg.startup_seq,cards:[...document.querySelectorAll('.block-card')].slice(0,3).map(el=>({block:el.dataset.block,cls:el.className,params:el.querySelector('.block-params')?.className}))})));throw e;});
   assert.deepEqual(errors,[]);
   console.log(engine.name(),packed?'gzip':'source',cases+' warning eligibility cases, inline/save agreement, exact links, draft retention, absent and present startup destinations passed');
  }finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
