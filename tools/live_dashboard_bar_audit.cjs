// Read-only browser assertion for the wired dashboard RPM-bar bench demo.
// Drive the S3 tester's N1/N2 outputs separately, then pass green/yellow/red.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const expected = process.argv[2];
const markerExpected = process.argv[3] === 'marker';
if (!['green', 'yellow', 'red', 'cycle'].includes(expected)) {
  throw new Error('Usage: node tools/live_dashboard_bar_audit.cjs green|yellow|red|cycle [marker]');
}

(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('ot_beta_notice_ack_v1', '1');
      localStorage.setItem('ot_theme_onboarded_v1', '1');
    });
    const errors = [];
    const snapshotRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/api/data')) snapshotRequests.push(response.status());
    });
    page.on('requestfailed', request => {
      if (request.url().includes('/api/data')) snapshotRequests.push(request.failure()?.errorText || 'failed');
    });
    await page.goto('http://192.168.4.1/', {waitUntil:'domcontentloaded'});
    try {
      await page.waitForFunction(() =>
        /connected/i.test(document.getElementById('conn-label')?.textContent || '')
        && parseFloat(document.getElementById('n1-gauge-bar')?.style.width || '0') > 0,
        null, {timeout:25000});
    } catch (error) {
      console.error('Live dashboard boot state:', await page.evaluate(() => ({
        connection:document.getElementById('conn-label')?.textContent,
        n1:document.getElementById('n1')?.textContent,
        gauge:document.getElementById('n1-gauge-bar')?.style.width,
        limit:typeof _lastData !== 'undefined' ? _lastData?.rpm_limit : undefined,
        hidden:document.hidden,
        retryScheduled:typeof _dashboardBootstrapRetryTimer !== 'undefined' && !!_dashboardBootstrapRetryTimer,
        assetsFailed:document.documentElement.getAttribute('data-ot-assets-failed'),
        errors:document.querySelector('#error-banner')?.textContent
      })), 'snapshot responses:', snapshotRequests);
      throw error;
    }
    const inspect = () => page.evaluate(() => {
      const card = id => {
        const bar = document.getElementById(`${id}-gauge-bar`);
        return {
          rpm:Number(document.getElementById(id)?.textContent?.replace(/,/g, '')),
          numberColor:document.getElementById(id)?.style.color,
          width:parseFloat(bar.style.width),
          color:bar.style.background,
          marker:bar.parentElement.classList.contains('shutdown-limit-high'),
          label:document.getElementById(`${id}-abs-label`)?.textContent
        };
      };
      return {version:document.getElementById('fw-version')?.textContent,
        mode:document.getElementById('mode-badge')?.textContent,
        n1:card('n1'), n2:card('n2')};
    });
    if (expected === 'cycle') {
      const seen = {n1:new Set(), n2:new Set()};
      const values = {n1:[], n2:[]};
      const deadline = Date.now() + 45000;
      while (Date.now() < deadline && ['n1', 'n2'].some(key => seen[key].size < 3)) {
        const state = await inspect();
        assert.match(state.version, /2\.4\.3(?:-dev)?/);
        assert.match(state.mode, /STANDBY/);
        for (const key of ['n1', 'n2']) {
          assert.equal(state[key].marker, false);
          assert.match(state[key].label, /advisory only/);
          const color = /^var\(--(green|yellow|red)\)$/.exec(state[key].color)?.[1];
          if (color) {
            seen[key].add(color);
            assert.equal(state[key].numberColor, color === 'red' ? 'var(--red)' : '',
              `${key}: ${JSON.stringify(state[key])}`);
          }
          values[key].push(state[key].rpm);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      for (const key of ['n1', 'n2']) {
        assert.deepEqual([...seen[key]].sort(), ['green', 'red', 'yellow'],
          `${key} did not traverse all dashboard colours`);
        assert.ok(Math.max(...values[key]) - Math.min(...values[key]) > 10000,
          `${key} RPM did not move meaningfully`);
      }
      assert.deepEqual(errors, []);
      console.log(`Live cycle passed: N1 ${Math.min(...values.n1)}–${Math.max(...values.n1)} RPM, `
        + `N2 ${Math.min(...values.n2)}–${Math.max(...values.n2)} RPM; both showed green/yellow/red.`);
      return;
    }
    const state = await inspect();
    assert.match(state.version, /2\.4\.3(?:-dev)?/);
    assert.match(state.mode, /STANDBY/);
    for (const key of ['n1', 'n2']) {
      assert.ok(state[key].rpm > 0, `${key} has no physical RPM`);
      assert.match(state[key].color, new RegExp(`--${expected}`),
        `${key} is not ${expected}: ${JSON.stringify(state[key])}`);
      assert.equal(state[key].marker, markerExpected, `${key} shutdown marker mismatch`);
      if (markerExpected) assert.doesNotMatch(state[key].label, /advisory only/);
      else assert.match(state[key].label, /advisory only/);
    }
    assert.deepEqual(errors, []);
    console.log(`Live ${expected} bars passed: ${JSON.stringify(state)}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
