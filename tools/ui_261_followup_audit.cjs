const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
const {guidedFixture}=require('./guided_build_fixture.cjs');
const {waitForEditorBaseline}=require('./save_controls_helper.cjs');
(async()=>{
 globalThis.OT_UI_SIM_PORT=14820;await import('./ui_mock_server.mjs');
 const base='http://127.0.0.1:14820',browser=await chromium.launch();
 try{
  const p=await browser.newPage({viewport:{width:1024,height:600}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  const initial=await(await p.request.get(base+'/__sim/state')).json(),state=guidedFixture(initial,1);
  state.settings.sequence.shutdown.cooldown_use_starter=false;
  await p.request.post(base+'/api/ecu_config',{data:state});await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',config_locked:false}});
  await p.goto(base+'/system.html');await p.locator('#system-maintenance').waitFor();
  assert.deepEqual(await p.locator('.system-category').evaluateAll(els=>els.map(el=>el.open)),[true,true,true]);
  await p.locator('#system-maintenance > summary').click();await p.evaluate(()=>renderSystemSetup());
  assert.equal(await p.locator('#system-maintenance').evaluate(el=>el.open),false);
  await p.reload();await p.locator('#system-maintenance').waitFor();assert.equal(await p.locator('#system-maintenance').evaluate(el=>el.open),true);
  await p.goto(base+'/sequence.html');await p.locator('#list-startup .block-card').first().waitFor();
  await p.getByRole('button',{name:'Shutdown',exact:true}).click();
  const cut=p.locator('#list-shutdown .block-card[data-block="ImmediateCut"]');await cut.locator('.block-header').click();
  const actions=cut.locator('.sequence-action-card');assert.ok(await actions.count()>=4);
  const labels=await actions.allTextContents();assert.ok(labels.some(s=>s.includes('Main Fuel')&&s.includes('0%')));assert.ok(labels.some(s=>s.includes('Igniter')&&s.includes('OFF')));
  assert.ok(!labels.some(s=>s.includes('Oil Pump')),'cut must retain oil');
  const model=await p.evaluate(()=>{
   const cut=resolveSequenceActions('shutdown',['ImmediateCut'])[0];
   const cool=resolveSequenceActions('shutdown',['CooldownSpin'])[0];
   const ab=resolveSequenceActions('afterburner',['ABIgnite'])[0];
   return {cut:cut.map(r=>({key:r.meta.key,value:r.value})),cool:cool.map(r=>({key:r.meta.key,value:r.value,phase:r.phase})),ab:ab.map(r=>r.meta.key)};
  });
  assert.ok(!model.cool.some(r=>r.key==='starter'&&r.phase==='during'),'disabled starter cooling absent');
  assert.ok(!model.ab.includes('ab_sol'),'AB ignition must not invent valve-open command');
  await fs.promises.mkdir('artifacts/261-ui',{recursive:true});await cut.screenshot({path:'artifacts/261-ui/immediate-cut.png'});
  await p.goto(base+'/hardware.html');
  await p.waitForFunction(()=>!!cfg.channel_registry && typeof setAct==='function');
  await p.evaluate(()=>{_workflowEditOpen.add('comms');renderCommsIndicatorSummary();});
  const fault=p.locator('#hardware-comms-summary .hw-item-card').filter({has:p.locator('.registry-card-summary strong',{hasText:'Fault LED'})});
  assert.equal(await fault.count(),1,'optional Fault LED is discoverable');
  await fault.getByLabel('Enable Fault LED').check();
  const faultPin=fault.locator('select');
  const inputOnly=await p.evaluate(()=>Object.keys(GPIO_DB).filter(pin=>GPIO_DB[pin].i));
  assert.ok(!(await faultPin.locator('option:not([disabled])').evaluateAll(options=>options.map(o=>o.value))).some(v=>inputOnly.includes(v)),'input-only GPIOs cannot drive an LED');
  await p.evaluate(()=>{setAct('fault_led','pin',4);setAct('fault_led','active_h',false);});
  const ledState=await p.evaluate(()=>({config:cfg.actuators.fault_led,rows:_deviceDiffRows(),usage:collectPinUsage()}));
  assert.equal(ledState.config.enabled,true);assert.equal(ledState.config.active_h,false);
  assert.ok(JSON.stringify(ledState.rows).includes('Fault LED'),'Fault LED edits appear in save recap');
  await p.evaluate(()=>{_hwDirty=false;});
  for(const route of ['hardware','controllers','system','sequence']){
   await p.goto(base+'/'+route+'.html');await waitForEditorBaseline(p,route);
   if(route==='controllers'){
    await p.locator('[data-group="safety"] > summary').click();
    await p.locator('[data-protection="egt"] > summary').click();
   }
   // Make a real edit: status polling may correctly remove a fabricated dirty
   // class when the model still equals its saved baseline.
   await p.evaluate(route=>{
    if(route==='hardware'){cfg.profile_desc=String(cfg.profile_desc||'')+' test';dirty();}
    else if(route==='system')setSystemHardware('profile_desc',String(hwCfg.profile_desc||'')+' test');
    else if(route==='controllers'){const field=document.getElementById('cf-tot_limit');field.value=Number(field.value)+1;field.dispatchEvent(new Event('input',{bubbles:true}));_markDirty();}
    else {hwCfg.startup_delay_ms=[...(hwCfg.startup_delay_ms||[]),151];markSequenceDirty();}
    document.activeElement.blur();scrollTo(0,0);
   },route);await p.waitForTimeout(850);
   await p.mouse.wheel(0,350);await p.waitForTimeout(200);
   const enough=await p.evaluate(()=>scrollY>80&&scrollY+innerHeight<document.documentElement.scrollHeight-20);
   if(enough){
    assert.ok(await p.locator('body').evaluate(el=>el.classList.contains('ot-controls-collapsed')),route+' collapses: '+await p.locator('.save-bar,.seq-save-bar').first().innerText());
    const diagnostic=await p.evaluate(()=>({body:document.body.className,bar:document.querySelector('.save-bar,.seq-save-bar').className,handle:[...document.querySelectorAll('.ot-save-handle')].map(el=>({text:el.textContent,display:getComputedStyle(el).display,visibility:getComputedStyle(el).visibility}))}));
    assert.ok(await p.getByRole('button',{name:/Show save controls/}).count(),route+' save handle: '+JSON.stringify(diagnostic));
    await p.getByRole('button',{name:/Show save controls/}).click();
    assert.ok(!await p.locator('body').evaluate(el=>el.classList.contains('ot-controls-collapsed')),route+' restores');
   }
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1,route+' no horizontal overflow');
  }
  assert.deepEqual(errors,[]);console.log('2.6.1 System entry, compound action previews, retained oil, conditional commands and shared short-viewport controls passed.');
 }finally{await browser.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
