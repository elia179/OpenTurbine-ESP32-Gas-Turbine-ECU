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
        assert.equal(route.request().headers()['x-openturbine-dashboard'],'1');
        if(failures-->0)return route.fulfill({status:503,json:{error:'busy'},headers:{'Retry-After':'1'}});
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
      await page.evaluate(()=>{
        applyData({mode:'STANDBY'});
        if (!document.getElementById('btn-stop').disabled) throw new Error('STOP should be idle in fresh STANDBY');
        setTelemetryStale(true, 6000);
        if (document.getElementById('btn-stop').disabled) throw new Error('Stale STANDBY blocked STOP');
        if (!document.getElementById('btn-start').disabled) throw new Error('Stale data must still block START');
        applyData({mode:'STANDBY'});
      });
      const controls = await page.evaluate(async () => {
        const stop = document.getElementById('btn-stop');
        const start = document.getElementById('btn-start');
        const originalFetch = window.fetch;
        const requests = [];
        window.fetch = (url, options) => {
          if (['/api/start','/api/start-limited','/api/stop','/api/hardware'].includes(url)) {
            requests.push([url,options?.method]);
            return Promise.resolve(new Response('{"ok":true}'));
          }
          return originalFetch(url,options);
        };
        try {
          applyData({mode:'STANDBY',extra_cooldown_active:true});
          const cooldown = {stopEnabled:!stop.disabled,startBlocked:start.disabled};
          stop.click();
          applyData({mode:'STANDBY',extra_cooldown_active:false,startup_seq_count:3});
          _telemetryStale = false;
          await showStartConfirm();
          const checks = document.getElementById('start-confirm-checks');
          const countShown = checks.textContent.includes('3 blocks');
          applyData({mode:'STANDBY',limited_start_allowed:true,limited_start_sensor:'TOT'});
          await confirmStart();
          const reconfirm = {
            updated:document.getElementById('btn-confirm-start').textContent === 'Start Reduced Power',
            notice:checks.textContent.includes('Review and confirm again'),
            requests:requests.length
          };
          await confirmStart();
          return {cooldown,requests,countShown,reconfirm};
        } finally {
          window.fetch = originalFetch;
        }
      });
      assert.deepEqual(controls.cooldown,{stopEnabled:true,startBlocked:true});
      assert.equal(controls.countShown,true);
      assert.deepEqual(controls.reconfirm,{updated:true,notice:true,requests:1});
      assert.deepEqual(controls.requests,[['/api/stop','POST'],['/api/start-limited','POST']]);
      await page.setViewportSize({width:667,height:320});
      await page.evaluate(() => showStartConfirm());
      const confirm = page.locator('#btn-confirm-start');
      await confirm.scrollIntoViewIfNeeded();
      await confirm.evaluate(button => {
        const bounds = button.getBoundingClientRect();
        if (bounds.top < 0 || bounds.bottom > innerHeight) throw new Error('START confirmation is clipped');
      });
      await page.evaluate(() => cancelStart());
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
      let busy = true;
      const second = await browser.newPage();
      await second.route('**/api/telemetry', route => busy
        ? route.fulfill({status:503,json:{error:'ECU is busy'},headers:{'Retry-After':'1'}}) : route.continue());
      await second.goto(base+'/index.html');
      await second.waitForFunction(()=>document.getElementById('telemetry-stale-banner')?.textContent.includes('ECU busy'));
      assert.equal(await second.locator('#btn-start').isDisabled(),true);
      assert.equal(await page.locator('#telemetry-stale-banner').isVisible(),false);
      busy = false;
      await second.locator('#telemetry-stale-banner').waitFor({state:'hidden'});
      await second.close();
      await page.route('**/api/command', route => route.fulfill({status:409, json:{error:'Transfer busy'}}));
      const abStopRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/ab-stop');
      assert.equal(await page.evaluate(async()=> (await sendAbCmd('AB_STOP')).ok), true);
      assert.equal((await abStopRequest).postData(), null);
      const unconfirmed = await page.evaluate(async()=>{
        const realFetch = window.fetch;
        const realAlert = window.alert;
        let attempts = 0;
        let message = '';
        window.alert = text => { message = text; };
        window.fetch = (url, options) => {
          if (url !== '/api/stop') return realFetch(url, options);
          attempts++;
          return new Promise((resolve, reject)=>{
            options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});
          });
        };
        try { return {reply:await sendCmd('/api/stop'), attempts, message}; }
        finally { window.fetch = realFetch; window.alert = realAlert; }
      });
      assert.equal(unconfirmed.attempts,1);
      assert.equal(unconfirmed.reply.ok,false);
      assert.match(unconfirmed.message,/STOP unconfirmed.*physical STOP/);
      assert.deepEqual(errors,[]);
      await page.close();
      console.log(`${bundle}: snapshots recover automatically, START stays locked with stale readings, and STOP paths remain available.`);
    }
  }finally{await browser.close();}
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
