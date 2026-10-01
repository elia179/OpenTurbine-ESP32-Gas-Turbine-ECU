// Bench-only browser check: downloads the current engine file, uploads the
// identical file, and verifies that the ECU rebooted with the profile intact.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, request } = require('playwright');
const {execFileSync} = require('node:child_process');

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

function registryMatches(actual, expected, suppliedFile) {
  if (!suppliedFile) return JSON.stringify(actual) === JSON.stringify(expected);
  // Firmware exports omit these documented defaults and expand other fields.
  // Compare every supplied, stored field rather than JSON property order.
  const defaults = {installed:true, pulses_per_unit:1, safe_demand:0};
  for (const group of ['inputs','outputs','bindings']) {
    if (actual[group].length !== expected[group].length) return false;
    for (const entry of expected[group]) {
      const got = actual[group].find(item => group === 'bindings' ? item.key === entry.key : item.id === entry.id);
      if (!got) return false;
      for (const [key,value] of Object.entries(entry)) {
        if (group === 'bindings' && key === 'direction') continue; // Binding direction is inferred from its key.
        const stored = got[key] === undefined && key in defaults ? defaults[key] : got[key];
        try {assert.deepEqual(stored,value);} catch (_) {return false;}
      }
    }
  }
  return true;
}

async function waitForProfile(expected, beforeBoot, suppliedFile = false, beforeUptime = 0) {
  for (let attempt = 0; attempt < 55; attempt++) {
    if (process.platform === 'win32' && attempt % 5 === 0)
      execFileSync('netsh',['wlan','connect','name=OpenTurbine'],{stdio:'ignore'});
    try {
      const info = await readJson('/api/device_info');
      const actual = await readJson('/api/ecu_config');
      const live = await readJson('/api/data');
      // A supplied older engine file may restore its saved boot statistics.
      const rebooted = suppliedFile ? live.uptime_s < beforeUptime : live.boot_count > beforeBoot;
      if (rebooted && info.state === 'STANDBY' && info.outputs_active === false &&
          registryMatches(actual.hardware.channel_registry, expected.hardware.channel_registry, suppliedFile) &&
          JSON.stringify(actual.hardware.startup_seq) === JSON.stringify(expected.hardware.startup_seq) &&
          actual.hardware.actuators.status_led.enabled === expected.hardware.actuators.status_led.enabled) return;
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
  const beforeLive = await readJson('/api/data');
  const beforeBoot = beforeLive.boot_count;
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
    const backupFile = process.argv.find(arg=>arg.startsWith('--backup-file='))?.slice('--backup-file='.length);
    if (backupFile) fs.writeFileSync(backupFile,buffer);
    assert.deepEqual(saved.hardware.channel_registry, before.hardware.channel_registry);
    assert.deepEqual(saved.hardware.startup_seq, before.hardware.startup_seq);
    console.log(`Downloaded and verified ${download.suggestedFilename()} (${buffer.length} bytes).`);

    const restoreFile = process.argv.find(arg=>arg.startsWith('--restore-file='))?.slice('--restore-file='.length);
    const restoreBuffer = restoreFile ? fs.readFileSync(restoreFile) : buffer;
    const expected = restoreFile ? JSON.parse(restoreBuffer.toString('utf8')) : before;
    await page.locator('#cfg-restore-file').setInputFiles({name:'OpenTurbine-roundtrip.json', mimeType:'application/json', buffer:restoreBuffer});
    await page.locator('#ot-dialog-confirm:visible').click();
    await page.waitForFunction(() => /rebooting|error|failed/i.test(document.getElementById('cfg-backup-state')?.textContent || ''), null, {timeout:30000});
    assert.match(await page.locator('#cfg-backup-state').textContent(), /rebooting/i,
      await page.locator('#cfg-backup-msg').textContent());
    console.log('Browser upload and restore accepted.');
    await waitForProfile(expected, beforeBoot, !!restoreFile, beforeLive.uptime_s);
    console.log(restoreFile
      ? 'Review engine file installed through browser restore; registry, sequence and LED setting verified, outputs inactive.'
      : 'Engine-file round-trip passed; original registry, sequence and LED setting retained, outputs inactive.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error.stack || error); process.exit(1);});
