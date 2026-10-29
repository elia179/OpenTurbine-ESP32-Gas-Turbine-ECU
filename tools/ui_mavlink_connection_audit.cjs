const assert=require('node:assert/strict');
const {chromium,firefox,webkit}=require('playwright');
const fs=require('node:fs'),{gunzipSync}=require('node:zlib');
(async()=>{
 globalThis.OT_UI_SIM_PORT=14951;await import('./ui_mock_server.mjs');
 for(const engine of [chromium,firefox,webkit])for(const packed of [false,true]){
  const browser=await engine.launch();try{
   const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   if(packed)await p.route(/\/(system\.html|controllers\.html|hardware\.html|theme\.js|app\.js|style\.css)(?:\?.*)?$/,r=>{const n=new URL(r.request().url()).pathname.slice(1);return r.fulfill({status:200,contentType:n.endsWith('html')?'text/html':n.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+n+'.gz'))});});
   await p.goto('http://127.0.0.1:14951/system.html');await p.locator('#system-device-setup').waitFor();
   await p.evaluate(()=>{hwCfg.mavlink={enabled:true,tx_pin:17,rx_pin:16,allow_commands:false};_clearDirty();renderSystemSetup();});
   const text=await p.locator('#system-device-setup').textContent();assert(!text.includes('OTC binary'));assert(text.includes('Remote engine commands'));assert(text.includes('Permitted controller system ID'));
   assert.notEqual(await p.locator('a[href*="hardware-comms-panel"]').evaluate(el=>getComputedStyle(el).color),'rgb(0, 0, 238)','setup links use the active theme colour');
   await p.evaluate(()=>{for(const [path,a,b] of [['allow_commands',true,false],['controller_system',33,255],['input_timeout_ms',750,500]]){setSystemHardware('mavlink.'+path,a);if(!_cfgDirty)throw Error('missing dirty '+path);setSystemHardware('mavlink.'+path,b);if(_cfgDirty)throw Error('revert remains dirty '+path);}hwCfg.mavlink.rx_pin=-1;renderSystemSetup();});
   assert(await p.locator('input[onchange*="mavlink.allow_commands"]').isDisabled());
   assert.equal(await p.locator('input[onchange*="mavlink.controller_system"]').count(),0);
   assert.equal(await p.locator('input[onchange*="mavlink.input_timeout_ms"]').count(),0);
   assert((await p.locator('#system-device-setup').textContent()).includes('Monitoring only'));
   await p.evaluate(()=>{if(hwCfg.mavlink.controller_system!==255||hwCfg.mavlink.input_timeout_ms!==500)throw Error('TX-only view changed retained RX settings');hwCfg.mavlink.rx_pin=16;renderSystemSetup();});
   assert.equal(await p.locator('input[onchange*="mavlink.controller_system"]').inputValue(),'255');
   assert.equal(await p.locator('input[onchange*="mavlink.input_timeout_ms"]').inputValue(),'500');
   await p.goto('http://127.0.0.1:14951/controllers.html');await p.waitForFunction(()=>!!hwCfg.channel_registry);
   await p.evaluate(()=>{hwCfg.mavlink={enabled:true,rx_pin:16};if(!simpleControlInputs().some(c=>c.id==='mavlink_throttle'))throw Error('missing virtual input');hwCfg.mavlink.rx_pin=-1;if(simpleControlInputs().some(c=>c.id==='mavlink_throttle'))throw Error('TX only exposes input');});
   await p.locator('#configured-controller-cards').waitFor({state:'attached'});
   await p.evaluate(()=>{
    hwCfg.mavlink={enabled:true,rx_pin:16};
    const output=simpleControlOutputs().find(c=>[5,6].includes(Number(c.driver))&&!c.virtual);
    if(!output)throw Error('missing mapped-output fixture');
    cfg.rules=[{controller_id:41,name:'Remote demand',enabled:true,kind:1,source:'mavlink_throttle',target:output.id,mode_mask:4,off_value:.12}];
    renderForm();
    const field=document.querySelector('input[onchange*="off_value"]');
    if(!field||Number(field.value)!==12)throw Error('legacy input-loss output is hidden or incorrectly scaled');
    cfg.rules[0].activate_events=4;cfg.rules[0].deactivate_events=24;renderForm();
    const body=document.querySelector('#configured-controller-cards').textContent;
    if(!body.includes("Uses the output's safe demand")||document.querySelector('input[onchange*="off_value"]'))throw Error('scheduled input-loss explanation differs from runtime');
   });
   await p.goto('http://127.0.0.1:14951/hardware.html');await p.locator('#hardware-comms-summary').waitFor();
   await p.evaluate(()=>{cfg.mavlink={enabled:true,tx_pin:17,rx_pin:16};_workflowEditOpen.add('comms');renderHardwareWorkflowSummaries();});
   const hardware=await p.locator('#hardware-comms-summary').textContent();assert(hardware.includes('MAVLink RX GPIO'));assert(!hardware.includes('OT Cluster serial'));
   await p.evaluate(()=>{cfg.mavlink={enabled:false,tx_pin:17,rx_pin:16,migration_review:true,legacy_cluster:{tx_pin:18,rx_pin:19,baud:115200}};chooseMavlinkRoute(true);if(cfg.mavlink.migration_review||cfg.mavlink.tx_pin!==18||cfg.mavlink.rx_pin!==19||cfg.mavlink.allow_commands)throw Error('migration selection failed');});
   assert.deepEqual(errors,[]);console.log(engine.name(),packed?'packaged':'source','MAVLink setup, dirty reverts, RX gating, input and migration passed');
  }finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
