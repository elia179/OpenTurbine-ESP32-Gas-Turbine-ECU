const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=16600+Math.floor(Math.random()*60);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 for(const engine of [chromium,firefox,webkit]){
  const browser=await engine.launch({headless:true});
  try{for(const gzip of [false,true]){
   const p=await browser.newPage({viewport:{width:800,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(calibration\.html|controllers\.html|hardware\.html|app\.js|theme\.js|style\.css)(?:\?.*)?$/,async r=>{
    const file=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
   });
   await p.request.post(base+'/__sim/reset');await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',oil_raw:400,oil_healthy:true,stop_switch_active:false}});
   await p.goto(base+'/calibration.html');await p.waitForFunction(()=>cfg.hardware&&live.mode==='STANDBY');
   assert.equal(await p.locator('#oil-pump-assisted').isVisible(),true);
   assert.equal(await p.locator('#oil-pump-assisted').isChecked(),false);
   assert.equal(await p.locator('#cal-oil-pct').isVisible(),false);
   const oilPanel=p.locator('#oil-press-cal-row .calibration-pump-controls');
   assert.ok(await oilPanel.evaluate(el=>el.parentElement.lastElementChild===el && getComputedStyle(el).borderTopWidth==='0px'));
   assert.equal(await oilPanel.getByRole('checkbox',{name:'Use pump for calibration'}).isChecked(),false);
   assert.equal(await oilPanel.locator('select').isVisible(),false);
   const pumpRequests=[];
   const capturePump=request=>{
    if(request.method()!=='POST'||!request.url().endsWith('/api/command'))return;
    const body=request.postDataJSON();
    if(body.cmd==='PRESSURE_CAL_PUMP')pumpRequests.push(body);
   };
   p.on('request',capturePump);
   for(const id of ['oil-press','fuelpress']){
    const panel=p.locator('#'+id+'-cal-row .calibration-pump-controls');
    const mode=panel.getByRole('checkbox',{name:'Use pump for calibration'});
    await mode.check();
    assert.ok(await panel.locator('select').isVisible());
    await panel.locator('select').selectOption('oil_pump');
    await panel.getByRole('button',{name:'Run pump'}).click();
    await p.locator('#ot-dialog-confirm').click();
    await panel.getByRole('status').filter({hasText:'Pump demand confirmed'}).waitFor();
    if (id==='oil-press') await mode.uncheck();
    else await panel.getByRole('button',{name:'Stop pump'}).click();
    await p.waitForFunction(()=>!pressurePumpSession);
    if (id==='oil-press') await panel.locator('select').waitFor({state:'hidden'});
   }
   p.off('request',capturePump);
   assert.deepEqual(pumpRequests.map(({pump_id,fParam})=>[pump_id,fParam]),
    [['oil_pump',.1],['oil_pump',0],['oil_pump',.1],['oil_pump',0]]);
   const fuelPanel=p.locator('#fuelpress-cal-row .calibration-pump-controls');
   await fuelPanel.getByRole('button',{name:'Run pump'}).click();
   await p.locator('#ot-dialog-confirm').click();
   await fuelPanel.getByRole('status').filter({hasText:'Pump demand confirmed'}).waitFor();
   const ignoreStop=route=>{
    const command=route.request().postDataJSON();
    return command.cmd==='PRESSURE_CAL_PUMP'&&command.fParam===0
      ? route.fulfill({json:{ok:true}}) : route.continue();
   };
   await p.route('**/api/command',ignoreStop);
   const fuelMode=fuelPanel.getByRole('checkbox',{name:'Use pump for calibration'});
   await fuelMode.uncheck();
   await fuelPanel.getByRole('status').filter({hasText:'Pump stop unconfirmed'}).waitFor();
   assert.equal(await fuelMode.isChecked(),true);
   assert.equal(await p.evaluate(()=>pressurePumpAllowsAmbient()),false);
   await p.locator('#ot-dialog-confirm').click();
   await p.unroute('**/api/command',ignoreStop);
   await fuelPanel.getByRole('button',{name:'Stop pump'}).click();
   await fuelPanel.getByRole('status').filter({hasText:'Pump demand is zero'}).waitFor();
   assert.equal(await p.evaluate(()=>pressurePumpAllowsAmbient()),true);
   await fuelPanel.getByRole('button',{name:'Run pump'}).click();
   await p.locator('#ot-dialog-confirm').click();
   await fuelPanel.getByRole('status').filter({hasText:'Pump demand confirmed'}).waitFor();
   await p.request.post(base+'/__sim/data',{data:{mock_ecu_id:'abcdef012345'}});
   await fuelPanel.getByRole('status').filter({hasText:'The connected ECU changed'}).waitFor();
   assert.equal(await p.evaluate(()=>window.OTConnectedEcuId()),'abcdef012345');
   const staleRefresh=await p.request.post(base+'/api/command',{data:{
    cmd:'PRESSURE_CAL_PUMP',pump_id:'oil_pump',ecu_id:'0123456789ab',boot_count:4,fParam:.1
   }});
   assert.equal(staleRefresh.status(),409);
   await p.request.post(base+'/__sim/data',{data:{mock_ecu_id:'0123456789ab'}});
   await p.reload();
   await p.waitForFunction(()=>cfg.hardware&&live.mode==='STANDBY');
   const telemetry=/\/api\/(?:telemetry|data)$/;
   const paused=route=>route.fulfill({status:503,json:{error:'intentional telemetry stall'}});
   await p.route(telemetry,paused);
   const result=await p.evaluate(async()=>{
    stopGlobalTelemetry();
    setConnectionState(true);
    document.body.classList.remove('telemetry-stale');
    const commands=[],original=postCalCommand;postCalCommand=async body=>{commands.push(body);return {ok:true};};
    const originalRaw=liveAdcRaw;
    const originalFrame=nextCalibrationFrame;
    let stalledAmbient=true;
    nextCalibrationFrame=async()=>{if(stalledAmbient)throw Error('No fresh calibration samples received.');return live;};
    let raw=NaN;
    liveAdcRaw=key=>key==='oil_raw'?raw:originalRaw(key);
    const finishedStarting=()=>new Promise((resolve,reject)=>{
      const deadline=Date.now()+12000;
      const timer=setInterval(()=>{
        if(!oilCalStarting){clearInterval(timer);resolve();}
        else if(Date.now()>=deadline){clearInterval(timer);reject(Error('Oil calibration start did not finish'));}
      },20);
    });
    async function startOil() {
      oilCalStart();
      await finishedStarting();
      if (!oilCalActive) throw Error(document.getElementById('oil-zero-status').textContent);
    }
    try{
     oilCalStart();
     await finishedStarting();
     const failedStartCanRetry=!oilCalActive && document.getElementById('oil-zero-status').textContent.includes('No fresh') &&
        !document.getElementById('oil-pump-assisted').disabled &&
        !document.getElementById('btn-oil-start').disabled;
     stalledAmbient=false;
     const {cv, ...snapshot} = live;
     window.applyData({...snapshot,boot_count:4});
     raw=400;
     await startOil();raw=3000;
     const checkFresh = hasFreshCalibrationTelemetry;
     hasFreshCalibrationTelemetry = () => true;
     try {
      document.getElementById('oil-pval').value='5';
      captureOilPoint();
     } finally { hasFreshCalibrationTelemetry = checkFresh; }
     oilGoStep3();
     const sensorCommands=commands.slice(),fit={...oilFit};let saved;
     const save=saveCalibrationPatch;saveCalibrationPatch=(hw,done,settings,msg,onOk,boot)=>saved={hw,settings,boot};saveOilCal();saveCalibrationPatch=save;
     window.applyData({...snapshot,boot_count:5});
     const restartClearedFit = oilPts.length===0 && oilCaptureBoot===null &&
        document.getElementById('oil-step-1').style.display!=='none';
     document.getElementById('oil-pump-assisted').checked=true;await startOil();
     window.applyData({...live,snapshot_id:undefined});
     document.getElementById('oil-pump-pct2').value='12.5';
     oilSetPump();await _oilDutyQueue;
     const refreshing=!!_oilDutyKeepAlive;
     await new Promise(resolve=>setTimeout(resolve,2150));
     await _oilDutyQueue;
     const lostTelemetry={positive:commands.filter(command=>command.fParam>0).length,
       returnedToStart:document.getElementById('oil-step-1').style.display!=='none',
       message:document.getElementById('oil-zero-status').textContent,
       stopped:_oilDutyKeepAlive===null};
     await oilMinSweepStop();await _oilDutyQueue;
     return {failedStartCanRetry,sensorCommands,fit,saved,restartClearedFit,refreshing,lostTelemetry,pumpCommands:commands.slice()};
    }finally{postCalCommand=original;liveAdcRaw=originalRaw;nextCalibrationFrame=originalFrame;}
   });
   await p.unroute(telemetry,paused);
   assert.ok(result.failedStartCanRetry);
   assert.ok(result.restartClearedFit && Number.isInteger(result.saved?.boot),JSON.stringify(result));
   assert.deepEqual(result.sensorCommands,[]);assert.ok(result.fit.c>0);assert.ok(result.saved.settings.calibration.oil_poly);assert.equal(result.saved.settings.oil,undefined);
   assert.ok(result.refreshing);
   assert.equal(result.lostTelemetry.positive,1,JSON.stringify(result.lostTelemetry));
   assert.ok(result.lostTelemetry.stopped && result.lostTelemetry.returnedToStart);
   assert.match(result.lostTelemetry.message,/fresh telemetry.*restart/i);
   assert.ok(result.pumpCommands.every(c=>c.cmd==='SET_OIL_CAL_PCT'));
   assert.ok(result.pumpCommands.some(c=>c.fParam===12.5));
   assert.equal(result.pumpCommands.at(-1).fParam,0);
   const rawCapture=await p.evaluate(()=>{
    const pressure=registryInputById('oil_pressure');
    const savedDriver=pressure.driver, savedInputs=live.registry_inputs;
    const connection=document.getElementById('conn');
    const wasConnected=connection.classList.contains('connected');
    const stale=document.body.classList.contains('telemetry-stale');
    try {
      connection.classList.add('connected');
      document.body.classList.remove('telemetry-stale');
      pressure.driver=9;
      live.registry_inputs=[{id:pressure.id,raw:1234,healthy:false,raw_fresh:false}];
      const rejectsCached=Number.isNaN(liveAdcRaw('oil_raw'));
      live.registry_inputs[0].raw_fresh=true;
      const recent=liveAdcRaw('oil_raw');
      document.body.classList.add('telemetry-stale');
      return {rejectsCached,recent,rejectsDisconnected:Number.isNaN(liveAdcRaw('oil_raw'))};
    } finally {
      pressure.driver=savedDriver;
      live.registry_inputs=savedInputs;
      connection.classList.toggle('connected',wasConnected);
      document.body.classList.toggle('telemetry-stale',stale);
    }
   });
   assert.deepEqual(rawCapture,{rejectsCached:true,recent:1234,rejectsDisconnected:true});
   const noPump=async route=>{
    const response=await route.fetch(),hardware=await response.json();
    hardware.actuators.oil_pump.enabled=false;
    hardware.channel_registry.outputs=hardware.channel_registry.outputs.filter(output=>
      !['oil_pump','coolant_pump','scavenge_pump','fuel_pump','ab_pump'].includes(output.purpose));
    await route.fulfill({response,json:hardware});
   };
   await p.route('**/api/hardware',noPump);
   const pumpCommands=[];
   const recordPumpCommand=request=>{
    if(request.method()==='POST'&&request.url().endsWith('/api/command'))pumpCommands.push(request.postDataJSON());
   };
   p.on('request',recordPumpCommand);
   await p.reload();
   await p.waitForFunction(()=>cfg.hardware?.actuators?.oil_pump?.enabled===false&&calibrationConnected());
   assert.equal(await p.locator('#oil-pump-assisted').isVisible(),false);
   assert.equal(await p.getByText('Use pump for calibration',{exact:true}).count(),0);
   assert.equal(await p.locator('#oil-cal-mode-note').isVisible(),false);
   assert.equal(await p.locator('#cal-oil-pct').isVisible(),false);
   await p.locator('#oil-pump-assisted').evaluate(box=>{box.checked=true;});
   await p.locator('#btn-oil-start').click();
   await p.waitForFunction(()=>oilCalActive);
   assert.equal(await p.locator('#oil-pump-cal-controls').isVisible(),false);
   assert.deepEqual(pumpCommands,[]);
   p.off('request',recordPumpCommand);
   await p.unroute('**/api/hardware',noPump);
   const methods=await p.evaluate(()=>{
    const ntc=registryInputById('oil_temperature');
    const points=[{raw:300,value:90},{raw:2000,value:30}];
    ntc.calibration_points=points;
    document.getElementById('ntc-beta').value='3950';
    document.getElementById('ntc-r0').value='10000';
    document.getElementById('ntc-rfixed').value='10000';
    const writes=[];
    const original=patchHardware;
    patchHardware=(patch,done)=>{writes.push(patch.channel_registry_calibration.ntc_use_point_table);done();};
    try {
      saveNtcCal();
      const datasheet=document.getElementById('ntc-active-method').textContent;
      const canRestore=!document.getElementById('btn-ntc-use-curve').hidden;
      useSavedNtcCurve();
      return {writes,datasheet,canRestore,pointsKept:ntc.calibration_points===points,
        curve:document.getElementById('ntc-active-method').textContent};
    } finally {patchHardware=original;}
   });
   assert.deepEqual(methods.writes,[false,true]);
   assert.ok(methods.pointsKept&&methods.canRestore);
   assert.match(methods.datasheet,/datasheet values/);
   assert.match(methods.curve,/known-point curve/);
   await p.goto(base+'/controllers.html');await p.waitForFunction(()=>cfg.rules&&typeof renderForm==='function');
   const cards=await p.evaluate(()=>{
    const options=simpleControlOutputs();const assertAvailable=options.some(o=>o.id==='request_fault');
    createControllerForOutput('request_fault');const index=cfg.rules.findIndex(r=>r.target==='request_fault');
    const owner=document.querySelector(`[data-controller-rule="${index}"]`);owner.open=true;
    updateSimpleControl(index,'name','Renamed fault action');
    if(!document.querySelector(`[data-controller-rule="${index}"]`).open)throw Error('Editing collapsed controller');
    const activation=document.querySelector(`[data-controller-rule="${index}"] [aria-label^="Activate:"]`);
    const nested=!!activation?.closest('details:not([data-controller-card])');
    const safety=document.querySelector('[data-protection="egt"]');if(!safety)throw Error('Missing safety fixture');safety.open=true;
    renderForm(true);
    return {available:assertAvailable,nested,visible:!!activation,safety:document.querySelector('[data-protection="egt"]').open};
   });
   assert.ok(cards.available&&cards.visible&&cards.safety);assert.equal(cards.nested,false);
   await p.goto(base+'/hardware.html');await p.waitForFunction(()=>typeof renderBuiltinInputSummary==='function'&&cfg.channel_registry);
   const duplicate=await p.evaluate(()=>{
    cfg.channel_registry.inputs.push({id:'test_oil_switch',name:'Test oil switch',purpose:'oil_zero_switch',driver:1,pin:35,installed:true});
    cfg.di_channels=[{pin:35,role:'oil_zero_switch',label:'Test oil switch'}];renderBuiltinInputSummary();
    return document.getElementById('builtin-inputs').textContent;
   });
   assert.doesNotMatch(duplicate,/Test oil switch/);
   await p.route('**/api/log',r=>r.fulfill({status:200,contentType:'application/json',body:'{damaged'}));
   await p.goto(base+'/log.html');
   await p.waitForFunction(()=>document.getElementById('runs-container')?.textContent.includes('Event log response could not be read'));
   assert.deepEqual(errors,[]);await p.close();
   console.log(engine.name(),gzip?'gzip':'source','sensor-only/no pump writes, two-point fit, optional pump control, fault action, direct timing, safety expansion and mirrored-switch suppression passed');
  }}finally{await browser.close();}
 }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
