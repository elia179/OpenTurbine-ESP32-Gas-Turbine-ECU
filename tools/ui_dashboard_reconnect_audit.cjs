// Isolated regression for compact frames arriving without full metadata.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {gunzipSync} = require('node:zlib');
const {chromium} = require('playwright');
(async()=>{
  const port=13200+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`;
  globalThis.OT_UI_SIM_PORT=port;await import('./ui_mock_server.mjs');
  const browser=await chromium.launch({headless:true,executablePath:process.env.OT_BROWSER_EXECUTABLE});
  try {
    for(const bundle of ['source','packaged']) {
      const page=await browser.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{
        localStorage.setItem('ot_beta_notice_ack_v1','1');
        localStorage.setItem('ot_theme_onboarded_v1','1');
        localStorage.setItem('ot_gs_dismissed','1');
      });
      if(bundle==='packaged')await page.route(/\/(index\.html|app\.js|style\.css)(?:\?.*)?$/,async route=>{
        const name=path.basename(new URL(route.request().url()).pathname);
        await route.fulfill({status:200,contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html',body:gunzipSync(fs.readFileSync(path.resolve(__dirname,'../data',name+'.gz')))});
      });
      await page.request.post(base+'/__sim/reset');
      let failures=2,allow=false,boot=4;
      const compact=()=>({cv:2,v:Array(73).fill(0),bc:boot,u:20,m:0,f:0,g:0,h:3,iv:[0,0,0],ov:[0,0,0,0,0,0]});
      await page.route('**/api/telemetry',route=>route.fulfill({json:compact()}));
      await page.route('**/api/data',async route=>{
        if(failures-->0)return route.fulfill({status:503,json:{error:'busy'}});
        if(!allow)return route.fulfill({json:{_snapshot_deferred:true}});
        return route.continue();
      });
      await page.goto(base+'/index.html');
      await page.locator('#dashboard-loading-banner').waitFor({state:'visible'});
      await page.evaluate(frame=>applyData(frame),compact());
      assert.equal(await page.locator('#btn-start').isEnabled(),false);
      assert.equal(await page.locator('#btn-stop').isEnabled(),true);
      assert.equal(await page.locator('#oil-card').isVisible(),false);
      assert.equal(await page.locator('[data-registry-output-id="0"]').count(),0);
      allow=true;
      await page.waitForFunction(()=>!document.body.classList.contains('dashboard-awaiting-snapshot'));
      assert.equal(await page.locator('#oil-card').isVisible(),true);
      // A reboot loses metadata even though compact values keep arriving.
      boot=5;allow=false;failures=1;
      await page.request.post(base+'/__sim/data',{data:{boot_count:boot,uptime_s:20}});
      await page.evaluate(frame=>applyData(frame),compact());
      assert.equal(await page.locator('#dashboard-loading-banner').isVisible(),true);
      assert.equal(await page.locator('#btn-start').isEnabled(),false);
      await page.evaluate(frame=>applyData(frame),compact());
      assert.equal(await page.locator('[data-registry-output-id="0"]').count(),0);
      allow=true;
      await page.waitForFunction(()=>!document.body.classList.contains('dashboard-awaiting-snapshot'));
      assert.equal(await page.locator('#oil-card').isVisible(),true);
      assert.deepEqual(errors,[]);
      await page.close();
      console.log(`${bundle}: failed/deferred startup and reboot snapshots recover automatically; no numbered cards; START locked and STOP available while loading.`);
    }
  }finally{await browser.close();}
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
