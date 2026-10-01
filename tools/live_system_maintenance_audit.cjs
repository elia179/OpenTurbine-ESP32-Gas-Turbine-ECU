// No-load bench check: reject an invalid engine file without changing Hardware.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
if (!process.argv.includes('--allow-write')) throw new Error('Requires an idle bench ECU and --allow-write');
const base = process.argv.find(arg => /^http/.test(arg)) || 'http://192.168.4.1';
const executablePath = [process.env.PROGRAMFILES,process.env.LOCALAPPDATA].filter(Boolean)
  .map(p=>path.join(p,'Google/Chrome/Application/chrome.exe')).find(fs.existsSync);
(async()=>{
  const before = await (await fetch(base+'/api/ecu_config')).json();
  const info = await (await fetch(base+'/api/device_info')).json();
  assert.equal(info.state,'STANDBY'); assert.equal(info.outputs_active,false);
  const browser = await chromium.launch({headless:true,executablePath});
  try {
    const page = await browser.newPage({acceptDownloads:true,viewport:{width:1200,height:900}});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/system.html',{waitUntil:'domcontentloaded'});
    await page.locator('#cfg-backup-btn').waitFor({state:'attached'});
    await page.locator('#system-backup-restore').evaluate(el=>{
      el.open=true;
      for(let p=el.parentElement;p;p=p.parentElement) if(p.tagName==='DETAILS') p.open=true;
    });
    const borders = await page.locator('#system-backup-restore').evaluate(el=>({
      top:getComputedStyle(el.querySelector('summary')).borderTopWidth,
      bottom:getComputedStyle(el.querySelector('.cfg-section')).borderBottomWidth
    }));
    assert.deepEqual(borders,{top:'0px',bottom:'0px'});
    const pending=page.waitForEvent('download'); await page.locator('#cfg-backup-btn').click();
    const download=await pending;
    const saved=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
    assert.deepEqual(saved.hardware,before.hardware);
    saved.hardware.profile_desc='X'.repeat(64);
    await page.locator('#cfg-restore-file').setInputFiles({name:'invalid-description.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
    await page.locator('#ot-dialog-confirm').click();
    await page.waitForFunction(()=>document.querySelector('#cfg-backup-state')?.textContent==='Error');
    await page.waitForTimeout(3500);
    assert.equal(await page.locator('#cfg-backup-state').textContent(),'Error');
    assert.match(await page.locator('#cfg-backup-msg').textContent(),/63 UTF-8 bytes/);
    const after=await (await fetch(base+'/api/ecu_config')).json();
    assert.deepEqual(after.hardware,before.hardware);
    assert.deepEqual(errors,[]);
    console.log(`${info.chip}: clean Maintenance borders; browser backup download verified; invalid restore explanation survives the backup timer; Hardware unchanged.`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
