const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
  const base=process.argv[2]||'http://192.168.4.1';
  await page.goto(base+'/calibration.html?v=20261023p');
  await page.waitForFunction(()=>typeof operatorAdcRaw==='function'&&Number.isFinite(operatorAdcRaw(live,'throttle')),{timeout:30000});
  const raw=await page.evaluate(()=>({measured:operatorAdcRaw(live,'throttle'),display:document.getElementById('cal-th-raw').textContent,control:live.throttle_input_raw}));
  assert.ok(Number.isFinite(raw.measured));assert.notEqual(raw.display,'NaN mV');console.log('Installed calibration raw data:',JSON.stringify(raw));
  await page.goto(base+'/controllers.html?v=20261023p');
  await page.waitForFunction(()=>cfg?.rules?.length&&typeof updateControllerTiming==='function');
  const legacy=await page.evaluate(()=>{
   const r=cfg.rules[0],before=!OTControllerTiming.scheduled(r);
   const old=Array.from(document.querySelectorAll('.controller-form-section b')).some(e=>e.textContent==='When this controller is active');
   updateControllerTiming(0,'activate_event',2);
   const card=document.querySelector('[data-controller-rule="0"]');
   const removed=!Array.from(card.querySelectorAll('.controller-form-section b')).some(e=>e.textContent==='When this controller is active');
   return {before,old,removed};
  });
  assert.ok(legacy.before&&legacy.old&&legacy.removed);assert.deepEqual(errors,[]);
  console.log('Installed browser: legacy checkboxes disappear after activation timing selected; no configuration saved.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
