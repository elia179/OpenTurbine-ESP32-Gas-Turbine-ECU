// Bench-only proof of the firmware upload control on System > Maintenance.
// This really flashes the selected image and therefore requires --allow-write.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, request} = require('playwright');

if (!process.argv.includes('--allow-write'))
  throw new Error('Requires --allow-write on an idle bench ECU');
const base = process.argv.find(arg => /^http/.test(arg)) || 'http://192.168.4.1';
const firmware = process.argv.find(arg => /firmware\.bin$/i.test(arg));
assert.ok(firmware && fs.statSync(firmware).size > 100000, 'Pass a valid firmware.bin');

function installedBrowser() {
  return [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ].filter(Boolean).find(candidate => fs.existsSync(candidate));
}

(async () => {
  const beforeApi = await request.newContext({baseURL:base});
  const beforeResponse = await beforeApi.get('/api/device_info');
  assert.ok(beforeResponse.ok(), 'ECU is not reachable');
  const before = await beforeResponse.json();
  await beforeApi.dispose();
  assert.equal(before.state, 'STANDBY', 'ECU must be in STANDBY');
  assert.equal(before.ota_allowed, true, 'ECU reports OTA is not allowed');

  const browser = await chromium.launch({
    headless:true,
    ...(installedBrowser() ? {executablePath:installedBrowser()} : {})
  });
  const page = await browser.newPage();
  let chunks = 0;
  page.on('response', response => {
    if (new URL(response.url()).pathname === '/api/firmware_chunk' && response.ok()) chunks++;
  });
  await page.addInitScript(() => {
    localStorage.setItem('ot_beta_notice_ack_v1', '1');
    localStorage.setItem('ot_theme_onboarded_v1', '1');
  });
  await page.goto(base + '/system.html', {waitUntil:'domcontentloaded', timeout:20000});
  await page.waitForSelector('#ota-file', {state:'attached'});
  await page.waitForFunction(() => runtimeMode === 'STANDBY', null, {timeout:30000});
  await page.locator('#ota-file').evaluate(input => {
    for (let parent=input.parentElement; parent; parent=parent.parentElement)
      if (parent.tagName === 'DETAILS') parent.open = true;
  });
  await page.locator('#ota-file').setInputFiles(firmware);
  await page.waitForFunction(() => /Done.*rebooting|Error/i.test(document.getElementById('ota-state')?.textContent || ''),
    null, {timeout:600000});
  const uploadState = await page.locator('#ota-state').textContent();
  const uploadMessage = await page.locator('#ota-msg').textContent();
  assert.match(uploadState, /Done.*rebooting/i, `Firmware upload stopped after ${chunks} chunks: ${uploadMessage}`);
  await browser.close();

  const expectedChunks = Math.ceil(fs.statSync(firmware).size / 4096);
  assert.equal(chunks, expectedChunks, 'browser did not receive every chunk response');
  await new Promise(resolve => setTimeout(resolve, 7000));
  const recovery = await request.newContext({baseURL:base, extraHTTPHeaders:{Connection:'close'}});
  let after;
  for (let attempt=0; attempt<40; attempt++) {
    try {
      const response = await recovery.get('/api/device_info', {timeout:3000});
      if (response.ok()) { after = await response.json(); break; }
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  await recovery.dispose();
  assert.ok(after, 'ECU did not return after browser OTA');
  assert.equal(after.build_id, before.build_id,
    'bench proof expected the same known firmware image to be reflashed');
  console.log(`Browser firmware OTA passed: ${chunks} bounded chunks, build ${after.build_id} returned in STANDBY.`);
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
