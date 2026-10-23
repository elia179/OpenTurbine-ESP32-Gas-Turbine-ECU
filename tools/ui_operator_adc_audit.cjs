const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=16900+Math.floor(Math.random()*60);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`;
 for(const engine of [chromium,firefox,webkit]){
  const browser=await engine.launch({headless:true});
  try{for(const gzip of [false,true]){
   const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(calibration\.html|app\.js|style\.css)(?:\?.*)?$/,r=>{
    const name=new URL(r.request().url()).pathname.slice(1);
    return r.fulfill({status:200,contentType:name.endsWith('html')?'text/html':name.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+name+'.gz'))});
   });
   await p.goto(base+'/calibration.html');await p.waitForFunction(()=>cfg?.hardware&&typeof operatorAdcRaw==='function');
   const result=await p.evaluate(async()=>{
    cfg.hardware.channel_registry={inputs:[{id:'pot_th',purpose:'throttle',role:'operator',driver:1,installed:true},{id:'pot_idle',purpose:'idle',role:'operator',driver:1,installed:true}]};
    const d={throttle_input_raw:157,idle_input_raw:157,registry_inputs:[{id:'pot_th',raw:4095,healthy:false},{id:'pot_idle',raw:0,healthy:false}]};
    window.applyData({...live,...d,throttle_input_type:'adc',idle_input_type:'adc'});
    const rendered=[document.getElementById('cal-th-raw').textContent,document.getElementById('cal-idle-raw').textContent];
    const physical=[operatorAdcRaw(d,'throttle'),operatorAdcRaw(d,'idle')];
    nextCalibrationFrame=async()=>{await new Promise(r=>setTimeout(r,30));return d;};calibrationConnected=()=>true;
    const captured=[await _captureInputAverage('throttle_input_raw'),await _captureInputAverage('idle_input_raw')];
    let sent;
    patchHardwareThenConfig=(hw,local,settings)=>{sent={hw,settings};};
    throttleInputType='adc';thMin=0;thMax=4095;saveThrottle();
    const initialSent=sent, cases=[];
    for(const purpose of ['throttle','idle'])for(const type of ['adc','servo'])for(const reversed of [false,true]) {
      const a=type==='adc'?0:1000,b=type==='adc'?4095:2000;
      const minimum=reversed?b:a,maximum=reversed?a:b;
      cfg.calibration={[purpose+'_min_raw']:minimum,[purpose+'_max_raw']:maximum};
      cfg.hardware.channel_registry.inputs.forEach(c=>c.driver=type==='adc'?1:3);
      const frame={...live,throttle_input_type:type,idle_input_type:type,rc_throttle_valid:true,rc_idle_valid:true};
      window.applyData(frame); // settle input-type changes before staging endpoints
      thMin=thMax=idleMin=idleMax=null;
      const shown=[];
      for(const sample of [minimum,(a+b)/2,maximum]){
        const value=Math.round(sample);
        const data={...frame,throttle_input_us:value,idle_input_us:value,registry_inputs:cfg.hardware.channel_registry.inputs.map(c=>({id:c.id,raw:value,healthy:true}))};
        window.applyData(data);
        const prefix=purpose==='throttle'?'th':'idle';
        shown.push([parseFloat(document.getElementById('bar-'+prefix).style.width),document.getElementById('cal-'+prefix+'-pct').textContent]);
      }
      if(purpose==='throttle'){thMin=minimum;thMax=maximum;throttleInputType=type;saveThrottle();}
      else{idleMin=minimum;idleMax=maximum;idleInputType=type;saveIdle();}
      cases.push({purpose,type,reversed,shown,patch:sent});
    }
    sent=initialSent;
    cfg.hardware.channel_registry.inputs.forEach(c=>c.driver=1);
    cfg.hardware.channel_registry.inputs.unshift({id:'retired',purpose:'throttle',driver:1,installed:false});
    const retiredSkipped=operatorAdcRaw(d,'throttle')===4095;
    const missing=Number.isNaN(operatorAdcRaw({throttle_input_raw:157},'throttle'));
    return {retiredSkipped,cases,rendered,physical,captured,sent,missing,badPercent:operatorPercent(NaN,0,4095),equalPercent:operatorPercent(5,5,5),normalPercent:operatorPercent(2048,82,4054)};
   });
   assert.deepEqual(result.rendered,['3300 mV','0 mV']);assert.deepEqual(result.physical,[4095,0]);assert.deepEqual(result.captured,[4095,0]);
   assert.equal(result.sent.settings.calibration.throttle_min_raw,82);assert.equal(result.sent.settings.calibration.throttle_max_raw,4054);
   assert.equal(result.sent.hw.channel_registry_calibration.min,82);assert.equal(result.sent.hw.channel_registry_calibration.max,4054);
   assert.ok(result.retiredSkipped);
   for(const c of result.cases){
    assert.deepEqual(c.shown.map(v=>Math.round(v[0])),[0,50,100],JSON.stringify(c));
    assert.deepEqual(c.shown.map(v=>v[1]),['0%','50%','100%'],JSON.stringify(c));
    const fields=c.patch.hw.channel_registry_calibration;
    assert.ok(fields.min<fields.max);assert.equal(fields.invert,c.reversed);
    const cal=c.patch.settings.calibration;
    assert.equal(cal[c.purpose+'_min_raw']>cal[c.purpose+'_max_raw'],c.reversed);
   }
   assert.ok(result.missing);assert.equal(result.badPercent,null);assert.equal(result.equalPercent,null);assert.ok(Math.abs(result.normalPercent-49.5)<1);
   assert.deepEqual(errors,[]);await p.close();console.log(engine.name(),gzip?'gzip':'source','physical endpoint capture despite fault fallback, saved deadbands, missing-data handling passed');
  }}finally{await browser.close();}
 }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
