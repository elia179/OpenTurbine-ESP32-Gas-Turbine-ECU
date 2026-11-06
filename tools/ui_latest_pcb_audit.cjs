const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,firefox,webkit}=require('playwright');
const {gunzipSync}=require('node:zlib');
const {latestPcbFixture,source,discovery}=require('./latest_pcb_fixture.cjs');
globalThis.OT_UI_SIM_I2C_DISCOVERY=discovery;
(async()=>{
 globalThis.OT_UI_SIM_PORT=15123;await import('./ui_mock_server.mjs');const base='http://127.0.0.1:15123';
 for(const engine of [chromium,firefox,webkit])for(const packed of [false,true]){
  const browser=await engine.launch();try{
   const p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
   const navigate=async route=>{
     try{await p.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});}
     catch(error){
       const state=await Promise.race([p.evaluate(()=>({url:location.href,ready:document.readyState,loading:typeof _hwLoading==='undefined'?null:_hwLoading,model:typeof _hardwareModelSnap,saveMessage:document.getElementById('save-msg')?.textContent})).catch(e=>({error:e.message})),new Promise(resolve=>setTimeout(()=>resolve({error:'Renderer did not answer the diagnostic probe'}),2000))]);
       console.error('PCB audit navigation failed',JSON.stringify({engine:engine.name(),packed,route,state,errors}));throw error;
     }
   };
   if(packed)await p.route(/\/(hardware\.html|theme\.js|app\.js|style\.css)(?:\?.*)?$/,r=>{const name=new URL(r.request().url()).pathname.slice(1);return r.fulfill({status:200,contentType:name.endsWith('html')?'text/html':name.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+name+'.gz'))});});
   const initial=await(await p.request.get(base+'/__sim/state')).json();const fixture=latestPcbFixture(initial);
   const restored=await p.request.post(base+'/api/ecu_config',{data:fixture});assert(restored.ok(),await restored.text());await navigate('/hardware.html');
   await p.waitForFunction(expected=>document.querySelector('#hardware-board-summary')?.textContent.includes(expected),source.board.revision);
   assert.ok((await p.locator('#hardware-board-summary').innerText()).includes('OpenTurbine PCB v1.0'));
   await p.waitForFunction(()=>typeof _hardwareModelSnap!=='undefined'&&!!_hardwareModelSnap&&!_hwLoading&&!document.querySelector('main').inert);
   await p.evaluate(async()=>{
     const original=structuredClone(cfg);
     try{
       const start=registryRoot().inputs.findIndex(c=>c.purpose==='start_switch');
       updateRegistryChannel('input',start,'name','Reviewed start switch');await saveHardware();
       if(document.getElementById('save-recap-modal').style.display!=='flex')throw Error('PCB indicator wrongly requires a raw GPIO: '+document.body.innerText.slice(-1200));
       _cancelSaveRecap();
     }finally{cfg=original;renderRegistryInventory();dirty();}
   });
   await p.evaluate(()=>{
     const inputs=registryRoot().inputs,index=inputs.length;
     const c={id:'gpio_transfer',name:'N2 test',purpose:'n2_speed',role:'speed',driver:2,pin:-1,min:0,max:100000,pulses_per_unit:1};inputs.push(c);
     updateRegistryProfilePort('input',index,'analog_3|analog');
     if(c.driver!==9)throw Error('ADC speed assignment failed');
     const html=registryProfilePortEditor('input',c,index);
     if(!html.includes('value="gpio|47"'))throw Error('ADC assignment hid spare digital GPIO');
     updateRegistryProfilePort('input',index,'gpio|47');
     if(c.driver!==2||c.pin!==47||c.physical_port)throw Error('ADC to pulse GPIO did not switch electrical interface');
     updateRegistryProfilePort('input',index,'pulse_in_3|frequency');
     if(!registryProfilePortEditor('input',c,index).includes('value="gpio|47"'))throw Error('IN assignment hid spare GPIO');
     updateRegistryProfilePort('input',index,'analog_3|analog');
     if(!registryProfilePortEditor('input',c,index).includes('value="gpio|47"'))throw Error('Repeated source changes trapped GPIO selector');
     const pressure={id:'analog_only',purpose:'oil_pressure',role:'pressure',driver:9};
     if(pcbGpioHeaderChoices('input',1,pressure).some(g=>g.pin===47))throw Error('Analog-only sensor offered a non-ADC GPIO');
     inputs.splice(index,1);renderRegistryInventory();
     const outputs=registryRoot().outputs, firstPower=outputs.length;
     for(let n=1;n<=6;n++){
       outputs.push({id:'power_claim_'+n,name:'PWM load '+n,purpose:'generic_pwm_output',role:'output',driver:5,pin:-1});
       updateRegistryProfilePort('output',outputs.length-1,'power_out_'+n+'|pwm');
     }
     if(_checkGpioConflicts().length)throw Error('Named power connectors conflict with their own fixed routing');
     const firstPin=outputs[firstPower].pin;
     outputs.push({id:'duplicate_power',name:'Duplicate PWM',purpose:'generic_pwm_output',driver:5,pin:firstPin});
     if(!_checkGpioConflicts().some(c=>c.pin===firstPin))throw Error('Duplicate power pin no longer detected');
     outputs.pop();
     outputs.push({id:'fixed_bus',name:'Invalid bus reuse',purpose:'generic_pwm_output',driver:5,pin:4});
     if(!_checkGpioConflicts().some(c=>c.pin===4))throw Error('Fixed bus pin reuse no longer detected');
     outputs.splice(firstPower);renderRegistryInventory();
     const guide=pcbConnectionGuide();
     if(!guide.includes('5 V signal')||!guide.includes('0–5 V')||!guide.includes('3.3 V logic')||!guide.includes('current rating'))throw Error('Board electrical overview incomplete');
     if(/[âÎ]/.test(guide))throw Error('Board descriptions contain mojibake');
   });
   await p.evaluate(()=>{
     const c={pin:37,driver:5,pwm_freq_hz:20000,pwm_res_bits:14,safe_demand:0};
     const html=registryPwmTimingEditor(c,0);
     if(!html.includes('max="20000"')||!html.includes('5 MHz')||html.includes('PWM resolution (bits)'))throw Error('power timer editor must reflect MCPWM timing');
     if(!registryInvertEditor('output',c,0).includes('Protected complementary'))throw Error('power output must not offer GPIO inversion');
     if(!registryDemandEditor(c,0).includes('Off (fixed by PCB)'))throw Error('power output must not offer unsafe boot demand');
   });
   assert.equal(await p.evaluate(()=>pcbProfile.ports.length),source.ports.length);assert.doesNotMatch(await p.locator('body').innerText(),/Pin conflict:/,'clean PCB preview has no unrelated development-board assignments');
   await p.evaluate(()=>{
    const ports=new Map(pcbProfile.ports.map(p=>[p.id,p]));
    const check=(condition,label)=>{if(!condition)throw Error(label);};
    for(let n=1;n<=8;n++){
      const port=ports.get('analog_'+n),analog=port.modes.find(m=>m.adapter==='i2c_adc_input'),sw=port.modes.find(m=>m.adapter==='i2c_adc_digital_input');
      for(const [purpose,role]of [['oil_pressure','pressure'],['general_voltage','voltage'],['general_temperature','temperature'],['throttle','operator']])check(pcbModeCompatible('input',purpose,role,analog),port.label+' '+purpose);
      for(const purpose of ['digital_switch','chip_detector','diff_press_switch','start_switch','stop_switch'])check(pcbModeCompatible('input',purpose,'digital_switch',sw),port.label+' switch '+purpose);
      check(!pcbModeCompatible('input','n1_speed','speed',sw),'threshold switch is not frequency capture');
      for(const [role,m] of [['pressure',analog],['digital_switch',sw]]){const c={driver:9,role,purpose:role==='pressure'?'oil_pressure':'digital_switch',physical_port:port.id,physical_mode:m.id};const html=registryProfileInputTuningEditor('input',c,0);check(!/type="checkbox"/.test(html)&&html.includes('no switchable pull-up or pull-down'),port.label+' hides unsupported bias for '+role);}
      check(!pcbCompatibleChoices('input','idle','operator').some(choice=>choice.port.id===port.id&&choice.mode.adapter==='i2c_adc_digital_input'),'new idle ADC assignments use analogue mode');
    }
    for(let n=1;n<=6;n++){
      check(ports.get('pulse_out_'+n).label==='OUT '+n+' Connector','5 V signal silkscreen label');check(ports.get('power_out_'+n).label==='PWM '+n+' Connector','VIN output silkscreen label');
      const input=ports.get('pulse_in_'+n);for(const adapter of ['pcnt_input','rc_pwm_input','pwm_duty_input','digital_input'])check(input.modes.some(m=>m.adapter===adapter),input.label+' '+adapter);
      check(pcbModeCompatible('input','throttle','operator',input.modes.find(m=>m.adapter==='pcnt_input')),'frequency throttle');
      check(pcbModeCompatible('input','idle','operator',input.modes.find(m=>m.adapter==='digital_input')),'switch idle');
      for(const m of ports.get('pulse_out_'+n).modes)check(pcbModeCompatible('output','starter','starter',m),'signal output mode '+m.adapter);
      check(ports.get('pulse_out_'+n).modes.length===3,'all signal output waveforms');
      check(!ports.get('power_out_'+n).modes.some(m=>m.adapter==='servo_output'),'load output is not a servo signal');
    }
    const tc=ports.get('thermocouple_1').modes[0];for(const purpose of ['tot','tit','oil_temperature','coolant_temp','intake_temperature','general_temperature'])check(pcbModeCompatible('input',purpose,'temperature',tc),'thermocouple '+purpose);
    check(!pcbModeCompatible('input','oil_pressure','pressure',tc),'thermocouple cannot measure pressure');
    check(!pcbModeCompatible('input','tot','temperature',{adapter:'onewire_temperature'}),'low-temperature saturation cannot become turbine feedback');
   });
   const builtin=p.locator('[data-registry-id="battery_voltage"]');
   assert.equal(await builtin.getByRole('button',{name:'Edit',exact:true}).count(),0);
   assert.equal(await builtin.locator('select[onchange*="purpose"]').isDisabled(),true);
   await p.evaluate(()=>{const c=registryRoot().inputs.find(row=>row.id==='battery_voltage'),before=JSON.stringify(c);updateRegistryChannel('input',registryRoot().inputs.indexOf(c),'purpose','general_pressure');if(JSON.stringify(c)!==before)throw Error('fixed supply monitor was silently repurposed');});
   const output=process.env.OT_PCB_PREVIEW;const shot=async(name,selector)=>{if(!output||engine!==chromium||packed)return;fs.mkdirSync(output,{recursive:true});const style=await p.addStyleTag({content:'.save-bar,body>nav{visibility:hidden!important}'});await p.locator(selector).screenshot({path:path.join(output,name+'.png'),animations:'disabled'});await style.evaluate(el=>el.remove());};
   await shot('01-board-profile','#hardware-board-summary');
   const add=async(purpose,connection,direction='input')=>{
    await p.getByRole('button',{name:'+ Add '+direction,exact:true}).click();
    await p.getByRole('button',{name:purpose}).click();
    await p.getByRole('button',{name:connection}).click();
    return p.locator('#registry-'+direction+'s .registry-card').last();
   };
   // Indicators remain in their normal section; disabling releases the connector.
   assert.equal(await p.locator('#registry-outputs [data-registry-id="status_led"]').count(),0);
   await p.locator('#btn-edit-comms').click();
   const statusCard=p.locator('[data-pcb-indicator="status_led"]');
   assert.equal(await statusCard.count(),1);
   const indicatorsBefore=await p.evaluate(()=>JSON.stringify(registryRoot().outputs));
   await statusCard.getByRole('checkbox').uncheck();
   assert.equal(await p.evaluate(()=>pcbCompatibleChoices('output','warning_indicator','indicator').some(c=>c.port.id==='status_led')),true);
   await statusCard.getByRole('checkbox').check();
   assert.equal(await p.evaluate(()=>JSON.stringify(registryRoot().outputs)),indicatorsBefore,'off/on preserves the original indicator configuration and order');
   await p.evaluate(()=>{const i=registryRoot().outputs.findIndex(c=>c.purpose==='status_led');updateRegistryProfilePort('output',i,'gpio|47');const c=registryRoot().outputs[i];if(c.driver!==4||c.pin!==47||c.physical_port)throw Error('indicator cannot use ordinary GPIO');});
   await statusCard.getByRole('checkbox',{name:'Active HIGH',exact:true}).check();
   const gpioIndicator=await p.evaluate(()=>JSON.stringify(registryRoot().outputs));
   await statusCard.getByRole('checkbox',{name:'Enable Status LED',exact:true}).uncheck();
   await statusCard.getByRole('checkbox',{name:'Enable Status LED',exact:true}).check();
   assert.equal(await p.evaluate(()=>JSON.stringify(registryRoot().outputs)),gpioIndicator,'GPIO indicator off/on preserves connection and polarity');
   await p.evaluate(()=>{const i=registryRoot().outputs.findIndex(c=>c.purpose==='status_led');updateRegistryProfilePort('output',i,'status_led|on_off');if(!pcbGpioHeaderChoices('output',4).find(g=>g.pin===47)?.available)throw Error('indicator did not release GPIO47');});

   assert.equal(await p.evaluate(()=>pcbCompatibleChoices('output','warning_indicator','indicator').some(c=>c.port.id==='status_led')),false);
   // An offline optional LED can be disabled and selected again without
   // loosening availability checks for engine outputs.
   await p.evaluate(()=>{const m=pcbProfile.ports.find(p=>p.id==='fault_led').modes[0];m.available=false;m.status='Fitted I2C device is not responding';renderRegistryInventory();});
   const faultCard=p.locator('[data-pcb-indicator="fault_led"]');
   await faultCard.getByRole('checkbox').uncheck();
   assert.equal(await faultCard.locator('option[value="fault_led|on_off"]').isDisabled(),false);
   await faultCard.locator('select').selectOption('fault_led|on_off');
   assert.equal(await faultCard.getByRole('checkbox').isChecked(),true);
   await p.evaluate(()=>{pcbProfile.ports.find(p=>p.id==='fault_led').modes[0].available=true;renderRegistryInventory();});
   await p.locator('#btn-edit-comms').click();
   await p.getByRole('button',{name:'+ Add output' ,exact:true}).click();
   await p.getByRole('button',{name:/^Oil pump /}).click();
   const connectorLabels=await p.locator('#registry-add-catalog .registry-add-option').allTextContents();
   assert.equal(connectorLabels.filter(t=>/^OUT 1(?:5 V|\s)/.test(t)).length,1,'one choice per connector');
   assert.doesNotMatch(connectorLabels.join(' '),/J34|J35|— Servo|— PWM output/);
   await p.locator('#registry-add-modal').getByRole('button',{name:'Close',exact:true}).click();
   const n1=await add(/^N1 /,/IN 1 Connector/);assert.doesNotMatch(await n1.textContent(),/J28/);assert.equal(await n1.getByText('GPIO pin',{exact:true}).count(),0);await shot('02-n1-connection','#registry-inputs .registry-card:last-child');
   assert.equal(await n1.getByText('PCB input pull-up',{exact:true}).count(),1);assert.equal(await n1.getByRole('checkbox',{name:'Pull-down',exact:true}).count(),0);await n1.getByRole('checkbox',{name:'Enable pull-up',exact:true}).check();assert.equal(await p.evaluate(()=>registryRoot().inputs.find(row=>row.physical_port==='pulse_in_1').pullup),true);
   await p.evaluate(()=>{const i=registryRoot().inputs.findIndex(c=>c.physical_port==='pulse_in_1');updateRegistryProfilePort('input',i,'pulse_in_1|frequency');if(!registryRoot().inputs[i].pullup)throw Error('reselecting connector erased its user pull-up choice');});
   await n1.getByRole('button',{name:'Done',exact:true}).click();
   const tot=await add(/TOT \/ EGT/,/Thermocouple 1/);assert.doesNotMatch(await tot.textContent(),/J43/);assert.equal(await p.evaluate(()=>cfg.channel_registry.inputs.at(-1).temp_interface),3);assert.equal(await tot.locator('select[onchange*="tc_type"]').count(),1);
   const details=tot.locator('details').filter({hasText:'Advanced connection details'});assert.equal(await details.count(),1);assert.equal(await details.getAttribute('open'),null);await details.locator('summary').click();assert.match(await details.innerText(),/Chip select[\s\S]*GPIO 14/);
   await tot.locator('select[onchange*="tc_type"]').selectOption('J');
   assert.equal(await p.evaluate(()=>cfg.channel_registry.inputs.at(-1).tc_type),'J');
   await shot('03-temperature-connection','#registry-inputs .registry-card:last-child');await tot.getByRole('button',{name:'Done',exact:true}).click();
   const oil=await add(/^Oil pressure /,/ADC 1/);assert.doesNotMatch(await oil.textContent(),/J20/);assert.equal(await p.evaluate(()=>cfg.channel_registry.inputs.at(-1).i2c_reference_mv),5000);await shot('04-pressure-connection','#registry-inputs .registry-card:last-child');await oil.getByRole('button',{name:'Done',exact:true}).click();
   const adcSwitch=await add(/^Digital interlock/,/ADC 2/);
   assert.match(await adcSwitch.textContent(),/Switch threshold \(V\)/);
   assert(await adcSwitch.locator('select[onchange*="purpose"] option[value="general_pressure"]').count(),'same ADC connector exposes both switch and analogue purposes');
   assert.equal(await adcSwitch.locator('input[onchange*="digital_threshold_raw"]').getAttribute('max'),'5');
   await shot('08-adc-switch','#registry-inputs .registry-card:last-child');
   await p.evaluate(()=>{
     const index=registryRoot().inputs.length-1,c=registryRoot().inputs[index];
     updateRegistryChannel('input',index,'digital_threshold_raw',4095);
     if(c.digital_hysteresis_raw!==0)throw Error('rail threshold retained an impossible deadband');
     updateRegistryChannel('input',index,'digital_hysteresis_raw',2000);
     if(c.digital_hysteresis_raw!==0)throw Error('out-of-rail deadband accepted');
     updateRegistryChannel('input',index,'digital_threshold_raw',2048);
     updateRegistryChannel('input',index,'digital_hysteresis_raw',64);
     updateRegistryChannel('input',index,'purpose','general_pressure');
     if(c.physical_mode!=='analog'||c.driver!==9||c.i2c_reference_mv!==5000)throw Error('ADC switch could not become an analogue measurement on the same connector');
     updateRegistryChannel('input',index,'purpose','digital_switch');
     if(c.physical_mode!=='switch'||c.driver!==9)throw Error('ADC analogue measurement could not become a switch on the same connector');
     const originalAlert=window.alert,alerts=[];window.alert=message=>alerts.push(message);
     try{
       const before=JSON.stringify(c);
       updateRegistryProfilePort('input',index,'pulse_in_1|switch');
       if(JSON.stringify(c)!==before||!alerts.length)throw Error('another assignment stole an already claimed connector');
       const n1Index=registryRoot().inputs.findIndex(row=>row.physical_port==='pulse_in_1'),n1=registryRoot().inputs[n1Index],n1Before=JSON.stringify(n1);
       updateRegistryChannel('input',n1Index,'purpose','oil_pressure');
       if(JSON.stringify(n1)!==n1Before)throw Error('unsupported function mutated a conditioned digital input');
     }finally{window.alert=originalAlert;}
   });
   await p.locator('#registry-inputs .registry-card').last().getByRole('button',{name:'Done',exact:true}).click();
   const contact=await add(/^Digital interlock/,/IN 2 Connector/);
   assert.equal(await contact.getByText('PCB input pull-up',{exact:true}).count(),1);
   assert.equal(await contact.getByRole('checkbox',{name:'Pull-down',exact:true}).count(),0);
   await contact.getByRole('checkbox',{name:'Enable pull-up',exact:true}).check();
   await p.evaluate(()=>{const i=registryRoot().inputs.findIndex(c=>c.physical_port==='pulse_in_2');updateRegistryChannel('input',i,'pulldown',true);if(!registryRoot().inputs[i].pullup||registryRoot().inputs[i].pulldown)throw Error('conditioned input accepted internal pull-down');});
   await contact.getByRole('button',{name:'Done',exact:true}).click();
   const starter=await add(/^Starter Electric starter/,/OUT 1 Connector/,'output');assert.doesNotMatch(await starter.textContent(),/J34/);assert.match(await starter.textContent(),/5 V signal.*Not a load-power output/);assert.equal(await starter.getByText('GPIO pin',{exact:true}).count(),0);await shot('05-starter-connection','#registry-outputs .registry-card:last-child');await starter.locator('.hw-field').filter({has:p.getByText('Signal type',{exact:true})}).locator('select').selectOption('pulse_out_1|pwm');assert.equal(await p.evaluate(()=>registryRoot().outputs.at(-1).driver),5);await p.evaluate(()=>{
     const c=registryRoot().outputs.at(-1),index=registryRoot().outputs.length-1;
     updateRegistryProfilePort('output',index,'pulse_out_1|pwm');
     if(c.driver!==5||c.min!==0||c.max!==1||!c.pwm_freq_hz)throw Error('servo pulse endpoints leaked into PWM duty mode');
     updateRegistryProfilePort('output',index,'pulse_out_1|on_off');
     if(c.driver!==4||c.min!==0||c.max!==1)throw Error('on/off mode has incorrect electrical endpoints');
     updateRegistryProfilePort('output',index,'pulse_out_1|servo');
     if(c.driver!==6||c.min!==1000||c.max!==2000)throw Error('PWM duty endpoints leaked into servo mode');
   });
   await p.locator('#registry-outputs .registry-card').last().getByRole('button',{name:'Done',exact:true}).click();
   await p.evaluate(()=>{
     const c=registryRoot().outputs.at(-1),index=registryRoot().outputs.length-1;
     updateRegistryProfilePort('output',index,'power_out_1|pwm');
     if(!registryPwmTimingEditor(c,index).includes('Brake — low-side on (default)'))throw Error('default Brake option missing');
     const baseline=structuredClone(c);delete baseline.pwm_zero_mode;
     updateRegistryChannel('output',index,'pwm_zero_mode',1);
     if(c.pwm_zero_mode!==1 || registryStatus(c).kind==='error')throw Error('Coast rejected on power PWM');
     updateRegistryChannel('output',index,'pwm_zero_mode',0);
     if(_registryEffectiveValue('pwm_zero_mode',baseline.pwm_zero_mode)!==_registryEffectiveValue('pwm_zero_mode',c.pwm_zero_mode))throw Error('default Brake revert remains dirty');
     updateRegistryChannel('output',index,'pwm_zero_mode',1);
     updateRegistryProfilePort('output',index,'pulse_out_1|pwm');
     if(c.pwm_zero_mode!==undefined || registryPwmTimingEditor(c,index).includes('At 0% command'))throw Error('Coast leaked onto logic output');
     updateRegistryProfilePort('output',index,'power_out_1|pwm');updateRegistryChannel('output',index,'pwm_zero_mode',1);
     updateRegistryProfilePort('output',index,'power_out_1|on_off');
     if(c.pwm_zero_mode!==undefined)throw Error('Coast leaked onto relay mode');
   });
   await p.locator('#btn-edit-buses').click();assert.equal(await p.locator('#en-i2c').isDisabled(),true);assert.equal(await p.locator('#en-spi').isDisabled(),true);await shot('06-fixed-buses','#hardware-buses-panel');
   await p.locator('#btn-edit-comms').click();assert.equal(await p.locator('#hardware-comms-panel [data-pcb-indicator="status_led"] strong').count(),1);assert.equal(await p.getByText('NeoPixel mode',{exact:true}).count(),0);await shot('07-indicators-and-serial','#hardware-comms-panel');

   assert.equal(await p.getByText('TCA9534 at 0x21',{exact:true}).count(),1);
   assert.equal(await p.getByText('TCA9534 at 0x20',{exact:true}).count(),1);
   assert.equal(await p.getByText('TCA9554 at 0x20',{exact:true}).count(),0);
   assert.equal(await p.locator('#pcb-spi-devices').getByText('DRV8350S - PWM 1-3',{exact:true}).count(),1);
   assert.equal(await p.locator('#pcb-spi-devices').getByText('DRV8350S - PWM 4-6',{exact:true}).count(),1);
   const driverCards=p.locator('#pcb-spi-devices .hw-item-card');
   assert.equal(await driverCards.filter({hasText:'PWM 1-3'}).locator('.registry-status-ok').count(),1);
   assert.equal(await driverCards.filter({hasText:'PWM 4-6'}).locator('.registry-status-error').count(),1);

   await p.evaluate(()=>{
     cfg.mavlink.enabled=false;
     const idle=buildPinOptions(-1,'out');
     if(!idle.includes('UART TX (GPIO 43)'))throw Error('UART pin label missing');
     const dom=new DOMParser().parseFromString('<select>'+idle+'</select>','text/html');
     if(!pcbGpioHeaderChoices('output',4).some(g=>g.pin===43&&g.available))throw Error('UART TX missing from add-output choices');
     if(dom.querySelector('option[value="43"]').disabled)throw Error('Disabled MAVLink still owns UART TX');
     cfg.mavlink.enabled=true;
     const busy=new DOMParser().parseFromString('<select>'+buildPinOptions(-1,'out')+'</select>','text/html');
     if(!busy.querySelector('option[value="43"]').disabled)throw Error('Enabled MAVLink did not reserve UART TX');
     cfg.mavlink.enabled=false;
   });
   await p.getByText('Connection and advanced GPIO settings',{exact:true}).click();
   await p.setViewportSize({width:390,height:844});
   await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await p.locator('#hardware-comms-panel').evaluate(node=>node.scrollWidth>node.clientWidth+1),false,'advanced serial routing fits a phone viewport');

   await p.evaluate(()=>{
     cfg.channel_registry.inputs=cfg.channel_registry.inputs.filter(c=>!['tot','torque'].includes(c.purpose));
     cfg.channel_registry.outputs=cfg.channel_registry.outputs.filter(c=>!String(c.purpose).includes('pump'));
     cfg.mavlink.enabled=false;
     openRegistryAddDialog('input');
     const preset=REGISTRY_INPUT_PRESETS.findIndex(c=>c.purpose==='tot');
     selectRegistryAddPreset(preset);
     selectRegistryBareGpio(preset);
     const i=cfg.channel_registry.inputs.length-1,c=cfg.channel_registry.inputs[i];
     updateRegistryChannel('input',i,'temp_interface',1);
     updateRegistryChannel('input',i,'spi_cs',47);
     if(c.temp_interface!==1||c.spi_cs!==47)throw Error('External MAX6675 configuration failed');
     if(registryStatus(c).kind==='error')throw Error('External thermocouple status: '+registryStatus(c).text);
     if(_checkGpioConflicts().some(row=>[12,13].includes(row.pin)))throw Error('Shared SPI bus conflicts with an external thermocouple');
     if(registryProfilePortEditor('input',c,i))throw Error('External SPI input still requires an onboard connector');
     if(!registryTemperatureInterfaceEditor(c,i).includes('MAX6675 (K-type)'))throw Error('External interface choice missing');
     updateRegistryChannel('input',i,'purpose','general_temperature');
     updateRegistryChannel('input',i,'temp_interface',5);
     updateRegistryProfilePort('input',i,'gpio|47');
     if(c.driver!==1||c.temp_interface!==5||c.pin!==47)throw Error('OneWire GPIO assignment lost its interface');
     if(pcbGpioHeaderDriver('input',c)!==0||registryStatus(c).kind==='error')throw Error('OneWire was restricted to ADC GPIO');

   });
   await p.setViewportSize({width:1280,height:900});
   await p.locator('#btn-edit-buses').click();
   assert.equal(await p.locator('#hardware-buses-summary').getByText('DRV8350S - PWM 1-3',{exact:true}).count(),0);


   // Own the simulated offline interval; a real poll must not overwrite it.
   await p.evaluate(()=>{clearInterval(i2cDiscoveryTimer);i2cDiscoveryTimer=null;});
   await p.waitForFunction(()=>!i2cDiscoveryInFlight);
   await p.evaluate(()=>{
     const port=pcbProfile.ports.find(p=>p.id==='analog_1');
     cfg.channel_registry.inputs=cfg.channel_registry.inputs.filter(c=>c.physical_port!==port.id&&c.purpose!=='torque');
     port.modes.forEach(m=>{m.available=false;m.status='ADC source device is not connected';});
     cfg._i2c_discovery.devices.find(d=>Number(d.address)===16).present=false;
     openRegistryAddDialog('input');
     selectRegistryAddPreset(REGISTRY_INPUT_PRESETS.findIndex(p=>p.purpose==='torque'));
   });
   await p.evaluate(()=>{
     const original=JSON.stringify(cfg);
     try{
       cfg.channel_registry.inputs=cfg.channel_registry.inputs.filter(c=>!['tot','torque'].includes(c.purpose));
       cfg._i2c_discovery.bus_active=false;
       const c={id:'adc_temp_audit',name:'Extra EGT',purpose:'tot',role:'temperature',driver:1,pin:-1,temp_interface:0,min:0,max:4095,analog_zero_mv:500,analog_mv_per_unit:10,analog_divider:1};
       registryRoot().inputs.push(c);const i=registryRoot().inputs.length-1;
       const choice=pcbCompatibleChoices('input','tot','temperature','',c).find(x=>x.port.id==='analog_1');
       if(!choice||!pcbModeSelectable(choice.mode)||choice.mode.available!==false)throw Error('Offline ADC choice lost availability/configurability distinction');
       const html=registryProfilePortEditor('input',c,i);
       const select=new DOMParser().parseFromString(html,'text/html').querySelector('select');
       if(select.querySelector('option[value="'+choice.port.id+'|'+choice.mode.id+'"]').disabled)throw Error('ADC temperature connector is disabled');
       updateRegistryProfilePort('input',i,choice.port.id+'|'+choice.mode.id);
       if(c.driver!==9||c.physical_port!=='analog_1'||registryStatus(c).kind==='error')throw Error('ADC temperature assignment failed');
       registryRoot().inputs.pop();
       const torque={id:'phase_audit',name:'Shaft torque',purpose:'torque',role:'torque',driver:2,pin:-1,phase_pin:-1,torque_interface:2,min:0,max:1,pulses_per_unit:1,phase_pulses_per_unit:1,phase_deg_per_nm:1,phase_speed_source:0};
       registryRoot().inputs.push(torque);
       const pins=new DOMParser().parseFromString('<select>'+buildPinOptions(-1,'in')+'</select>','text/html');
       if(pins.querySelector('option[value="4"]')||pins.querySelector('option[value="12"]')||pins.querySelector('option[value="38"]'))throw Error('Internal/output GPIO leaked into phase picker');
       if(pins.querySelector('option[value="6"]').textContent!=='IN 3 Connector')throw Error('Input connector label missing for torque pickup');
       if(!pins.querySelector('option[value="47"]'))throw Error('Exposed GPIO missing for torque pickup');
       torque.pin=6;
       const second=new DOMParser().parseFromString('<select>'+buildPinOptions(-1,'in')+'</select>','text/html');
       if(!second.querySelector('option[value="6"]').disabled)throw Error('Reference pickup was offered to second pickup');
     }finally{cfg=JSON.parse(original);renderRegistryInventory();}
   });
   const ghost=p.locator('#registry-add-catalog button').filter({hasText:'ADC 1 Connector'}).first();
   assert.equal(await ghost.isEnabled(),true,'known PCB connector remains configurable offline');
   assert.match(await ghost.getAttribute('title'),/TLA2528 unavailable.*not (?:connected|responding)/i);
   assert.equal(await ghost.evaluate(n=>getComputedStyle(n).pointerEvents),'auto');
   await p.evaluate(()=>{
     cfg._i2c_discovery.devices.find(d=>Number(d.address)===16).present=true;
     refreshRegistryDeviceStatuses();
   });
   assert.equal(await ghost.isEnabled(),true,'recovered source becomes selectable without reloading');
   await ghost.click();
   const addedId=await p.evaluate(()=>cfg.channel_registry.inputs.at(-1).id);
   const nameField=p.locator(`[data-registry-direction="input"][data-registry-id="${addedId}"] input[type="text"]`).first();
   await nameField.fill('Edited torque name');
   await nameField.focus();
   const changesBefore=await p.evaluate(()=>JSON.stringify(_buildChanges()));
   let discoveryBody=structuredClone(discovery),discoveryRequests=0;
   await p.route('**/api/i2c_discovery',async route=>{
     discoveryRequests++;
     await new Promise(resolve=>setTimeout(resolve,100));
     await route.fulfill({json:discoveryBody});
   });
   await p.evaluate(()=>Promise.all([refreshBusDeviceStatus(),refreshBusDeviceStatus()]));
   assert.equal(discoveryRequests,1,'slow status requests are serialized');
   discoveryBody={};
   await p.evaluate(()=>refreshBusDeviceStatus());
   assert.equal(await p.evaluate(()=>cfg._i2c_discovery.status_unavailable),true);
   await p.evaluate(id=>{
     const c=registryRoot().inputs.find(c=>c.id===id),curve=c.calibration_points,count=_registrySnap.inputs.length;
     _registrySnap.inputs.push(structuredClone(c));
     c.calibration_points=[{raw:100,value:1}];
     if(registryStatus(c).kind!=='error')throw Error('Unavailable-device warning masked invalid calibration points');
     if(curve===undefined)delete c.calibration_points;else c.calibration_points=curve;
     _registrySnap.inputs.length=count;
   },addedId);
   assert.equal(await nameField.evaluate(node=>document.activeElement===node),true,'status refresh retains field focus');
   assert.equal(await nameField.inputValue(),'Edited torque name');
   assert.equal(await p.evaluate(()=>JSON.stringify(_buildChanges())),changesBefore,'device status does not create configuration edits');
   await p.locator('#btn-edit-buses').click();
   assert.match(await p.locator('#i2c-discovery').innerText(),/status is unavailable/i);
   discoveryBody=structuredClone(discovery);
   await p.evaluate(()=>refreshBusDeviceStatus());
   assert.equal(await p.evaluate(()=>!!cfg._i2c_discovery.status_unavailable),false);
   assert.equal(await nameField.inputValue(),'Edited torque name');
   await p.unroute('**/api/i2c_discovery');
   await navigate('/index.html');
   await p.waitForFunction(()=>typeof renderRegistryOutputCards==='function');
   await p.evaluate(()=>{
     const outputs=[
       {id:'ui_status',purpose:'status_led',name:'Status LED',driver:11,demand:1,available:false},
       {id:'ui_fault',purpose:'fault_led',name:'Fault LED',driver:11,demand:1,available:false},
       {id:'ui_aux_missing',purpose:'generic',name:'Aux',driver:11,demand:1,available:false}
     ];
     renderRegistryOutputCards({pcb_profile_active:true,registry_outputs:outputs});
     if(document.getElementById('registry-output-card-ui_status')||document.getElementById('registry-output-card-ui_fault'))throw Error('LED commands leaked onto Dashboard');
     const card=document.getElementById('registry-output-card-ui_aux_missing');
     if(card?.querySelector('.value').textContent!=='Unavailable'||card.querySelector('.binary-state-active'))throw Error('Missing output device displayed an active command as available');
   });
   await navigate('/tools.html');
   await p.waitForFunction(()=>typeof timedToolBlockReason==='function'&&typeof hwCfg!=='undefined'&&hwCfg?.channel_registry);
   await p.evaluate(()=>{
     toolsTelemetryAvailable=true;engineMode='FAULT';
     liveData={mode:'FAULT',stop_switch_active:false,stop_switch_configured:false,registry_outputs:hwCfg.channel_registry.outputs.map(()=>({available:false}))};
     const tool=TOOLS.find(t=>t.registryOutput);
     if(!tool)throw Error('Indicator test missing');
     if(!timedToolBlockReason(tool,false,false).includes('unavailable'))throw Error('Missing indicator device is still testable');
     refreshTimedToolLockStates();
     if(!document.getElementById('state-'+tool.id).textContent.startsWith('Unavailable'))throw Error('Missing indicator device not explained');
   });
   await navigate('/hardware.html');
   await p.waitForFunction(()=>typeof pcbProfile!=='undefined'&&pcbProfile?.ports?.length>0&&!_hwLoading);
   await p.evaluate(()=>{
     const inputs=registryRoot().inputs,outputs=registryRoot().outputs;
     for(const purpose of ['oil_temperature','coolant_temp']){
       openRegistryAddDialog('input');
       const preset=REGISTRY_INPUT_PRESETS.findIndex(c=>c.purpose===purpose||registryDerivedPurpose('input',c)===purpose);
       selectRegistryAddPreset(preset);
       if(!document.getElementById('registry-add-catalog').textContent.includes('DS18B20 / OneWire'))throw Error('Missing OneWire choice: '+purpose);
       const i=inputs.length;
       selectRegistryExternalSource(preset,'onewire');
       updateRegistryProfilePort('input',i,'gpio|47');
       const c=inputs[i];
       if(c.temp_interface!==5||c.pin!==47||registryStatus(c).kind==='error')throw Error('OneWire setup failed: '+purpose);
       removeRegistryChannel('input',i);
       if(inputs.includes(c)||document.getElementById('registry-remove-modal').style.display==='flex')throw Error('Unreferenced draft removal prompted');
     }
     openRegistryAddDialog('input');
     const thrust=REGISTRY_INPUT_PRESETS.findIndex(c=>c.purpose==='thrust');
     selectRegistryAddPreset(thrust);
     const external=document.getElementById('registry-add-catalog').textContent;
     if(!external.includes('NAU7802 / I2C load cell')||!external.includes('HX711 load cell'))throw Error('External thrust choices missing');
     const thrustIndex=inputs.length;
     selectRegistryExternalSource(thrust,'hx711');
     const hx=inputs[thrustIndex];
     const hxCard=document.querySelector('[data-registry-id="'+hx.id+'"]');
     if(!hxCard.textContent.includes('Digital / HX711')||!hxCard.textContent.includes('HX711 DOUT GPIO')||
        hxCard.querySelector('[data-pcb-source-id]'))throw Error('HX711 card exposed an analog source selector');
     removeRegistryChannel('input',thrustIndex);
     closeRegistryAddDialog();
     outputs.push({id:'glow_main',name:'Glow',purpose:'glow_plug',role:'glow_plug',driver:4,pin:38,physical_port:'pulse_out_1',physical_mode:'on_off'});
     const act=ensureActuatorObject('glow_plug');
     Object.assign(act,{type:2,fuel_type:1,fuel_pin:37,fuel_active_h:true});
     const pwm=pcbWetGlowFuelChoices(1,37),servo=pcbWetGlowFuelChoices(2,37);
     if(!pwm.some(c=>c.pin===37&&c.label==='PWM 1 Connector'&&c.available))throw Error('Wet glow power connector missing: '+JSON.stringify({pwm,pin:GPIO_DB[37],claims:collectPinUsage().get(37)}));
     if(servo.some(c=>c.pin===37))throw Error('Wet glow servo offered on power connector');
     const claimed=pcbCompatibleChoices('output','pilot_fuel','valve').find(c=>c.port.id==='power_out_1');
     if(!claimed||pcbModeSelectable(claimed.mode))throw Error('Wet glow pilot-fuel connector was double-bookable');
   });
   assert.deepEqual(errors,[]);console.log(engine.name(),packed?'packaged':'source','PCB connections, live recovery, unknown status, edit preservation, OneWire and independent driver status passed');
  }finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
