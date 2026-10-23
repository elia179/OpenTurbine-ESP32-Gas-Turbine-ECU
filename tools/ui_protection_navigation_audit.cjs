const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=18100+Math.floor(Math.random()*100);await import('./ui_mock_server.mjs');
 const base=`http://127.0.0.1:${OT_UI_SIM_PORT}`;
 for(const engine of [chromium,firefox,webkit].filter(e=>!process.env.OT_UI_ENGINE||e.name()===process.env.OT_UI_ENGINE))for(const gzip of [false,true]){
  const browser=await engine.launch();try{
   const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
   if(gzip)await p.route(/\/(controllers\.html|app\.js|theme\.js|style\.css)(?:\?.*)?$/,async r=>{const file=new URL(r.request().url()).pathname.split('/').pop();await r.fulfill({status:200,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});});
   await p.request.post(base+'/__sim/reset');await p.request.post(base+'/__sim/data',{data:{mode:'STANDBY',dev_mode:false,stop_switch_active:false,extra_cooldown_active:false}});await p.goto(base+'/controllers.html');await p.waitForFunction(()=>document.querySelector('#cf-sf_p1t'));
   await p.evaluate(()=>openProtection('egt'));
   for(const width of [1280,800,390]){
    await p.setViewportSize({width,height:960});
    for(const key of ['egt','p1','p2','torque']){
     await p.locator(`.protection-nav button[onclick="openProtection('${key}')"]`).click();
     await p.waitForFunction(key=>{
      const card=document.querySelector(`[data-protection="${key}"]`),top=card.getBoundingClientRect().top;
      let end=0;for(const e of document.querySelectorAll('body>nav,.cfg-workspace')){const s=getComputedStyle(e);if(['sticky','fixed'].includes(s.position))end=Math.max(end,(parseFloat(s.top)||0)+e.getBoundingClientRect().height);}
      return top>=end+8&&top<end+25;
     },key);
    }
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }
   await p.evaluate(()=>openProtection('p1'));
   const badge=p.locator('[data-protection="p1"] [data-trip-state]');
   await p.locator('#cf-sf_p1t').fill('4.1');await p.locator('#cf-sf_p1en').check();await p.locator('#cf-sf_p1d').fill('500');assert.match(await badge.innerText(),/ON.*4.1 bar.*500 ms/);
   await p.locator('#cf-sf_p1en').uncheck();assert.match(await badge.innerText(),/OFF/);
   await p.locator('#cf-sf_p1en').check();await p.locator('#cf-sf_p1d').fill('0');assert.match(await badge.innerText(),/ON.*immediate/);
   await p.evaluate(()=>{_unitPrefs.press='psi';document.querySelector('#cf-sf_p1t').dispatchEvent(new Event('input',{bubbles:true}));});assert.match(await badge.innerText(),/psi/);
   await p.evaluate(()=>openProtection('egt'));
   for(const theme of ['carbon','ember','slate','midnight','contrast','daylight']){
    await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    for(const kind of ['startup','trip','limiting']){
     const styles=await p.locator(`[data-protection="egt"] .protection-part-${kind}`).evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e),b=getComputedStyle(e,'::before');return {width:s.borderTopWidth,strip:b.backgroundColor,expected:s.borderTopColor};}));
     assert.ok(styles.length);for(const css of styles){assert.equal(css.width,'3px');assert.equal(css.strip,css.expected);}
    }
   }
   await p.emulateMedia({forcedColors:'active'});
   const forced=await p.locator('.protection-part-startup').first().evaluate(e=>{const s=getComputedStyle(e,'::before');return {supported:CSS.supports('forced-color-adjust','none'),adjust:s.forcedColorAdjust,height:s.height,color:s.backgroundColor};});
   if(forced.supported)assert.equal(forced.adjust,'none');assert.equal(forced.height,'3px');assert.notEqual(forced.color,'rgba(0, 0, 0, 0)');
   assert.deepEqual(errors,[]);console.log(engine.name(),gzip?'gzip':'source','shortcut heading visibility at 3 widths, six themes, contrast accents, live trip status and units passed');
  }finally{await browser.close();}
 }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
