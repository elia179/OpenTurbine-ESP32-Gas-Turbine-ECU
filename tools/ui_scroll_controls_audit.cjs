const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,firefox,webkit}=require('playwright');
const {gunzipSync}=require('node:zlib');
const packed=process.env.OT_UI_PACKAGED==='1';
const {guidedFixture}=require('./guided_build_fixture.cjs');
(async()=>{
 globalThis.OT_UI_SIM_PORT=Number(process.env.OT_SCROLL_PORT||14822);await import('./ui_mock_server.mjs');
 const base='http://127.0.0.1:'+globalThis.OT_UI_SIM_PORT;
 const initial=await(await fetch(base+'/__sim/state')).json();
 await fetch(base+'/api/ecu_config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(guidedFixture(initial,1))});
 await fetch(base+'/__sim/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'STANDBY',config_locked:false})});
 for(const engine of [chromium,firefox,webkit]){
  if(process.env.OT_SCROLL_CASE&&!process.env.OT_SCROLL_CASE.startsWith(engine.name()+':'))continue;
  const browser=await engine.launch();
  try{
   const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   if(packed)await p.route(/\/(hardware\.html|controllers\.html|system\.html|sequence\.html|app\.js|theme\.js|style\.css)(?:\?.*)?$/,r=>{
    const n=new URL(r.request().url()).pathname.slice(1);
    return r.fulfill({status:200,contentType:n.endsWith('html')?'text/html':n.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+n+'.gz'))});
   });
   for(const viewport of [{width:1024,height:600},{width:390,height:600}]){
    if(process.env.OT_SCROLL_CASE&&!process.env.OT_SCROLL_CASE.includes(':'+viewport.width+':'))continue;
    await p.setViewportSize(viewport);
    for(const route of ['hardware','controllers','system','sequence']){
     if(process.env.OT_SCROLL_CASE&&!process.env.OT_SCROLL_CASE.endsWith(':'+route))continue;
     await p.goto(base+'/'+route+'.html');
     const ready={hardware:'#hardware-comms-summary .hw-item-card',controllers:'[data-group="safety"]',system:'#system-maintenance',sequence:'#list-startup .block-card'}[route];
     await p.locator(ready).first().waitFor();
     await p.waitForFunction(()=>!!window.OTScrollControls);
     await p.mouse.move(150,200);
     await p.evaluate(()=>{
      document.querySelectorAll('details').forEach(d=>d.open=true);
      const bar=document.querySelector('.save-bar,.seq-save-bar');
      bar.classList.add('is-dirty');
      const status=bar.querySelector('#save-msg,#save-status');if(status)status.textContent='Unsaved changes';
      document.activeElement.blur();scrollTo(0,0);
     });
     // A normal filter click leaves the button focused. It must not pin both bars.
     if(route==='controllers')await p.getByRole('button',{name:'Explore all features',exact:true}).click();
     await p.waitForTimeout(850);await p.mouse.wheel(0,250);
     await p.waitForFunction(()=>document.body.classList.contains('ot-controls-collapsed'),null,{timeout:5000});
     const handle=p.getByRole('button',{name:/Unsaved changes.*Show save controls/});
     await handle.waitFor({state:'visible'});
     assert.ok((await handle.boundingBox()).height>=44);
     await handle.click();
     await p.waitForTimeout(280);
     const rect=await p.locator('.ot-managed-save').boundingBox();
     assert.ok(rect.y>=48&&rect.y+rect.height<=viewport.height+1,route+' restores Save inside viewport');
     if(engine===chromium&&viewport.width===390&&route==='controllers'){await fs.promises.mkdir('artifacts/261-ui',{recursive:true});await p.screenshot({path:'artifacts/261-ui/scroll-controls-mobile-save.png'});}
     assert.ok(await p.evaluate(()=>parseFloat(getComputedStyle(document.body).paddingBottom)>=document.querySelector('.ot-managed-save').offsetHeight),'floating bar has content clearance');
     if(viewport.width===390&&(route==='controllers'||route==='system'))assert.ok(await p.locator('.ot-search-handle').isVisible(),'off-screen page controls keep their shortcut after Save is restored');
     const y=await p.evaluate(()=>scrollY);assert.ok(y>100,'Save restoration preserves reading position');
     // Once focus leaves the controls, downward scrolling can compact them again.
     await p.waitForTimeout(850);await p.mouse.wheel(0,100);
     await p.waitForFunction(()=>document.body.classList.contains('ot-controls-collapsed'));
     if(route==='controllers'||route==='system'){
      await p.getByRole('button',{name:route==='controllers'?'Search & page controls':'Page controls',exact:true}).click();
      await p.waitForTimeout(280);
      const search=route==='controllers'?p.locator('.cfg-workspace input[type="search"]').first():p.locator('.cfg-workspace button').first();
      const r=await search.boundingBox();
      assert.ok(r.y>=48&&r.y+r.height<=viewport.height,'Search is visible after restoration');
      assert.equal(await search.evaluate(el=>el===document.activeElement),true);
      await p.mouse.wheel(0,150);assert.equal(await p.locator('body').evaluate(el=>el.classList.contains('ot-controls-collapsed')),false,'typing keeps search visible');
     }
     await p.evaluate(()=>{
      document.activeElement.blur();
      const bar=document.querySelector('.ot-managed-save');
      bar.classList.remove('is-dirty');
      const status=bar.querySelector('#save-msg,#save-status');if(status)status.textContent='Error: save failed; retry when connected';
     });
     await p.waitForFunction(()=>document.body.classList.contains('ot-save-attention'));
     await p.waitForTimeout(280);
     await p.mouse.wheel(0,250);
     assert.equal(await p.locator('body').evaluate(el=>el.classList.contains('ot-controls-collapsed')),false,'save errors remain visible');
     const error=p.locator('.ot-managed-save #save-msg,.ot-managed-save #save-status').first();
     assert.ok(await error.isVisible(),'save error text survives narrow layout');
     const er=await error.boundingBox();assert.ok(er.y>=0&&er.y+er.height<=viewport.height+1);
     // Clean pages need no bottom button offering disabled Save/Discard actions.
     await p.evaluate(()=>{
      const bar=document.querySelector('.ot-managed-save');
      const status=bar.querySelector('#save-msg,#save-status');if(status)status.textContent='No unsaved changes';
      scrollTo(0,0);
     });
     await p.waitForTimeout(850);await p.mouse.wheel(0,250);
     await p.waitForFunction(()=>document.body.classList.contains('ot-controls-collapsed'),null,{timeout:5000}).catch(async e=>{
      console.log('clean diagnostics',await p.evaluate(()=>({y:scrollY,height:innerHeight,total:document.documentElement.scrollHeight,classes:document.body.className,active:document.activeElement.outerHTML.slice(0,180),bar:document.querySelector('.ot-managed-save').textContent,modals:Array.from(document.querySelectorAll('.ot-dialog-overlay,.save-recap-backdrop,[role="dialog"][aria-modal="true"]')).map(el=>({name:el.className,rects:el.getClientRects().length}))})));throw e;
     });
     assert.equal(await p.locator('.ot-save-handle').isVisible(),false,'clean page has no redundant Save handle');
     // Real recap backdrops use display:flex rather than a .show class.
     if(await p.locator('.save-recap-backdrop,#custom-dlg').count()){
      await p.evaluate(()=>{const modal=document.querySelector('.save-recap-backdrop,#custom-dlg');modal.style.display='flex';});
      await p.mouse.wheel(0,100);
      assert.equal(await p.locator('body').evaluate(el=>el.classList.contains('ot-controls-collapsed')),false,'visible recap pins controls');
      await p.evaluate(()=>document.querySelector('.save-recap-backdrop,#custom-dlg').style.display='none');
      await p.waitForTimeout(100); // WebKit updates root overflow after the closing-dialog paint.
     }
     const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
     if(overflow>1){
      console.log('overflow contents',await p.evaluate(()=>Array.from(document.querySelectorAll('main *')).filter(el=>el.getClientRects().length&&el.scrollWidth>el.clientWidth+2).map(el=>({tag:el.tagName,id:el.id,cls:el.className,client:el.clientWidth,scroll:el.scrollWidth,overflow:getComputedStyle(el).overflowX,text:el.textContent.slice(0,90)})).slice(-18)));
      console.log('overflow diagnostics',overflow,await p.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>el.getClientRects().length&&el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,id:el.id,cls:el.className,right:el.getBoundingClientRect().right,visibility:getComputedStyle(el).visibility})).slice(-18)));
      await fs.promises.mkdir('artifacts/261-ui',{recursive:true});await p.screenshot({path:'artifacts/261-ui/scroll-overflow.png'});
     }
     assert.ok(overflow<=1,route+' has no overflow');
     console.log(engine.name(),packed?'gzip':'source',viewport.width,route,'restore position, focus, dirty state, error and recap policy passed');
    }
   }
   await p.setViewportSize({width:1280,height:1000});
   await p.goto(base+'/system.html');await p.locator('#system-maintenance').waitFor();
   await p.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);document.activeElement.blur();});
   await p.mouse.move(150,200);await p.waitForTimeout(850);await p.mouse.wheel(0,250);
   await p.waitForFunction(()=>document.body.classList.contains('ot-controls-collapsed'));
   assert.equal(await p.locator('body').evaluate(el=>el.classList.contains('ot-short-controls')),true,'1000px viewport compacts controls');
   await p.setViewportSize({width:1024,height:1100});
   await p.goto(base+'/system.html');await p.locator('#system-maintenance').waitFor();
   await p.mouse.wheel(0,250);
   assert.equal(await p.locator('body').evaluate(el=>el.classList.contains('ot-short-controls')),false,'tall desktop retains normal controls');
   assert.deepEqual(errors,[]);
   if(engine===chromium){await fs.promises.mkdir('artifacts/261-ui',{recursive:true});await p.screenshot({path:'artifacts/261-ui/scroll-controls-desktop.png'});}
  }finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
