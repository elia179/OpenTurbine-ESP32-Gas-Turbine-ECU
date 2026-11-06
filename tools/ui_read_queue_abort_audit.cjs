const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium,firefox,webkit}=require('playwright');
(async()=>{
 for(const [name,type] of Object.entries({chromium,firefox,webkit})){
  const browser=await type.launch();
  try{for(const packed of [false,true]){
   const p=await browser.newPage();
   await p.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
   await p.addInitScript(()=>{
    window.probeStarted=[];
    window.fetch=(input,init={})=>{
     if(init.signal?.aborted)return Promise.reject(new DOMException('Cancelled before send','AbortError'));
     const path=new URL(input,location.href).pathname;window.probeStarted.push(path);
     if(path==='/api/data')return Promise.resolve(new Response('{"ready":true}',{headers:{'Content-Type':'application/json'}}));
     return Promise.resolve(new Response(new ReadableStream({start(controller){init.signal?.addEventListener('abort',()=>controller.error(new DOMException('Probe aborted','AbortError')),{once:true});}}),{headers:{'Content-Type':'application/json'}}));
    };
   });
   await p.goto('http://127.0.0.1:15135/');
   await p.addScriptTag({content:packed?gunzipSync(fs.readFileSync('data/ui_dialog.js.gz')).toString():fs.readFileSync('data_src/ui_dialog.js','utf8')});
   for(const helper of [false,true]){
    const result=await p.evaluate(async helper=>{
     window.probeStarted=[];
     const head=new AbortController(),tail=new AbortController();
     const first=fetch('/api/config',{signal:head.signal}).catch(()=>{});
     await new Promise(resolve=>setTimeout(resolve,20));
     const second=helper?OTReadJson('/api/hardware',{attempts:1,timeoutMs:25,budgetMs:100}):fetch('/api/hardware',{signal:tail.signal});
     const timer=setTimeout(()=>tail.abort(),25);
     const outcome=await Promise.race([second.then(()=> 'resolved',e=>e.name),new Promise(resolve=>setTimeout(()=>resolve('deadline missed'),400))]);
     const startedBeforeRelease=[...window.probeStarted];
     clearTimeout(timer);head.abort();await first;await second.catch(()=>{});
     const recovered=await(await fetch('/api/data')).json();
     return {outcome,startedBeforeRelease,startedAfterRelease:[...window.probeStarted],recovered};
    },helper);
    assert.equal(result.outcome,'AbortError');
    assert.deepEqual(result.startedBeforeRelease,['/api/config'],'An aborted queued read must not start concurrently');
    assert.deepEqual(result.startedAfterRelease,['/api/config','/api/data'],'A cancelled queued read must not be sent later');
    assert.deepEqual(result.recovered,{ready:true});
   }
   await p.close();console.log(`PASS ${name} ${packed?'gzip':'source'}: queued fetch and metadata-helper deadlines, no late transmission, queue recovery`);
  }}finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exit(1)});
