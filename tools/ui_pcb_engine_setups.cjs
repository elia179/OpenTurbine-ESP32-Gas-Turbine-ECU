// Setup workflows against official PCB metadata. Peripheral presence is simulated.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,firefox,webkit}=require('playwright');
const {gunzipSync}=require('node:zlib');
const {latestPcbFixture,discovery}=require('./latest_pcb_fixture.cjs');
globalThis.OT_UI_SIM_I2C_DISCOVERY=discovery;
(async()=>{
 globalThis.OT_UI_SIM_PORT=15124;await import('./ui_mock_server.mjs');
 const base='http://127.0.0.1:15124',browser=await ({chromium,firefox,webkit}[process.env.OT_BROWSER||'chromium']).launch();
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(process.env.OT_PACKED==='1')await page.route(/\/(?:hardware|controllers|calibration|sequence|tools)\.html(?:\?.*)?$|\/(?:app|theme|ui_dialog)\.js(?:\?.*)?$|\/style\.css(?:\?.*)?$/,r=>{
    const name=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({status:200,contentType:name.endsWith('html')?'text/html':name.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+name+'.gz'))});
  });
  await page.addInitScript(()=>{localStorage.setItem('ot_beta_notice_ack_v1','1');localStorage.setItem('ot_theme_onboarded_v1','1');});
  fs.mkdirSync('artifacts/pcb2/engine-setups',{recursive:true});
  for(const variant of ['turbojet','free-power','dual-oil-and-auxiliaries']){
   const original=await(await page.request.get(base+'/__sim/state')).json();
   const fixture=latestPcbFixture(original);fixture.hardware.profile_id=fixture.settings.profile_id='PCB '+variant;
   await page.request.post(base+'/api/ecu_config',{data:fixture});
   await page.goto(base+'/hardware.html');await page.waitForFunction(()=>typeof registryRoot==='function'&&pcbProfileActive()&&GPIO_DB===GPIO_DB_ESP32S3&&!!_hardwareModelSnap);
   const setup=await page.evaluate(variant=>{
    const check=(ok,msg)=>{if(!ok)throw Error(msg);};
    const add=(direction,id,port,mode)=>{
     openRegistryAddDialog(direction);
     const presets=direction==='input'?REGISTRY_INPUT_PRESETS:REGISTRY_OUTPUT_PRESETS;
     const index=presets.findIndex(p=>p.id===id||p.purpose===id);check(index>=0,'preset '+id);
     const before=registryRoot()[direction+'s'].length;
     selectRegistryProfilePort(index,port,mode);
     check(registryRoot()[direction+'s'].length===before+1,'could not add '+id+' to '+port);
     const c=registryRoot()[direction+'s'].at(-1);
     check(registryStatus(c).kind!=='error',id+': '+registryStatus(c).text);
     return c;
    };
    const initialStart=registryRoot().inputs.findIndex(c=>c.purpose==='start_switch');
    updateRegistryProfilePort('input',initialStart,'gpio|17');check(!registryRoot().inputs[initialStart].physical_port,'could not select Start GPIO in place');
    updateRegistryProfilePort('input',initialStart,'start_switch|switch');check(registryRoot().inputs[initialStart].physical_port==='start_switch','could not return to Start Connector in place');
    const startHeader=pcbGpioHeaderChoices('input',0).find(g=>g.pin===17);
    check(startHeader&&!startHeader.available&&startHeader.status.includes('Start Connector'),'Start/header conflict not explained');
    const startIndex=registryRoot().inputs.findIndex(c=>c.purpose==='start_switch');
    removeRegistryChannel('input',startIndex);confirmRegistryRemoveChannel();
    check(pcbGpioHeaderChoices('input',0).find(g=>g.pin===17)?.available,'removing Start did not release GPIO17');
    openRegistryAddDialog('input');const switchPreset=REGISTRY_INPUT_PRESETS.findIndex(p=>p.id==='digital_interlock');
    selectRegistryGpioHeader(switchPreset,17);const header=registryRoot().inputs.at(-1);
    check(header.pin===17&&!header.physical_port&&registryStatus(header).kind!=='error','raw GPIO17 not usable');
    check(pcbCompatibleChoices('input','start_switch','digital_switch').find(c=>c.port.id==='start_switch')?.mode.available===false,'named Start not blocked by GPIO17');
    removeRegistryChannel('input',registryRoot().inputs.length-1);confirmRegistryRemoveChannel();
    add('input','start_switch','start_switch','switch');
    check(pcbGpioHeaderChoices('output',5).some(g=>g.pin===46),'S3 GPIO46 was incorrectly restricted to input only');
    const n1=add('input','n1_speed','pulse_in_1','frequency');
    const tot=add('input','tot','thermocouple_1','temperature');
    const oil=add('input','oil_pressure','analog_1','analog');
    const throttle=add('input','operator_throttle','analog_2','analog');
    const fuel=add('output','main_fuel','power_out_1','pwm');
    add('output','oil_pump','power_out_2','pwm');
    add('output','starter','pulse_out_1','servo');
    add('output','igniter','power_out_3','on_off');
    add('output','fuel_shutoff','power_out_4','on_off');
    check(registryPwmTimingEditor(fuel,0).includes('At 0% command'),'new fuel PWM lacks Brake/Coast');
    check(oil.device_channel===0&&throttle.device_channel===1,'ADC connectors share temporary channel');
    check(fuel.pin===37,'power output unresolved until reboot');
    const resourceSnapshot=structuredClone(cfg);
    cfg.buzzer={enabled:false};registryRoot().outputs=Array.from({length:5},(_,i)=>({id:'timer_'+i,driver:5,pin:[18,8,9,39,40][i],pwm_freq_hz:1000+i*1000,pwm_res_bits:10}));
    check(registryPwmResourceProblem().includes('independent PWM timer'),'five incompatible signal timers not flagged');
    registryRoot().outputs.forEach(c=>c.pwm_freq_hz=1000);check(!registryPwmResourceProblem(),'shared signal timing falsely rejected');
    registryRoot().outputs.push(...Array.from({length:6},(_,i)=>({id:'power_'+i,driver:5,pin:[37,38,41,42,2,1][i],pwm_freq_hz:1000+i*1000})));
    check(!registryPwmResourceProblem(),'MCPWM outputs counted against LEDC timers');
    cfg=resourceSnapshot;
    const beforeMirroring=structuredClone(cfg);
    const fuelIndex=registryRoot().outputs.findIndex(c=>c.id===fuel.id);updateRegistryChannel('output',fuelIndex,'pwm_zero_mode',1);
    duplicateRegistryChannel(fuelIndex);const mirror=registryRoot().outputs.at(-1),mirrorIndex=registryRoot().outputs.length-1;
    check(mirror.pwm_zero_mode===undefined,'unassigned mirror retained PCB-only zero mode');
    check(registryProfilePortEditor('output',mirror,mirrorIndex).includes('Choose a connection'),'unassigned mirror cannot choose a connector');
    updateRegistryProfilePort('output',mirrorIndex,'power_out_6|pwm');check(mirror.pin===1&&mirror.mirror_of===fuel.id,'mirror did not acquire named power connector');
    updateRegistryProfilePort('output',mirrorIndex,'pulse_out_3|pwm');check(mirror.pin===9&&mirror.pwm_zero_mode===undefined,'moving mirror to signal output retained power state');
    cfg=beforeMirroring;renderRegistryInventory();
    const rules=[{enabled:true,name:'Throttle fuel demand',kind:1,source:throttle.id,target:fuel.id,input_min:0,input_max:100,output_min:0,output_max:1,mode_mask:4}];
    if(variant==='free-power'){
     const n2=add('input','n2_speed','pulse_in_2','frequency');
     add('input','torque','analog_3','analog');add('input','oil_temperature','analog_4','analog');
     openRegistryAddDialog('output');const rawPreset=REGISTRY_OUTPUT_PRESETS.findIndex(p=>p.driver===5&&p.role==='generic');selectRegistryGpioHeader(rawPreset,47);const raw=registryRoot().outputs.at(-1);check(raw.pin===47&&!raw.physical_port&&registryStatus(raw).kind!=='error','GPIO47 PWM not usable: '+JSON.stringify({raw,status:registryStatus(raw),choices:pcbGpioHeaderChoices('output',5)}));check(document.querySelector(`[data-registry-id="${raw.id}"] select[onchange*="driver"]`),'raw GPIO lacks development-board signal selector');
     add('output','prop_pitch','pulse_out_2','servo');add('output','scavenge_pump','power_out_5','pwm');
     rules[0]={enabled:true,name:'Free turbine speed',kind:2,source:n2.id,target:fuel.id,target_fixed:28000,target_source_type:0,output_min:0,output_max:1,response_gain:.0002,integral_gain:.00002,deadband:300,off_value:0,mode_mask:4};
    }
    if(variant==='dual-oil-and-auxiliaries'){
     const a=add('input','digital_interlock','pulse_in_2','switch');a.name='Oil circuit 1';
     const b=add('input','digital_interlock','analog_3','switch');b.name='Oil circuit 2';
     add('input','generic_analog_input','analog_4','analog');add('input','fuel_pressure','analog_5','analog');
     add('input','generic_analog_input','analog_6','analog');add('input','generic_analog_input','analog_7','analog');
     add('input','generic_analog_input','analog_8','analog');add('input','tit','thermocouple_2','temperature');
     add('output','scavenge_pump','power_out_5','pwm');add('output','coolant_pump','power_out_6','pwm');
     rules.push(...[a,b].map((c,i)=>({enabled:true,name:'Oil circuit '+(i+1)+' fault',kind:0,source:c.id,target:'request_fault',op:0,threshold:.5,hysteresis:0,on_value:1,off_value:0,mode_mask:4})));
    }
    const endpoints=new Set();for(const c of registryRoot().inputs.filter(c=>c.driver===9)){const key=c.i2c_address+':'+c.device_channel;check(!endpoints.has(key),'duplicate ADC endpoint '+key);endpoints.add(key);}
    const connectors=registryRoot().inputs.concat(registryRoot().outputs).map(c=>c.physical_port).filter(Boolean);
    check(new Set(connectors).size===connectors.length,'duplicate physical connector');
    for(const c of registryRoot().inputs.concat(registryRoot().outputs))check(registryStatus(c).kind!=='error',c.name+': '+registryStatus(c).text);
    return {hardware:structuredClone(cfg),rules,ids:{n1:n1.id,tot:tot.id,fuel:fuel.id},counts:{inputs:registryRoot().inputs.length,outputs:registryRoot().outputs.length}};
   },variant);
   if(variant==='free-power'){const card=page.locator('[data-registry-id="tot_main"]');await card.screenshot({path:'artifacts/pcb2/engine-setups/thermocouple-card.png'});}
   const saved={hardware:setup.hardware,settings:{...fixture.settings,rules:setup.rules}};
   assert((await page.request.post(base+'/api/ecu_config',{data:saved})).ok());
   fs.writeFileSync('artifacts/pcb2/engine-setups/'+variant+'.json',JSON.stringify(setup.hardware.channel_registry,null,2));
   await page.reload();await page.waitForFunction(()=>typeof registryRoot==='function'&&pcbProfileActive()&&GPIO_DB===GPIO_DB_ESP32S3&&!!_hardwareModelSnap);
   assert.deepEqual(await page.evaluate(()=>registryRoot().outputs.map(c=>c.physical_port)),setup.hardware.channel_registry.outputs.map(c=>c.physical_port));
   await page.evaluate(()=>{
     const c=registryRoot().inputs.find(row=>row.physical_port==='analog_1');
     const mode=pcbProfile.ports.find(p=>p.id===c.physical_port).modes.find(m=>m.id===c.physical_mode);
     mode.available=false;mode.status='Fitted I2C device is not responding';
     const device=cfg._i2c_discovery?.devices?.find(d=>Number(d.address)===Number(mode.i2c_address)),wasPresent=device?.present;
     if(device)device.present=false;
     if(registryStatus(c).kind!=='warn'||registryInvalidDetails().some(e=>e.channel===c))throw Error('saved offline ADC prevents unrelated saves');
     if(registryStatus({...c,id:'new_offline_adc',purpose:'general_pressure',role:'pressure'}).kind!=='warn')throw Error('known offline connector could not be configured');
     mode.available=true;if(device)device.present=wasPresent;
     if(registryRoot().inputs.some(c=>c.name==='Oil circuit 1')){
       const oldCfg=structuredClone(cfg),oldSettings=structuredClone(settingsCfg);
       const a=registryRoot().inputs.find(c=>c.name==='Oil circuit 1'),b=registryRoot().inputs.find(c=>c.name==='Oil circuit 2');
       removeRegistryChannel('input',registryRoot().inputs.indexOf(a));confirmRegistryRemoveChannel();
       if(settingsCfg.rules.some(rule=>rule.source===a.id)||!settingsCfg.rules.some(rule=>rule.source===b.id))throw Error('removing oil circuit 1 damaged circuit 2 controller');
       cfg=oldCfg;settingsCfg=oldSettings;renderRegistryInventory();dirty();updateSaveButton();
     }
   });

   for(const path of ['controllers.html','calibration.html','sequence.html','tools.html']){
    const hardwareLoaded=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/hardware'&&r.ok());
    await page.goto(base+'/'+path);await hardwareLoaded;
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const text=await page.locator('body').innerText();assert(!/ReferenceError|TypeError|\bNaN\b/.test(text),variant+' '+path);
   }
   assert.deepEqual(errors,[]);console.log('PASS PCB setup '+variant,setup.counts);
  }
 }finally{await browser.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
