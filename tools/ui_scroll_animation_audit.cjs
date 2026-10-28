const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,firefox,webkit}=require('playwright');
const {gunzipSync}=require('node:zlib');
(async()=>{
 globalThis.OT_UI_SIM_PORT=14931;await import('./ui_mock_server.mjs');
 const base='http://127.0.0.1:14931';
 for(const engine of [chromium,firefox,webkit]){
  const browser=await engine.launch();
  try{
   const p=await browser.newPage({viewport:{width:1024,height:600}});
   if(process.env.OT_UI_PACKAGED==='1')await p.route(/\/(controllers\.html|theme\.js|app\.js|style\.css)(?:\?.*)?$/,r=>{
    const n=new URL(r.request().url()).pathname.slice(1);
    return r.fulfill({status:200,contentType:n.endsWith('html')?'text/html':n.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+n+'.gz'))});
   });
   await p.goto(base+'/controllers.html');await p.locator('[data-group="safety"]').waitFor();
   await p.getByRole('button',{name:'Explore all features',exact:true}).click();
   await p.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);document.querySelector('.save-bar').classList.add('is-dirty');document.activeElement.blur();});
   await p.waitForTimeout(850);await p.mouse.move(150,300);await p.mouse.wheel(0,250);
   await p.waitForFunction(()=>document.body.classList.contains('ot-controls-collapsed'));
   const state=await p.evaluate(()=>['.cfg-workspace','.save-bar'].map(sel=>{
    const el=document.querySelector(sel),s=getComputedStyle(el);
    return {duration:s.transitionDuration,animations:el.getAnimations().length};
   }));
   assert.ok(state.every(s=>s.duration.includes('0.24s')&&s.animations>0),'both bars animate instead of jumping');
   await p.locator('.cfg-workspace').waitFor({state:'hidden'});
   await p.locator('.save-bar').waitFor({state:'hidden'});
   await p.getByRole('button',{name:'Search & page controls',exact:true}).click();
   await p.waitForTimeout(280);
   assert.ok(await p.locator('.cfg-workspace').isVisible());
   const search=p.locator('.cfg-workspace input[type="search"]');
   assert.equal(await search.evaluate(el=>el===document.activeElement),true);
   await p.emulateMedia({reducedMotion:'reduce'});
   await p.evaluate(()=>document.activeElement.blur());
   await p.waitForTimeout(850);await p.mouse.wheel(0,200);
   await p.waitForFunction(()=>document.body.classList.contains('ot-controls-collapsed'));
   assert.equal(await p.locator('.cfg-workspace').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
   assert.equal(await p.locator('.cfg-workspace').isVisible(),false);
   console.log(engine.name()+': hide/reveal transitions, search focus and reduced-motion preference passed');
  }finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
