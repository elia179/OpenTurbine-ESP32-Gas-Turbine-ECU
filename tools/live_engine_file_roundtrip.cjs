// Bench-only browser check: downloads the current engine file, uploads the
// identical file, and verifies that the ECU rebooted with the profile intact.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, request } = require('playwright');

if (!process.argv.includes('--allow-write')) throw new Error('Requires --allow-write on an idle bench ECU');
const base = process.argv.find(arg => /^http/.test(arg)) || 'http://192.168.4.1';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function readJson(route) {
  const api = await request.newContext({baseURL:base, extraHTTPHeaders:{Connection:'close'}});
  try {
    const response = await api.get(route, {timeout:8000});
    assert.ok(response.ok(), `${route}: HTTP ${response.status()}`);
    return await response.json();
  } finally { await api.dispose(); }
}

async function waitForProfile(expected, beforeBoot) {
  for (let attempt = 0; attempt < 55; attempt++) {
    try {
      const info = await readJson('/api/device_info');
      const actual = await readJson('/api/ecu_config');
      const live = await readJson('/api/data');
      if (live.boot_count > beforeBoot && info.state === 'STANDBY' && info.outputs_active === false &&
          JSON.stringify(actual.hardware.channel_registry) === JSON.stringify(expected.hardware.channel_registry) &&
          JSON.stringify(actual.hardware.startup_seq) === JSON.stringify(expected.hardware.startup_seq) &&
          actual.hardware.actuators.status_led.enabled === false) return;
    } catch (_) {}
    await delay(1000);
  }
  throw new Error('ECU did not return in STANDBY with the original registry, sequence, and LED state');
}

(async () => {
  const beforeInfo = await readJson('/api/device_info');
  assert.equal(beforeInfo.state, 'STANDBY');
  assert.equal(beforeInfo.outputs_active, false);
  const before = await readJson('/api/ecu_config');
  const beforeBoot = (await readJson('/api/data')).boot_count;
  assert.equal(before.hardware.actuators.status_led.enabled, false);
  const candidates = [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ].filter(Boolean);
  const executablePath = candidates.find(candidate => fs.existsSync(candidate));
  const browser = await chromium.launch({headless:true, ...(executablePath ? {executablePath} : {})});
  try {
    const context = await browser.newContext({acceptDownloads:true});
    const page = await context.newPage();
    await page.goto(`${base}/system.html`, {waitUntil:'domcontentloaded', timeout:30000});
    await page.locator('#cfg-backup-btn').waitFor({state:'attached', timeout:20000});
    await page.waitForFunction(() => typeof window.backupConfig === 'function' && typeof window.restoreConfig === 'function');
    const downloadPromise = page.waitForEvent('download', {timeout:30000});
    await page.evaluate(() => window.backupConfig());
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^OpenTurbine_.*\.json$/);
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const saved = JSON.parse(buffer.toString('utf8'));
    assert.deepEqual(saved.hardware.channel_registry, before.hardware.channel_registry);
    assert.deepEqual(saved.hardware.startup_seq, before.hardware.startup_seq);
    console.log(`Downloaded and verified ${download.suggestedFilename()} (${buffer.length} bytes).`);

    await page.locator('#cfg-restore-file').setInputFiles({name:'OpenTurbine-roundtrip.json', mimeType:'application/json', buffer});
    await page.locator('#ot-dialog-confirm:visible').click();
    await page.waitForFunction(() => /rebooting/i.test(document.getElementById('cfg-backup-state')?.textContent || ''), null, {timeout:30000});
    console.log('Browser upload and restore accepted.');
    await waitForProfile(before, beforeBoot);
    console.log('Engine-file round-trip passed; original registry, sequence and disabled LED retained, outputs inactive.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error.stack || error); process.exit(1);});
