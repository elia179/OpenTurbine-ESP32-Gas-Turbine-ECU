// Explicit bench-only write test. Never starts the engine or energizes outputs.
// Changes only the description, restores it, and checks Settings preservation.
const assert = require('node:assert/strict');
const {joinFixtureWifi} = require('./fixture_wifi_helper.cjs');
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
if (!process.argv.includes('--allow-write')) throw new Error('Requires --allow-write on an idle bench ECU');
const base = process.argv.find(a => /^http/.test(a)) || 'http://192.168.4.1';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const wifiProfile = process.env.OT_WIFI_PROFILE || 'OpenTurbine';
const interruptSave = process.argv.includes('--interrupt-save');
const temporaryDescription = `Development save audit ${Date.now()}`;

function assertSettingsPreserved(actual, original) {
  const expected = structuredClone(original);
  // A settings save can materialize the firmware defaults in a sparse engine
  // file. Validate each new value and keep every previously stored value exact.
  const sequenceDefaults = {
    startup: {
      final_check_battery_enabled: false,
      final_check_battery_max_v: null,
      final_check_battery_min_v: null,
      final_check_egt_max_c: null,
      final_check_n1_max_rpm: null,
      final_check_n2_max_rpm: null,
      final_check_oil_max_bar: null,
      final_check_oil_min_bar: null,
      final_check_oil_use_shared_min: true,
      final_check_p1_max_bar: null,
      final_check_p2_max_bar: null,
    },
    shutdown: {cooldown_keep_oil_on_exit: false, final_stop_speed_source: 0},
  };
  for (const [phase, defaults] of Object.entries(sequenceDefaults)) {
    for (const [key, value] of Object.entries(defaults)) {
      if (Object.hasOwn(actual.sequence[phase], key) && !Object.hasOwn(expected.sequence[phase], key))
        expected.sequence[phase][key] = value;
    }
  }
  assert.deepEqual(actual, expected);
}

async function fetchJson(route, options = {}) {
  const attempts = options.method ? 1 : 5;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(base + route, {
        signal: AbortSignal.timeout(8000),
        headers: {Connection:'close'},
        ...options,
      });
      const data = await response.json();
      if (!response.ok || data.ok === false || data.error) {
        throw new Error(data.detail || data.error || `${route} returned HTTP ${response.status}`);
      }
      if (route === '/api/ecu_config' && (!data.hardware || !data.settings))
        throw new Error('Incomplete engine-file response after reboot');
      return data;
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      console.log(`Read retry ${attempt + 1}: ${route}: ${error.message}`);
      await delay(1000);
    }
  }
}

async function reconnect() {
  await delay(8000);
  let lastError = '';
  for (let i=0; i<40; i++) {
    // A combined Hardware + Settings save deliberately reboots twice on
    // Classic. Windows can join another remembered AP between those resets.
    // Keep selecting the fixture AP until the actual status read succeeds.
    if (i % 5 === 0 && process.platform === 'win32' && base === 'http://192.168.4.1') {
      try { joinFixtureWifi(wifiProfile); }
      catch (_) {} // status read remains the authority
    }
    let fault = '';
    try {
      const r = await fetch(base+'/api/status', {signal:AbortSignal.timeout(3000),headers:{Connection:'close'}});
      if (r.ok) {
        const status = await r.json();
        if (status.mode === 'STANDBY') return;
        if (status.mode === 'FAULT') fault = status.fault_description || 'ECU entered FAULT after the save';
      }
    } catch (error) { lastError = error.message; }
    if (fault) throw new Error(fault);
    await delay(1000);
  }
  throw new Error(`ECU did not reconnect: ${lastError || 'no STANDBY status'}`);
}

