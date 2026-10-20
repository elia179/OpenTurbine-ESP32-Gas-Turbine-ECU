// Explicit idle-bench write test. Restores the complete original engine file.
// Does not issue START or output commands.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
if (!process.argv.includes('--allow-write')) throw Error('Requires --allow-write on an idle bench ECU');
const base = process.argv.find(arg => /^http/.test(arg)) || 'http://192.168.4.1';
const profile = process.env.OT_WIFI_PROFILE || 'OpenTurbine';
const out = process.env.OT_AUDIT_OUT || 'artifacts/v254-qualification';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
fs.mkdirSync(out,{recursive:true});
async function read(route,attempts=5,timeout=7000) {
  for (let i=0;i<attempts;i++) {
    try {
      const response = await fetch(base+route,{headers:{Connection:'close'},signal:AbortSignal.timeout(timeout)});
      assert.ok(response.ok,`${route}: ${response.status}`);
      return await response.json();
    } catch (error) { if (i===attempts-1) throw error; await pause(500); }
  }
}
async function idle() {
  const info = await read('/api/device_info');
  assert.equal(info.state,'STANDBY'); assert.equal(info.outputs_active,false);
  return info;
}
async function returned(previousBoot,predicate) {
  const deadline=Date.now()+120000;
  for(let i=0;i<50 && Date.now()<deadline;i++) {
    if(i>0 && i%3===0 && process.platform==='win32')
      execFileSync('netsh',['wlan','connect',`name=${profile}`],{stdio:'ignore'});
    try {
      const live=await read('/api/data',1,2500);
      if(Number(live.boot_count)!==Number(previousBoot)) {
        const config=await read('/api/ecu_config',1,7000);
        if(predicate(config)) {await idle(); return config;}
      }
    }catch(_){}
    await pause(700);
  }
  throw Error('ECU did not reboot with the expected saved hardware');
}
(async()=>{
  const info=await idle();
  const original=await read('/api/ecu_config');
  assert.equal(original.hardware.channel_registry.inputs.some(c=>c.purpose==='flame'),false,
    'This bench fixture requires an unused flame purpose');
  const usedPins=new Set([...original.hardware.channel_registry.inputs,...original.hardware.channel_registry.outputs]
    .flatMap(c=>[c.pin,c.current_pin,c.spi_cs,c.spi_clk,c.spi_miso,c.spi_mosi,c.hx711_clk,c.phase_pin]).filter(p=>p>=0));
  const h=original.hardware;
  for(const p of [h.controls?.stop_pin,h.controls?.start_pin,...(h.di_channels||[]).map(c=>c.pin)])
    if(p>=0)usedPins.add(p);
  for(const item of [h.i2c,h.spi,h.buzzer,h.cluster_serial,h.mavlink,...Object.values(h.actuators||{})])
    if(item?.enabled)for(const [key,value] of Object.entries(item))
      if((key==='pin'||key.endsWith('_pin'))&&Number(value)>=0)usedPins.add(Number(value));
  const adcPins=info.target==='esp32dev'?[35,34,36,39]:[5,7,10,4,6,1,2,3,8,9];
  const pin=adcPins.find(p=>!usedPins.has(p));
  const movedPin=[...adcPins,...(info.target==='esp32dev'?[]:[18,35,36,37,38,39,42,43,44,47])]
    .find(p=>p!==pin && !usedPins.has(p));
  assert.ok(pin!==undefined&&movedPin!==undefined,'Fixture needs an unused ADC1 pin and a separate input GPIO');
  fs.writeFileSync(`${out}/${info.target}-gpio-original.json`,JSON.stringify(original,null,2));
  const browser=await chromium.launch({headless:true});
  const results=[];
  let modified=false, channelId;
  async function editor() {
    const page=await browser.newPage({viewport:{width:900,height:1000},hasTouch:true});
    await page.addInitScript(()=>{
      localStorage.setItem('ot_beta_notice_ack_v1','1');localStorage.setItem('ot_theme_onboarded_v1','1');
    });
    await page.goto(base+'/hardware.html',{waitUntil:'domcontentloaded',timeout:45000});
    // cfg is assigned before discovery/catalog loading and the final snapshot.
    // Wait for editor readiness before making changes to that draft.
    await page.waitForFunction(()=>typeof cfg!=='undefined' && cfg.profile_id &&
      /Loaded.*no unsaved changes/.test(document.querySelector('#save-msg')?.textContent||''),
      null,{timeout:45000});
    return page;
  }
  async function save(page,predicate,label) {
    await idle(); const beforeBoot=(await read('/api/data')).boot_count;
    assert.ok(await page.locator('#btn-save').isEnabled(),JSON.stringify(await page.evaluate(()=>({
      dirty:_hwDirty,mode:engineMode,pinConflict:_pinConflictBlocking,
      invalid:registryInvalidChannels(),inputs:registryRoot().inputs,
      footer:document.querySelector('#save-msg')?.textContent
    }))));
    await page.locator('#btn-save').click();
    await page.locator('#save-recap-modal').waitFor({state:'visible'});
    const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/hardware' && r.request().method()==='PATCH',{timeout:30000});
    modified=true;
    await page.locator('#save-recap-confirm-btn').click();
    const response=await pending;
    const result=await response.json();
    assert.ok(response.ok() && result.ok!==false,JSON.stringify(result));
    await page.close();
    const config=await returned(beforeBoot,predicate);
    assert.deepEqual(config.settings,original.settings,'Hardware save altered Settings');
    results.push(label);console.log('PASS: '+label);
    return config;
  }
  const channel=config=>config.hardware.channel_registry.inputs.find(c=>c.id===channelId);
  const adapter=config=>config.hardware.di_channels.find(c=>c.registry_id===channelId);
  try {
    let page=await editor();
    channelId=await page.evaluate(pin=>{
      openRegistryAddDialog('input');
      selectRegistryAddPreset(REGISTRY_INPUT_PRESETS.findIndex(c=>c.purpose==='flame'));
      const r=registryRoot(),index=r.inputs.length-1;
      updateRegistryChannel('input',index,'pin',pin);
      return r.inputs[index].id;
    },pin);
    await save(page,c=>channel(c)?.purpose==='flame' && c.hardware.sensors.flame.enabled,
      'Flame input saved with its singleton GPIO adapter');

    page=await editor();
    await page.evaluate(id=>{
      const index=registryRoot().inputs.findIndex(c=>c.id===id);
      updateRegistryChannel('input',index,'purpose','low_oil_switch');
      updateRegistryChannel('input',index,'driver',0);
      _registryEditOpen.add(registryEditKey('input',index));renderRegistryInventory();
    },channelId);
    const card=page.locator(`[data-registry-id="${channelId}"]`);
    const bias=card.locator('.hw-bias-unavailable input');
    if(info.target==='esp32dev') {
      assert.equal(await bias.count(),2);
      for(const field of await bias.all())assert.ok(await field.isDisabled());
      assert.match(await card.innerText(),/no internal pull-up or pull-down/);
    }else assert.equal(await bias.count(),0,'S3 supports internal bias');
    let saved=await save(page,c=>channel(c)?.purpose==='low_oil_switch' && !!adapter(c),
      'Former flame input saved as a GPIO safety switch without hardware-patch rejection');
    assert.equal(saved.hardware.sensors.flame.enabled,false);
    assert.equal(adapter(saved).pin,pin);
    assert.equal(adapter(saved).active_h,false);
    if(info.target==='esp32dev')assert.ok(!channel(saved).pullup && !channel(saved).pulldown);

    page=await editor();
    await page.evaluate(({id,pin})=>{
      const i=registryRoot().inputs.findIndex(c=>c.id===id);
      updateRegistryChannel('input',i,'name','Bench oil safety');
      updateRegistryChannel('input',i,'active_high',true);
      updateRegistryChannel('input',i,'pin',pin);
      if (!pinHasNoInternalPull(pin)) updateRegistryChannel('input',i,'pulldown',true);
    },{id:channelId,pin:movedPin});
    saved=await save(page,c=>channel(c)?.pin===movedPin && adapter(c)?.pin===movedPin && adapter(c).active_h===true,
      'Repeated save moved, renamed and reversed the linked safety input');
    assert.equal(adapter(saved).label,'Bench oil safety');
    assert.equal(saved.hardware.di_channels.filter(c=>c.pin===movedPin).length,1);
    assert.equal(saved.hardware.di_channels.some(c=>c.pin===pin),false);
    if(info.target!=='esp32dev')assert.ok(channel(saved).pulldown && !channel(saved).pullup);

    page=await editor();
    await page.evaluate(id=>{
      const i=registryRoot().inputs.findIndex(c=>c.id===id);
      updateRegistryChannel('input',i,'active_high',false);
    },channelId);
    saved=await save(page,c=>adapter(c)?.active_h===false,
      'Active-low safety input rebooted with its configured bias and linked slot');

    // Deduplicating a runtime adapter must never conceal two actual devices.
    const collisionRegistry=structuredClone(saved.hardware.channel_registry);
    collisionRegistry.inputs.push({...channel(saved),id:'audit_duplicate',name:'Duplicate oil switch'});
    const collisionBoot=(await read('/api/data')).boot_count;
    const rejected=await fetch(base+'/api/hardware?source=hardware',{
      method:'PATCH',headers:{'Content-Type':'application/json',Connection:'close'},
      body:JSON.stringify({channel_registry:collisionRegistry}),signal:AbortSignal.timeout(20000)});
    const rejection=await rejected.json();
    assert.equal(rejected.status,400,JSON.stringify(rejection));
    assert.match(rejection.detail||rejection.error,/GPIO|collision|channel registry/i);
    assert.equal(rejection.rebooting,true,'A rejected live-registry update must recover at boot');
    const unchanged=await returned(collisionBoot,c=>c.hardware.channel_registry.inputs.length===saved.hardware.channel_registry.inputs.length);
    assert.deepEqual(unchanged.hardware.channel_registry,saved.hardware.channel_registry);
    assert.deepEqual(unchanged.settings,original.settings);
    const liveHardware=await read('/api/hardware');
    assert.deepEqual(liveHardware.channel_registry,saved.hardware.channel_registry,'Runtime Hardware must match the committed file after rejection');
    results.push('Backend rejected a real duplicate-GPIO assignment and retained the committed configuration');
    console.log('PASS: '+results[results.length-1]);

    // Repurpose back to flame: a stale safety slot must be retired, not kept
    // as an independent invisible input claiming the old GPIO.
    page=await editor();
    await page.evaluate(({id,pin})=>{
      const i=registryRoot().inputs.findIndex(c=>c.id===id);
      updateRegistryChannel('input',i,'purpose','flame');
      updateRegistryChannel('input',i,'driver',1);
      updateRegistryChannel('input',i,'pin',pin);
    },{id:channelId,pin});
    await save(page,c=>channel(c)?.purpose==='flame' && !adapter(c) &&
      !c.hardware.di_channels.some(d=>d.pin===movedPin),
      'Repurposing a safety input retired its legacy runtime copy');

    page=await editor();
    await page.evaluate(id=>{
      const i=registryRoot().inputs.findIndex(c=>c.id===id);
      removeRegistryChannel('input',i);confirmRegistryRemoveChannel();
    },channelId);
    await save(page,c=>!channel(c) && !c.hardware.sensors.flame.enabled,
      'Removing the repurposed channel retired its singleton assignment');
  }finally{
    await browser.close();
    if(modified) {
      const beforeBoot=(await read('/api/data')).boot_count;
      let error;
      try{
        const response=await fetch(base+'/api/ecu_config',{method:'POST',headers:{'Content-Type':'application/json',Connection:'close'},
          body:JSON.stringify(original),signal:AbortSignal.timeout(30000)});
        const result=await response.json();
        assert.ok(response.ok && result.ok!==false,JSON.stringify(result));
      }catch(e){error=e;}
      const restored=await returned(beforeBoot,c=>JSON.stringify(c.hardware.channel_registry)===JSON.stringify(original.hardware.channel_registry));
      assert.deepEqual(restored.hardware,original.hardware);
      assert.deepEqual(restored.settings,original.settings);
      console.log('PASS: complete original engine configuration restored, outputs inactive'+(error?' after reconnect':''));
    }
  }
  fs.writeFileSync(`${out}/${info.target}-gpio-result.json`,JSON.stringify({passed:true,device:info,checks:results,originalRestored:true},null,2));
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
