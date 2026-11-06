// Read-only real-device draft test. Checkbox changes are never saved.
const assert=require('node:assert/strict'),{chromium,request}=require('playwright');
(async()=>{
 const base=process.argv[2]||'http://192.168.4.1';
 const api=await request.newContext({baseURL:base,extraHTTPHeaders:{Connection:'close'}});
 const info=await(await api.get('/api/device_info')).json();
 assert(['STANDBY','FAULT'].includes(info.state),'unexpected initial engine state');assert.equal(info.outputs_active,false);
 const browser=await chromium.launch();
 try{
  const p=await browser.newPage(),writes=[],errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(['POST','PATCH'].includes(r.method()))writes.push(r.url());});
  await p.goto(base+'/system.html?v='+require('./web_revision.cjs'),{timeout:45000});
  await p.waitForFunction(()=>typeof _fieldSnap!=='undefined'&&'cf-tm_lh' in _fieldSnap);
  for(const path of ['mavlink.enabled','mavlink.allow_commands','mavlink.baud','mavlink.interval_ms','profile_desc']){
   const result=await p.evaluate(path=>{
    const before=getPath(hwCfg,path.split('.'));
    const value=typeof before==='boolean'?!before:before===undefined?true:typeof before==='number'?before+1:'Temporary edit';
    setSystemHardware(path,value);
    const dirty=_cfgDirty&&_buildChanges().length>0;
    setSystemHardware(path,before);
    return {dirty,clean:!_cfgDirty,changes:_buildChanges(),disabled:document.getElementById('btn-save').disabled,bar:document.querySelector('.save-bar').classList.contains('is-dirty')};
   },path);
   assert.ok(result.dirty,path);assert.ok(result.clean&&result.disabled&&!result.bar,path);assert.deepEqual(result.changes,[],path);
  }
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  console.log('Live System MAVLink and engine-description edit/revert passed: no dirty state, no recap rows, Save disabled, zero writes.');
 }finally{await browser.close();await api.dispose();}
})().catch(e=>{console.error(e);process.exit(1)});
