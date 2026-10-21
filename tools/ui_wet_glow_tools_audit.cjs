const assert=require('node:assert/strict'),fs=require('node:fs');
const {gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=14700+Math.floor(Math.random()*70);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 fs.mkdirSync('artifacts/v256-tools',{recursive:true});
 for(const [engine,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch({headless:true});
  try{for(const packaged of [false,true]){
   const p=await browser.newPage({viewport:{width:800,height:1100},hasTouch:true});const errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(packaged)await p.route(/\/(tools\.html|app\.js|style\.css|theme\.js)(?:\?.*)?$/,async r=>{
    const name=new URL(r.request().url()).pathname.split('/').pop();
    await r.fulfill({status:200,contentType:name.endsWith('.html')?'text/html':name.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+name+'.gz'))});
   });
   await p.request.post(base+'/__sim/reset');
   await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',extra_cooldown_active:false,stop_switch_active:false}});
   await p.request.patch(base+'/api/hardware',{data:{actuators:{glow_plug:{enabled:true,type:2,pin:17,fuel_pin:16,fuel_type:1,fuel_demand_pct:25,fuel_delay_ms:8000}},channel_registry:{version:2,inputs:[],outputs:[{id:'glow_plug',name:'Workshop ignition',purpose:'glow_plug',role:'ignition',driver:5,pin:17,ignition_on_demand:.6}],bindings:[]}}});
   await p.goto(base+'/tools.html');
   await p.waitForFunction(()=>document.querySelector('#btn-WET_GLOW_FUEL_TEST')?.disabled===false).catch(async e=>{
    console.error(errors,await p.evaluate(()=>({hw:typeof hwCfg==='undefined'?null:hwCfg.actuators?.glow_plug,mode:typeof engineMode==='undefined'?null:engineMode,tools:document.querySelector('#tool-area')?.innerText?.slice(0,500)})));throw e;
   });
   const group=p.locator('#card-GLOW_TEST > .tool-component-tests');
   assert.equal(await group.getAttribute('open'),null);
   await group.locator('summary').click();
   assert.match(await p.locator('#card-GLOW_ONLY_TEST').innerText(),/60%.*Pilot-fuel output stays OFF.*Workshop ignition/s);
   assert.match(await p.locator('#card-WET_GLOW_FUEL_TEST').innerText(),/25% immediately.*Heating element stays OFF/s);
   for(const width of [800,400,320]){
    await p.setViewportSize({width,height:1100});
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${engine}/${width} overflow`);
   }
   await group.screenshot({path:`artifacts/v256-tools/${engine}-${packaged?'packaged':'source'}.png`});
   await p.locator('#btn-test-settings').click();
   const duration=p.locator('.test-setting[data-key="glow_test_ms"]');
   assert.equal(await duration.count(),1,'One shared duration setting, without duplicate keys');
   assert.match(await duration.locator('xpath=ancestor::div[contains(@class,"test-setting-row")]').innerText(),/combined and individual.*Shared cutoff/s);
   await duration.fill('1.5');await p.locator('#test-settings-modal button',{hasText:'Save settings'}).click();
   await p.locator('#test-settings-modal').waitFor({state:'hidden'});
   assert.equal((await(await p.request.get(base+'/api/config')).json()).tools.glow_test_ms,1500);
   await p.reload();await p.waitForFunction(()=>document.querySelector('#btn-WET_GLOW_FUEL_TEST')?.disabled===false);
   await group.locator('summary').click();
   for(const id of ['GLOW_TEST','GLOW_ONLY_TEST','WET_GLOW_FUEL_TEST'])assert.equal(await p.locator('#time-'+id).innerText(),'1.5 s');
   for(const [id,selection] of [['GLOW_ONLY_TEST',1],['WET_GLOW_FUEL_TEST',2],['GLOW_TEST',0]]){
    const before=(await(await p.request.get(base+'/__sim/state')).json()).commands.length;
    await p.locator('#btn-'+id).click();
    await p.locator('#ot-dialog-confirm').waitFor({state:'visible'});
    assert.equal((await(await p.request.get(base+'/__sim/state')).json()).commands.length,before,'No command before confirmation');
    await p.locator('#ot-dialog-confirm').click();
    await p.waitForFunction(()=>activeId!==null);
    const commands=(await(await p.request.get(base+'/__sim/state')).json()).commands;
    assert.equal(commands.length,before+1);assert.equal(commands.at(-1).cmd,'GLOW_TEST');assert.equal(commands.at(-1).iParam??0,selection);
    for(const other of ['GLOW_TEST','GLOW_ONLY_TEST','WET_GLOW_FUEL_TEST'])assert.ok(await p.locator('#btn-'+other).isDisabled());
    // Finish the UI's simulated countdown; physical timeout is covered by firmware tests.
    await p.evaluate(()=>{activeStart-=20000;});await p.waitForFunction(()=>activeId===null);
   }
   await p.evaluate(()=>{stopToolsTelemetry();});
   for(const frame of [{mode:'RUNNING'},{mode:'STANDBY',stop_switch_active:true},{mode:'STANDBY',stop_switch_active:false,extra_cooldown_active:true}]){
    await p.evaluate(d=>applyData(d),frame);
    for(const id of ['GLOW_TEST','GLOW_ONLY_TEST','WET_GLOW_FUEL_TEST'])assert.ok(await p.locator('#btn-'+id).isDisabled());
   }
   await p.evaluate(()=>{hwCfg.actuators.glow_plug.type=0;syncDynamicToolText();renderTools();});
   assert.equal(await p.locator('.tool-component-tests').count(),0);
   await p.evaluate(()=>{hwCfg.actuators.glow_plug.type=2;hwCfg.actuators.glow_plug.fuel_pin=-1;renderTools();});
   assert.equal(await p.locator('#card-WET_GLOW_FUEL_TEST').count(),0);
   await p.evaluate(()=>{hwCfg.actuators.glow_plug.enabled=false;renderTools();});
   assert.equal(await p.locator('#card-GLOW_TEST,#card-GLOW_ONLY_TEST,#card-WET_GLOW_FUEL_TEST').count(),0);
   assert.deepEqual(errors,[]);await p.close();
   console.log(`${engine} ${packaged?'gzip':'source'}: component group, names, isolated payloads, confirmations, exclusive progress, STOP/mode/cooldown locks and mobile layout passed`);
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
