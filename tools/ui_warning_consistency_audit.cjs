const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright'),{guidedFixture}=require('./guided_build_fixture.cjs');
(async()=>{
 globalThis.OT_UI_SIM_PORT=14977;await import('./ui_mock_server.mjs');const base='http://127.0.0.1:'+OT_UI_SIM_PORT;
 const initial=await(await fetch(base+'/__sim/state')).json(),fixture=guidedFixture(initial,1);
 fixture.hardware.controllers.dynamic_idle=false;fixture.settings.dynamic_idle.fuel_mode=1;
 for(const engine of [chromium,firefox,webkit])for(const packed of [false,true]){
  const browser=await engine.launch();try{
   const p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const key of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1','ot_gs_dismissed'])localStorage.setItem(key,'1');});
   if(packed)await p.route(/\/(index\.html|controllers\.html|hardware\.html|sequence\.html|app\.js|theme\.js|ui_dialog\.js|style\.css)(?:\?.*)?$/,r=>{
    const name=new URL(r.request().url()).pathname.slice(1);return r.fulfill({status:200,contentType:name.endsWith('html')?'text/html':name.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+name+'.gz'))});
   });
   await p.request.post(base+'/api/ecu_config',{data:fixture});await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',config_locked:false,dev_mode:false,fault_latched:false,fault_description:''}});
   await p.goto(base+'/controllers.html');await p.locator('#protection-egt').waitFor({state:'attached'});
   const count=await p.evaluate(async()=>{
    const savedCfg=JSON.parse(JSON.stringify(cfg)),savedHw=JSON.parse(JSON.stringify(hwCfg)),alert=OTDialog.alert,confirm=OTDialog.confirm;
    let dialogs=[];OTDialog.alert=async(message,options)=>{dialogs.push({message,options,error:true});};OTDialog.confirm=async(message,options)=>{dialogs.push({message,options});return false;};
    const cases=[
     ['interlock off',false,()=>hwCfg.safety.hot_start=false],
     ['normal shutdown off',false,()=>hwCfg.safety.overtemp=false],
     ['enabled normal trip',true,()=>{}],
     ['pre-start below trip',false,()=>cfg.sequence.startup.pre_start_egt_limit_c=50],
     ['separate immediate trip overrides dormant normal limit',false,()=>Object.assign(cfg.sequence.startup,{startup_egt_guard_enabled:true,startup_egt_immediate_enabled:true,startup_egt_limit_c:300})],
     ['separate immediate conflict',true,()=>Object.assign(cfg.sequence.startup,{startup_egt_guard_enabled:true,startup_egt_immediate_enabled:true,startup_egt_limit_c:100})],
     ['timed startup conflict',true,()=>Object.assign(cfg.sequence.startup,{startup_egt_guard_enabled:true,startup_egt_immediate_enabled:false,startup_egt_dwell_enabled:true,startup_egt_dwell_c:100,startup_egt_dwell_ms:1000})],
     ['timed startup above pre-start maximum',false,()=>Object.assign(cfg.sequence.startup,{startup_egt_guard_enabled:true,startup_egt_immediate_enabled:false,startup_egt_dwell_enabled:true,startup_egt_dwell_c:300,startup_egt_dwell_ms:1000})],
     ['zero retained limit with protection off',false,()=>{hwCfg.safety.overtemp=false;cfg.engine.tot_limit=0;cfg.engine.tot_safe_margin=0;}],
     ['no temperature hardware',false,()=>{hwCfg.channel_registry.inputs=hwCfg.channel_registry.inputs.filter(r=>!['tot','tit'].includes(r.purpose));hwCfg.safety.overtemp=false;}],
    ];
    try{
     for(const unit of ['C','F'])for(const [name,expected,mutate] of cases){
      cfg=JSON.parse(JSON.stringify(savedCfg));hwCfg=JSON.parse(JSON.stringify(savedHw));setTempUnit('C');
      hwCfg.safety.hot_start=true;hwCfg.safety.overtemp=true;cfg.safety.egt_source=1;cfg.engine.tot_limit=100;cfg.engine.tot_safe_margin=20;
      Object.assign(cfg.sequence.startup,{pre_start_egt_limit_c:200,startup_egt_guard_enabled:false,startup_egt_immediate_enabled:false,startup_egt_dwell_enabled:false,startup_egt_limit_c:0,startup_egt_dwell_c:0});
      mutate();renderForm(false);_applyAllVisibility();if(unit==='F')setConfigTempUnit('F');
      document.querySelector('[data-group="safety"]').open=false;document.getElementById('protection-egt').open=false;runValidation();
      if(!!preStartTemperatureWarning(cfg)!==expected)throw Error(name+' '+unit+': wrong canonical warning');
      if(!!document.querySelector('[data-warnkey="warn-prestart-egt-limit"]')!==expected)throw Error(name+' '+unit+': wrong inline warning');
      if(document.querySelector('[data-group="safety"]').open||document.getElementById('protection-egt').open)throw Error(name+': warning reopened a closed card');
      if(expected&&!document.querySelector('#protection-egt > summary [data-inline-warning-count]'))throw Error(name+': closed temperature card lacks badge');
      dialogs=[];await validateBeforeSave(cfg);
      if(dialogs.some(d=>d.error)&&name!=='no temperature hardware')throw Error(name+': unrelated validation error '+dialogs.map(d=>d.message).join('\n'));
      const saveWarning=dialogs.some(d=>/Pre-Start EGT Maximum is at\/above/.test(d.message));
      if(saveWarning!==expected)throw Error(name+' '+unit+': save and inline disagree');
     }
    }finally{OTDialog.alert=alert;OTDialog.confirm=confirm;cfg=savedCfg;hwCfg=savedHw;setTempUnit('C');renderForm(false);}
    return cases.length*2;
   });
   await p.goto(base+'/index.html');await p.waitForFunction(()=>typeof faultSettingsDestination==='function');
   const routes=await p.evaluate(()=>[
    ['OVERSPEED','#cf-rpm_limit'],['N2_OVERSPEED','#cf-n2_rpm_limit'],['P1_HIGH','#cf-sf_p1t'],['P2_HIGH','#cf-sf_p2t'],['TORQUE_HIGH','#cf-sf_tqt'],
    ['OVERTEMP','#cf-tot_limit'],['TIT_OVERTEMP','#cf-sf_tit'],['OIL_TEMP_HIGH','#cf-sf_ot'],['FUEL_PRESS_LOW','#cf-sf_fp'],['BATT_LOW','#cf-sf_bv'],
    ['UNDERSPEED','#cf-min_rpm'],['FLAMEOUT','#cf-sf_fo'],['RELIGHT_FAILED','#cf-rl_en'],['HOT_START','#cf-sf_hs'],['SURGE','#cf-sf_sg'],
    ['STARTUP_OVERTEMP','#cf-sf_st'],['STARTUP_TEMP_DWELL','#cf-sf_sd'],['OIL_FLOW_LOW','#cf-oil_ufd'],
    ['LOW_OIL','#protection-low_oil'],['OIL_ZERO','#protection-low_oil'],['PCB_OUTPUT_STAGE_FAULT','#hardware-buses-editor'],['OUTPUT_OVERCURRENT','#hardware-outputs-panel'],['STARTUP_TEMP_SENSOR','#hardware-inputs-panel']
   ].map(([code,expected])=>({code,expected,url:faultSettingsDestination({fault_description:code,egt_source:1}).url})));
   for(const route of routes)assert.equal(new URL(route.url,base).hash,route.expected,route.code);
   assert.equal(await p.evaluate(()=>faultSettingsDestination({fault_description:'OVERTEMP',egt_source:0,has_tot:false,has_tit:true}).url),'/controllers.html#cf-sf_tit');
   // Exercise real Dashboard links for fields, a nested sequence card and PCB diagnostics.
   for(const [code,hash,visible] of [['OVERSPEED','#cf-rpm_limit','#cf-rpm_limit'],['STARTUP_OVERTEMP','#cf-sf_st','#cf-sf_st'],['BATT_LOW','#cf-sf_bv','#cf-sf_bv'],['STARTUP_ABORT: OilPrime','#step-startup-OilPrime','.block-card[data-block="OilPrime"] .block-params.open'],['PCB_OUTPUT_STAGE_FAULT','#hardware-buses-editor','#hardware-buses-editor']]){
    await p.request.post(base+'/__sim/data',{data:{mode:'FAULT',fault_description:code,fault_latched:true,limited_start_allowed:false}});
    await p.goto(base+'/index.html');await p.waitForFunction(code=>typeof _lastData!=='undefined'&&_lastData?.fault_description===code,code);
    await p.locator('#fault-limits-link').click();await p.waitForURL(url=>url.hash===hash);
    await p.locator(visible).waitFor({state:'visible'});
   }

   if(engine===chromium&&!packed){
    await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',fault_description:'',fault_latched:false}});
    await p.goto(base+'/controllers.html');await p.locator('#protection-egt').waitFor({state:'attached'});
    await p.evaluate(()=>{hwCfg.safety.hot_start=true;hwCfg.safety.overtemp=true;cfg.sequence.startup.pre_start_egt_limit_c=1000;cfg.sequence.startup.startup_egt_guard_enabled=false;renderForm(false);runValidation();document.querySelector('[data-group="safety"]').open=true;document.getElementById('protection-egt').open=false;});
    for(const width of [390,800,1280]){
     await p.setViewportSize({width,height:900});
     const badge=p.locator('#protection-egt > summary [data-inline-warning-count]');
     await badge.scrollIntoViewIfNeeded();assert.equal(await badge.isVisible(),true);
     assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'warning badge causes no horizontal overflow');
     assert.equal(await p.locator('#protection-egt').evaluate(el=>el.open),false);
     fs.mkdirSync('artifacts/272-ui',{recursive:true});await p.locator('#protection-egt > summary').screenshot({path:'artifacts/272-ui/warning-badge-'+width+'.png'});
    }
   }
   assert.deepEqual(errors,[]);
   console.log(engine.name(),packed?'gzip':'source',count+' temperature/unit cases; cards remain closed with badges; 23 fault routes and real Dashboard field/step/bus clicks passed');
  }finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
