const assert=require('node:assert/strict');
const fs=require('node:fs');
const {gunzipSync}=require('node:zlib');
const {createHash}=require('node:crypto');
const {chromium,request}=require('playwright');
const base=process.argv[2]||'http://192.168.4.1';
const expectedTarget=process.argv[3]||'esp32dev';
const out=process.argv[4]||'artifacts/v254-qualification';
(async()=>{
  const api=await request.newContext({baseURL:base,extraHTTPHeaders:{Connection:'close'}});
  const get=async route=>{
    let last;
    for(let i=0;i<4;i++){
      try{const r=await api.get(route,{timeout:15000});assert.ok(r.ok(),`${route}: HTTP ${r.status()}`);return r;}
      catch(e){last=e;await new Promise(resolve=>setTimeout(resolve,500));}
    }
    throw last;
  };
  const info=await(await get('/api/device_info')).json();
  assert.equal(info.target,expectedTarget);assert.equal(info.firmware_version,'2.5.4');
  assert.equal(info.state,'STANDBY');assert.equal(info.outputs_active,false);
  const before=await(await get('/api/data')).json();
  const browser=await chromium.launch({headless:true});
  const errors=[],writes=[];
  try{
    const page=await browser.newPage({viewport:{width:800,height:1000},hasTouch:true});
    await page.addInitScript(()=>{
      for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1','ot_gs_dismissed'])localStorage.setItem(k,'1');
    });
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
    const token=fs.readFileSync('data_src/index.html','utf8').match(/data-ot-version','([^']+)'/)[1];
    await page.goto(base+'/?v='+token,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>document.querySelector('#conn-label')?.textContent==='Connected',null,{timeout:20000});
    const button=page.locator('#dashboard-fullscreen-btn');
    await button.waitFor({state:'visible'});
    for(const width of [800,400]){
      await page.setViewportSize({width,height:1000});
      await page.waitForTimeout(500); // Let the shared button transitions settle.
      const styles=await page.evaluate(()=>{
        const props=['fontFamily','fontSize','fontWeight','letterSpacing','textTransform','padding','borderRadius','border','backgroundColor','color','minHeight'];
        return ['dashboard-fullscreen-btn','dashboard-card-edit-btn'].map(id=>Object.fromEntries(props.map(p=>[p,getComputedStyle(document.getElementById(id))[p]])));
      });
      assert.deepEqual(styles[0],styles[1]);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await button.tap();await page.waitForFunction(()=>!!document.fullscreenElement);
      await button.tap();await page.waitForFunction(()=>!document.fullscreenElement);
    }
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  }finally{await browser.close();}
  const hashes={};
  try{
    for(const name of fs.readdirSync('data').filter(n=>n.endsWith('.gz'))){
      const response=await get('/'+name.slice(0,-3)+'?verify=254');
      let actual=await response.body();
      if(actual[0]===0x1f && actual[1]===0x8b)actual=gunzipSync(actual);
      const expected=gunzipSync(fs.readFileSync('data/'+name));
      assert.ok(actual.equals(expected),'Served web asset differs: '+name);
      hashes[name]=createHash('sha256').update(actual).digest('hex');
    }
    const after=await(await get('/api/data')).json();
    assert.equal(after.boot_count,before.boot_count,'Read-only browser audit rebooted ECU');
    const final=await(await get('/api/device_info')).json();
    assert.equal(final.outputs_active,false);assert.equal(final.state,'STANDBY');
    fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(`${out}/${expectedTarget}-readonly.json`,JSON.stringify({passed:true,device:info,webHashes:hashes,errors,writes},null,2));
    console.log(`${expectedTarget}: matching toolbar styles, touch fullscreen at tablet/phone widths, all 12 served web hashes, no writes or reboot; outputs inactive.`);
  }finally{await api.dispose();}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
