// Bench-only browser check of the complete twelve-file web asset upload.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, request} = require('playwright');

if (!process.argv.includes('--allow-write')) throw new Error('Requires --allow-write on an idle bench ECU');
const base = process.argv.find(arg => /^http/.test(arg)) || 'http://192.168.4.1';
const root = path.resolve(__dirname, '..');
const names = ['calibration.html.gz','controllers.html.gz','hardware.html.gz','index.html.gz',
  'log.html.gz','sequence.html.gz','app.js.gz','style.css.gz','system.html.gz',
  'theme.js.gz','ui_dialog.js.gz','tools.html.gz'];
const files = names.map(name => path.join(root, 'data', name));

async function snapshot() {
  const api = await request.newContext({baseURL:base, extraHTTPHeaders:{Connection:'close'}});
  try {
    const infoResponse = await api.get('/api/device_info', {timeout:8000});
    const cfgResponse = await api.get('/api/ecu_config', {timeout:8000});
    const liveResponse = await api.get('/api/data', {timeout:8000});
    assert.ok(infoResponse.ok() && cfgResponse.ok() && liveResponse.ok());
    return {info:await infoResponse.json(), cfg:await cfgResponse.json(), live:await liveResponse.json()};
  } finally {await api.dispose();}
}

(async () => {
  const before = await snapshot();
  assert.equal(before.info.state, 'STANDBY');
  assert.equal(before.info.outputs_active, false);
  assert.equal(before.cfg.hardware.actuators.status_led.enabled, false);
  const candidates = [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ].filter(Boolean);
  const executablePath = candidates.find(candidate => fs.existsSync(candidate));
  const browser = await chromium.launch({headless:true, ...(executablePath ? {executablePath} : {})});
  let chunks = 0;
  try {
    const page = await browser.newPage();
    page.on('response', response => {
      if (new URL(response.url()).pathname === '/api/web_asset_chunk' && response.ok()) chunks++;
    });
    await page.goto(`${base}/system.html`, {waitUntil:'domcontentloaded', timeout:30000});
    await page.locator('#assets-files').waitFor({state:'attached'});
    await page.waitForFunction(() => typeof window.startSystemWebAssetsUpdate === 'function');
    await page.locator('#assets-files').setInputFiles(files);
    await page.waitForFunction(() => /Done.*rebooting/i.test(document.getElementById('assets-state')?.textContent || ''),
      null, {timeout:180000});
  } finally {await browser.close();}
  const expectedChunks = files.reduce((sum, file) => sum + Math.ceil(fs.statSync(file).size / 8192), 0);
  assert.equal(chunks, expectedChunks);
  let after;
  for (let attempt=0; attempt<40; attempt++) {
    try {
      after = await snapshot();
      if (after.live.boot_count > before.live.boot_count &&
          after.info.state === 'STANDBY' && after.info.outputs_active === false) break;
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(after);
  assert.ok(after.live.boot_count > before.live.boot_count, 'web asset upload did not reboot the ECU');
  assert.equal(after.info.build_id, before.info.build_id);
  assert.equal(after.cfg.hardware.actuators.status_led.enabled, false);
  assert.deepEqual(after.cfg.hardware.channel_registry, before.cfg.hardware.channel_registry);
  const html = await (await fetch(`${base}/hardware.html`)).text();
  assert.match(html, /Electrical output endpoints/);
  console.log(`Browser web asset update passed: 12 files, ${chunks} bounded chunks, profile retained, STANDBY, LED disabled.`);
})().catch(error => {console.error(error.stack || error); process.exit(1);});
