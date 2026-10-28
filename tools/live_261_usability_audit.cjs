// Read-only checks of the new UI on a stopped real ECU. No configuration writes.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,request}=require('playwright');
const base=process.argv[2]||'http://192.168.4.1',target=process.argv[3],out=process.argv[4];
(async()=>{
 const api=await request.newContext({baseURL:base,extraHTTPHeaders:{Connection:'close'}});
 const info=await(await api.get('/api/device_info')).json();
 assert.equal(info.target,target);assert.equal(info.firmware_version,'2.6.1');
 assert.equal(info.state,'STANDBY');assert.equal(info.outputs_active,false);
 const browser=await chromium.launch(),errors=[],writes=[];
 try{
  const p=await browser.newPage({viewport:{width:1024,height:600}});
  p.on('pageerror',e=>errors.push(e.message));
  p.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
  await p.goto(base+'/system.html?v=20261028a',{timeout:45000});
  await p.locator('#system-maintenance').waitFor({timeout:30000});
  assert.deepEqual(await p.locator('.system-category').evaluateAll(es=>es.map(e=>e.open)),[true,true,true]);
  await p.locator('#system-maintenance > summary').click();
  await p.evaluate(()=>renderSystemSetup());
  assert.equal(await p.locator('#system-maintenance').evaluate(e=>e.open),false);
  await p.locator('#system-maintenance > summary').click();
  for(const width of [1024,390]){
   await p.setViewportSize({width,height:600});
   await p.evaluate(()=>{document.activeElement.blur();scrollTo(0,0);});
   await p.mouse.move(150,200);await p.waitForTimeout(850);await p.mouse.wheel(0,250);
   await p.waitForFunction(()=>document.body.classList.contains('ot-controls-collapsed'));
   assert.equal(await p.locator('.ot-save-handle').isVisible(),false);
   await p.getByRole('button',{name:'Page controls',exact:true}).click();
   const rect=await p.locator('.cfg-workspace button').first().boundingBox();
   assert.ok(rect&&rect.y>=44&&rect.y+rect.height<=600);
  }
  await p.setViewportSize({width:1280,height:1000});
  await p.goto(base+'/controllers.html?v=20261028b',{timeout:45000});
  await p.locator('[data-group="safety"]').waitFor();
  await p.getByRole('button',{name:'Explore all features',exact:true}).click();
  await p.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));
  await p.mouse.move(150,300);await p.waitForTimeout(850);await p.mouse.wheel(0,300);
  await p.waitForFunction(()=>document.body.classList.contains('ot-controls-collapsed'));
  assert.equal(await p.locator('.cfg-workspace').isVisible(),false);
  assert.equal(await p.locator('.save-bar').isVisible(),false);
  if(out){fs.mkdirSync(out,{recursive:true});await p.screenshot({path:out+'/controllers-1000-collapsed.png'});}
  await p.goto(base+'/sequence.html?v=20261028b',{timeout:45000});
  await p.waitForFunction(()=>hwCfg.channel_registry&&cfg.rules&&typeof resolveSequenceActions==='function');
  await p.locator('#list-startup .block-card').first().waitFor({timeout:30000});
  await p.getByRole('button',{name:'Shutdown',exact:true}).click();
  const cut=p.locator('#list-shutdown .block-card[data-block="ImmediateCut"]');
  assert.equal(await cut.count(),1);
  await cut.locator('.block-header').click();
  assert.ok(await cut.locator('.sequence-action-card').count()>0);
  const text=await cut.locator('.sequence-actions').innerText();
  assert.ok(text.includes('Commands shown here are built into this block'));
  assert.ok(text.includes('Oil pumping is retained'));
  if(out){fs.mkdirSync(out,{recursive:true});await cut.screenshot({path:out+'/immediate-cut-live.png'});}
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const final=await(await api.get('/api/device_info')).json();
  assert.equal(final.state,'STANDBY');assert.equal(final.outputs_active,false);
  console.log(target+': System three open sections/manual collapse, short-screen Page controls, no redundant clean Save button, actual compound command cards; zero writes and no JS errors.');
 }finally{await browser.close();await api.dispose();}
})().catch(e=>{console.error(e);process.exit(1)});
