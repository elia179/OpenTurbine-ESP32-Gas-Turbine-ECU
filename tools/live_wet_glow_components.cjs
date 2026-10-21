const assert=require('node:assert/strict'),fs=require('node:fs');
const {execFileSync}=require('node:child_process');const {chromium}=require('playwright');
if(!process.argv.includes('--allow-write'))throw Error('Requires --allow-write on the idle two-board wet-glow fixture');
const base='http://192.168.4.1',label=process.argv.find(a=>a.startsWith('--label='))?.slice(8)||'wet-glow';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({headless:true});const errors=[],commands=[];
 try{const p=await b.newPage({viewport:{width:800,height:1000}});p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
 await p.goto(base+'/tools.html',{waitUntil:'domcontentloaded',timeout:45000});
 await p.waitForFunction(()=>document.querySelector('#btn-GLOW_TEST')?.disabled===false,null,{timeout:30000});
 assert.match(await p.locator('#card-GLOW_ONLY_TEST .tool-desc').textContent(),/60%/);
 await p.locator('#btn-test-settings').click();const duration=p.locator('.test-setting[data-key="glow_test_ms"]');assert.equal(await duration.count(),1);await duration.fill('2.5');
 await p.locator('#test-settings-modal button',{hasText:'Save settings'}).click();
 await p.locator('#test-settings-modal').waitFor({state:'hidden',timeout:25000});
 // Reconnect/read back the saved value; never repeat the write on a lost response.
 let loaded=false;
 for(let i=0;i<18&&!loaded;i++){
  if(i%3===0)try{execFileSync('netsh',['wlan','connect','name=OpenTurbine'],{stdio:'ignore'});}catch(_){}
  try{await p.goto(base+'/tools.html',{waitUntil:'domcontentloaded',timeout:6000});await p.waitForFunction(()=>document.querySelector('#btn-GLOW_TEST')?.disabled===false,null,{timeout:5000});loaded=true;}catch(_){await wait(1000);}
 }
 assert.ok(loaded,'Tools did not recover after duration save');
 const group=p.locator('.tool-component-tests');await group.locator('summary').click();
 for(const id of ['GLOW_TEST','GLOW_ONLY_TEST','WET_GLOW_FUEL_TEST'])assert.equal(await p.locator('#time-'+id).textContent(),'2.5 s');
 for(const [id,selection] of [['GLOW_ONLY_TEST',1],['WET_GLOW_FUEL_TEST',2],['GLOW_TEST',0]]){
  await p.waitForFunction(id=>document.getElementById('btn-'+id)?.disabled===false,id,{timeout:10000});
  await p.locator('#btn-'+id).click();await p.locator('#ot-dialog-confirm').waitFor({state:'visible'});
  const response=p.waitForResponse(r=>r.url().endsWith('/api/command')&&r.request().method()==='POST',{timeout:10000});
  await p.locator('#ot-dialog-confirm').click();const r=await response;assert.ok(r.ok());assert.equal((await r.json()).ok,true);
  const body=r.request().postDataJSON();assert.equal(body.cmd,'GLOW_TEST');assert.equal(body.iParam??0,selection);commands.push(body);
  await p.waitForFunction(id=>activeId===id,id);for(const other of ['GLOW_TEST','GLOW_ONLY_TEST','WET_GLOW_FUEL_TEST'])assert.ok(await p.locator('#btn-'+other).isDisabled());
  await p.waitForFunction(()=>activeId===null,null,{timeout:8000});
 }
 await p.screenshot({path:`artifacts/v256-hardware/${label}-tools.png`,fullPage:true});
 assert.deepEqual(errors,[]);fs.writeFileSync(`artifacts/v256-hardware/${label}-tools-browser.json`,JSON.stringify({passed:true,shared_duration_ms:2500,commands,errors},null,2));
 console.log('Actual Tools browser passed: persisted shared duration, all three confirmed component commands, exclusive progress, no JavaScript errors.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
