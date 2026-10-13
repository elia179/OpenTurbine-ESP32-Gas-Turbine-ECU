const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {gunzipSync} = require('node:zlib');
const {chromium} = require('playwright');
const roots=[process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean);
const executablePath=roots.flatMap(root=>[path.join(root,'Google','Chrome','Application','chrome.exe'),path.join(root,'Microsoft','Edge','Application','msedge.exe')]).find(file=>fs.existsSync(file));
(async()=>{
  const port=14000+Math.floor(Math.random()*200);
  globalThis.OT_UI_SIM_PORT=port;
  await import('./ui_mock_server.mjs');
  const base=`http://127.0.0.1:${port}`;
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  try {
    for(const bundle of ['source','packaged']) {
      const page=await browser.newPage({viewport:{width:390,height:844}});
      await page.request.post(base+'/__sim/scenario/minimal');
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      let requests=0;
      page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/ecu_config'))requests++;});
      if(bundle==='packaged') await page.route(/\/(system|calibration)\.html(?:\?.*)?$/,route=>route.fulfill({status:200,contentType:'text/html',body:gunzipSync(fs.readFileSync(path.resolve(__dirname,'../data/'+new URL(route.request().url()).pathname.slice(1)+'.gz')))}));
      await page.addInitScript(()=>{
        localStorage.setItem('ot_beta_notice_ack_v1','1');localStorage.setItem('ot_theme_onboarded_v1','1');
        const read=FileReader.prototype.readAsText;
        FileReader.prototype.readAsText=function(...args){
          const fault=window.failEngineFileRead;
          if(!fault)return read.apply(this,args);
          window.failEngineFileRead=null;
          if(fault==='throw'){window.fileReadFaultDelivered=true;throw new DOMException('Read unavailable','NotReadableError');}
          queueMicrotask(()=>{this.dispatchEvent(new ProgressEvent(fault));window.fileReadFaultDelivered=true;});
        };
      });
      const file={name:'saved-engine.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(await (await page.request.get(base+'/api/ecu_config')).json()))};
      for(const fault of ['error','abort','throw']) {
        await page.goto(base+'/system.html');
        await page.waitForFunction(()=>typeof runtimeMode!=='undefined'&&runtimeMode==='STANDBY');
        await page.evaluate(kind=>{window.failEngineFileRead=kind;window.fileReadFaultDelivered=false;},fault);
        await page.locator('#cfg-restore-file').setInputFiles(file);
        await page.locator('#ot-dialog-confirm').click();
        await page.waitForFunction(()=>window.fileReadFaultDelivered);
        assert.equal(await page.locator('#cfg-restore-btn').isDisabled(),false,'file-read failure must unlock retry');
        assert.equal(await page.locator('#cfg-restore-file').inputValue(),'');
        assert.equal(await page.locator('#cfg-backup-state').textContent(),'Error');
        assert.match(await page.locator('#cfg-backup-msg').textContent(),/Select.*again/i);
        assert.equal(requests,0,'unreadable files must not reach the ECU');
      }
      // Selecting that same file after the failure must trigger a real restore.
      let releaseRestore;
      const heldRestore=new Promise(resolve=>releaseRestore=resolve);
      const holdPost=async route=>{if(route.request().method()==='POST')await heldRestore;await route.continue();};
      await page.route('**/api/ecu_config',holdPost);
      await page.locator('#cfg-restore-file').setInputFiles(file);
      const posted=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/api/ecu_config'));
      await page.locator('#ot-dialog-confirm').click();
      const payload=(await posted).postDataJSON();
      assert.ok(payload.hardware&&payload.settings);
      await page.evaluate(()=>window.applyData({mode:'STANDBY'}));
      assert.equal(await page.locator('#cfg-restore-btn').isDisabled(),true,'status refresh must not unlock a pending restore');
      await page.locator('#cfg-restore-file').setInputFiles(file);
      assert.equal(await page.locator('#cfg-restore-file').inputValue(),'');
      assert.equal(requests,1);
      releaseRestore();
      await page.locator('#reboot-overlay.show').waitFor();
      await page.unroute('**/api/ecu_config',holdPost);
      assert.equal(requests,1);
      await page.request.post(base+'/__sim/reset');
      for(const role of ['throttle','idle']) {
        const prefix=role==='throttle'?'th':'idle';
        await page.request.post(base+'/__sim/data',{data:{mode:'STANDBY',[role+'_input_type']:'adc',[role+'_input_raw']:1000}});
        await page.goto(base+'/calibration.html');
        await page.waitForFunction(role=>calibrationConnected()&&live[role+'_input_raw']===1000&&live[role+'_input_type']==='adc',role);
        const captured=async value=>page.waitForFunction(({role,value,maximum})=>
          (role==='throttle'?(maximum?thMax:thMin):(maximum?idleMax:idleMin))===value&&!_operatorCaptureBusy[role],{role,value:value[0],maximum:value[1]});
        const stimulus=async raw=>{
          await page.request.post(base+'/__sim/data',{data:{[role+'_input_raw']:raw}});
          await page.waitForFunction(({role,raw})=>live[role+'_input_raw']===raw,{role,raw});
        };
        await page.locator('#btn-'+prefix+'-cap-min').click();await captured([1000,false]);
        await stimulus(3000);
        await page.locator('#btn-'+prefix+'-cap-max').click();await captured([3000,true]);
        assert.equal(await page.locator('#btn-'+prefix+'-save').isDisabled(),false);
        await stimulus(null);
        await page.locator('#btn-'+prefix+'-cap-min').click();
        assert.equal(await page.locator('#btn-'+prefix+'-save').isDisabled(),true);
        assert.equal(await page.locator('#btn-'+prefix+'-cap-max').isDisabled(),true);
        await page.waitForFunction(prefix=>document.getElementById(prefix+'-status').textContent.startsWith('Capture failed.'),prefix);
        await page.locator('#ot-dialog-confirm').click();
        assert.equal(await page.locator('#btn-'+prefix+'-cap-min').isDisabled(),false);
        await captured([null,false]);
        await stimulus(1200);
        await page.locator('#btn-'+prefix+'-cap-min').click();await captured([1200,false]);
        assert.equal(await page.locator('#btn-'+prefix+'-save').isDisabled(),false);
        await page.locator('#btn-'+prefix+'-cap-max').click();
        await page.request.post(base+'/__sim/data',{data:{[role+'_input_type']:'servo',[role+'_input_us']:1500,['rc_'+role+'_valid']:true}});
        await page.waitForFunction(prefix=>document.getElementById(prefix+'-status').textContent.includes('Input type changed'),prefix);
        await page.locator('#ot-dialog-confirm').click();
        await captured([null,false]);await captured([null,true]);
        assert.equal(await page.locator('#btn-'+prefix+'-save').isDisabled(),true);
      }
      assert.deepEqual(errors,[]);
      await page.close();
    }
    console.log('Restore/calibration recovery audit passed: file-read error/abort/exception and same-file retry; throttle/idle recapture failures, capture locking, fresh retries and changed-input rejection; source and packaged mobile pages.');
  } finally {await browser.close();}
  process.exit(0);
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
