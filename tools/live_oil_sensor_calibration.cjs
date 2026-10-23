const assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {chromium}=require('playwright');const base='http://192.168.4.1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function read(path){const r=await fetch(base+path);assert.ok(r.ok);return r.json();}
async function write(path,data){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const body=await r.json();assert.ok(r.ok&&body.ok!==false,JSON.stringify(body));return body;}
async function ready(){for(let i=0;i<50;i++){try{if((await read('/api/device_info')).state==='STANDBY')return;}catch{}if(i%5===0)execFileSync('netsh',['wlan','connect','name=OpenTurbine-S3-followup'],{stdio:'ignore'});await sleep(1000);}throw Error('ECU not ready');}
function stimulus(volts){execFileSync('python',['-c',`import sys;sys.path.insert(0,'dev/bench/harness');from otbench.tester import Tester\nwith Tester('COM3') as t:t.set('OILP',${volts})`],{stdio:'pipe'});}
(async()=>{
 const original=await read('/api/ecu_config');assert.equal((await read('/api/device_info')).target,'esp32s3dev');
 fs.writeFileSync('artifacts/v260-followup-s3-before-calibration.json',JSON.stringify(original));
 const h=structuredClone(original.hardware);h.channel_registry.inputs.push({id:'bench_oil_pressure',name:'Bench Oil Pressure',purpose:'oil_pressure',role:'pressure',driver:1,pin:1,min:0,max:4095,installed:true});
 let installed=false,browser;
 try{
  stimulus(.5);await write('/api/hardware',h);installed=true;await sleep(7000);await ready();
  browser=await chromium.launch({headless:true});const p=await browser.newPage(),commands=[],errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(new URL(r.url()).pathname==='/api/command')commands.push(r.postData());});
  await p.addInitScript(()=>{for(const k of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(k,'1');});
  await p.goto(base+'/calibration.html');await p.waitForFunction(()=>cfg.hardware&&live.mode==='STANDBY'&&Number(live.oil_raw)>100&&Number(live.oil_raw)<1500,null,{timeout:15000});
  await p.evaluate(()=>{window.__calMessages=[];window.alert=m=>window.__calMessages.push(String(m));});
  assert.equal(await p.locator('#oil-pump-assisted').isChecked(),false);
  await p.locator('#btn-oil-start').click();await p.waitForFunction(()=>oilCalActive,null,{timeout:10000});
  const zero=await p.evaluate(()=>oilPts[0].raw);stimulus(2.5);
  await p.waitForFunction(z=>Number(live.oil_raw)>z+1500,zero,{timeout:10000});
  await p.locator('#oil-pval').fill('5');await p.getByRole('button',{name:'Capture point',exact:true}).first().click();
  await p.locator('#btn-oil-to-3').click();await p.locator('#btn-oil-save').click();
  await p.waitForFunction(()=>window.__calMessages.some(m=>/saved|failed/i.test(m)),null,{timeout:30000});
  const messages=await p.evaluate(()=>window.__calMessages);assert.ok(messages.some(m=>m.includes('Oil pressure calibration saved')),JSON.stringify(messages));assert.deepEqual(commands,[]);
  const saved=await read('/api/ecu_config');const channel=saved.hardware.channel_registry.inputs.find(c=>c.id==='bench_oil_pressure');assert.equal(channel.calibration_points.length,2);assert.equal(saved.settings.oil.min_pct,original.settings.oil.min_pct);
  stimulus(1.5);await sleep(1700);const d=await read('/api/data');const bar=Number(d.oil);assert.ok(Math.abs(bar-2.5)<.3,`Midpoint ${bar} bar`);assert.equal(d.oil_pct,0);assert.deepEqual(errors,[]);
  console.log('S3 real DAC oil calibration passed: two ADC endpoints saved, midpoint',bar,'bar; zero pump commands, pump remained off and existing pump minimum retained.');
 }finally{
  if(browser)await browser.close();stimulus(0);
  if(installed){await write('/api/ecu_config',original);await sleep(7000);await ready();console.log('Original S3 engine file restored after sensor-only calibration.');}
 }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
