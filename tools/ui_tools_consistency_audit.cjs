const assert=require('node:assert/strict'),fs=require('node:fs');
const {gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=14800+Math.floor(Math.random()*70);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 const config=fs.readFileSync('src/system/Config.cpp','utf8');
 const limits=Object.fromEntries([...config.matchAll(/validInt\(tools\["([^"]+)"\], (\d+), (\d+)\)/g)].map(m=>[m[1],[Number(m[2])/1000,Number(m[3])/1000]]));
 for(const [name,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch({headless:true});
  try{for(const gzip of [false,true]){
   const p=await browser.newPage({viewport:{width:400,height:1000}}),errors=[],writes=[];
   p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+r.url());});
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(tools\.html|app\.js|style\.css|theme\.js)(?:\?.*)?$/,async r=>{
    const file=new URL(r.request().url()).pathname.split('/').pop();
    await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
   });
   await p.request.post(base+'/__sim/reset');await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',stop_switch_active:false,extra_cooldown_active:false}});
   await p.request.patch(base+'/api/hardware',{data:{actuators:{glow_plug:{enabled:true,type:2,pin:17,fuel_pin:16}},channel_registry:{version:2,inputs:[],outputs:[
    {id:'custom_glow',name:'Workshop heater',purpose:'glow_plug',role:'ignition',driver:5,pin:17},
    {id:'linked_heat',name:'Second heater <A>',purpose:'general_pwm',role:'generic',driver:5,pin:18,mirror_of:'custom_glow'},
    {id:'unused',name:'Removed output',purpose:'general_relay',role:'generic',driver:4,pin:19,installed:false},
    {id:'aux_free',name:'Drain valve',purpose:'general_relay',role:'generic',driver:4,pin:20},
    {id:'pump_a',name:'Auxiliary oil',purpose:'oil_pump',role:'oil_pump',driver:5,pin:21},
    {id:'pump_b',name:'Main lubrication',purpose:'oil_pump',role:'oil_pump',driver:5,pin:22},
    {id:'fuel_shutoff',name:'Fuel cutoff',purpose:'fuel_shutoff',role:'generic',driver:4,pin:23}
   ],bindings:[{key:'primary_oil_pump',channel:'pump_b'}]}}});
   await p.goto(base+'/tools.html');await p.waitForSelector('#linked-outputs-card');
   assert.deepEqual(await p.locator('[id^="card-REGISTRY_OUTPUT_TEST_"]').evaluateAll(a=>a.map(x=>x.id)),['card-REGISTRY_OUTPUT_TEST_3','card-REGISTRY_OUTPUT_TEST_4']);
   assert.match(await p.locator('#linked-outputs-card').innerText(),/Second heater <A> → Workshop heater/);
   assert.equal(await p.locator('#linked-outputs-card button').count(),0);assert.equal(await p.locator('#linked-outputs-card a').count(),0);
   // Exercise canonical migration preference, explicit ownership override and
   // multiple unbound devices rather than assuming every purpose is core-owned.
   assert.deepEqual(await p.evaluate(()=>{
    const c={id:'custom_fan',purpose:'cooling_fan',installed:true};
    const canonical={id:'cooling_fan',purpose:'cooling_fan',installed:true};
    return [registryCoreOutputOwner(c,[c]),registryCoreOutputOwner(c,[c,canonical]),registryCoreOutputOwner(c,[c,{...c,id:'fan_two'}])];
   }),[true,false,false]);
   // Every offered duration must agree with the actual firmware validator.
   await p.waitForFunction(()=>engineMode==='STANDBY');await p.locator('#btn-test-settings').click();
   const seconds=await p.locator('.test-setting[data-kind="seconds"]').evaluateAll(a=>a.map(x=>({key:x.dataset.key,min:Number(x.min),max:Number(x.max)})));
   for(const x of seconds)assert.deepEqual([x.min,x.max],limits[x.key],x.key);
   const glow=p.locator('[data-key="glow_test_ms"]'),save=p.locator('#test-settings-modal button',{hasText:'Save settings'});
   const before=writes.length;
   for(const value of ['','0','0.05','60.01']){
    await glow.fill(value);await save.click();assert.match(await p.locator('#test-settings-status').innerText(),/enter 0.1–60 seconds/);
    assert.equal(writes.length,before,'Invalid duration must not reach the ECU');
   }
   await glow.fill('0.1');const percent=p.locator('[data-key="start_test_pct"]');
   await percent.fill('101');await save.click();assert.match(await p.locator('#test-settings-status').innerText(),/enter 0–100%/);assert.equal(writes.length,before);
   await percent.fill('0');await p.locator('[data-key="fuel_sol_test_ms"]').fill('0.05');await save.click();
   await p.locator('#test-settings-modal').waitFor({state:'hidden'});
   const saved=await(await p.request.get(base+'/api/config')).json();assert.equal(saved.tools.glow_test_ms,100);assert.equal(saved.tools.fuel_sol_test_ms,50);assert.equal(saved.tools.start_test_pct,0);
   // Repeated settings refresh must not duplicate friendly output-name suffixes.
   assert.equal(await p.evaluate(()=>{syncDynamicToolText();syncDynamicToolText();return TOOLS.find(t=>t.id==='FUEL_PRIME').desc.split('Fitted output:').length-1;}),1);
   // A previous completion callback must not reset a restarted running card.
   await p.evaluate(()=>stopToolsTelemetry());await p.clock.install();
   await p.evaluate(()=>{const t=TOOLS.find(t=>t.id==='GLOW_TEST');t.durationMs=1000;startProgress(t);});
   await p.clock.runFor(1100);assert.equal(await p.locator('#state-GLOW_TEST').innerText(),'Done');
   await p.evaluate(()=>{const t=TOOLS.find(t=>t.id==='GLOW_TEST');t.durationMs=5000;startProgress(t);});
   await p.clock.runFor(2100);assert.equal(await p.locator('#state-GLOW_TEST').innerText(),'Active');
   assert.equal(await p.locator('#prog-GLOW_TEST').getAttribute('class'),'prog-fill running');
   await p.clock.runFor(5000);assert.deepEqual(errors,[]);await p.close();
   console.log(`${name} ${gzip?'gzip':'source'}: firmware-matched setting limits, no invalid writes, linked/removed/core ownership, escaped names and restart countdown passed`);
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
