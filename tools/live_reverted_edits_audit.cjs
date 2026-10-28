// Read-only real-device draft test. Checkbox changes are never saved.
const assert=require('node:assert/strict'),{chromium,request}=require('playwright');
(async()=>{
 const base=process.argv[2]||'http://192.168.4.1';
 const api=await request.newContext({baseURL:base,extraHTTPHeaders:{Connection:'close'}});
 const info=await(await api.get('/api/device_info')).json();
 assert.equal(info.state,'STANDBY');assert.equal(info.outputs_active,false);
 const browser=await chromium.launch();
 try{
  const p=await browser.newPage(),writes=[],errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(['POST','PATCH'].includes(r.method()))writes.push(r.url());});
  await p.goto(base+'/system.html?v=20261028d',{timeout:45000});
  await p.waitForFunction(()=>typeof _fieldSnap!=='undefined'&&'cf-tm_lh' in _fieldSnap);
  for(const path of ['cluster_serial.enabled','mavlink.enabled']){
   let checkbox=p.locator(`input[onchange*="${path}"]`);
   await checkbox.evaluate(el=>{let details=el.closest('details');while(details){details.open=true;details=details.parentElement.closest('details');}});
   const original=await checkbox.isChecked();
   await checkbox.setChecked(!original);
   assert.ok(await p.evaluate(()=>_cfgDirty&&_buildChanges().length>0));
   await checkbox.setChecked(original);
   assert.deepEqual(await p.evaluate(()=>({dirty:_cfgDirty,changes:_buildChanges(),disabled:document.getElementById('btn-save').disabled})),{dirty:false,changes:[],disabled:true});
   assert.equal(await p.locator('.save-bar').evaluate(el=>el.classList.contains('is-dirty')),false);
  }
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  console.log('Live System Cluster/MAVLink toggle/revert passed: no dirty state, no recap rows, Save disabled, zero writes.');
 }finally{await browser.close();await api.dispose();}
})().catch(e=>{console.error(e);process.exit(1)});
