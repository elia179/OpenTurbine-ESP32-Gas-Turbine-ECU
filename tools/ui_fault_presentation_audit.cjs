const assert=require('node:assert/strict'),fs=require('node:fs');
const {gunzipSync}=require('node:zlib');
const {chromium}=require('playwright');
(async()=>{
  globalThis.OT_UI_SIM_PORT=16450+Math.floor(Math.random()*50);await import('./ui_mock_server.mjs');
  const base=`http://127.0.0.1:${globalThis.OT_UI_SIM_PORT}`,browser=await chromium.launch({headless:true});
  try{for(const gzip of [false,true]){
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
    if(gzip)await page.route(/\/(app\.js|index\.html|theme\.js|style\.css)(?:\?.*)?$/,async r=>{
      const file=new URL(r.request().url()).pathname.split('/').pop();
      await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});
    });
    await page.request.post(base+'/__sim/reset');
    await page.request.post(base+'/__sim/data',{data:{mode:'FAULT',fault_description:'OVERSPEED'}});
    await page.goto(base+'/index.html');await page.waitForFunction(()=>typeof faultDescriptionText==='function');
    await page.waitForFunction(()=>document.querySelector('#fault-desc-text')?.textContent.includes('What to do:'));
    assert.match(await page.locator('#fault-desc-text').innerText(),/Engine over-speed/);
    const texts=await page.evaluate(()=>({
      named:faultDescriptionText({fault_description:'OIL_PRESSURE_LOW: Scavenge <return>'}),
      previous:faultDescriptionText({fault_description:'Old descriptive fault. What to do: check wiring.'}),
      unknown:faultDescriptionText({fault_description:'FUTURE_FAULT: Named output'}),
      current:faultDescriptionText({fault_description:'OUTPUT_OVERCURRENT: Fuel pump'}),
      abort:faultDescriptionText({fault_description:'STARTUP_ABORT: FlameConfirm'}),
      multiple:faultDescriptionText({fault_description:'MULTIPLE_SENSOR_FAILURE: Named EGT <left>'})
    }));
    assert.match(texts.named,/Scavenge <return> pressure/);assert.match(texts.named,/What to do:/);
    assert.equal(texts.previous,'Old descriptive fault. What to do: check wiring.');
    assert.match(texts.unknown,/FUTURE_FAULT: Named output/);assert.match(texts.current,/Fuel pump current/);
    assert.match(texts.abort,/flame.*Tools/i);assert.match(texts.multiple,/Named EGT <left>.*overridden/);
    assert.deepEqual(errors,[]);await page.close();
    console.log(`${gzip?'gzip':'source'}: compact fault code/detail expands to repair guidance, user names preserved, old descriptions and unknown codes supported.`);
  }}finally{await browser.close();}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
