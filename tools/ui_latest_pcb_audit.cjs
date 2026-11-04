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
   if(packed)await p.route(/\/(hardware\.html|theme\.js|app\.js|style\.css)(?:\?.*)?$/,r=>{const name=new URL(r.request().url()).pathname.slice(1);return r.fulfill({status:200,contentType:name.endsWith('html')?'text/html':name.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+name+'.gz'))});});
   const initial=await(await p.request.get(base+'/__sim/state')).json();const fixture=latestPcbFixture(initial);
   const restored=await p.request.post(base+'/api/ecu_config',{data:fixture});assert(restored.ok(),await restored.text());await p.goto(base+'/hardware.html');
   await p.waitForFunction(expected=>document.querySelector('#hardware-board-summary')?.textContent.includes(expected),source.board.revision);
   assert.ok((await p.locator('#hardware-board-summary').innerText()).includes('OpenTurbine PCB v1.0'));
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
      check(!pcbCompatibleChoices('input','idle','operator').some(choice=>choice.port.id===port.id&&choice.mode.adapter==='i2c_adc_digital_input'),'new idle ADC assignments use analogue mode');
    }
    for(let n=1;n<=6;n++){
      check(ports.get('pulse_out_'+n).label==='OUT '+n,'5 V signal silkscreen label');check(ports.get('power_out_'+n).label==='PWM '+n,'VIN output silkscreen label');
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
   const n1=await add(/^N1 /,/Input 1/);assert.doesNotMatch(await n1.textContent(),/J28/);assert.equal(await n1.getByText('GPIO pin',{exact:true}).count(),0);await shot('02-n1-connection','#registry-inputs .registry-card:last-child');
   assert.equal(await n1.getByText('PCB input pull-up',{exact:true}).count(),1);assert.equal(await n1.getByRole('checkbox',{name:'Pull-down',exact:true}).count(),0);await n1.getByRole('checkbox',{name:'Enable pull-up',exact:true}).check();assert.equal(await p.evaluate(()=>registryRoot().inputs.find(row=>row.physical_port==='pulse_in_1').pullup),true);
   await n1.getByRole('button',{name:'Done',exact:true}).click();
   const tot=await add(/TOT \/ EGT/,/Thermocouple 1/);assert.doesNotMatch(await tot.textContent(),/J43/);assert.equal(await p.evaluate(()=>cfg.channel_registry.inputs.at(-1).temp_interface),3);assert.equal(await tot.locator('select[onchange*="tc_type"]').count(),1);
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
   const contact=await add(/^Digital interlock/,/Input 2/);
   assert.equal(await contact.getByText('PCB input pull-up',{exact:true}).count(),1);
   assert.equal(await contact.getByRole('checkbox',{name:'Pull-down',exact:true}).count(),0);
   await contact.getByRole('checkbox',{name:'Enable pull-up',exact:true}).check();
   await p.evaluate(()=>{const i=registryRoot().inputs.findIndex(c=>c.physical_port==='pulse_in_2');updateRegistryChannel('input',i,'pulldown',true);if(!registryRoot().inputs[i].pullup||registryRoot().inputs[i].pulldown)throw Error('conditioned input accepted internal pull-down');});
   await contact.getByRole('button',{name:'Done',exact:true}).click();
   const starter=await add(/^Starter Electric starter/,'OUT 1','output');assert.doesNotMatch(await starter.textContent(),/J34/);assert.match(await starter.textContent(),/5 V signal.*Not a load-power output/);assert.equal(await starter.getByText('GPIO pin',{exact:true}).count(),0);await shot('05-starter-connection','#registry-outputs .registry-card:last-child');await starter.locator('.hw-field').filter({has:p.getByText('Signal type',{exact:true})}).locator('select').selectOption('pulse_out_1|pwm');assert.equal(await p.evaluate(()=>registryRoot().outputs.at(-1).driver),5);await p.evaluate(()=>{
     const c=registryRoot().outputs.at(-1),index=registryRoot().outputs.length-1;
     updateRegistryProfilePort('output',index,'pulse_out_1|pwm');
     if(c.driver!==5||c.min!==0||c.max!==1||!c.pwm_freq_hz)throw Error('servo pulse endpoints leaked into PWM duty mode');
     updateRegistryProfilePort('output',index,'pulse_out_1|on_off');
     if(c.driver!==4||c.min!==0||c.max!==1)throw Error('on/off mode has incorrect electrical endpoints');
     updateRegistryProfilePort('output',index,'pulse_out_1|servo');
     if(c.driver!==6||c.min!==1000||c.max!==2000)throw Error('PWM duty endpoints leaked into servo mode');
   });
   await p.locator('#registry-outputs .registry-card').last().getByRole('button',{name:'Done',exact:true}).click();
   await p.locator('#btn-edit-buses').click();assert.equal(await p.locator('#en-i2c').isDisabled(),true);assert.equal(await p.locator('#en-spi').isDisabled(),true);await shot('06-fixed-buses','#hardware-buses-panel');
   await p.locator('#btn-edit-comms').click();assert.equal(await p.locator('#hardware-comms-panel [data-pcb-indicator="status_led"] strong').count(),1);assert.equal(await p.getByText('NeoPixel mode',{exact:true}).count(),0);await shot('07-indicators-and-serial','#hardware-comms-panel');
   assert.deepEqual(errors,[]);console.log(engine.name(),packed?'packaged':'source','latest PCB catalogue, labelled inputs/outputs, fixed buses, indicators and serial passed');
  }finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
