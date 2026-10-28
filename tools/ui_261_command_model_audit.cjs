const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
const {guidedFixture}=require('./guided_build_fixture.cjs');
(async()=>{
 globalThis.OT_UI_SIM_PORT=14821;await import('./ui_mock_server.mjs');
 const base='http://127.0.0.1:14821';
 for(const engine of [chromium,firefox,webkit])for(const packed of [false,true]){
  const browser=await engine.launch();
  try{
   const p=await browser.newPage({viewport:{width:1024,height:600}}),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   if(packed)await p.route(/\/(sequence\.html|app\.js|theme\.js|style\.css)(?:\?.*)?$/,r=>{
    const n=new URL(r.request().url()).pathname.slice(1);
    return r.fulfill({status:200,contentType:n.endsWith('html')?'text/html':n.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+n+'.gz'))});
   });
   await p.request.post(base+'/__sim/reset');
   const initial=await(await p.request.get(base+'/__sim/state')).json();
   await p.request.post(base+'/api/ecu_config',{data:guidedFixture(initial,1)});
   await p.goto(base+'/sequence.html');await p.waitForFunction(()=>typeof resolveSequenceActions==='function'&&hwCfg.channel_registry&&cfg.throttle&&cfg.sequence);
   const result=await p.evaluate(()=>{
    const outputs=hwCfg.channel_registry.outputs,main=registryOutputPurpose('main_fuel');
    outputs.push({id:'scavenge_extra',name:'Return Oil Pump',purpose:'scavenge_pump',role:'scavenge_pump',driver:4,pin:39,installed:true});
    outputs.push({id:'ab_spark_extra',name:'Tailpipe Spark',purpose:'ab_igniter',role:'ab_igniter',driver:4,pin:40,installed:true});
    outputs.push({...main,id:'fuel_follower',name:'Linked Fuel Drive',purpose:'generic',mirror_of:main.id});
    outputs.push({id:'unwired_spark',name:'Unwired Igniter',purpose:'igniter',driver:4,pin:-1,installed:true});
    cfg.afterburner={...cfg.afterburner,use_torch:false,use_igniter:true};
    cfg.throttle={...cfg.throttle,fuel_pump_min_pct:12,idle_max_pct:38};
    paramVals['OilPrime.oil_prime_use_scavenge']=true;
    paramVals['ModifiedIdle.modified_idle_multiplier']=1.5;
    paramVals['FuelPumpIdle.fp_idle_max_pct']=99; // obsolete/stale per-card value must not override the shared setting
    const simplify=rows=>rows.map(r=>({target:r.meta.target,value:r.value,phase:r.phase,label:r.meta.label,note:r.note}));
    const ab=resolveSequenceActions('afterburner',['ABIgnite','ABFlameConfirm']).map(simplify);
    const oil=resolveSequenceActions('startup',['OilPrime']).map(simplify);
    const cut=resolveSequenceActions('shutdown',['ImmediateCut']).map(simplify);
    const idle=resolveSequenceActions('startup',['FuelPumpIdle','ModifiedIdle']).map(simplify);
    const spool=resolveSequenceActions('startup',['Spool']).map(simplify);
    hwCfg.ab_seq=['ABIgnite','ABFlameConfirm'];
    const igniteHtml=buildResolvedActionsHtml('ABIgnite',0,'afterburner');
    const confirmHtml=buildResolvedActionsHtml('ABFlameConfirm',1,'afterburner');
    const recap=buildFinalStateCard('afterburner',hwCfg.ab_seq,0)?.textContent;
    return {ab,oil,idle,spool,cut,igniteHtml,confirmHtml,recap};
   });
   assert.ok(!result.cut[0].some(r=>r.target==='unwired_spark'),'unassigned channels are not fitted outputs');
   assert.ok(result.ab[0].some(r=>r.target==='ab_spark_extra'&&r.value===1));
   assert.ok(!result.ab[0].some(r=>r.target==='ab_spark_extra'&&r.value===0),'AB ignition must carry into confirmation');
   assert.ok(result.ab[1].some(r=>r.target==='ab_spark_extra'&&r.value===0&&r.phase==='exit'));
   assert.ok(result.igniteHtml.includes('Tailpipe Spark')&&result.igniteHtml.includes('ON'));
   assert.ok(result.confirmHtml.includes('Tailpipe Spark')&&result.confirmHtml.includes('OFF'));
   assert.ok(result.oil[0].some(r=>r.target==='scavenge_extra'&&r.value===1));
   assert.ok(result.oil[0].some(r=>r.target==='scavenge_extra'&&r.value===0&&r.phase==='exit'));
   assert.ok(result.idle[0].some(r=>r.value==='38% (fixed)'),'fixed idle uses shared limit');
   assert.ok(result.idle[1].some(r=>r.value==='12% (fixed) × 1.5'),'raised idle without input starts at minimum');
   assert.ok(result.spool[0].some(r=>r.target==='fuel_follower'&&r.value===.12&&r.note.includes('Follows')));
   assert.deepEqual(errors,[]);
   console.log(engine.name(),packed?'gzip':'source','AB ignition carry/release, oil scavenge release, shared idle ceiling, raised-idle minimum and linked commands passed');
  }finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
