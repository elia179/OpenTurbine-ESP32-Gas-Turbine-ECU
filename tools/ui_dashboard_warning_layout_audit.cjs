const assert=require('node:assert/strict');
const fs=require('node:fs');
const {gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
const healthy={mode:'STANDBY',dev_mode:false,bench_mode:false,config_storage_fault:false,config_load_warning:null,config_version_mismatch:false,profile_match:true,fault_description:'',fault_latched:false,limited_start_allowed:false,limp_override_sensor:'',surge_detected:false,startup_seq_count:4,session_dropped_rows:0,event_dropped_events:0,session_logger_healthy:true,event_recorder_healthy:true,runtime_stats_healthy:true};
const banners=['dev-banner','empty-seq-banner','bench-banner','logging-health-banner','config-storage-banner','config-version-banner','config-load-warn-banner','profile-mismatch-banner','fault-card','limited-run-banner','surge-warn-banner'];
(async()=>{
 globalThis.OT_UI_SIM_PORT=14620+Math.floor(Math.random()*50);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 fs.mkdirSync('artifacts/v255-dashboard',{recursive:true});
 for(const [engine,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch({headless:true});
  try{for(const packaged of [false,true]){
   const context=await browser.newContext({viewport:{width:768,height:1024},hasTouch:true});
   await context.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1','ot_gs_dismissed'])localStorage.setItem(k,'1');});
   const page=await context.newPage();const errors=[],writes=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+r.url());});
   if(packaged)await page.route(/\/(index\.html|app\.js|style\.css|theme\.js)(?:\?.*)?$/,async route=>{
    const name=new URL(route.request().url()).pathname.split('/').pop();
    await route.fulfill({status:200,contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html',body:gunzipSync(fs.readFileSync('data/'+name+'.gz'))});
   });
   await page.request.post(base+'/__sim/reset');await page.request.post(base+'/__sim/data',{data:healthy});
   await page.goto(base+'/index.html');
   await page.waitForSelector('#n1-card .dashboard-drag-handle',{state:'attached'});
   const slot=page.locator('#dashboard-warnings-card');
   const feed=async patch=>{
    await page.request.post(base+'/__sim/data',{data:{...healthy,...patch}});
    const data=await(await page.request.get(base+'/api/data')).json();
    await page.evaluate(d=>applyData(d),data);
   };
   await feed({});assert.equal(await slot.isVisible(),false,'Empty warnings slot must not consume normal dashboard space');
   await page.locator('#dashboard-card-edit-btn').click();
   assert.ok(await slot.isVisible());assert.equal(await slot.locator('.dashboard-warnings-placeholder').innerText(),'Warnings appear here');
   assert.equal(await slot.locator('.dashboard-hide-card,[data-dashboard-setting]').count(),0,'Warnings must not be hidden or minimized');
   assert.ok((await slot.boundingBox()).height<=60,'Healthy edit placeholder must stay thin');
   await page.locator('#dashboard-arrange-btn').click();
   // Exercise real pointer reordering (touch on Chromium, mouse elsewhere).
   const handle=slot.locator('.dashboard-drag-handle');
   await handle.scrollIntoViewIfNeeded();
   const grip=await handle.boundingBox(),target=await page.locator('#n1-card').boundingBox();
   const from={x:grip.x+grip.width/2,y:grip.y+grip.height/2};
   const to={x:target.x+target.width/2,y:target.y+target.height*.8};
   if(engine==='chromium'){
    const touch=await context.newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[to]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
   }else{
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    await page.mouse.move(to.x,to.y);await page.mouse.up();
   }
   assert.ok(await page.evaluate(()=>{const a=JSON.parse(localStorage.getItem('ot_dashboard_card_order_v1'));return a.indexOf('dashboard-warnings-card')>a.indexOf('n1-card');}),'Pointer drag must move warnings below N1');
   await handle.focus();await page.keyboard.press('ArrowUp');
   // Use the real keyboard reorder handler to place warnings below N1.
   await handle.focus();
   for(let i=0;i<8;i++){
    const done=await page.evaluate(()=>{const a=[...document.querySelector('#dashboard-custom-cards').children].map(c=>c.id);return a.indexOf('dashboard-warnings-card')>a.indexOf('n1-card');});
    if(done)break;await page.keyboard.press('ArrowDown');
   }
   const order=await page.evaluate(()=>JSON.parse(localStorage.getItem('ot_dashboard_card_order_v1')));
   assert.ok(order.indexOf('dashboard-warnings-card')>order.indexOf('n1-card'));
   assert.equal(order.filter(id=>id==='dashboard-warnings-card').length,1);
   await page.locator('#dashboard-card-edit-btn').click();assert.equal(await slot.isVisible(),false);
   await page.reload();await page.waitForSelector('#n1-card .dashboard-drag-handle',{state:'attached'});
   await feed({});assert.equal(await slot.isVisible(),false);
   assert.deepEqual(await page.evaluate(()=>[...document.querySelector('#dashboard-custom-cards').children].map(c=>c.id)),order);
   for(const [id,patch] of [
    ['dev-banner',{dev_mode:true}],['empty-seq-banner',{startup_seq_count:0}],['bench-banner',{bench_mode:true}],
    ['logging-health-banner',{session_logger_healthy:false}],['config-storage-banner',{config_storage_fault:true}],
    ['config-version-banner',{config_version_mismatch:true}],['config-load-warn-banner',{config_load_warning:'Review pressure limit'}],
    ['profile-mismatch-banner',{profile_match:false}],['fault-card',{mode:'FAULT',fault_description:'Bench fault test',fault_latched:true,fault_clear_allowed:false}],
    ['limited-run-banner',{limp_override_sensor:'Pressure sensor',limp_throttle_cap:30}],['surge-warn-banner',{surge_detected:true}]
   ]){
    await feed(patch);await slot.waitFor({state:'visible',timeout:5000});
    await slot.locator('#'+id).waitFor({state:'visible',timeout:5000});
    assert.equal(await page.locator('#'+id).count(),1,'Never clone a warning');
    assert.equal(await slot.locator('.dashboard-warnings-placeholder').isVisible(),false);
    const bounds=await slot.boundingBox();assert.ok(bounds.width>600,'Warnings span the full custom grid');
    await feed({});await slot.waitFor({state:'hidden',timeout:5000});
   }
   await feed({config_storage_fault:true,config_version_mismatch:true,surge_detected:true,mode:'FAULT',fault_description:'Bench fault test'});
   for(const width of [1366,768,390,320]){
    await page.setViewportSize({width,height:1024});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${engine}/${width} warning overflow`);
    assert.ok(await slot.locator('#fault-card').isVisible());
   }
   await page.setViewportSize({width:768,height:1024});
   await slot.screenshot({path:`artifacts/v255-dashboard/${engine}-${packaged?'packaged':'source'}-warnings.png`});
   // Navigation remains functional after the banners have been moved.
   await feed({config_load_warning:'Review pressure limit'});
   await slot.locator('#config-load-warn-banner a').click();await page.waitForURL('**/controllers.html*');
   await page.goto(base+'/index.html');await page.waitForSelector('#n1-card .dashboard-drag-handle',{state:'attached'});await feed({});
   // Old layouts retain warnings above their saved cards. Stale hidden/minimal
   // preferences must not conceal alarms, even when restored from storage.
   await page.evaluate(()=>{
    localStorage.setItem('ot_dashboard_card_order_v1',JSON.stringify(['p2-card','n1-card','dashboard-controls-card']));
    localStorage.setItem('ot_dashboard_hidden_cards_v1',JSON.stringify(['dashboard-warnings-card','p2-card']));
    localStorage.setItem('ot_dashboard_card_views_v1',JSON.stringify({'dashboard-warnings-card':{detail:'minimal',size:'small'}}));
   });
   await page.reload();await page.waitForSelector('#n1-card .dashboard-drag-handle',{state:'attached'});await feed({config_storage_fault:true});
   assert.ok(await slot.isVisible());assert.ok(await slot.locator('#config-storage-banner').isVisible());
   assert.equal(await slot.getAttribute('data-dashboard-detail'),'normal');assert.equal(await slot.getAttribute('data-dashboard-size'),'wide');
   assert.equal(await page.evaluate(()=>document.querySelector('#dashboard-custom-cards').firstElementChild.id),'dashboard-warnings-card');
   await feed({});await page.locator('#dashboard-card-edit-btn').click();
   assert.ok((await slot.boundingBox()).height<=60);
   await slot.screenshot({path:`artifacts/v255-dashboard/${engine}-${packaged?'packaged':'source'}-edit.png`});
   await page.locator('#dashboard-reset-btn').click();
   assert.ok(await page.evaluate(()=>!!(document.querySelector('#dashboard-warnings-card').compareDocumentPosition(document.querySelector('#n1-card'))&Node.DOCUMENT_POSITION_FOLLOWING)));
   await page.locator('#dashboard-card-edit-btn').click();assert.equal(await slot.isVisible(),false);
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[],'Dashboard layout must not modify the ECU');
   assert.equal(await slot.locator('#captive-banner').count(),0,'Browser connection guidance remains in its global location');
   console.log(`${engine} ${packaged?'packaged':'source'}: thin edit slot, pointer/keyboard saved order, 11 warning lifecycles, links, old preferences, reset and 4 viewport widths passed; no ECU writes.`);
   await context.close();
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
