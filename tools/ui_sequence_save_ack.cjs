const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15126;await import('./ui_mock_server.mjs');const base='http://127.0.0.1:15126',browser=await chromium.launch();
 try{for(const packed of [false,true]){
  const p=await browser.newPage();p.on('console',m=>{if(m.text().startsWith('ACK TEST'))console.log(m.text());});await p.addInitScript(()=>{localStorage.setItem('ot_beta_notice_ack_v1','1');localStorage.setItem('ot_theme_onboarded_v1','1');});
  if(packed)await p.route(/\/(?:sequence\.html|app\.js|ui_dialog\.js)(?:\?.*)?$/,r=>{const file=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({contentType:file.endsWith('html')?'text/html':'application/javascript',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});});
  let releaseLoad,heldLoad=false;await p.route('**/api/config',async r=>{if(r.request().method()==='GET'&&!heldLoad){heldLoad=true;await new Promise(resolve=>releaseLoad=resolve);}return r.continue();});
  await p.goto(base+'/sequence.html');assert(await p.locator('main').evaluate(el=>el.inert),'Sequence must remain locked until baseline is loaded');
  for(let n=0;!releaseLoad&&n<100;n++)await new Promise(resolve=>setTimeout(resolve,5));assert(releaseLoad,'initial settings request absent');releaseLoad();
  await p.waitForFunction(()=>typeof saveAll==='function'&&loadedHwCfg.channel_registry&&!_seqLoading&&!document.querySelector('main').inert);
  const applyReads=await p.evaluate(async()=>{
   const original=window.fetch,ecu='0123456789ab',different='abcdef012345';
   const patch={sequence:{shutdown:{final_stop_timeout_ms:1234}}};
   const outcomes=[];
   try{
    for(const [statusEcu,configEcu] of [[ecu,ecu],[different,ecu],[ecu,different]]){
     const reads=[];
     window.fetch=async url=>{
      reads.push(url);
      return new Response(JSON.stringify(url==='/api/status'?{config_apply_busy:false}:patch),{
       headers:{'X-OpenTurbine-ECU':url==='/api/status'?statusEcu:configEcu}
      });
     };
     const error=await confirmSequenceSettingsApplied(patch,ecu).then(()=>null,error=>error.message);
     outcomes.push({reads,error});
    }
    return outcomes;
   }finally{window.fetch=original;}
  });
  assert.deepEqual(applyReads[0],{reads:['/api/status','/api/config'],error:null});
  assert.deepEqual(applyReads[1].reads,['/api/status']);
  assert.deepEqual(applyReads[2].reads,['/api/status','/api/config']);
  assert.ok(applyReads.slice(1).every(result=>result.error.includes('Reconnect to the original ECU')));
  const rows=await p.evaluate(async()=>{
   stopSequenceTelemetry();await OTWaitForPageTelemetryIdle(10000);
   refreshEngineStatus=async()=>{engineMode='STANDBY';};validateCustomBlockLimits=()=>[];validateSequenceHardwareForSave=()=>[];_validateSequence=()=>[];
   const actualFetch=window.fetch,actualTimer=window.setTimeout;let resumed=0,reboots=0;
   startSequenceTelemetryForPlatform=()=>{resumed++;};startRebootCountdown=()=>{reboots++;};
   const result=[];
   try{
    for(const body of ['{}','null','not JSON','{"ok":false,"error":"rejected"}','{"ok":true,"reboot":true}','{"ok":true}']){
     loadedHwCfg=structuredClone(hwCfg);loadedCfg=structuredClone(cfg);
     const settingsOnly=body==='{"ok":true}';
     if(settingsOnly){
      cfg.sequence.shutdown.final_stop_timeout_ms=(cfg.sequence.shutdown.final_stop_timeout_ms||10000)+100;
     }else{
      hwCfg.startup_seq=['TimedDelay'];hwCfg.startup_delay_ms=[1234];loadedHwCfg.startup_delay_ms=[1000];
     }
     markSequenceDirty();
     let writes=0,release;
     window.fetch=async(url,options)=>{
      if(options?.method==='PATCH'){
       const target = new URL(url,location.href);
       if(target.searchParams.get('ecu_id')!=='0123456789ab')throw Error('Sequence save omitted its ECU');
       if(settingsOnly && target.pathname!=='/api/config')throw Error('Setting-only save used the wrong endpoint');
       writes++;await new Promise(resolve=>{release=resolve;});
       return new Response(body,{status:200,headers:{'Content-Type':'application/json'}});
      }
      return actualFetch(url,options);
     };
     console.log('ACK TEST '+body);const pending=saveAll();
     for(let wait=0;!release&&wait<1000;wait++)await new Promise(resolve=>actualTimer(resolve,5));
     if(!release)throw Error('Save never reached PATCH: '+document.getElementById('save-status').textContent);
     if(!document.querySelector('main').inert||!document.getElementById('save-btn').disabled||!document.getElementById('seq-discard-btn').disabled)throw Error('pending save did not lock editing');
     await saveAll();if(writes!==1)throw Error('duplicate sequence write');
     release();await pending;
     const success=settingsOnly||body==='{"ok":true,"reboot":true}';
     if(_seqDirty===success||document.querySelector('main').inert||_seqSavePending)throw Error('draft/lock not restored correctly');
     result.push({body,success,status:document.getElementById('save-status').textContent});
    }
    // A transport timeout must release the editor without replaying the write.
    loadedHwCfg=structuredClone(hwCfg);hwCfg.startup_delay_ms=[2345];markSequenceDirty();let writes=0;
    window.setTimeout=(fn,ms,...args)=>actualTimer(fn,ms===15000?20:ms,...args);
    window.fetch=async(url,options)=>{if(options?.method==='PATCH'){writes++;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError'))));}return actualFetch(url,options);};
    await saveAll();if(writes!==1||!_seqDirty||_seqSavePending||document.querySelector('main').inert)throw Error('timeout retried or lost draft');
    if(resumed!==6||reboots!==1)throw Error('failure telemetry/success reboot handling wrong');
    OTSetup.scope(new Response('{}',{headers:{'X-OpenTurbine-ECU':'abcdef012345'}}));
    await saveAll();
    if(writes!==1||!_seqDirty||!document.getElementById('save-status').textContent.includes('Reload this page'))throw Error('Sequence wrote or lost the draft after switching ECUs');
    return result;
   }finally{window.fetch=actualFetch;window.setTimeout=actualTimer;}
  });assert(rows.slice(0,3).every(r=>r.status.includes('unconfirmed')));assert(rows[3].status.includes('rejected'));assert.equal(rows[4].success,true);assert.equal(rows[5].success,true);
  console.log('PASS '+(packed?'compressed':'source')+' sequence acknowledgements, timeout, duplicate suppression, edit lock and draft preservation');await p.close();
 }}finally{await browser.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
