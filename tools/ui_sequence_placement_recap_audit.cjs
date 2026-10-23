const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=17100+Math.floor(Math.random()*70);await import('./ui_mock_server.mjs');const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 for(const engine of [chromium,firefox,webkit])for(const gzip of [false,true]){
  const browser=await engine.launch({headless:true});
  try{
   const p=await browser.newPage({viewport:{width:1280,height:1100}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(sequence\.html|app\.js|theme\.js|style\.css)(?:\?.*)?$/,r=>{const n=new URL(r.request().url()).pathname.slice(1);return r.fulfill({status:200,contentType:n.endsWith('html')?'text/html':n.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+n+'.gz'))});});
   await p.request.post(base+'/__sim/reset');await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',config_locked:false}});
   await p.goto(base+'/sequence.html');await p.waitForFunction(()=>typeof placeControllerBlock==='function'&&hwCfg.channel_registry&&cfg.rules);
   await p.evaluate(()=>{
    cfg.rules=[{controller_id:42,name:'Main <fuel>',target:registryOutputPurpose('main_fuel').id,enabled:true,activate_event:0,deactivate_events:17,kind:1,mode_mask:4}];cfg.controller_schema=1;
    hwCfg.controllers.governor=false;hwCfg.controllers.dynamic_idle=false;
    hwCfg.startup_seq=['TimedDelay','TimedDelay'];hwCfg.startup_delay_ms=[1111,2222];hwCfg.startup_device_target=['keep-A','keep-B'];hwCfg.startup_ignition_target=[1,2];hwCfg.startup_wait_inputs=[{channel:0,timeout_ms:5000,active:true},{channel:1,timeout_ms:6000,active:false}];hwCfg.startup_enter_actions=[[],[]];hwCfg.startup_exit_actions=[[],[]];
    hwCfg.shutdown_seq=[];hwCfg.ab_seq=[];hwCfg.ab_shut_seq=[];syncControllerSequenceBlocks();renderAllTabsWithLiveIdle();switchTab('startup');
   });
   assert.equal(await p.locator('#controller-pending-blocks select').count(),0);
   assert.equal(await p.locator('[data-controller-key]').count(),2);
   const on=p.locator('[data-controller-key="ControllerOn_42"]');await on.scrollIntoViewIfNeeded();
   let box=await on.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2+10,box.y+box.height/2+8);
   let gap=p.locator('#list-startup [data-controller-drop="1"]');await gap.scrollIntoViewIfNeeded();box=await gap.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:8});await p.mouse.up();
   assert.deepEqual(await p.evaluate(()=>hwCfg.startup_seq),['TimedDelay','ControllerOn_42','TimedDelay']);
   assert.deepEqual(await p.evaluate(()=>hwCfg.startup_delay_ms),[1111,0,2222]);assert.deepEqual(await p.evaluate(()=>hwCfg.startup_device_target),['keep-A','','keep-B']);
   await p.evaluate(()=>{hwCfg.startup_delay_ms[1]=4321;hwCfg.startup_enter_actions[1]=[{target:registryOutputPurpose('glow_plug').id,act:0,value:.25}];});
   await p.locator('#list-startup [data-block="ControllerOn_42"]').getByRole('button',{name:'Remove this sequence block',exact:true}).click();
   assert.equal(await on.count(),1);
   const blocked=await p.evaluate(async()=>{
    const oldAlert=OTDialog.alert,oldStatus=refreshEngineStatus,oldFetch=window.fetch;let text='',writes=0;
    OTDialog.alert=async m=>{text=m;};refreshEngineStatus=async()=>{engineMode='STANDBY';};window.fetch=(url,options)=>{if(options?.method&&options.method!=='GET')writes++;return oldFetch(url,options);};
    try{_seqDirty=true;await saveAll();return {text,writes};}finally{OTDialog.alert=oldAlert;refreshEngineStatus=oldStatus;window.fetch=oldFetch;}
   });assert.equal(blocked.writes,0);assert.match(blocked.text,/place required Activate/);
   // Touch drag into an empty shutdown list.
   await p.getByRole('button',{name:'Shutdown',exact:true}).first().click();
   const off=p.locator('[data-controller-key="ControllerOff_42"]');await off.scrollIntoViewIfNeeded();box=await off.boundingBox();
   const touch={pointerId:71,pointerType:'touch',button:0,clientX:box.x+20,clientY:box.y+20};await off.dispatchEvent('pointerdown',touch);await off.dispatchEvent('pointermove',{...touch,clientX:touch.clientX+10,clientY:touch.clientY+10});
   gap=p.locator('#list-shutdown [data-controller-drop="0"]');await gap.scrollIntoViewIfNeeded();box=await gap.boundingBox();const drop={...touch,clientX:box.x+box.width/2,clientY:box.y+box.height/2};await p.locator('body').dispatchEvent('pointermove',drop);await p.locator('body').dispatchEvent('pointerup',drop);
   assert.deepEqual(await p.evaluate(()=>hwCfg.shutdown_seq),['ControllerOff_42']);
   // Cancellation leaves the unplaced block and sequence intact.
   await on.scrollIntoViewIfNeeded();box=await on.boundingBox();const cancel={pointerId:72,pointerType:'touch',button:0,clientX:box.x+20,clientY:box.y+20};await on.dispatchEvent('pointerdown',cancel);await on.dispatchEvent('pointermove',{...cancel,clientX:cancel.clientX+12});await p.locator('body').dispatchEvent('pointercancel',cancel);
   assert.equal(await on.count(),1);assert.deepEqual(await p.evaluate(()=>hwCfg.shutdown_seq),['ControllerOff_42']);assert.equal(await p.locator('[data-controller-drop]').count(),0);
   // Keyboard placement and cross-sequence relocation.
   await on.focus();await on.press('Enter');await p.locator('#list-shutdown [data-controller-drop="0"]').focus();await p.keyboard.press('Enter');
   assert.deepEqual(await p.evaluate(()=>hwCfg.shutdown_seq),['ControllerOn_42','ControllerOff_42']);assert.equal(await p.evaluate(()=>hwCfg.shutdown_delay_ms[0]),4321);assert.equal(await p.evaluate(()=>hwCfg.shutdown_enter_actions[0][0].target),await p.evaluate(()=>registryOutputPurpose('glow_plug').id));assert.equal(await p.locator('#controller-pending-blocks').isVisible(),false);
   await p.locator('#list-shutdown [data-block="ControllerOn_42"]').getByRole('button',{name:'Remove this sequence block',exact:true}).click();await p.getByRole('button',{name:'Startup',exact:true}).first().click();await on.click();await p.locator('#list-startup [data-controller-drop="0"]').click();
   assert.equal(await p.evaluate(()=>hwCfg.startup_seq[0]),'ControllerOn_42');
   assert.equal(await p.locator('#add-startup-sel option[value="ControllerOn_42"]').count(),0);
   const duplicate=await p.evaluate(()=>{const before=hwCfg.shutdown_seq.slice();const alert=OTDialog.alert;let msg='';OTDialog.alert=async m=>{msg=m;};try{addBlock('shutdown','ControllerOn_42');return {before,after:hwCfg.shutdown_seq.slice(),msg};}finally{OTDialog.alert=alert;}});assert.deepEqual(duplicate.before,duplicate.after);assert.match(duplicate.msg,/already placed/);
   const recap=await p.evaluate(()=>{
    const fuel=registryOutputPurpose('main_fuel'),preheat=registryOutputPurpose('glow_plug');if(!preheat)throw Error('Missing preheat fixture');
    cfg.rules=[{controller_id:50,name:'Main <fuel>',target:fuel.id,enabled:true,activate_event:2,deactivate_events:24,mode_mask:4}];
    hwCfg.startup_seq=['SetOutput','TimedDelay','WaitTOT','SetOutput'];hwCfg.startup_enter_actions=[[{target:preheat.id,value:1}],[],[],[{target:preheat.id,value:0}]];hwCfg.startup_exit_actions=[[],[],[],[]];hwCfg.startup_device_target=['','','',''];hwCfg.startup_ignition_target=[0,0,0,0];
    const rows=(tab,seq)=>Array.from(buildFinalStateCard(tab,seq,0).querySelectorAll('.fs-row')).map(r=>({label:r.querySelector('.fs-label').textContent,value:r.querySelector('.fs-val').textContent,href:r.querySelector('a')?.getAttribute('href')}));
    const simple=rows('startup',hwCfg.startup_seq);
    hwCfg.startup_device_target=[preheat.id];hwCfg.startup_enter_actions=[[]];hwCfg.startup_exit_actions=[[]];
    const remapped=rows('startup',['OilPumpOn']);
    hwCfg.custom_blocks={Custom_Recap:{type:'action',steps:[{type:'set_act',target:preheat.id,val:1}]}};
    const custom=rows('startup',['Custom_Recap']);
    cfg.rules=[{controller_id:50,name:'Old startup owner',target:fuel.id,enabled:true,activate_event:0,deactivate_events:4}];hwCfg.startup_seq=['ControllerOn_50'];hwCfg.startup_device_target=[''];
    const released=rows('startup',hwCfg.startup_seq);
    cfg.rules=[{controller_id:51,name:'Legacy running fuel',target:fuel.id,enabled:true,mode_mask:4}];
    const legacy=rows('startup',['TimedDelay']);
    const shutdown=rows('shutdown',['FinalStop']);
    cfg.rules=[{controller_id:52,name:'Standby fuel owner',target:fuel.id,enabled:true,activate_event:4,deactivate_events:2}];
    const standby=rows('shutdown',['FinalStop']);
    return {simple,remapped,custom,released,legacy,shutdown,standby,fuel:fuel.name,preheat:preheat.name};
   });
   assert.equal(recap.simple.length,2);assert.equal(recap.simple.find(r=>r.label===recap.preheat).value,'off');assert.match(recap.simple.find(r=>r.label===recap.fuel).value,/Controlled by.*Main <fuel>/);assert.equal(recap.simple.find(r=>r.label===recap.fuel).href,'/controllers.html');
   assert.equal(recap.remapped.length,2);assert.equal(recap.remapped.find(r=>r.label===recap.preheat).value,'on');assert.equal(recap.custom.find(r=>r.label===recap.preheat).value,'on');assert.match(recap.released.find(r=>r.label===recap.fuel).value,/released/);assert.doesNotMatch(recap.released.find(r=>r.label===recap.fuel).value,/Controlled by/);assert.match(recap.legacy.find(r=>r.label===recap.fuel).value,/Legacy running fuel/);
   assert.match(recap.standby.find(r=>r.label===recap.fuel).value,/Standby fuel owner/);
   assert.ok(recap.shutdown.every(r=>r.label===recap.fuel||/oil|scavenge/i.test(r.label)));assert.deepEqual(errors,[]);
   await p.evaluate(()=>{
    const fuel=registryOutputPurpose('main_fuel'),preheat=registryOutputPurpose('glow_plug');
    cfg.rules=[{controller_id:60,name:'Fuel control',target:fuel.id,enabled:true,activate_event:0,deactivate_events:17,mode_mask:4}];
    hwCfg.startup_seq=['SetOutput','TimedDelay','SetOutput'];hwCfg.startup_device_target=['','',''];hwCfg.startup_delay_ms=[0,15000,0];hwCfg.startup_enter_actions=[[{target:preheat.id,value:1}],[],[{target:preheat.id,value:0}]];hwCfg.startup_exit_actions=[[],[],[]];hwCfg.shutdown_seq=[];syncControllerSequenceBlocks();renderAllTabsWithLiveIdle();switchTab('startup');
   });
   const unreachable=await p.evaluate(()=>{
    hwCfg.has_afterburner=false;cfg.rules=[{controller_id:72,name:'AB-path controller',target:registryOutputPurpose('main_fuel').id,enabled:true,activate_events:1,deactivate_events:24}];
    hwCfg.ab_seq=['ControllerOn_72'];hwCfg.ab_delay_ms=[321];hwCfg.startup_seq=['TimedDelay'];hwCfg.startup_delay_ms=[123];
    syncControllerSequenceBlocks();renderAllTabsWithLiveIdle();
    const pending=pendingControllerBlocks().map(b=>b.key);placeControllerBlock('ControllerOn_72','startup',1);
    return {pending,ab:hwCfg.ab_seq,startup:hwCfg.startup_seq,delay:hwCfg.startup_delay_ms};
   });
   assert.deepEqual(unreachable.pending,['ControllerOn_72']);assert.deepEqual(unreachable.ab,[]);assert.deepEqual(unreachable.startup,['TimedDelay','ControllerOn_72']);assert.deepEqual(unreachable.delay,[123,321]);
   await p.screenshot({path:`artifacts/sequence-placement-${engine.name()}-${gzip?'gzip':'source'}.png`,fullPage:true});
   await p.setViewportSize({width:390,height:844});await p.screenshot({path:`artifacts/sequence-placement-${engine.name()}-${gzip?'gzip':'source'}-mobile.png`,fullPage:true});
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile page overflows horizontally');
   console.log(engine.name(),gzip?'gzip':'source','mouse/touch/keyboard placement, cancellation, relocation, metadata preservation, missing-block save lock, duplicate guard and command-only recap passed');
  }finally{await browser.close();}
 }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
