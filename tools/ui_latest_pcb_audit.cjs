const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,firefox,webkit}=require('playwright');
const {gunzipSync}=require('node:zlib');
const {latestPcbFixture,source}=require('./latest_pcb_fixture.cjs');
(async()=>{
 globalThis.OT_UI_SIM_PORT=15123;await import('./ui_mock_server.mjs');const base='http://127.0.0.1:15123';
 for(const engine of [chromium,firefox,webkit])for(const packed of [false,true]){
  const browser=await engine.launch();try{
   const p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
   if(packed)await p.route(/\/(hardware\.html|theme\.js|app\.js|style\.css)(?:\?.*)?$/,r=>{const name=new URL(r.request().url()).pathname.slice(1);return r.fulfill({status:200,contentType:name.endsWith('html')?'text/html':name.endsWith('js')?'application/javascript':'text/css',body:gunzipSync(fs.readFileSync('data/'+name+'.gz'))});});
   const initial=await(await p.request.get(base+'/__sim/state')).json();const fixture=latestPcbFixture(initial);
   const restored=await p.request.post(base+'/api/ecu_config',{data:fixture});assert(restored.ok(),await restored.text());await p.goto(base+'/hardware.html');
   await p.waitForFunction(()=>document.querySelector('#hardware-board-summary')?.textContent.includes('1.0-20261028'));
   assert.equal(await p.evaluate(()=>pcbProfile.ports.length),source.ports.length);
   const output=process.env.OT_PCB_PREVIEW;const shot=async(name,selector)=>{if(!output||engine!==chromium||packed)return;fs.mkdirSync(output,{recursive:true});const style=await p.addStyleTag({content:'.save-bar,body>nav{visibility:hidden!important}'});await p.locator(selector).screenshot({path:path.join(output,name+'.png'),animations:'disabled'});await style.evaluate(el=>el.remove());};
   await shot('01-board-profile','#hardware-board-summary');
   const add=async(purpose,connection,direction='input')=>{
    await p.getByRole('button',{name:'+ Add '+direction,exact:true}).click();
    await p.getByRole('button',{name:purpose}).click();
    await p.getByRole('button',{name:connection}).click();
    return p.locator('#registry-'+direction+'s .registry-card').last();
   };
   const n1=await add(/^N1 /,/Pulse input 1/);assert.match(await n1.textContent(),/J28/);assert.equal(await n1.getByText('GPIO pin',{exact:true}).count(),0);await shot('02-n1-connection','#registry-inputs .registry-card:last-child');
   await n1.getByRole('button',{name:'Done',exact:true}).click();
   const tot=await add(/TOT \/ EGT/,/Thermocouple 1/);assert.match(await tot.textContent(),/J43/);assert.equal(await p.evaluate(()=>cfg.channel_registry.inputs.at(-1).temp_interface),3);await shot('03-temperature-connection','#registry-inputs .registry-card:last-child');await tot.getByRole('button',{name:'Done',exact:true}).click();
   const oil=await add(/^Oil pressure /,/Analog input 1/);assert.match(await oil.textContent(),/J20/);assert.equal(await p.evaluate(()=>cfg.channel_registry.inputs.at(-1).i2c_reference_mv),5000);await shot('04-pressure-connection','#registry-inputs .registry-card:last-child');await oil.getByRole('button',{name:'Done',exact:true}).click();
   const starter=await add(/^Starter Electric starter/,/Pulse output 1/,'output');assert.match(await starter.textContent(),/J34/);assert.equal(await starter.getByText('GPIO pin',{exact:true}).count(),0);await shot('05-starter-connection','#registry-outputs .registry-card:last-child');await starter.getByRole('button',{name:'Done',exact:true}).click();
   await p.locator('#btn-edit-buses').click();assert.equal(await p.locator('#en-i2c').isDisabled(),true);assert.equal(await p.locator('#en-spi').isDisabled(),true);await shot('06-fixed-buses','#hardware-buses-panel');
   await p.locator('#btn-edit-comms').click();assert.match(await p.locator('#hardware-comms-summary').textContent(),/built-in PCB indicator/i);assert.equal(await p.getByText('Fault LED',{exact:true}).count(),1);assert.equal(await p.getByText('NeoPixel mode',{exact:true}).count(),0);await shot('07-indicators-and-serial','#hardware-comms-panel');
   assert.deepEqual(errors,[]);console.log(engine.name(),packed?'packaged':'source','latest PCB catalogue, labelled inputs/outputs, fixed buses, indicators and serial passed');
  }finally{await browser.close();}
 }
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
