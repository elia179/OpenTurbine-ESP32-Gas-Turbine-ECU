const assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
  await p.goto('http://192.168.4.1/sequence.html?v=20261028a');
  await p.waitForFunction(()=>typeof pendingControllerBlocks==='function'&&hwCfg.channel_registry&&cfg.rules&&document.getElementById('controller-pending-blocks'),null,{timeout:30000});
  const result=await p.evaluate(()=>({pending:pendingControllerBlocks().length,cards:document.querySelectorAll('[data-controller-key]').length,dropdowns:document.querySelectorAll('#controller-pending-blocks select').length,recap:document.querySelector('#final-state-startup')?.textContent,restoration:typeof pendingControllerSlots?.get==='function'}));
  assert.equal(result.cards,result.pending);assert.equal(result.dropdowns,0);assert.ok(result.restoration);assert.ok(result.recap);assert.deepEqual(errors,[]);
  await p.screenshot({path:'artifacts/sequence-installed-classic.png',fullPage:true});
  await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  console.log('Installed Classic sequence page passed desktop/mobile rendering; pending cards',result.pending,'no placement dropdowns, recap present, no browser errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
