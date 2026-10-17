const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async () => {
  globalThis.OT_UI_SIM_PORT = 12800 + Math.floor(Math.random()*100);
  await import('./ui_mock_server.mjs');
  const base = `http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      localStorage.setItem('ot_theme_onboarded_v1','1');
      localStorage.setItem('ot_beta_notice_ack_v1','1');
      localStorage.setItem('ot_gs_dismissed','1');
    });
    const hw = await (await page.request.get(base+'/api/hardware')).json();
    const renamed = {p1_pressure:'Boost Pressure',p2_pressure:'Jetpipe pressure',oil_pressure:'oil_feed <test>',n1_speed:'Compressor shaft',tot:'Tail temperature',battery_voltage:'ECU supply'};
    hw.channel_registry.inputs.forEach(c=>{c.name=renamed[c.purpose] || 'Input_'+c.id+' <test>';});
    Object.assign(hw.labels,{p1:'Boost Pressure',p2:'Jetpipe pressure'});
    hw.channel_registry.outputs.forEach(c=>{c.name='Output_'+c.id+' <test>';});
    hw.channel_registry.outputs.find(c=>c.purpose==='main_fuel').name='Main Fuel Pump';
    hw.channel_registry.outputs.find(c=>c.purpose==='oil_pump').name='bearing_feed <test>';
    hw.channel_registry.outputs.find(c=>c.purpose==='cooling_fan').name='bench_fan';
    hw.channel_registry.outputs.push({id:'aux_named',name:'my_fuel_valve <test>',purpose:'generic',role:'valve',driver:4,pin:23,min:0,max:1});
    await page.request.post(base+'/api/hardware',{data:hw});
    // The simulator keeps live telemetry separate from saved hardware. Match
    // the full metadata snapshot that real firmware sends after a reboot.
    const model = await (await page.request.get(base+'/__sim/state')).json();
    for (const [collection, direction] of [['registry_inputs','inputs'],['registry_outputs','outputs']]) {
      model.data[collection] = hw.channel_registry[direction].map(channel => ({
        value:0,healthy:true,demand:0,...model.data[collection].find(row=>row.id===channel.id),...channel
      }));
    }
    await page.request.post(base+'/__sim/data',{data:{labels:hw.labels,
      registry_inputs:model.data.registry_inputs,registry_outputs:model.data.registry_outputs}});
    await page.goto(base+'/index.html');
    await page.waitForFunction(()=>document.querySelector('#lbl-oil-output')?.textContent==='bearing_feed <test>');
    assert.equal(await page.locator('[data-output-name="cooling_fan"]').textContent(),'bench_fan');
    assert.equal(await page.locator('#oilpump-current-card [data-output-name="oil_pump"]').textContent(),'bearing_feed <test>');
    assert.equal(await page.locator('#lbl-n1').textContent(),'Compressor shaft RPM');

    await page.goto(base+'/hardware.html');
    await page.waitForSelector('#registry-inputs .hw-item-card');
    assert.ok((await page.locator('#registry-inputs').textContent()).includes('oil_feed <test>'));
    assert.equal(await page.evaluate(()=>registryDisplayName('input',{id:'x',name:'generic_user_pressure',purpose:'p1_pressure'})),'generic_user_pressure');
    assert.equal(await page.evaluate(()=>registryDisplayName('output',{id:'fuel',purpose:'main_fuel',name:'Main Fuel Pump'})),'Main Fuel Pump');
    assert.equal(await page.evaluate(()=>registryDisplayName('output',{id:'fuel',purpose:'main_fuel',name:'Main Fuel Meteri'})),'Main Fuel Meteri');
    const switchEdit=await page.evaluate(()=>{
      cfg.channel_registry.inputs=cfg.channel_registry.inputs.filter(c=>c.purpose!=='start_switch');
      cfg.channel_registry.inputs.push({id:'name_audit_start',purpose:'start_switch',name:'Panel_start <test>',driver:0,pin:22});
      setLabel('start','Renamed_start <test>');
      renderHardwareWorkflowSummaries();
      return {name:cfg.channel_registry.inputs.find(c=>c.id==='name_audit_start').name,
        text:document.getElementById('builtin-inputs').textContent};
    });
    assert.equal(switchEdit.name,'Renamed_start <test>');
    assert.ok(switchEdit.text.includes('Renamed_start <test>'));
    await page.goto(base+'/controllers.html');
    await page.waitForSelector('#controller-overview [data-controller-card]');
    assert.ok((await page.locator('#controller-overview').textContent()).includes('Boost Pressure'));
    assert.ok((await page.locator('#controller-overview').textContent()).includes('Jetpipe pressure'));
    assert.match(await page.locator('#cf-sf_p1d').locator('xpath=ancestor::*[contains(@class,"cfg-field")][1]').locator('.cfg-label').textContent(),/Boost Pressure/);
    assert.match(await page.locator('#cf-sf_p2d').locator('xpath=ancestor::*[contains(@class,"cfg-field")][1]').locator('.cfg-label').textContent(),/Jetpipe pressure/);

    assert.equal(await page.evaluate(()=>controllerChannelName({id:'x',name:'generic_user_pressure',purpose:'p1_pressure'})),'generic_user_pressure');
    for (const [key,value,name] of [['di_src',0,'Compressor shaft'],['di_src',2,'Boost Pressure'],['di_src',3,'Jetpipe pressure'],['eg_src',1,'Tail temperature'],['sf_fs',2,'Compressor shaft'],['rl_ts',2,'Compressor shaft'],['rl_cs',2,'Compressor shaft'],['so_src',0,'Compressor shaft']]) {
      assert.ok((await page.locator(`#cf-${key} option[value="${value}"]`).textContent()).includes(name),key+' omitted fitted name');
    }
    assert.ok((await page.locator('#controller-overview').textContent()).includes('Compressor shaft'));
    await page.evaluate(()=>{
      hwCfg.channel_registry.inputs.find(c=>c.purpose==='n1_speed').name='shaft <test>';
      renderForm(true);
    });
    assert.ok((await page.locator('[data-protection="n1"] .protection-card-title').textContent()).includes('shaft <test>'));
    assert.equal(await page.locator('test').count(),0,'Protection name was interpreted as HTML');
    const reviewName=await page.evaluate(()=>{
      hwCfg.channel_registry.inputs.find(c=>c.purpose==='p1_pressure').name='Boost (left)';
      renderForm(true);
      return _getFieldLabel(document.getElementById('cf-sf_p1d'));
    });
    assert.ok(reviewName.includes('Boost (left)'), 'Save review truncated parentheses in a user name');
    await page.goto(base+'/calibration.html');
    await page.waitForFunction(()=>document.querySelector('#p1-cal-name')?.textContent.includes('Boost Pressure'));
    assert.match(await page.locator('#p2-cal-name').textContent(),/Jetpipe pressure/);
    assert.equal(await page.locator('#oil-press-cal-row .configured-channel-name').textContent(),'oil_feed <test>');
    assert.equal(await page.locator('#oil-h-cal').count(),1,'Calibration health dot was lost');
    assert.match(await page.locator('#oil-press-cal-row .wizard-title').textContent(),/oil_feed <test>/);
    assert.match(await page.locator('#oilpump-current-cal-row .sensor-name').textContent(),/bearing_feed <test>/);

    await page.goto(base+'/sequence.html');
    await page.waitForFunction(()=>typeof hwCfg!=='undefined' && !!hwCfg?.channel_registry);
    assert.equal(await page.evaluate(()=>registryLabel({id:'x',name:'generic_user_pressure'},'Input')),'generic_user_pressure');
    await page.evaluate(()=>openCustomBlockDialog('startup'));
    await page.locator('#cblk-type').selectOption('while');
    for (const [key,name] of Object.entries({oil_press:'oil_feed <test>',n1_rpm:'Compressor shaft',tot:'Tail temperature',batt_voltage:'ECU supply',p1:'Boost Pressure',p2:'Jetpipe pressure'})) {
      assert.equal(await page.locator(`#cblk-cond-sensor option[value="${key}"]`).textContent(),name);
      await page.locator('#cblk-cond-sensor').selectOption(key);
      assert.ok((await page.locator('#cblk-cond-preview').textContent()).includes(name));
    }
    await page.evaluate(()=>addCustomStep('set_act'));
    assert.equal(await page.locator('#cblk-outputs option').filter({hasText:'bearing_feed <test>'}).count(),1);
    const summaries = await page.evaluate(()=>{
      const sensor=getEnabledSensors().find(s=>s.key==='oil_press');
      const output=getEnabledActuators().find(a=>a.key==='oil_pump');
      const block=buildRuntimeBlockDef('audit',{type:'while',condition:{sensor:'tot',source:sensor.source,op:'>',value:2},steps:[{act:'starter',target:output.target,val:50}]});
      const missing=buildRuntimeBlockDef('missing',{type:'while',condition:{sensor:'tot',source:'removed_input',op:'>',value:2},steps:[{act:'starter',target:'removed_output',val:50}]});
      return {condition:block.condition(),desc:block.desc,missing:missing.condition()+missing.desc};
    });
    assert.match(summaries.condition,/oil_feed <test>/);
    assert.match(summaries.desc,/bearing_feed <test>/);
    assert.match(summaries.missing,/Missing input: removed_input/);
    assert.match(summaries.missing,/Missing output: removed_output/);
    assert.equal(await page.locator('test').count(),0,'Custom step name was interpreted as HTML');
    await page.evaluate(()=>closeCustomBlockDialog());
    const channelLists = await page.evaluate(()=>({sensors:getEnabledSensors(),outputs:getEnabledActuators()}));
    for(const sensor of channelLists.sensors.filter(s=>s.source))
      assert.equal(sensor.label,hw.channel_registry.inputs.find(c=>c.id===sensor.source).name,'Sensor '+sensor.key);
    for(const output of channelLists.outputs.filter(s=>s.target))
      assert.equal(output.label,hw.channel_registry.outputs.find(c=>c.id===output.target).name,'Output '+output.key);
    const legacyNames=await page.evaluate(()=>{
      hwCfg.di_channels=[{pin:22,label:'Door_switch <test>'}];
      return {label:sequenceDigitalInputLabel(0),condition:BLOCKS.StarterSpin.condition({pre_ign_rpm:123}),
        check:sequenceParamLabel({key:'final_check_p1_bar',label:'Minimum accepted P1'})};
    });
    const waitCard = await page.evaluate(()=>{
      hwCfg[seqKey('startup')]=['WaitForInput'];
      hwCfg[waitInputSeqKey('startup')]=[{channel:0,active:true,timeout_ms:5000}];
      const card=buildCard('WaitForInput',0,'startup');
      return {text:card.textContent,options:[...card.querySelectorAll('option')].map(o=>o.textContent),html:card.querySelector('test')!==null};
    });
    assert.ok(waitCard.text.includes('Door_switch <test>'));
    assert.ok(waitCard.options.some(t=>t.includes('Door_switch <test>')));
    assert.equal(waitCard.html,false);
    assert.equal(legacyNames.label,'Door_switch <test>');
    assert.match(legacyNames.condition,/Compressor shaft/);
    assert.match(legacyNames.check,/Boost Pressure/);
    await page.goto(base+'/tools.html');
    await page.waitForSelector('#card-OIL_PRIME');
    assert.match(await page.locator('#card-OIL_PRIME .tool-desc').textContent(),/bearing_feed <test>/);
    assert.equal(await page.getByText('my_fuel_valve <test> Test',{exact:true}).count(),1);
    assert.equal(await page.evaluate(()=>registryToolDisplayName({id:'x',name:'my_fuel_valve'},0)),'my_fuel_valve');
    assert.equal(await page.locator('test').count(),0,'A display name was interpreted as HTML');
    await page.goto(base+'/log.html');
    await page.locator('#tab-session').click();
    await page.waitForFunction(()=>document.querySelector('#chart-lbl-p1 span')?.textContent.includes('Boost Pressure'));
    assert.match(await page.locator('#chart-lbl-p2 span').textContent(),/Jetpipe pressure/);
    await page.waitForFunction(()=>document.querySelector('#chart-lbl-n1 > span')?.textContent.includes('Compressor shaft'));
    assert.match(await page.locator('#chart-lbl-tot > span').textContent(),/Tail temperature/);
    assert.equal(await page.locator('#chart-lbl-tot .chart-tunit').count(),1);
    assert.match(await page.locator('[data-bit="batt"]').locator('..').textContent(),/ECU supply/);

    assert.deepEqual(errors,[]);
    console.log('Channel names passed: Hardware, Controllers, Calibration, Sequence, Tools and Log preserve user text, including underscores/lowercase/HTML characters; pressure headings, chart legends and tool targets identify the fitted channels.');
  } finally {await browser.close();}
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
