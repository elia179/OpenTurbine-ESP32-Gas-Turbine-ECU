const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
const {latestPcbFixture,discovery}=require('./latest_pcb_fixture.cjs');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15700+Math.floor(Math.random()*100);
 globalThis.OT_UI_SIM_I2C_DISCOVERY={...discovery,devices:[],pcb_devices:[],bus_active:false};
 await import('./ui_mock_server.mjs');const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 for(const engine of [chromium,firefox,webkit]){
  const browser=await engine.launch();try{for(const packed of [false,true]){
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   if(packed)await page.route(/\/(hardware\.html|app\.js|style\.css|theme\.js)(?:\?.*)?$/,r=>{
    const name=new URL(r.request().url()).pathname.slice(1);
    return r.fulfill({status:200,contentType:name.endsWith('.html')?'text/html':name.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+name+'.gz'))});
   });
   for(const pcb of [false,true]){
    await page.request.post(base+'/__sim/reset');
    if(pcb){const initial=await(await page.request.get(base+'/__sim/state')).json();await page.request.post(base+'/api/ecu_config',{data:latestPcbFixture(initial)});}
    await page.goto(base+'/hardware.html');
    await page.waitForFunction(()=>typeof _hwLoading!=='undefined'&&!_hwLoading&&typeof cfg==='object'&&!!cfg.channel_registry);
    const counts=await page.evaluate(()=>{
     const original=structuredClone(cfg),counts={input:0,output:0};
     for(const direction of ['input','output']){
      const presets=direction==='input'?REGISTRY_INPUT_PRESETS:REGISTRY_OUTPUT_PRESETS;
      for(let index=0;index<presets.length;index++){
       cfg=structuredClone(original);cfg.i2c.enabled=false;cfg.spi.enabled=false;
       cfg.channel_registry={version:2,inputs:[],outputs:[],bindings:[],input_capacity:32,output_capacity:32};
       openRegistryAddDialog(direction);selectRegistryAddPreset(index);
       if(pcbProfileActive()){
        const draft=[...document.querySelectorAll('#registry-add-catalog button')].find(b=>b.textContent.startsWith('Add unassigned card'));
        if(!draft||draft.disabled)throw Error('No draft path for '+presets[index].label);
        draft.click();
       }
       const rows=registryRoot()[direction+'s'];
       if(rows.length!==1)throw Error('Could not add '+presets[index].label+' without buses');
       if(!document.querySelector('[data-registry-id="'+rows[0].id+'"]'))throw Error('Draft card not rendered: '+presets[index].label);
       if(!registryFixedProfileFunction(direction,rows[0])&&!document.getElementById('btn-save').disabled)throw Error('Unassigned draft can be saved: '+presets[index].label);
       counts[direction]++;
      }
     }
     cfg=structuredClone(original);cfg.i2c.enabled=false;cfg.spi.enabled=false;
     cfg.channel_registry={version:2,inputs:[],outputs:[],bindings:[]};
     openRegistryAddDialog('input');selectRegistryAddPreset(REGISTRY_INPUT_PRESETS.findIndex(p=>p.purpose==='thrust'));
     if(pcbProfileActive())selectRegistryBareGpio(REGISTRY_INPUT_PRESETS.findIndex(p=>p.purpose==='thrust'));
     const thrust=registryRoot().inputs[0];
     if(thrust.driver!==1||thrust.torque_interface)throw Error('Thrust must start with an ADC draft');
     updateRegistryTorqueSensorType(0,'hx711');
     if(thrust.driver!==1||thrust.torque_interface!==1)throw Error('HX thrust requires no bus');
     updateRegistryTorqueSensorType(0,'adc');
     if(thrust.driver!==1||thrust.torque_interface!==0)throw Error('Cannot return thrust to ADC');
     return counts;
    });
    assert.deepEqual(errors,[]);console.log(`${engine.name()} ${packed?'gzip':'source'} ${pcb?'PCB':'bare'}: ${counts.input} input and ${counts.output} output drafts open without buses; incomplete save blocked; thrust ADC/HX switching passed`);
   }
   await page.close();
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
