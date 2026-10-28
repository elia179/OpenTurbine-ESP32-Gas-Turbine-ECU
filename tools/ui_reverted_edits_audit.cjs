// Exercise reverted edits without saving: save state and recap must agree.
const assert=require('node:assert/strict');
const {chromium,firefox,webkit}=require('playwright');
const fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {guidedFixture}=require('./guided_build_fixture.cjs');
(async()=>{
 globalThis.OT_UI_SIM_PORT=14941;await import('./ui_mock_server.mjs');
 const base='http://127.0.0.1:14941';
 const initial=await(await fetch(base+'/__sim/state')).json();
 await fetch(base+'/api/ecu_config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(guidedFixture(initial,1))});
 await fetch(base+'/__sim/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'STANDBY',config_locked:false})});
 for(const engine of [chromium,firefox,webkit]){
 const browser=await engine.launch();
 try{
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  if(process.env.OT_UI_PACKAGED==='1')await p.route(/\/(system\.html|controllers\.html|hardware\.html|sequence\.html|calibration\.html|theme\.js|app\.js|style\.css)(?:\?.*)?$/,r=>{
   const n=new URL(r.request().url()).pathname.slice(1);
   return r.fulfill({status:200,contentType:n.endsWith('html')?'text/html':n.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+n+'.gz'))});
  });
  await p.goto('http://127.0.0.1:14941/system.html');
  await p.locator('#system-maintenance').waitFor();
  for(const path of ['cluster_serial.enabled','mavlink.enabled','profile_desc','cluster_serial.baud','mavlink.interval_ms']){
   const result=await p.evaluate(path=>{
    const before=getPath(hwCfg,path.split('.'));
    const value=typeof before==='boolean'?!before:typeof before==='number'?before+50:'temporary';
    setSystemHardware(path,value);
    const dirty=_cfgDirty&&_buildChanges().length>0;
    setSystemHardware(path,before);
    return {dirty,clean:!_cfgDirty,changes:_buildChanges(),save:document.querySelector('#btn-save').disabled,bar:document.querySelector('.save-bar').classList.contains('is-dirty')};
   },path);
   assert.ok(result.dirty,path);assert.ok(result.clean&&result.save&&!result.bar,path);assert.deepEqual(result.changes,[],path);
  }
  await p.evaluate(()=>{
   delete hwCfg.cluster_serial.enabled;_clearDirty();
   setSystemHardware('cluster_serial.enabled',true);setSystemHardware('cluster_serial.enabled',false);
   if(_cfgDirty||_buildChanges().length)throw Error('legacy omitted disabled default retained dirty');
  });
  await p.goto('http://127.0.0.1:14941/controllers.html');await p.locator('[data-group="safety"]').waitFor();
  await p.waitForFunction(()=>Object.keys(_fieldSnap).length>20);
  await p.waitForFunction(()=>!isLocked);
  const fields=await p.evaluate(()=>{
   let count=0;
   for(const el of document.querySelectorAll('input[id^="cf-"],select[id^="cf-"]')){
    if(!(el.id in _fieldSnap)||['cf-fi_input','cf-fi_low','cf-fi_high'].includes(el.id))continue;
    const before=el.type==='checkbox'?el.checked:el.value;
    if(el.type==='checkbox')el.checked=!before;
    else if(el.tagName==='SELECT'){
     const other=[...el.options].find(o=>o.value!==before&&!o.disabled);if(!other)continue;el.value=other.value;
    }else if(el.type==='number')el.value=String(Number(before)+1);else continue;
    _markDirty();if(!_cfgDirty)throw Error(el.id+' failed to mark edited');
    if(el.type==='checkbox')el.checked=before;else el.value=before;
    _markDirty();if(_cfgDirty||_buildChanges().length)throw Error(el.id+' remained dirty after reverting');count++;
   }
   const section=Object.keys(hwCfg.safety||{})[0];
   if(section){const before=hwCfg.safety[section];_controllerHardwareDirty=true;hwCfg.safety[section]=!before;_markDirty();hwCfg.safety[section]=before;_markDirty();if(_cfgDirty)throw Error('safety retained dirty state');}
   const rule=cfg.rules[0];if(!rule)throw Error('missing fixture controller');
   const name=rule.name;rule.name+=' edited';_controllerRulesDirty=true;_markDirty();if(!_cfgDirty)throw Error('controller edit missed');
   rule.name=name;_controllerRulesDirty=true;_markDirty();if(_cfgDirty)throw Error('controller revert retained dirty');
   const added=JSON.parse(JSON.stringify(rule));added.name='Temporary controller';cfg.rules.push(added);_controllerRulesDirty=true;_markDirty();
   cfg.rules.pop();_controllerRulesDirty=true;_markDirty();if(_cfgDirty)throw Error('create/remove retained dirty');
   return count;
  });assert.ok(fields>10,'fitted controller fields exercised: '+fields);
  await p.goto('http://127.0.0.1:14941/hardware.html');await p.locator('#hardware-comms-summary .hw-item-card').first().waitFor();
  await p.waitForFunction(()=>!!_hardwareModelSnap);
  await p.evaluate(()=>{
   const before=cfg.profile_desc;
   cfg.profile_desc='temporary';dirty();if(!_hwDirty)throw Error('hardware edit not detected');
   cfg.profile_desc=before;dirty();if(_hwDirty||!document.querySelector('#btn-save').disabled)throw Error('hardware revert retained dirty');
   const registry=registryRoot();const row=JSON.parse(JSON.stringify(registry.inputs[0]));
   registry.inputs[0].name+=' test';dirty();if(!_hwDirty)throw Error('registry edit not detected');
   registry.inputs[0]=row;dirty();if(_hwDirty)throw Error('registry revert retained dirty');
   cfg._i2c_discovery={devices:[],updated:Date.now()};dirty();if(_hwDirty)throw Error('discovery is not a configuration edit');
   delete cfg.cluster_serial.enabled;_snapshotFields();
   cfg.cluster_serial.enabled=true;dirty();cfg.cluster_serial.enabled=false;dirty();
   if(_hwDirty)throw Error('legacy hardware enable default retained dirty');
  });
  await p.goto('http://127.0.0.1:14941/sequence.html');await p.locator('#list-startup .block-card').first().waitFor();
  await p.evaluate(()=>{
   const before=hwCfg.startup_delay_ms[0];
   hwCfg.startup_delay_ms[0]=Number(before||0)+1000;markSequenceDirty();if(!_seqDirty)throw Error('sequence edit not detected');
   hwCfg.startup_delay_ms[0]=before;markSequenceDirty();if(_seqDirty||!document.querySelector('#save-btn').disabled)throw Error('sequence revert retained dirty');
  });
  await p.goto('http://127.0.0.1:14941/calibration.html');
  await p.waitForFunction(()=>!!cfg.hardware&&!!cfg.engine);
  const writes=[];p.on('request',r=>{if(['POST','PATCH'].includes(r.method()))writes.push(r.url());});
  await p.evaluate(async()=>{
   window.alert=()=>{};
   await new Promise(resolve=>patchHardware({platform:cfg.hardware.platform},resolve));
   await new Promise(resolve=>patchConfig({engine:{rpm_limit:cfg.engine.rpm_limit}},'test',resolve));
  });
  assert.deepEqual(writes,[],'identical calibration must not write');
  assert.deepEqual(errors,[]);console.log(engine.name()+': reverted edits passed: System, '+fields+' Controller fields, rules, Hardware/registry, Sequence, calibration no-op writes.');
 }finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
