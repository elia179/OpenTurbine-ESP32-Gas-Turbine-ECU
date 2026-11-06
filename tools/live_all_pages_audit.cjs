// Read-only live-ECU navigation/layout audit; never commands outputs or saves.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,firefox,webkit}=require('playwright');
const base=process.argv[2]||'http://192.168.4.1',target=process.argv[3]||'esp32dev',out=process.argv[4]||'artifacts/live-pages';
(async()=>{
 let recoveredReadRetries=0;
 const read=async route=>{
  for(let attempt=0;attempt<5;attempt++){
   try{
    const r=await fetch(base+route,{headers:{Connection:'close'},signal:AbortSignal.timeout(15000)});
    if(r.status===503&&attempt<4){recoveredReadRetries++;await new Promise(resolve=>setTimeout(resolve,400));continue;}
    assert(r.ok,`${route}: ${r.status}`);return await r.json();
   }catch(error){
    // Match the app's bounded GET recovery. Never hide invalid JSON, rejected
    // requests, configuration changes or an unexpected reboot.
    if(error instanceof assert.AssertionError||error instanceof SyntaxError||attempt===4)throw error;
    recoveredReadRetries++;await new Promise(resolve=>setTimeout(resolve,400));
   }
  }
 };

 const identity=await read('/api/device_info');assert.equal(identity.target,target);assert(['STANDBY','FAULT'].includes(identity.state),'unexpected initial engine state');assert.equal(identity.outputs_active,false);
 const before=await read('/api/ecu_config'),boot=(await read('/api/data')).boot_count;
 const results=[];fs.mkdirSync(out,{recursive:true});
 for(const [name,type] of Object.entries({chromium,firefox,webkit})){
  if(process.env.OT_BROWSER&&process.env.OT_BROWSER!==name)continue;
  const browser=await type.launch();
  try{
   const p=await browser.newPage();const errors=[],writes=[];const network=[];p.on('response',r=>{if(r.request().resourceType()==='document'||r.status()>=400)network.push({url:r.url(),status:r.status(),length:r.headers()['content-length']});});p.on('requestfailed',r=>{network.push({url:r.url(),type:r.resourceType(),failure:r.failure()});console.log('NETWORK '+JSON.stringify(network.slice(-12)));});
   p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()!=='GET')writes.push(r.method()+' '+r.url());});
   await p.addInitScript(()=>{for(const key of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1','ot_gs_dismissed'])localStorage.setItem(key,'1');});
   for(const [width,height] of [[1024,600],[800,1000],[390,844]]){
    await p.setViewportSize({width,height});
    for(const page of ['index','hardware','controllers','calibration','sequence','log','tools','system']){
     try {
     await p.goto(base+'/'+page+'.html',{waitUntil:'domcontentloaded',timeout:45000});
     await p.waitForFunction(()=>document.querySelector('#conn-label')?.textContent?.trim().toLowerCase()==='connected',null,{timeout:30000});
     if(page==='hardware')await p.waitForFunction(()=>typeof _hwLoading!=='undefined'&&!_hwLoading&&!document.querySelector('main').inert,null,{timeout:30000});
     if(page==='hardware')assert.deepEqual(await p.evaluate(()=>_checkGpioConflicts()),[], 'valid connector inventory must not report GPIO conflicts');
     if(page==='sequence')await p.waitForFunction(()=>typeof _seqLoading!=='undefined'&&!_seqLoading&&!document.querySelector('main').inert,null,{timeout:30000});
     if(page==='log')await p.waitForFunction(()=>{const body=document.getElementById('log-body');const empty=body?.querySelector('.empty-msg');return body?.querySelectorAll('tr').length>0&&(!empty||/^No events/i.test(empty.textContent));},null,{timeout:15000});
     if(['system','controllers'].includes(page))await p.waitForFunction(()=>typeof cfg!=='undefined'&&cfg.profile_id&&typeof _fieldSnap!=='undefined'&&Object.keys(_fieldSnap).length>0,null,{timeout:30000});
     const loadMessage=await p.evaluate(()=>document.getElementById('save-msg')?.textContent||document.getElementById('save-status')?.textContent||'');assert(!/Load failed/i.test(loadMessage),`${page}: ${loadMessage}`);
     await p.waitForTimeout(600);
     const layout=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.title}));
     assert(layout.title,`missing title ${page}`);assert(layout.scroll<=width+1,`${name} ${page} ${width}: horizontal overflow ${layout.scroll}`);
     assert.deepEqual(errors,[],`${name} ${page}: JS errors`);assert.deepEqual(writes,[],`${name} ${page}: unexpected write`);
     if(width===1024&&['hardware','controllers','sequence','system'].includes(page))await p.screenshot({path:`${out}/${name}-${page}-landscape.png`});
     results.push({browser:name,page,width,height,passed:true});console.log(`${target} ${name} ${width}x${height} ${page}: connected, clean layout, no JS errors/writes`);
     } catch(error) {
      const state=await p.evaluate(()=>({url:location.href,ready:document.readyState,connection:document.getElementById('conn-label')?.textContent,applyData:typeof applyData,config:typeof cfg,mode:typeof runtimeMode==='undefined'?null:runtimeMode,saveMessage:document.getElementById('save-msg')?.textContent,body:document.body.innerText.slice(0,1800),scripts:[...document.scripts].map(s=>({src:s.src,length:s.textContent.length}))})).catch(e=>({error:e.message}));
      const diagnostic={browser:name,page,width,height,state,errors,network:network.slice(-30),failure:error.message};
      fs.writeFileSync(`${out}/${name}-failed-page.json`,JSON.stringify(diagnostic,null,2));
      console.error('FAILED PAGE '+JSON.stringify(diagnostic));
      await p.screenshot({path:`${out}/${name}-failed-page.png`}).catch(()=>{});
      throw error;
     }
    }
   }
  }finally{await browser.close();}
 }
 assert.deepEqual(await read('/api/ecu_config'),before,'read-only audit changed engine file');assert.equal((await read('/api/data')).boot_count,boot,'read-only navigation rebooted ECU');
 const final=await read('/api/device_info');assert.equal(final.state,identity.state,'read-only audit changed engine state');assert.equal(final.outputs_active,false);
 fs.writeFileSync(`${out}/${target}-pages-${process.env.OT_BROWSER||'all'}.json`,JSON.stringify({passed:true,identity,results,configurationUnchanged:true,bootUnchanged:true,recoveredReadRetries},null,2));
 console.log(`PASS ${results.length} live browser/viewport/page cases; configuration and boot unchanged.`);
})().catch(e=>{console.error(e);process.exit(1)});
