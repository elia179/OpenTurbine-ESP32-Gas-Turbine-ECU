const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15129;await import('./ui_mock_server.mjs');const base='http://127.0.0.1:15129';
 for(const [name,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch();
  try{for(const packed of [false,true]){
   const p=await browser.newPage();await p.addInitScript(()=>{localStorage.setItem('ot_beta_notice_ack_v1','1');localStorage.setItem('ot_theme_onboarded_v1','1');});
   await p.addInitScript(()=>{
    const native=window.fetch.bind(window);
    window.fetch=(input,init={})=>{
     const url=new URL(typeof input==='string'?input:input.url,location.href);
     if(url.pathname!=='/api/__body_timeout_probe')return native(input,init);
     const stream=new ReadableStream({start(controller){
      const abort=()=>controller.error(new DOMException('Probe transport aborted','AbortError'));
      if(init.signal?.aborted)abort();else init.signal?.addEventListener('abort',abort,{once:true});
     }});
     return Promise.resolve(new Response(stream,{status:200,headers:{'Content-Type':url.searchParams.get('csv')?'text/csv':'application/json'}}));
    };
   });
   if(packed)await p.route(/\/(?:system\.html|app\.js|theme\.js|ui_dialog\.js)(?:\?.*)?$/,r=>{const file=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({contentType:file.endsWith('html')?'text/html':'application/javascript',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});});
   await p.request.post(base+'/__sim/scenario/minimal');await p.goto(base+'/system.html');await p.waitForFunction(()=>typeof startSystemOTA==='function'&&runtimeMode==='STANDBY'&&!!document.getElementById('ota-btn'));
   await p.evaluate(async()=>{
    for(const [method,suffix]of [['POST',''],['GET','?csv=1']]){
     const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25);
     const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error(method+' body timeout was detached at headers')),1500));
     let aborted=false;
     try{await Promise.race([fetch('/api/__body_timeout_probe'+suffix,{method,signal:controller.signal}).then(r=>r.text()),timeout]);}
     catch(error){if(!controller.signal.aborted||!['AbortError','TypeError'].includes(error.name))throw error;aborted=true;}
     finally{clearTimeout(timer);}
     if(!aborted)throw Error(method+' stalled body accepted');
    }
   });
   const result=await p.evaluate(async()=>{
    const actualFetch=window.fetch,actualTimer=window.setTimeout,actualXHR=window.XMLHttpRequest,actualOverlay=window.OTShowRebootOverlay;let overlays=0;const result=[];
    window.OTShowRebootOverlay=()=>overlays++;
    try{
     for(const body of ['{}','null','not JSON','{"ok":false,"error":"denied"}','{"ok":"true"}']){
      let writes=0;window.fetch=async()=>{writes++;return new Response(body,{status:200});};
      await startSystemOTA({files:[new File(['image'],'firmware.bin')],value:'chosen'});
      if(writes!==1||document.getElementById('ota-state').textContent!=='Error'||document.getElementById('ota-btn').disabled)throw Error('invalid firmware acknowledgement accepted/retried');
      result.push(body);
     }
     let writes=0;window.fetch=async()=>{writes++;return new Response('{"ok":true}',{status:503});};
     await startSystemOTA({files:[new File(['image'],'firmware.bin')],value:'chosen'});
     if(writes!==1||document.getElementById('ota-state').textContent!=='Error')throw Error('HTTP rejection accepted');
     window.setTimeout=(fn,ms,...args)=>actualTimer(fn,ms===20000?10:ms===800?1:ms,...args);
     for(const bodyStall of [false,true]){
      let writes=0;
      window.fetch=async(url,options)=>{writes++;const stalled=()=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError'))));return bodyStall?{ok:true,json:stalled}:stalled();};
      await startSystemOTA({files:[new File(['image'],'firmware.bin')],value:'chosen'});
      if(writes!==5||document.getElementById('ota-state').textContent!=='Error'||overlays)throw Error('stalled update not bounded');
     }
     const offsets=[];window.fetch=async url=>{offsets.push(Number(new URL(url,location.origin).searchParams.get('offset')));if(offsets.length===1)throw new TypeError('lost response');return new Response('{"ok":true}',{status:200});};
     await startSystemOTA({files:[new File([new Uint8Array(9000)],'firmware.bin')],value:'chosen'});
     if(JSON.stringify(offsets)!=='[0,0,4096,8192]'||overlays!==1||!document.getElementById('ota-state').textContent.startsWith('Done'))throw Error('chunk retry or progress wrong');
     const names=['calibration.html.gz','controllers.html.gz','hardware.html.gz','index.html.gz','log.html.gz','sequence.html.gz','app.js.gz','style.css.gz','system.html.gz','theme.js.gz','ui_dialog.js.gz','tools.html.gz'];
     const files=names.map(name=>new File(['x'],name));
     for(const [status,body,success] of [[200,'{}',false],[200,'null',false],[200,'{"ok":"true"}',false],[500,'{"ok":true}',false],[200,'{"ok":true}',true]]){
      let writes=0;window.XMLHttpRequest=class{constructor(){this.upload={};}open(){}setRequestHeader(){}send(){writes++;this.status=status;this.responseText=body;queueMicrotask(()=>this.onload());}};
      startSystemWebAssetsUpdate({files,value:'chosen'});
      for(let n=0;n<100&&!/^(Error|Done)/.test(document.getElementById('assets-state').textContent);n++)await new Promise(resolve=>actualTimer(resolve,5));
      if(writes!==(success?12:1)||document.getElementById('assets-state').textContent.startsWith('Done')!==success)throw Error('web assets accepted bad acknowledgement/HTTP status');
     }
     if(overlays!==2)throw Error('false reboot overlay');return result.length;
    }finally{window.fetch=actualFetch;window.setTimeout=actualTimer;window.XMLHttpRequest=actualXHR;window.OTShowRebootOverlay=actualOverlay;}
   });assert.equal(result,5);console.log(`${name} ${packed?'compressed':'source'}: strict firmware/web acknowledgements, bounded header/body stalls, exact-offset retries and complete progress passed`);await p.close();
  }}finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
