const assert=require('node:assert/strict'),fs=require('node:fs'),{gunzipSync}=require('node:zlib');
const {chromium}=require('playwright');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15125;await import('./ui_mock_server.mjs');
 const base='http://127.0.0.1:15125',browser=await chromium.launch();
 try{for(const packed of [false,true]){
  const page=await browser.newPage();
  await page.addInitScript(()=>{localStorage.setItem('ot_beta_notice_ack_v1','1');localStorage.setItem('ot_theme_onboarded_v1','1');});
  if(packed)await page.route(/\/(?:controllers\.html|sequence\.html|hardware\.html|ui_dialog\.js)(?:\?.*)?$/,r=>{const file=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({contentType:file.endsWith('html')?'text/html':'application/javascript',body:gunzipSync(fs.readFileSync('data/'+file+'.gz'))});});
  await page.goto(base+'/hardware.html');await page.waitForFunction(()=>typeof registryStatus==='function'&&cfg.channel_registry&&!_hwLoading);
  await page.evaluate(()=>{const c=registryRoot().inputs[0];c.name='ä'.repeat(11)+'a';if(registryStatus(c).text.includes('UTF-8'))throw Error('valid 23-byte channel name rejected');c.name='ä'.repeat(12);if(!registryStatus(c).text.includes('UTF-8'))throw Error('24-byte channel name accepted');});
  await page.goto(base+'/sequence.html');await page.waitForFunction(()=>typeof validateCustomBlockLimits==='function'&&hwCfg.channel_registry&&!_seqLoading);
  const sequence=await page.evaluate(()=>{
   const errors=[];for(const [name,desc,expected]of [['ä'.repeat(15)+'a','ß'.repeat(47)+'x',false],['ä'.repeat(16),'',true],['Short','ß'.repeat(48),true]]){
    hwCfg.custom_blocks={custom_test:{label:name,desc,type:'wait',duration_ms:1000}};
    const found=validateCustomBlockLimits();if(found.length!==Number(expected))throw Error('UTF-8 block boundary mismatch: '+JSON.stringify(found));errors.push(...found);
   }
   return errors;
  });assert(sequence.every(text=>text.includes('UTF-8 bytes')));
  await page.goto(base+'/controllers.html');await page.waitForFunction(()=>typeof validateBeforeSave==='function'&&hwCfg.channel_registry&&cfg.rules);
  const result=await page.evaluate(async()=>{
   const bytes=value=>new TextEncoder().encode(value).length;
   for(const name of ['Engine oil pressure two','ä'.repeat(11)+'a','測試'.repeat(8)]){
    const channel={id:'name_test',name,purpose:'oil_pump',role:'oil_pump',driver:4,installed:true};
    const generated=_defaultRuleForOutput(channel).name;if(!generated||bytes(generated)>23||generated.includes('\ufffd'))throw Error('invalid automatically generated controller name');
   }
   for(const value of ['ä'.repeat(12),'😀'.repeat(8),'測試'.repeat(8)]){
    const generated=OTTruncateUtf8(value,23);if(bytes(generated)>23||generated.includes('\ufffd'))throw Error('generated name split UTF-8 character');
   }

   const original=OTDialog.alert;let message='';OTDialog.alert=async text=>{message+=text;};
   try{cfg.rules=[{name:'ä'.repeat(12),enabled:false,kind:3,target:'request_shutdown',mode_mask:4}];_controllerRulesDirty=true;const accepted=await validateBeforeSave(cfg);return {accepted,message};}
   finally{OTDialog.alert=original;}
  });assert.equal(result.accepted,false);assert.match(result.message,/controller name to 23 UTF-8 bytes/);
  console.log('PASS '+(packed?'compressed':'source')+' UTF-8 block/controller name boundaries');await page.close();
 }}finally{await browser.close();}process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
