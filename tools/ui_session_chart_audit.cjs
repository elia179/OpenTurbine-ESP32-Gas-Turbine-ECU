const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {gunzipSync} = require('node:zlib');
const {chromium} = require('playwright');
const roots=[process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean);
const executablePath=roots.flatMap(root=>[path.join(root,'Google','Chrome','Application','chrome.exe'),path.join(root,'Microsoft','Edge','Application','msedge.exe')]).find(file=>fs.existsSync(file));
(async()=>{
  const port=13700+Math.floor(Math.random()*200);
  globalThis.OT_UI_SIM_PORT=port;
  await import('./ui_mock_server.mjs');
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  try {
    for(const bundle of ['source','packaged']) {
      const page=await browser.newPage({viewport:{width:1200,height:900}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{
        window.activeDownloadUrls=new Set();
        const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
        URL.createObjectURL=blob=>{const url=create(blob);activeDownloadUrls.add(url);return url;};
        URL.revokeObjectURL=url=>{activeDownloadUrls.delete(url);revoke(url);};
      });
      if(bundle==='packaged') await page.route(/\/log\.html(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'text/html',body:gunzipSync(fs.readFileSync(path.resolve(__dirname,'../data/log.html.gz')))}));
      await page.goto(`http://127.0.0.1:${port}/log.html`);
      await page.locator('#tab-session').click();
      await page.waitForFunction(()=>typeof _sessionTabLoad!=='undefined' && _sessionTabLoad===null);
      const csv='t_ms,tot_c\n0,650\n100,700\n',raw='{"event":"test"}\n';
      await page.route(/\/api\/(?:log\/(?:csv|raw)|session\/log)(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'text/plain',body:route.request().url().includes('/raw')?raw:csv}));
      for(let repeat=0;repeat<2;repeat++) {
        for(const [call,filename,content] of [
          ["downloadLog('raw')",/^event_log\.ndjson$/,raw],
          ["downloadLog('csv')",/^event_log\.csv$/,csv],
          ['downloadSessionLog()',/^session_\d+\.csv$/,csv],
          ['downloadSession(42)',/^session_42\.csv$/,csv]
        ]) {
          const ready=page.waitForEvent('download');
          await page.evaluate(call);
          const download=await ready;
          assert.match(download.suggestedFilename(),filename);
          assert.equal(fs.readFileSync(await download.path(),'utf8'),content);
        }
      }
      await page.waitForFunction(()=>activeDownloadUrls.size===0);
      assert.equal(await page.locator('a[href^="blob:"]').count(),0);
      const large=await page.evaluate(()=>{
        const headers=['t_ms','n1_rpm','tot_c','n2_rpm','oil_bar','thr_pct','tit_c','oil_temp_c','batt_v','fuel_press_bar','glow_pct','fuel_flow'];
        for(const [,cb] of CHART_COLS) document.getElementById(cb).checked=true;
        const rows=Array.from({length:20000},(_,i)=>[i*100,30000,650,5000,2,30,700,60,12,3,20,1].join(','));
        const result=renderSessionCsvPreview(headers.join(',')+'\n'+rows.join('\n'),'large session');
        return {result,rows:_sessionRows.length,canvas:document.getElementById('session-chart').width};
      });
      assert.equal(large.result,true);assert.equal(large.rows,20000);assert.ok(large.canvas>0);
      const metrics=await page.evaluate(()=>{
        const csv='t_ms,p1_bar,p2_bar,torque_nm,shaft_power_w,thrust_n,starter_pct\n0,1,2,-5,1500,10,30\n100,2,3,5,2500,20,40';
        renderSessionCsvPreview(csv);
        return CHART_COLS.filter(([header])=>_sessionHeaders.includes(header)).map(([header,cb,label,,convert])=>({header,visible:getComputedStyle(document.getElementById(label)).display!=='none',scaled:convert(header==='shaft_power_w'?2500:5)}));
      });
      assert.deepEqual(metrics.map(m=>m.header).sort(),['p1_bar','p2_bar','torque_nm','shaft_power_w','thrust_n','starter_pct'].sort());
      assert.ok(metrics.every(m=>m.visible));assert.equal(metrics.find(m=>m.header==='shaft_power_w').scaled,2.5);
      // Missing, nonfinite and malformed cells must create gaps, not ruin the axes.
      const finite=await page.evaluate(()=>{
        const proto=CanvasRenderingContext2D.prototype, original=proto.lineTo;
        const coords=[];proto.lineTo=function(x,y){coords.push([x,y]);return original.call(this,x,y);};
        try {renderSessionCsvPreview('t_ms,tot_c\n0,650\n100,Infinity\n200,nan\n300,\n400,700');}
        finally {proto.lineTo=original;}
        return coords.every(pair=>pair.every(Number.isFinite));
      });
      assert.equal(finite,true);assert.deepEqual(errors,[]);
      await page.setViewportSize({width:390,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.close();
    }
    console.log('Session chart audit passed: repeated downloads preserve filenames/content and release Blob URLs; 20,000-row logs, all traces, power units, nonfinite gaps, mobile layout and packaged assets.');
  } finally {await browser.close();}
  process.exit(0);
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
