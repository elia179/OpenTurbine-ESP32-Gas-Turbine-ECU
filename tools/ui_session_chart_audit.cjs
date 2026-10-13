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
      // A slow older preview (including its error) must not replace a newer run.
      for(const status of [200,404]) {
        let release,started;
        const held=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>started=resolve);
        const delayed=async route=>{started();await held;await route.fulfill({status,contentType:'text/plain',body:status===200?'t_ms,tot_c\n0,111\n100,112':'Session not found'});};
        await page.route('**/api/session/log?run=41',delayed);
        const response=page.waitForResponse(r=>r.url().endsWith('/api/session/log?run=41'));
        await page.evaluate(()=>{previewSession(41);});await seen;
        await page.evaluate(()=>previewSession(42));
        await page.waitForFunction(()=>document.getElementById('session-preview-msg').textContent==='Run #42 - 2 rows');
        release();await response;
        await page.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>e.name.endsWith('/api/session/log?run=41')));
        // Wait for both the fulfilled response body and its preview callback.
        await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,100)));
        assert.equal(await page.locator('#session-preview-msg').textContent(),'Run #42 - 2 rows');
        assert.equal(await page.evaluate(()=>_sessionRows[0][1]),'650');
        await page.unroute('**/api/session/log?run=41',delayed);
      }
      const refresh=page.waitForRequest(r=>r.url().endsWith('/api/session/log?run=42'));
      await page.locator('#session-preview-refresh').click();await refresh;
      await page.waitForFunction(()=>document.getElementById('session-preview-msg').textContent==='Run #42 - 2 rows');
      const rejection=async route=>route.fulfill({status:423,contentType:'application/json',body:JSON.stringify({error:'Raw log download requires STANDBY with standby logging disabled'})});
      await page.route('**/api/log/raw',rejection);
      await page.getByRole('button',{name:'Event NDJSON',exact:true}).click();
      await page.locator('#ot-dialog-message').waitFor({state:'visible'});
      assert.equal(await page.locator('#ot-dialog-message').textContent(),'Raw log download requires STANDBY with standby logging disabled');
      await page.getByRole('button',{name:'OK',exact:true}).click();await page.unroute('**/api/log/raw',rejection);
      const unavailable=async route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Recorder is busy. Try again.'})});
      await page.route('**/api/session/log?run=42',unavailable);
      await page.locator('#session-preview-refresh').click();
      await page.waitForFunction(()=>document.getElementById('session-preview-msg').textContent==='Run #42: Recorder is busy. Try again.');
      await page.unroute('**/api/session/log?run=42',unavailable);
      await page.route('**/api/session/log',unavailable);
      await page.evaluate(()=>loadSessionPreview());
      assert.equal(await page.locator('#session-preview-msg').textContent(),'Recorder is busy. Try again.');
      assert.match(await page.locator('#session-rows').textContent(),/could not be loaded.*Refresh/);
      await page.unroute('**/api/session/log',unavailable);
      const currentRefresh=page.waitForRequest(r=>r.url().endsWith('/api/session/log'));
      await page.locator('#session-preview-refresh').click();await currentRefresh;
      await page.waitForFunction(()=>document.getElementById('session-preview-msg').textContent==='2 rows');
      const large=await page.evaluate(()=>{
        const headers=['t_ms','n1_rpm','tot_c','n2_rpm','oil_bar','thr_pct','tit_c','oil_temp_c','batt_v','fuel_press_bar','glow_pct','fuel_flow'];
        for(const [,cb] of CHART_COLS) document.getElementById(cb).checked=true;
        const rows=Array.from({length:20000},(_,i)=>[i*100,30000,650,5000,2,30,700,60,12,3,20,1].join(','));
        const result=renderSessionCsvPreview(headers.join(',')+'\n'+rows.join('\n'),'large session');
        return {result,rows:_sessionRows.length,canvas:document.getElementById('session-chart').width};
      });
      assert.equal(large.result,true);assert.equal(large.rows,20000);assert.ok(large.canvas>0);
      const metrics=await page.evaluate(()=>{
        // SessionLogger::println emits CRLF; the final header must still match.
        const csv='\uFEFFt_ms,p1_bar,p2_bar,torque_nm,shaft_power_w,thrust_n,starter_pct\r\n0,1,2,-5,1500,10,30\r\n100,2,3,5,2500,20,40\r\n';
        renderSessionCsvPreview(csv);
        return CHART_COLS.filter(([header])=>_sessionHeaders.includes(header)).map(([header,cb,label,,convert])=>({header,visible:getComputedStyle(document.getElementById(label)).display!=='none',scaled:convert(header==='shaft_power_w'?2500:5)}));
      });
      assert.deepEqual(metrics.map(m=>m.header).sort(),['p1_bar','p2_bar','torque_nm','shaft_power_w','thrust_n','starter_pct'].sort());
      assert.ok(metrics.every(m=>m.visible));assert.equal(metrics.find(m=>m.header==='shaft_power_w').scaled,2.5);
      assert.deepEqual(await page.evaluate(()=>[_sessionHeaders[0],_sessionRows[0].at(-1)]),['t_ms','30']);
      const timing=await page.evaluate(()=>{
        for(const [,id] of CHART_COLS) document.getElementById(id).checked=id==='chart-cb-tot';
        const proto=CanvasRenderingContext2D.prototype,move=proto.moveTo,line=proto.lineTo;
        const xs=[];
        proto.moveTo=function(x,y){if(this.strokeStyle==='#f59c3a')xs.push(x);return move.call(this,x,y);};
        proto.lineTo=function(x,y){if(this.strokeStyle==='#f59c3a')xs.push(x);return line.call(this,x,y);};
        try {renderSessionCsvPreview('t_ms,tot_c\n0,650\n1000,700\n10000,750');}
        finally {proto.moveTo=move;proto.lineTo=line;}
        return (xs[1]-xs[0])/(xs[2]-xs[0]);
      });
      assert.ok(Math.abs(timing-0.1)<1e-9,`one-second reading appears at ${timing} of a ten-second run`);
      const rollover=await page.evaluate(()=>{
        const proto=CanvasRenderingContext2D.prototype,original=proto.fillText;
        const labels=[];proto.fillText=function(text,...args){labels.push(text);return original.call(this,text,...args);};
        try {renderSessionCsvPreview('t_ms,tot_c\n4294966796,650\n0,700\n500,750');}
        finally {proto.fillText=original;}
        return labels;
      });
      assert.ok(rollover.includes('1.0 s'));assert.ok(!rollover.some(label=>/^-[\d.]+ s$/.test(label)));
      await page.locator('#chart-cb-tot').uncheck();
      assert.equal(await page.locator('#session-chart-message').textContent(),'Select a measurement above to plot it.');
      assert.equal(await page.locator('#session-chart').isVisible(),false);
      await page.locator('#chart-cb-tot').check();
      assert.equal(await page.locator('#session-chart').isVisible(),true);
      await page.evaluate(()=>renderSessionCsvPreview('t_ms,tot_c\n0,650'));
      assert.match(await page.locator('#session-chart-message').textContent(),/At least two readings/);
      await page.evaluate(()=>renderSessionCsvPreview('t_ms,tot_c\n0,nan\n100,Infinity'));
      assert.match(await page.locator('#session-chart-message').textContent(),/No valid readings/);
      // Missing, nonfinite and malformed cells must create gaps, not ruin the axes.
      const finite=await page.evaluate(()=>{
        const proto=CanvasRenderingContext2D.prototype, original=proto.lineTo;
        const coords=[];proto.lineTo=function(x,y){coords.push([x,y]);return original.call(this,x,y);};
        try {renderSessionCsvPreview('t_ms,tot_c\n0,650\n100,Infinity\n200,nan\n300,\n400,700');}
        finally {proto.lineTo=original;}
        return coords.every(pair=>pair.every(Number.isFinite));
      });
      assert.equal(finite,true);assert.deepEqual(errors,[]);
      const sensors=await page.evaluate(()=>{
        _unitPrefs.temp='C';
        const headers=['t_ms','sensor_Aux_Speed__speed_rpm','sensor_Aux_Temp__temp_c',
          'sensor_Aux_Pressure__pressure_bar','sensor_Aux_Flow__flow_l_min',
          'sensor_Aux_Current__current_a','sensor_Aux_Voltage__voltage_v',
          'sensor_Load__torque_nm','sensor_Load__thrust_n','sensor_LongUnbrokenSensorNameForMobile__custom_value'];
        window.sensorCsv=headers.join(',')+'\r\n0,3000,100,2,1,3,12,4,5,6\r\n100,4000,110,3,2,4,13,5,6,7\r\n';
        renderSessionCsvPreview(sensorCsv);
        return {visible:getComputedStyle(document.getElementById('session-chart-wrap')).display!=='none',
          scaled:_sessionExtraChartCols.map(([,id,,,scale])=>scale(100)),
          labels:[...document.querySelectorAll('#session-extra-chart-controls label')].map(el=>el.textContent)};
      });
      assert.equal(sensors.visible,true);
      assert.deepEqual(sensors.scaled,[0.1,100,10000,100,1000,1000,100,100,100]);
      assert.ok(sensors.labels.includes(' Load Nm'));assert.ok(sensors.labels.includes(' Load N'));
      await page.locator('#chart-cb-extra-2').check();
      const selected=await page.evaluate(()=>{
        renderSessionCsvPreview(sensorCsv);
        _unitPrefs.temp='F';redrawChart();
        return {checked:document.getElementById('chart-cb-extra-2').checked,
          temp:_sessionExtraChartCols[1][4](100),label:document.getElementById('chart-lbl-extra-2').textContent};
      });
      assert.equal(selected.checked,true);assert.equal(selected.temp,212);assert.match(selected.label,/°F/);
      await page.setViewportSize({width:390,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.evaluate(()=>renderSessionCsvPreview('t_ms,tot_c\r\n0,650\r\n100,700\r\n'));
      assert.equal(await page.locator('#session-extra-chart-controls input').count(),0);
      await page.close();
    }
    console.log('Session chart audit passed: download content and cleanup, preview selection/errors, CRLF/BOM files, standard/additional traces, timestamp spacing/rollover, empty-state recovery, 20,000-row logs, nonfinite gaps, mobile layout and packaged assets.');
  } finally {await browser.close();}
  process.exit(0);
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
