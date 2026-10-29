const {clickSaveControls}=require('./save_controls_helper.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {gunzipSync}=require('node:zlib');
const {chromium}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=14520+Math.floor(Math.random()*50);
 await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 const browser=await chromium.launch({headless:true});
 try{
  for(const platform of ['esp32','esp32s3'])for(const packaged of [false,true]){
   const context=await browser.newContext({viewport:{width:800,height:1100},hasTouch:true});
   const page=await context.newPage();const errors=[],dialogs=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
   if(packaged)await page.route(/\/(hardware\.html|theme\.js|app\.js|style\.css)(?:\?.*)?$/,async route=>{
    const name=new URL(route.request().url()).pathname.split('/').pop();
    await route.fulfill({status:200,contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html',body:gunzipSync(fs.readFileSync('data/'+name+'.gz'))});
   });
   await page.request.post(base+'/__sim/blank');
   await page.request.patch(base+'/api/hardware',{data:{
    platform,controls:platform==='esp32s3'?{stop_pin:12,start_pin:13}:{stop_pin:27,start_pin:26},
    actuators:{glow_plug:{enabled:true,pin:17,type:2,fuel_pin:16,fuel_type:1,fuel_delay_ms:8000,has_current:true,current_pin:platform==='esp32s3'?2:36,current_mv_a:185}},
    channel_registry:{version:2,inputs:[],outputs:[{id:'glow_plug',name:'Workshop wet plug',purpose:'glow_plug',role:'glow_plug',driver:5,pin:17,min:0,max:1,pwm_freq_hz:1000,pwm_res_bits:8}],bindings:[]}
   }});
   await page.goto(base+'/hardware.html');
   await page.waitForFunction(()=>typeof cfg!=='undefined'&&/Loaded.*no unsaved changes/.test(document.querySelector('#save-msg')?.textContent||''));
   const solo=await page.evaluate(async()=>{
    stopHardwareTelemetry();
    const baseline=JSON.stringify(cfg),results=[];
    const setup=()=>{cfg=JSON.parse(baseline);_registryEditOpen.clear();_registryEditOpen.add(registryEditKey('output',0));renderRegistryInventory();};
    const check=(label)=>{const changes=_buildChanges();if(!changes.some(r=>r.label.includes(label)))throw Error(label+' missing: '+JSON.stringify(changes));if(!_changedFieldCount())throw Error(label+' missing from change counter');results.push(label);};
    for(const [key,value,label] of [
     ['fuel_pin',18,'Pilot-fuel GPIO'],['fuel_active_h',false,'Pilot-fuel active state'],
     ['fuel_freq_hz',2000,'Pilot-fuel PWM frequency'],['fuel_res_bits',9,'Pilot-fuel PWM resolution'],
     ['fuel_pwm_min_pct',10,'Pilot-fuel minimum PWM duty'],['fuel_pwm_max_pct',90,'Pilot-fuel maximum PWM duty'],
     ['fuel_min_us',1100,'Pilot-fuel minimum pulse'],['fuel_max_us',1900,'Pilot-fuel maximum pulse'],['fuel_demand_pct',70,'Pilot-fuel command']]){
     setup();if(key.endsWith('_us'))cfg.actuators.glow_plug.fuel_type=2;
     renderRegistryInventory();_snapshotFields();await setAct('glow_plug',key,value);check(label);
    }
    for(const [action,value,label] of [['setRegistryGlowType',0,'Glow-plug type'],['setRegistryWetGlowFuelType',2,'Pilot-fuel signal'],['setRegistryWetGlowDelaySeconds',9.5,'Pilot-fuel delay']]){
     setup();_snapshotFields();window[action](value);check(label);
    }
    for(const act of ['oil_pump','glow_plug','igniter','igniter2']){
     for(const [field,value,label] of [['mv_a',200,'Current sensitivity'],['zero_v',1.2,'Zero-current voltage'],['current_max_a',9,'Overcurrent shutdown'],['current_trip_delay_ms',700,'Overcurrent confirmation'],...(act==='glow_plug'?[['ready_a',4,'Hot-status current']]:[])]){
      setup();const purpose={oil_pump:'oil_pump',glow_plug:'glow_plug',igniter:'igniter',igniter2:'ab_igniter'}[act];
      cfg.actuators[act]={enabled:true,pin:17,has_current:true,current_pin:36,current_mv_a:100};
      cfg.channel_registry.outputs=[{id:act,name:'Named '+act,purpose,role:purpose,driver:5,pin:17,min:0,max:1}];
      renderRegistryInventory();_snapshotFields();await setActCurrentSensor(act,field,value);check(label);
     }
     setup();cfg.actuators[act]={enabled:true,pin:17,has_current:false};
     const purpose=act==='igniter2'?'ab_igniter':act;
     cfg.channel_registry.outputs=[{id:act,name:'Named '+act,purpose,role:purpose,driver:5,pin:17,min:0,max:1}];
     renderRegistryInventory();_snapshotFields();setCoreActuatorCurrentEnabled(act,true);check('Current sensing');
    }
    for(const [mode,key,value,label] of [[0,'ignition_on_demand',.5,'Ignition On level'],[0,'ignition_ramp_ms',700,'Ignition ramp-up'],[1,'ignition_dwell_ms',9,'Ignition dwell'],[1,'ignition_rest_ms',8,'Ignition rest'],[2,'ignition_coil_sat_a',5,'Coil saturation'],[0,'ignition_mode',1,'Ignition mode']]){
     setup();cfg.channel_registry.outputs=[{id:'igniter',name:'Named igniter',purpose:'igniter',role:'igniter',driver:5,pin:17,min:0,max:1,ignition_mode:mode}];
     renderRegistryInventory();_snapshotFields();updateRegistryChannel('output',0,key,value);check(label);
    }
    for(const [key,value,label] of [['phase_pin',36,'Torque pickup GPIO'],['phase_pulses_per_unit',2,'Torque pickup pulses'],['phase_speed_source',3,'Shaft speed source'],['phase_zero_deg',2,'Zero-torque phase'],['phase_deg_per_nm',.1,'Phase sensitivity'],['filter_alpha',1,'Input filter'],['pullup',true,'Internal pull-up']]){
     setup();cfg.channel_registry.inputs=[{id:'torque_main',name:'Named phase torque',purpose:'torque',role:'torque',driver:2,pin:25,min:0,max:100,torque_interface:2,phase_pin:34,pulses_per_unit:1}];
     renderRegistryInventory();_snapshotFields();updateRegistryChannel('input',0,key,value);check(label);
    }
    for(const [bus,key,value,label] of [
     ['i2c','enabled',true,'Installed'],['i2c','sda_pin',21,'SDA GPIO'],['i2c','scl_pin',22,'SCL GPIO'],
     ['i2c','interrupt_pin',25,'Interrupt GPIO'],['i2c','frequency_hz',100000,'Bus speed'],
     ['spi','enabled',true,'Installed'],['spi','sck_pin',18,'SCK GPIO'],['spi','miso_pin',19,'MISO GPIO'],['spi','mosi_pin',23,'MOSI GPIO']]){
     setup();_snapshotFields();
     if(bus==='i2c')setI2cField(key,value);else setSpiField(key,value);
     document.querySelector('#hardware-buses-editor').style.display='none';
     check(label);
     if(_buildChanges().length!==1 || _changedFieldCount()!==1)throw Error('Bus edit must have one review row even after closing its editor: '+JSON.stringify(_buildChanges()));
    }
    if(_registryFieldValue('phase_deg_per_nm',.000001,'input')===_registryFieldValue('phase_deg_per_nm',.000002,'input'))throw Error('Small calibration change was rounded away');
    // Keep the rendered registry editors and the review predicate in sync.
    // A newly exposed field must not silently disappear from the save recap.
    const fixtures=[];
    for(const driver of [0,1,2,3,7,8,9,10])
     fixtures.push(['input',{purpose:driver===10?'thrust':driver===2?'n1_speed':'generic',role:driver===10?'thrust':driver===2?'speed':'generic',driver}]);
    for(const purpose of ['throttle','idle','flame','ab_flame','battery_voltage','oil_pressure','low_oil_switch'])
     fixtures.push(['input',{purpose,role:['flame','ab_flame'].includes(purpose)?'flame':purpose==='battery_voltage'?'voltage':purpose==='oil_pressure'?'pressure':purpose==='low_oil_switch'?'low_oil_switch':'operator',driver:1}]);
    for(const temp_interface of [0,1,2,3,4,5])
     fixtures.push(['input',{purpose:'oil_temperature',role:'temperature',driver:1,temp_interface}]);
    for(const torque_interface of [0,1,2])
     fixtures.push(['input',{purpose:'torque',role:'torque',driver:torque_interface===2?2:1,torque_interface}]);
    for(const purpose of ['generic','main_fuel','oil_pump','scavenge_pump','glow_plug','igniter','ab_igniter'])
     for(const driver of [4,5,6,11])
      fixtures.push(['output',{purpose,role:purpose,driver,has_current:true,has_flow_monitor:true,ignition_mode:0}]);
    let reviewedControls=0;
    for(const [direction,fixture] of fixtures){
     setup();cfg.i2c.enabled=true;
     const c={id:'audit_device',name:'Named device',pin:25,min:0,max:1,...fixture};
     cfg.channel_registry={version:2,inputs:direction==='input'?[c]:[],outputs:direction==='output'?[c]:[],bindings:[]};
     _registryEditOpen.clear();_registryEditOpen.add(registryEditKey(direction,0));renderRegistryInventory();
     for(const el of document.querySelectorAll('[data-registry-id="audit_device"] input,[data-registry-id="audit_device"] select')){
      const handler=el.getAttribute('oninput')||el.getAttribute('onchange')||'';
      const match=handler.match(/updateRegistryChannel\('(input|output)',\d+,'([^']+)'/);
      if(!match)continue;
      if(!_registryFieldRelevant(direction,c,match[2]))throw Error('Rendered field has no review coverage: '+JSON.stringify({fixture,key:match[2]}));
      reviewedControls++;
     }
    }
    if(reviewedControls<100)throw Error('Registry editor coverage unexpectedly small: '+reviewedControls);
    results.push(reviewedControls+' rendered registry controls covered');
    for(const [key,value,label] of [['physical_port','connector_b','PCB connection'],['physical_mode','alternate_mode','PCB connection mode']]){
     setup();_snapshotFields();cfg.channel_registry.outputs[0][key]=value;dirty();check(label);
    }
    // A default-valued edit must not create a phantom recap.
    setup();_snapshotFields();setRegistryWetGlowDelaySeconds(8);
    if(_buildChanges().length)throw Error('Unchanged wet-glow delay created a review row');
    cfg=JSON.parse(baseline);renderRegistryInventory();_snapshotFields();
    return results;
   });
   // Reproduce the user's exact path: only the visible delay changes, then the
   // editor closes before review. No rename or unrelated edit is supplied.
   await page.evaluate(()=>{_registryEditOpen.add(registryEditKey('output',0));renderRegistryInventory();});
   await page.locator('input[oninput*="setRegistryWetGlowDelaySeconds"]').fill('9.5');
   await page.evaluate(()=>{_registryEditOpen.clear();renderRegistryInventory();});
   await clickSaveControls(page);
   await page.locator('#save-recap-modal').waitFor({state:'visible'});
   assert.match(await page.locator('#save-recap-body').innerText(),/Workshop wet plug.*Pilot-fuel delay.*8.*9\.5/s);
   await page.setViewportSize({width:400,height:900});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Review must fit a phone viewport');
   const sent=page.waitForRequest(r=>r.url().includes('/api/hardware?source=hardware')&&r.method()==='PATCH');
   const response=page.waitForResponse(r=>r.url().includes('/api/hardware?source=hardware')&&r.request().method()==='PATCH');
   await page.locator('#save-recap-confirm-btn').click();
   const request=await sent;assert.equal(request.postDataJSON().actuators.glow_plug.fuel_delay_ms,9500);
   assert.ok((await response).ok());
   const saved=await(await page.request.get(base+'/api/hardware')).json();
   assert.equal(saved.actuators.glow_plug.fuel_delay_ms,9500);
   assert.equal(saved.channel_registry.outputs[0].name,'Workshop wet plug');
   assert.deepEqual(dialogs,[]);assert.deepEqual(errors,[]);
   console.log(`${platform} ${packaged?'packaged':'source'}: ${solo.length-1} isolated edits reviewed; ${solo.find(row=>row.endsWith('rendered registry controls covered'))}; delay-only edit survives closing the card, review, confirmation and persisted PATCH without renaming.`);
   await context.close();
  }
 }finally{await browser.close();}
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
