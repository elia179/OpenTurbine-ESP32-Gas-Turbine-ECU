const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=18600+Math.floor(Math.random()*100);await import('./ui_mock_server.mjs');const base=`http://127.0.0.1:${OT_UI_SIM_PORT}`;
 for(const engine of [chromium,firefox,webkit])for(const compressed of [false,true]){
  const browser=await engine.launch();try{
   const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(compressed)await page.route(/\/(controllers\.html|index\.html|app\.js|style\.css|theme\.js)(?:\?.*)?$/,async r=>{const f=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({status:200,contentType:f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+f+'.gz'))});});
   await page.request.post(base+'/__sim/reset');await page.request.post(base+'/__sim/data',{data:{mode:'STANDBY',dev_mode:false,stop_switch_active:false,extra_cooldown_active:false}});
   await page.goto(base+'/controllers.html');await page.waitForFunction(()=>document.querySelector('#cf-sf_p1en'));
   const matrix=await page.evaluate(()=>{
    const originalHw=JSON.parse(JSON.stringify(hwCfg)),originalCfg=JSON.parse(JSON.stringify(cfg));
    const purposes=[...new Set(originalHw.channel_registry.inputs.map(r=>r.purpose))];
    const cases=[{name:'all',inputs:purposes},{name:'none',inputs:[]},{name:'removed',inputs:[],remove:true},{name:'unassigned channels',inputs:[],invalid:true},...purposes.map(p=>({name:p,inputs:[p]})),
     {name:'TOT and TIT / TOT selected',inputs:['tot','tit'],source:1},{name:'TOT and TIT / TIT selected',inputs:['tot','tit'],source:2},
     {name:'no outputs',inputs:purposes,noOutputs:true},{name:'low oil switch only',inputs:['low_oil_switch']},{name:'zero oil switch only',inputs:['oil_zero_switch']},
     {name:'second oil pump monitored',inputs:['oil_flow'],secondFlow:true}];
    const expectedFields=ALL_CONFIG_SCHEMA.filter(s=>WORKSPACE_GROUPS.find(g=>g.id==='safety').sections.includes(s.title)).flatMap(s=>s.fields.map(f=>f.key));
    const check=(condition,message)=>{if(!condition)throw Error(message);};
    let checks=0;
    for(const item of cases){
     hwCfg=JSON.parse(JSON.stringify(originalHw));cfg=JSON.parse(JSON.stringify(originalCfg));isLocked=false;runtimeMode='STANDBY';_cfgDirty=false;
     for(const p of ['low_oil_switch','oil_zero_switch'])hwCfg.channel_registry.inputs.push({id:p,name:p,purpose:p,role:p,driver:0,pin:35,installed:false});
     hwCfg.channel_registry.inputs.forEach(r=>r.installed=item.inputs.includes(r.purpose));
     if(item.remove)hwCfg.channel_registry.inputs=[];
     if(item.invalid)hwCfg.channel_registry.inputs.forEach(r=>Object.assign(r,{installed:true,pin:-1,spi_clk:-1,spi_cs:-1,spi_miso:-1,i2c_address:0,device_channel:-1}));
     hwCfg.channel_registry.outputs.forEach(r=>{r.installed=!item.noOutputs&&item.name!=='none'&&item.name!=='removed';r.has_flow_monitor=false;});
     if(item.secondFlow)hwCfg.channel_registry.outputs.push({id:'second_oil',name:'Second oil pump',purpose:'oil_pump',driver:5,pin:22,installed:true,has_flow_monitor:true});
     cfg.safety.egt_source=item.source||0;
     for(const field of ALL_CONFIG_SCHEMA.flatMap(s=>s.fields))if(field.key.startsWith('pb_')&&field.key.endsWith('e'))setPath(cfg,field.path,1);
     renderForm(true);refreshFeatureCachesFromHardware();_applyAllVisibility();
     for(const mode of ['configured','explore']){
      setWorkspaceFilter(mode);const group=document.querySelector('[data-group="safety"]');group.open=true;group.querySelectorAll('details').forEach(d=>d.open=true);
      for(const key of expectedFields){check(document.querySelectorAll('#cf-'+key).length===1,item.name+': missing/duplicate '+key);checks++;}
      const fitted=p=>item.inputs.includes(p);
      const expected={n1:fitted('n1_speed'),n2:fitted('n2_speed'),egt:fitted('tot')||fitted('tit'),p1:fitted('p1_pressure'),p2:fitted('p2_pressure'),torque:fitted('torque')};
      for(const [key,available] of Object.entries(expected)){
       const button=group.querySelector(`[data-protection-target="${key}"]`),card=group.querySelector(`[data-protection="${key}"]`);
       check(button.hidden===(mode==='configured'&&!available),item.name+'/'+mode+': shortcut '+key);
       check(card.classList.contains('filter-hidden')===button.hidden,item.name+': shortcut/card mismatch '+key);checks++;
      }
      for(const input of group.querySelectorAll('.cfg-field[data-hardware-unavailable="1"] input[type="checkbox"]')){check(input.checked||input.disabled,item.name+': unfitted activation editable '+input.id);checks++;}
      if(mode==='configured')for(const field of group.querySelectorAll('.cfg-field[data-hardware-unavailable="1"]')){check(field.classList.contains('filter-hidden'),item.name+': unavailable field visible '+field.dataset.key);checks++;}
      for(const part of group.querySelectorAll('.protection-part:not(.filter-hidden),.startup-trip-card:not(.filter-hidden)')){check(!!part.querySelector('.cfg-field:not(.filter-hidden)'),item.name+': empty subsection');checks++;}
      check(document.querySelector('#cf-rh_jt').closest('.cfg-field').dataset.hardwareUnavailable===String(!(fitted('n1_speed')||fitted('n2_speed'))?1:0),item.name+': RPM-health availability');
      if(item.name.includes('oil switch')&&mode==='configured'){
       const key='low_oil',card=group.querySelector(`[data-protection="${key}"]`);
       check(!card.classList.contains('filter-hidden')&&!card.closest('.cfg-section').classList.contains('filter-hidden'),item.name+': switch safety hidden');
       check(!card.querySelector('[data-safety-key] input').disabled,item.name+': switch toggle unavailable');
       check(card.textContent.includes('20 ms debounce'),item.name+': switch guidance missing');
      }
      if(item.secondFlow)check(document.querySelector('#cf-oil_ufs').closest('.cfg-field').dataset.hardwareUnavailable==='0','second pump monitor missed');
     }
    }
    return {cases:cases.length,fields:expectedFields.length,checks};
   });
   const staged=await page.evaluate(()=>{
    hwCfg.channel_registry.inputs.push({id:'review_tot',name:'Review TOT',purpose:'tot',role:'temperature',driver:1,pin:34,installed:true});
    cfg.sequence.startup.startup_egt_guard_enabled=true;cfg.sequence.startup.startup_egt_immediate_enabled=false;cfg.sequence.startup.startup_egt_dwell_enabled=false;
    renderForm(true);refreshFeatureCachesFromHardware();_applyAllVisibility();setWorkspaceFilter('configured');
    const missing=document.querySelector('[data-startup-guard-state]').textContent,before=document.querySelector('[data-protection-active-count]').textContent;
    document.getElementById('cf-sf_st_en').checked=true;document.getElementById('cf-sf_st').value='900';refreshStartupGuardUi();
    const ready=document.querySelector('[data-startup-guard-state]').textContent,after=document.querySelector('[data-protection-active-count]').textContent;
    setConfigSearch('nothing-matches-this-search');const emptyShortcuts=Array.from(document.querySelectorAll('[data-protection-target]')).every(b=>b.hidden);
    setConfigSearch('');setWorkspaceFilter('changed');const changedShortcuts=Array.from(document.querySelectorAll('[data-protection-target]')).filter(b=>!b.hidden).every(b=>!document.querySelector(`[data-protection="${b.dataset.protectionTarget}"]`).classList.contains('filter-hidden'));
    setWorkspaceFilter('explore');return {missing,before,ready,after,emptyShortcuts,changedShortcuts};
   });
   assert.match(staged.missing,/needs setup/);assert.match(staged.ready,/ON/);assert.equal(parseInt(staged.after),parseInt(staged.before)+1);assert.ok(staged.emptyShortcuts&&staged.changedShortcuts);
   await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{setWorkspaceFilter('explore');document.querySelector('[data-group="safety"]').open=true;});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
   await page.goto(base+'/index.html');await page.waitForFunction(()=>typeof renderAdditionalSensorViews==='function');
   const bars=await page.evaluate(()=>{
    _sensorRanges={};const d={has_p1:true,has_p2:true,has_torque:true,p1:0,p2:0,torque:0,p1_healthy:true,p2_healthy:true,torque_healthy:true,p1_trip_bar:10,p2_trip_bar:10,torque_trip_nm:100,trip_enabled:0};
    const rows=[];for(const fraction of [0,.5,.85,.975,1,1.1]){d.p1=d.p2=fraction*10;d.torque=fraction*100;renderAdditionalSensorViews(d,false);
     for(const key of ['p1','p2','torque']){const card=document.getElementById(key+'-card'),track=card.querySelector('.sensor-view-track'),marker=track.querySelector('.sensor-limit-marker');rows.push({fraction,key,color:track.querySelector('.gauge-bar').style.background,expected:shutdownGaugeColor(fraction),marker:marker.style.left,visible:!marker.hidden,advisory:track.title.includes('Advisory')});}}
    _unitPrefs.press='psi';renderAdditionalSensorViews(d,false);const psi={position:document.querySelector('#p1-card .sensor-limit-marker').style.left,text:document.querySelector('#p1-card .sensor-view-scale').textContent};
    _sensorRanges.p1={min:0,max:20};renderAdditionalSensorViews(d,false);const manual=document.querySelector('#p1-card .sensor-limit-marker').style.left;
    d.p1_healthy=false;renderAdditionalSensorViews(d,false);const unhealthy=document.querySelector('#p1-card .sensor-view-track .gauge-bar').style.width;
    _sensorRanges={};d.p1_trip_bar=0;renderAdditionalSensorViews(d,false);const auto={hidden:document.querySelector('#p1-card .sensor-limit-marker').hidden,text:document.querySelector('#p1-card .sensor-view-scale').textContent};
    return {rows,psi,manual,unhealthy,auto};
   });
   for(const row of bars.rows){assert.equal(row.color,row.expected,JSON.stringify(row));assert.equal(row.marker,'90%');assert.ok(row.visible&&row.advisory);}
   assert.equal(bars.psi.position,'90%');assert.match(bars.psi.text,/PSI/);assert.equal(bars.manual,'50%');assert.equal(bars.unhealthy,'0%');assert.ok(bars.auto.hidden);assert.match(bars.auto.text,/auto/);assert.deepEqual(errors,[]);
   console.log(engine.name(),compressed?'compressed':'source',JSON.stringify(matrix),'pressure/torque colours, marker positions, advisory state, manual/auto range, unhealthy readings and mobile passed');
  }finally{await browser.close();}
 }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