async function restoreDescription(value) {
  await reconnect();
  const current = await fetchJson('/api/ecu_config');
  if ((current.hardware?.profile_desc ?? '') === value) return;
  const status = await fetchJson('/api/status');
  assert.equal(status.mode, 'STANDBY', 'ECU must be in STANDBY for cleanup');
  await fetchJson('/api/hardware?source=system', {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({profile_desc: value}),
  });
  await reconnect();
  const restored = await fetchJson('/api/ecu_config');
  assert.equal(restored.hardware?.profile_desc ?? '', value,
    'cleanup did not restore the original description');
  console.log('CLEANUP: restored the original engine description');
}
(async () => {
  const original = await fetchJson('/api/ecu_config');
  const status = await fetchJson('/api/status');
  assert.equal(status.mode,'STANDBY');
  const executablePath = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA]
    .filter(Boolean).flatMap(p=>[path.join(p,'Google/Chrome/Application/chrome.exe'),path.join(p,'Microsoft/Edge/Application/msedge.exe')])
    .find(p=>fs.existsSync(p));
  const browser = await chromium.launch({headless:true,...(executablePath ? {executablePath}: {})});
  const page = await browser.newPage();
  let observer;
  const originalDescription = original.hardware?.profile_desc ?? '';
  let restoreNeeded = false;
  try {
    await page.addInitScript(()=>{
      localStorage.setItem('ot_beta_notice_ack_v1','1');
      localStorage.setItem('ot_theme_onboarded_v1','1');
    });
    await page.goto(base+'/system.html');
    await page.waitForSelector('#system-engine-description',{state:'attached'});
    await page.evaluate(()=>document.querySelectorAll('details').forEach(e=>e.open=true));
    const value = originalDescription;
    await page.locator('#system-engine-description').fill(temporaryDescription);
    await page.locator('#system-engine-description').dispatchEvent('change');
    assert.equal(await page.evaluate(()=>_cfgDirty),true);
    // Cancel before navigation tears down telemetry or pending page fetches.
    await page.locator('nav a[href^="/controllers.html"]').click();
    await page.waitForSelector('#ot-app-dialog.show');
    assert.match(await page.locator('#ot-app-dialog').innerText(),/unsaved changes/i);
    await page.locator('#ot-dialog-cancel').click();
    assert.match(page.url(),/system.html/);
    await page.locator('#btn-save').click();
    await page.waitForSelector('#save-recap-modal',{state:'visible'});
    assert.doesNotMatch(await page.locator('#save-recap-body').innerText(), /Controller assignments|N1 pullback/);
    restoreNeeded = true;
    await page.locator('#save-recap-confirm-btn').click();
    await page.waitForFunction(()=>/Saved.*(?:rebooting|restarting)/i.test(document.querySelector('#save-msg')?.textContent || ''),null,{timeout:15000});
    await reconnect();
    let saved = await fetchJson('/api/ecu_config');
    assert.equal(saved.hardware.profile_desc,temporaryDescription);
    assert.deepEqual({...saved.hardware,profile_desc:originalDescription},original.hardware,
      'System save changed unrelated Hardware, including oil-loop IDs or registry bindings');
    assertSettingsPreserved(saved.settings, original.settings);
    // Exercise the combined page-save function with unchanged cosmetic settings:
    // the first reboot must finish before the second PATCH is transmitted.
    await page.goto(base+'/system.html');
    await page.waitForSelector('#system-engine-description',{state:'attached'});
    const concurrentSave = /\/api\/hardware\?source=system/;
    let writes = 0, delayedRead;
    if (interruptSave) {
      observer = await browser.newPage();
      await observer.addInitScript(()=>{
        localStorage.setItem('ot_beta_notice_ack_v1','1');
        localStorage.setItem('ot_theme_onboarded_v1','1');
      });
      await observer.goto(base+'/');
      await observer.waitForFunction(()=>typeof _dashboardSnapshotReady!=='undefined' && _dashboardSnapshotReady);
      await page.route(concurrentSave, async route => {
        writes++;
        delayedRead = observer.request.get(base + '/api/ecu_config', {timeout:8000}).catch(() => null);
        const submitted = await route.fetch();
        if (submitted.ok()) await route.abort('connectionclosed');
        else await route.fulfill({response:submitted});
      });
    }
    await page.evaluate(({value,theme})=>{
      setSystemHardware('profile_desc',value);
      window.__auditSave = _saveSystemChanges({ui_theme:theme},document.getElementById('save-msg'),document.getElementById('btn-save'));
    },{value,theme:original.settings.ui_theme});
    // Reconnect Windows while the page waits for the first reboot.
    await reconnect();
    await page.evaluate(()=>window.__auditSave);
    if (interruptSave) {
      await page.unroute(concurrentSave);
      assert.equal(writes,1,'the interrupted save must be sent once');
      await delayedRead;
      await observer.bringToFront();
      await observer.waitForFunction(()=>_dashboardSnapshotReady && Date.now()-_lastMsgMs < 2500 && !_telemetryStale);
      await observer.close();
      observer = null;
      console.log('PASS: lost acknowledgement verified without a repeat write, and the second dashboard recovered');
    }
    await reconnect();
    saved = await fetchJson('/api/ecu_config');
    assert.equal(saved.hardware.profile_desc,value);
    assert.deepEqual(saved.hardware,original.hardware,'Combined save changed unrelated Hardware');
    assertSettingsPreserved(saved.settings, original.settings);
    restoreNeeded = false;
    console.log('PASS: System recap, unsaved navigation, page-only save, combined save across reboot, exact Settings preservation, and description restoration');
  } finally {
    await observer?.close();
    if (restoreNeeded) {
      try {
        await restoreDescription(originalDescription);
      } catch (error) {
        console.error(`CLEANUP FAILED: ${error.stack || error}`);
        process.exitCode = 1;
      }
    }
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
