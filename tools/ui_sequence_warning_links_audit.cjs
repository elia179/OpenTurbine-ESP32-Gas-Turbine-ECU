const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  // An optional live ECU URL exercises the delivered pages without saving
  // anything: validation cases below only change browser-local editor state.
  const liveBase = process.argv.find(arg => /^https?:/.test(arg));
  if (!liveBase) {
    globalThis.OT_UI_SIM_PORT = 8779;
    await import('./ui_mock_server.mjs');
  }
  const candidates = [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe')
  ].filter(Boolean);
  const browser = await chromium.launch({headless:true, executablePath:candidates.find(p => fs.existsSync(p))});
  const page = await browser.newPage();
  const base = liveBase || 'http://127.0.0.1:8779';
  try {
    if (!liveBase) await page.request.post(base + '/__sim/scenario/full');
    await page.goto(base + '/sequence.html?v=20261013d');
    await page.waitForFunction(() => typeof loadedCfg !== 'undefined' && Object.keys(loadedCfg).length > 0 && document.body.textContent.includes('No unsaved changes'));
    const firmware = fs.readFileSync(path.join(__dirname, '../src/main.cpp'), 'utf8');
    const blocks = [...new Set([...firmware.matchAll(/addIssue\("([^"]+)"/g)].map(match => match[1]))];
    const sequenceRoutes = await page.evaluate(blocks => blocks.map(block => ({block, url:sequenceIssueDestination({block,msg:''})})), blocks);
    await page.evaluate(() => {
      stopSequenceTelemetry();
      _applySeqValidation({seq_has_errors:true, seq_issues:[
        {block:'P2 Hard Trip', msg:'P2 hard trip is configured without a P2 sensor', error:true},
        {block:'Oil Safety', msg:'No oil pressure sensor is configured', error:true},
        {block:'StarterSpin', msg:'Review starter configuration', error:false},
        {block:'<img src=x onerror=alert(1)>', msg:'<script>alert(1)</script>', error:true}
      ]});
    });
    const warnings = page.locator('#seq-validation-banner > .seq-val-error, #seq-validation-banner > .seq-val-warn');
    const trip = warnings.first();
    assert.match(await trip.getAttribute('href'), /^\/controllers\.html(?:\?v=\w+)?#cf-sf_p2t$/);
    assert.match(await trip.textContent(), /set this shutdown limit to 0/);
    assert.equal(await page.locator('#seq-validation-banner img, #seq-validation-banner script').count(), 0);
    assert.match(await warnings.nth(1).getAttribute('href'), /^\/hardware\.html(?:\?v=\w+)?$/);
    assert.match(await page.locator('.seq-val-start-blocked').getAttribute('href'), /#cf-sf_p2t$/);
    await page.evaluate(() => { history.replaceState(null, '', '/sequence.html'); markSequenceDirty(); });
    await warnings.nth(2).click();
    await page.waitForFunction(() => location.hash === '#tab-startup');
    assert.equal(await page.evaluate(() => _seqDirty), true);
    assert.equal(await page.locator('#ot-dialog-cancel').isVisible(), false);
    await page.evaluate(() => markSequenceDirty());
    await trip.click();
    await page.locator('#ot-dialog-cancel').click();
    assert.match(page.url(), /sequence.html/);
    assert.equal(await page.evaluate(() => _seqDirty), true);
    await page.evaluate(() => clearSequenceDirty());
    await trip.focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/controllers.html*#cf-sf_p2t');
    await page.waitForFunction(() => document.querySelector('#cf-sf_p2t')?.closest('.cfg-field')?.classList.contains('deep-link-target'));
    assert.equal(await page.locator('#cf-sf_p2t').isVisible(), true);
    assert.equal(await page.locator('[data-protection="p2"]').getAttribute('open'), '');
    const inlineRoutes = await page.evaluate(() => Object.entries(INLINE_WARNING_DESTINATIONS).map(([block,url]) => ({block,url})));
    for (const route of [...sequenceRoutes, ...inlineRoutes]) {
      const url = new URL(route.url, route.url.startsWith('#') && route.block.startsWith('warn-') ? base + '/controllers.html' : base + '/sequence.html');
      route.page = url.pathname;
      route.id = url.hash.slice(1);
    }
    const destinations = [...sequenceRoutes, ...inlineRoutes];
    for (const pathname of [...new Set(destinations.map(route => route.page))]) {
      await page.goto(base + pathname + '?v=20261013d');
      const targets = destinations.filter(route => route.page === pathname && route.id);
      for (const target of targets) {
        if (liveBase && target.id === 'cf-ab_mo' &&
            !await page.locator('#cf-ab_mo').count()) {
          console.log('Live profile has no afterburner field; its destination is covered by the full-profile mock audit.');
          continue;
        }
        if (pathname === '/sequence.html' && ['starter-target','starter-assist','oil-arm-min'].includes(target.id)) {
          await page.evaluate(hash => { location.hash = hash; }, target.id);
          await page.locator('#tab-startup').waitFor({state:'visible'});
          continue;
        }
        await page.waitForFunction(id => !!document.getElementById(id), target.id, {timeout:8000})
          .catch(() => { throw new Error(`Missing destination ${target.page}#${target.id} for ${target.block}`); });
      }
    }
    await page.goto(base + '/system.html?v=20261013d#system-backup-restore');
    await page.locator('#cfg-backup-btn').waitFor({state:'visible'});
    await page.goto(base + '/controllers.html?v=20261013d');
    await page.waitForFunction(() => !!document.getElementById('cf-pb_n1h'));
    await page.evaluate(() => {
      document.getElementById('cf-pb_n1e').value = '1';
      document.getElementById('cf-pb_n1h').value = String(Number(document.getElementById('cf-rpm_limit').value) + 1000);
      runValidation();
    });
    const inline = page.locator('[data-warnkey="warn-n1-pullback-trip"]');
    await inline.click();
    await page.locator('#cf-pb_n1e').waitFor({state:'visible'});
    assert.equal(await page.locator('[data-protection="n1"]').getAttribute('open'), '');
    await page.goto(base + '/hardware.html?v=20261013d');
    await page.waitForFunction(() => typeof cfg !== 'undefined' && !!cfg.controls);
    await page.evaluate(() => { cfg.controls.start_pin = cfg.controls.stop_pin; checkPinConflicts(); });
    const conflict = page.locator('#pin-conflict-banner a[data-ot-warning-link]').first();
    await conflict.click();
    await page.waitForFunction(() => location.hash === '#hardware-inputs-panel');
    await page.goto(base + '/index.html?v=20261013d');
    for (const id of ['config-storage-banner','limited-run-banner','surge-warn-banner']) {
      await page.waitForFunction(id => !!document.querySelector(`#${id} a[data-ot-warning-link]`), id);
    }
    console.log(`Warning navigation passed: ${blocks.length} firmware issue labels, ${inlineRoutes.length} inline warning destinations, P2 hidden-field reveal, escaping, keyboard activation, unsaved-change cancellation, GPIO conflicts, nested System restore and Dashboard diagnostics.`);
  } finally { await browser.close(); }
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
