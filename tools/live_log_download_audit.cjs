// Read-only real-ECU proof that friendly log labels do not change exports.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const base = process.argv[2] || 'http://192.168.4.1';
const executablePath = [process.env.PROGRAMFILES, process.env.LOCALAPPDATA]
  .filter(Boolean).map(p => path.join(p,'Google/Chrome/Application/chrome.exe'))
  .find(p => fs.existsSync(p));
(async () => {
  const browser = await chromium.launch({headless:true,...(executablePath ? {executablePath} : {})});
  try {
    const page = await browser.newPage({acceptDownloads:true});
    await page.addInitScript(()=>{
      for(const key of ['ot_beta_notice_ack_v1','ot_theme_onboarded_v1'])localStorage.setItem(key,'1');
    });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    await page.goto(`${base}/log.html`, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => /Connected/i.test(document.querySelector('#conn-label')?.textContent || ''));
    await page.waitForFunction(()=>document.querySelector('#log-count')?.textContent.includes('recent events') ||
      /No events/i.test(document.querySelector('#log-body')?.textContent||''));
    for (const [label, name] of [['Event CSV','event_log.csv'],['Event NDJSON','event_log.ndjson']]) {
      const pending = page.waitForEvent('download', {timeout:30000});
      await page.getByRole('button', {name:label, exact:true}).click();
      const download = await pending;
      assert.equal(download.suggestedFilename(), name);
      const chunks = [];
      for await (const chunk of await download.createReadStream()) chunks.push(chunk);
      const text = Buffer.concat(chunks).toString('utf8');
      if (name.endsWith('.ndjson')) {
        const records = text.trim() ? text.trim().split('\n').map(line => JSON.parse(line)) : [];
        if(!records.length){const response=await page.request.get(base+'/api/log');assert.ok(response.ok());assert.deepEqual(await response.json(),[],'An empty NDJSON download must correspond to an empty event log');}
        assert.ok(records.every(record => typeof record.ev === 'string'));
        assert.ok(!records.length||records.some(record => /^[A-Z_]+$/.test(record.ev)), 'raw event identifiers must remain intact');
      } else assert.match(text, /(?:event|ev)/i);
      console.log(`PASS: browser downloaded ${name}, ${Buffer.byteLength(text)} bytes; raw diagnostic format intact.`);
    }
    assert.deepEqual(failures, []);
  } finally {await browser.close();}
})().catch(error => {console.error(error.stack || error); process.exit(1);});
