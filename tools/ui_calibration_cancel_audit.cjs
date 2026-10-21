const assert=require('node:assert/strict'),fs=require('node:fs');
const {gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15000+Math.floor(Math.random()*70);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 for(const [name,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch({headless:true});
  try{for(const gzip of [false,true]){
   const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(calibration\.html|app\.js|style\.css|theme\.js)(?:\?.*)?$/,async r=>{
    const file=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
   });
   await p.request.post(base+'/__sim/reset');await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY'}});
   await p.goto(base+'/calibration.html');await p.waitForFunction(()=>cfg.hardware&&live.mode==='STANDBY');
   const result=await p.evaluate(async()=>{
    stopGlobalTelemetry();
    const originalCommand=postCalCommand,originalTimer=window.setTimeout,originalSave=window.OTSaveConfigPatch;
    let waits=[],commands=[],failStop=false,holdPositive=false,releasePositive;
    const flush=()=>new Promise(r=>originalTimer(r,0));
    window.setTimeout=(fn,ms,...args)=>{if([1000,1500,3000].includes(ms)){waits.push({fn,ms,args});return -1;}return originalTimer(fn,ms,...args);};
    postCalCommand=async p=>{
     commands.push({...p});
     if(failStop&&p.cmd==='SET_THROTTLE_PCT'&&!p.fParam)throw Error('Rejected test stop');
     if(holdPositive&&p.cmd==='SET_THROTTLE_PCT'&&p.fParam>0)return new Promise(r=>releasePositive=r);
     return {ok:true};
    };
    const slider=document.getElementById('fp-min-slider'),status=document.getElementById('fp-min-status');
    const positive=()=>commands.filter(p=>p.cmd==='SET_THROTTLE_PCT'&&p.fParam>0).length;
    try{
     slider.value='10';fpMinSlide();const refreshWasRunning=!!_fpMinKeepAlive;
     const cancelled=fpMinTest();await flush();const refreshPaused=_fpMinKeepAlive===null;
     const waiting=waits.shift();const count=positive();await fpMinStop(true);waiting.fn();await cancelled;
     const stoppedStaysStopped=count===positive()&&!_fpMinTestRunning;
     // All three successful cycles retain a real off interval and finish off.
     commands=[];waits=[];const normal=fpMinTest();await flush();const phases=[];
     for(let n=0;n<3;n++){
      let w=waits.shift();phases.push(w.ms);w.fn();await flush();
      w=waits.shift();phases.push(w.ms);w.fn();await flush();
     }
     await normal;const normalCount=positive(),normalStatus=status.textContent;
     // Observing STOP or an engine-mode transition cancels browser workers;
     // returning to STANDBY must not resume them or issue a calibration zero
     // into an engine which has taken ownership of its outputs.
     const externalCancellation=[];
     for(const frame of [{mode:'STANDBY',stop_switch_active:true},{mode:'RUNNING',stop_switch_active:false}]){
      applyData({mode:'STANDBY',stop_switch_active:false});commands=[];waits=[];
      const interrupted=fpMinTest();await flush();const wait=waits.shift(),before=commands.length;
      applyData(frame);applyData({mode:'STANDBY',stop_switch_active:false});wait.fn();await interrupted;
      externalCancellation.push(commands.length===before&&!_fpMinTestRunning&&_fpMinKeepAlive===null);
     }
     // A late acknowledgement from a cancelled positive command cannot resume it.
     commands=[];waits=[];holdPositive=true;const late=fpMinTest();await flush();
     await fpMinStop(true);releasePositive({ok:true});await late;holdPositive=false;
     const lateSafe=positive()===1&&waits.length===0&&!_fpMinTestRunning;
     failStop=true;const failedStop=await fpMinStop(true),failureText=status.textContent;
     const retryStopAvailable=!document.getElementById('btn-fp-stop').disabled;failStop=false;
     // Cancelling the oil-zero settling delay must not capture data or advance.
     waits=[];const before=JSON.stringify(oilPts);oilCalStart();await flush();const oilWait=waits.shift();
     oilCalStop();oilWait.fn();await flush();
     const oilCancelled=oilWait.ms===3000&&!oilCalActive&&JSON.stringify(oilPts)===before&&document.getElementById('oil-step-2').style.display==='none';
     // Stop the manual refresh before saving, then preserve the Saved message.
     commands=[];slider.value='12';fpMinSlide();
     window.OTSaveConfigPatch=async patch=>{commands.push({cmd:'SAVE',patch});return {response:{ok:true},data:{ok:true}};};
     await fpMinSave();const saveIndex=commands.findIndex(p=>p.cmd==='SAVE');
     const savedAfterStop=saveIndex>0&&commands[saveIndex-1].cmd==='SET_THROTTLE_PCT'&&commands[saveIndex-1].fParam===0&&_fpMinKeepAlive===null;
     return {refreshWasRunning,refreshPaused,stoppedStaysStopped,normalCount,normalStatus,phases,externalCancellation,lateSafe,failedStop,failureText,retryStopAvailable,oilCancelled,savedAfterStop,savedText:status.textContent};
    }finally{fpMinCancelTimers();window.setTimeout=originalTimer;postCalCommand=originalCommand;window.OTSaveConfigPatch=originalSave;}
   });
   for(const key of ['refreshWasRunning','refreshPaused','stoppedStaysStopped','lateSafe','retryStopAvailable','oilCancelled','savedAfterStop'])assert.equal(result[key],true,key);
   assert.equal(result.normalCount,3);assert.deepEqual(result.phases,[1500,1000,1500,1000,1500,1000]);
   assert.deepEqual(result.externalCancellation,[true,true]);
   assert.match(result.normalStatus,/Three restart cycles complete/);assert.equal(result.failedStop,false);assert.match(result.failureText,/Stop not confirmed/);assert.match(result.savedText,/Saved 12.0%/);
   // Real command helper rejects an HTTP-200 body lacking an acknowledgement.
   await p.route('**/api/command',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
   assert.match(await p.evaluate(()=>postCalCommand({cmd:'SET_THROTTLE_PCT',fParam:0}).then(()=>'',e=>e.message)),/acknowledgement/);
   assert.deepEqual(errors,[]);await p.close();
   console.log(`${name} ${gzip?'gzip':'source'}: pump-test cancellation/late ack, exclusive three-cycle timing, stop rejection, oil-delay cancellation and stop-before-save passed`);
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
