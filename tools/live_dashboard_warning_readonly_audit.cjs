// Read-only real-ECU dashboard qualification. Warning frames are injected only
// into this isolated browser context; no ECU status/configuration is changed.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.argv[2]||'http://192.168.4.1',target=process.argv[3]||'esp32dev';
const out=process.argv[4]||'artifacts/v255-qualification';
async function get(route){for(let i=0;i<4;i++)try{const r=await fetch(base+route,{signal:AbortSignal.timeout(15000),headers:{Connection:'close'}});assert.ok(r.ok,route);return await r.json();}catch(e){if(i===3)throw e;await new Promise(r=>setTimeout(r,500));}}
(async()=>{
 const before=await get('/api/device_info');assert.equal(before.target,target);assert.equal(before.firmware_version,'2.5.5');
 assert.equal(before.outputs_active,false);assert.equal(before.state,'STANDBY');
 const boot=(await get('/api/data')).boot_count;
 const browser=await chromium.launch({headless:true});const errors=[],writes=[];
 let movedBelow;
 try{
  const p=await browser.newPage({viewport:{width:800,height:1000},hasTouch:true});
  await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1','ot_gs_dismissed'])localStorage.setItem(k,'1');});
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+r.url());});
  await p.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await p.waitForSelector('#dashboard-warnings-card .dashboard-drag-handle',{state:'attached',timeout:45000});
  await p.waitForFunction(()=>typeof _lastData!=='undefined'&&_lastData&&Object.keys(_lastData).length>10,null,{timeout:45000});
  await p.evaluate(()=>stopGlobalTelemetry());await p.waitForTimeout(750);
  await p.evaluate(()=>{
   window._benchWarningData={..._lastData,mode:'STANDBY',startup_seq_count:4,dev_mode:false,bench_mode:false,config_storage_fault:false,config_version_mismatch:false,config_load_warning:null,profile_match:true,fault_description:'',fault_latched:false,limited_start_allowed:false,limp_override_sensor:'',surge_detected:false,session_logger_healthy:true,event_recorder_healthy:true,runtime_stats_healthy:true,session_dropped_rows:0,event_dropped_events:0};
   const actualApply=applyData;window._benchWarningPatch={};
   // Focus/resize can restart live pulls. Keep the injected browser-only frame
   // stable until navigation, rather than racing a real healthy telemetry frame.
   applyData=()=>actualApply({...window._benchWarningData,...window._benchWarningPatch});
   window._benchInject=patch=>{window._benchWarningPatch=patch;applyData();};
   window._benchInject({});
  });
  const slot=p.locator('#dashboard-warnings-card');assert.equal(await slot.isVisible(),false);
  await p.locator('#dashboard-card-edit-btn').click();assert.ok(await slot.isVisible());assert.ok((await slot.boundingBox()).height<=60);
  assert.equal(await slot.locator('.dashboard-hide-card,[data-dashboard-setting]').count(),0);
  await p.locator('#dashboard-arrange-btn').click();
  for(const id of ['n1-card','tot-card','throttle-output-card','dashboard-controls-card'])if(await p.locator('#'+id).isVisible()){movedBelow=id;break;}
  assert.ok(movedBelow);
  await slot.locator('.dashboard-drag-handle').focus();
  for(let i=0;i<50;i++){
   const done=await p.evaluate(id=>{const a=[...document.querySelector('#dashboard-custom-cards').children].map(c=>c.id);return a.indexOf('dashboard-warnings-card')>a.indexOf(id);},movedBelow);
   if(done)break;await p.keyboard.press('ArrowDown');
  }
  assert.ok(await p.evaluate(id=>{const a=JSON.parse(localStorage.getItem('ot_dashboard_card_order_v1'));return a.indexOf('dashboard-warnings-card')>a.indexOf(id);},movedBelow));
  await p.locator('#dashboard-card-edit-btn').click();assert.equal(await slot.isVisible(),false);
  for(const [id,patch] of [
   ['config-storage-banner',{config_storage_fault:true}],['config-version-banner',{config_version_mismatch:true}],
   ['profile-mismatch-banner',{profile_match:false}],['surge-warn-banner',{surge_detected:true}],
   ['fault-card',{mode:'FAULT',fault_description:'Browser-only warning test',fault_clear_allowed:false,fault_latched:true}],
   ['bench-banner',{bench_mode:true}],['logging-health-banner',{session_logger_healthy:false}]
  ]){
   await p.evaluate(patch=>window._benchInject(patch),patch);
   assert.ok(await slot.locator('#'+id).isVisible(),id);assert.equal(await p.locator('#'+id).count(),1);
   await p.evaluate(()=>window._benchInject({}));assert.equal(await slot.isVisible(),false);
  }
  await p.evaluate(()=>window._benchInject({config_storage_fault:true,config_version_mismatch:true}));
  for(const width of [800,400,320]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  fs.mkdirSync(out,{recursive:true});await slot.screenshot({path:`${out}/${target}-live-warnings.png`});
  await slot.locator('#config-storage-banner a').click();await p.waitForURL('**/system.html*#system-backup-restore',{timeout:45000});
  await p.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await p.waitForSelector('#dashboard-warnings-card .dashboard-drag-handle',{state:'attached',timeout:45000});
  assert.ok(await p.evaluate(id=>{const a=[...document.querySelector('#dashboard-custom-cards').children].map(c=>c.id);return a.indexOf('dashboard-warnings-card')>a.indexOf(id);},movedBelow),'Saved warning position did not survive navigation');
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 }finally{await browser.close();}
 const after=await get('/api/device_info');assert.equal(after.outputs_active,false);assert.equal(after.state,'STANDBY');
 assert.equal((await get('/api/data')).boot_count,boot,'Read-only dashboard check restarted ECU');
 fs.writeFileSync(`${out}/${target}-dashboard-result.json`,JSON.stringify({passed:true,device:after,movedBelow,warningFrames:'browser-only',errors,writes,noRestart:true},null,2));
 console.log(`${target}: live dashboard thin warning slot, saved order, active/cleared warnings, links and 800/400/320px layouts passed; no ECU writes, commands or restart.`);
})().catch(e=>{console.error(e);process.exit(1)});
