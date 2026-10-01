// Bench-only: harmless description save reboots the DUT under an open dashboard.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
if(!process.argv.includes('--allow-write'))throw Error('Requires an idle no-load bench ECU');
const base=process.argv.find(a=>/^http/.test(a))||'http://192.168.4.1';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.OT_BROWSER_EXECUTABLE});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{localStorage.setItem('ot_beta_notice_ack_v1','1');localStorage.setItem('ot_theme_onboarded_v1','1');localStorage.setItem('ot_gs_dismissed','1');});
    const get=async route=>{let error;for(let attempt=0;attempt<5;attempt++){try{const r=await page.request.get(base+route,{timeout:30000,headers:{Connection:'close'}});assert.ok(r.ok());return await r.json();}catch(e){error=e;await new Promise(r=>setTimeout(r,1500));}}throw error;};
    const status=await get('/api/status');assert.equal(status.mode,'STANDBY');
    const info=await get('/api/device_info');assert.equal(info.outputs_active,false);
    const cfg=await get('/api/ecu_config');
    await page.goto(base+'/index.html');
    await page.waitForFunction(()=>typeof _lastData!=='undefined'&&_lastData?.rpm_limit!==undefined&&!document.body.classList.contains('dashboard-awaiting-snapshot'));
    const oldBoot=await page.evaluate(()=>_lastBootCount);
    let failOne=true;
    await page.route('**/api/data',route=>{
      if(failOne){failOne=false;return route.fulfill({status:503,json:{error:'injected transient snapshot failure'}});}
      return route.continue();
    });
    const saved=await page.request.patch(base+'/api/hardware?source=system',{data:{profile_desc:cfg.hardware.profile_desc},timeout:30000});
    assert.equal(saved.status(),200);
    // Re-associate once after the planned reboot, without repeated connect
    // requests disrupting Windows' association already in progress.
    await new Promise(r=>setTimeout(r,9000));
    if(process.platform==='win32')execFileSync('netsh',['wlan','connect','name=OpenTurbine'],{stdio:'ignore'});
    await page.waitForFunction(old=>_lastBootCount!==old&&_lastData?.rpm_limit!==undefined&&!document.body.classList.contains('dashboard-awaiting-snapshot'),oldBoot,{timeout:90000});
    assert.equal(failOne,false,'Reboot must request fresh metadata');
    assert.equal(await page.locator('[data-registry-output-id="0"]').count(),0);
    assert.deepEqual((await get('/api/ecu_config')).hardware,cfg.hardware);
    assert.deepEqual((await get('/api/ecu_config')).settings,cfg.settings);
    assert.deepEqual(errors,[]);
    console.log('PASS: real ECU reboot plus one failed metadata response recovers the complete dashboard without reload; no numbered outputs; Hardware and Settings unchanged.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
