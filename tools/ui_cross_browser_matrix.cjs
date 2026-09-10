const assert = require('node:assert/strict');
const { chromium, firefox, webkit } = require('playwright');

const port = 8781;
const base = `http://127.0.0.1:${port}`;
const pages = ['/', '/hardware.html', '/controllers.html', '/system.html', '/calibration.html', '/sequence.html', '/log.html', '/tools.html', '/config.html'];
const viewports = [
  { name: 'compact-phone', width: 320, height: 568 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 768 },
  { name: 'wide-desktop', width: 1920, height: 1080 },
];

(async () => {
  globalThis.OT_UI_SIM_PORT = port;
  await import('./ui_mock_server.mjs');
  await new Promise(resolve => setTimeout(resolve, 100));
  const results = [];
  for (const [name, browserType] of Object.entries({ chromium, firefox, webkit })) {
    let browser;
    let launchError;
    for (let attempt = 0; attempt < 3 && !browser; attempt++) {
      try {
        browser = await browserType.launch({ headless: true });
      } catch (error) {
        launchError = error;
        if (!/spawn UNKNOWN|EBUSY|EPERM/i.test(String(error.message)) || attempt === 2) break;
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    if (!browser) {
      if (/Executable doesn't exist|browser.*not found|spawn UNKNOWN|EBUSY|EPERM/i.test(String(launchError?.message))) {
        console.warn(`${name}: browser process unavailable on this host; canonical CI installs and runs it`);
        continue;
      }
      throw launchError;
    }
    try {
      for (const viewport of viewports) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
          if (message.type() !== 'error') return;
          errors.push(message.text());
        });
        await page.addInitScript(() => {
          localStorage.setItem('ot_beta_notice_ack_v1', '1');
          localStorage.setItem('ot_theme_onboarded_v1', '1');
        });
        for (const route of pages) {
          const response = await page.goto(base + route, { waitUntil: 'domcontentloaded' });
          assert.ok(response && response.ok(), `${name}/${viewport.name} failed ${route}`);
          assert.ok(await page.locator('body').isVisible(), `${name}/${viewport.name} blank ${route}`);
          // window.innerWidth includes a non-overlay vertical scrollbar while
          // documentElement.clientWidth does not. Comparing the two document
          // widths therefore reports the Linux scrollbar (normally 15 px) as
          // horizontal overflow on tall pages such as Calibration.
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          assert.ok(overflow <= 2, `${name}/${viewport.name} horizontal overflow ${overflow}px on ${route}`);
        }
        assert.deepEqual(errors, [], `${name}/${viewport.name} console errors`);
        await page.close();
        results.push(`${name} ${viewport.name}`);
      }
    } finally {
      await browser.close();
    }
  }
  assert.ok(results.length > 0, 'no browser engine was available');
  console.log(`Cross-browser matrix passed: ${results.join(', ')}`);
  process.exit(0);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
