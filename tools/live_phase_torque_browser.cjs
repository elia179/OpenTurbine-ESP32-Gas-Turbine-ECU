// Read-only viewport audit of the installed 2.4 phase-torque pages.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

function browserBinary() {
  const candidates = [
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate));
}

(async () => {
  const base = process.argv[2] || 'http://192.168.4.1';
  const browser = await chromium.launch({headless:true,
    ...(browserBinary() ? {executablePath:browserBinary()} : {})});
  const failures = [];
  try {
    for (const width of [320, 390, 768, 1920]) {
      const context = await browser.newContext({viewport:{width, height:900}});
      await context.addInitScript(() => {
        localStorage.setItem('ot_beta_notice_ack_v1','1');
        localStorage.setItem('ot_theme_onboarded_v1','1');
        localStorage.setItem('ot_theme','carbon');
      });
      const page = await context.newPage();
      page.on('pageerror', err => failures.push(`${width}px ${page.url()}: ${err.message}`));
      for (const route of ['/', '/hardware.html', '/calibration.html',
                            '/controllers.html', '/sequence.html', '/system.html', '/tools.html']) {
        const response = await page.goto(base + route, {waitUntil:'domcontentloaded', timeout:30000});
        assert.ok(response?.ok(), `${width}px ${route}: HTTP ${response?.status()}`);
        await page.waitForFunction(() => /connected/i.test(
          document.getElementById('conn-label')?.textContent || ''), {timeout:25000});
        const extent = await page.evaluate(() => ({
          viewport:window.innerWidth, root:document.documentElement.scrollWidth,
          body:document.body.scrollWidth
        }));
        assert.ok(extent.root <= extent.viewport + 3,
          `${width}px ${route}: page overflow ${JSON.stringify(extent)}`);
        if (route === '/') {
          await page.waitForFunction(() => {
            const card = document.getElementById('torque-card');
            const speed = document.getElementById('torque-speed-row');
            const power = document.getElementById('torque-power-row');
            return card && getComputedStyle(card).display !== 'none' &&
              speed && getComputedStyle(speed).display !== 'none' &&
              power && getComputedStyle(power).display !== 'none' &&
              /\d/.test(document.getElementById('torque-speed')?.textContent || '');
          }, {timeout:15000});
          const torqueUi = await page.evaluate(() => ({
            duplicate:!!document.querySelector('[data-registry-input-id="torque_shaft_speed"]'),
            powerLabel:document.getElementById('torque-power-row')?.textContent?.trim(),
            cacheVersion:document.querySelector('script[data-ot-version]')?.getAttribute('data-ot-version')
          }));
          assert.equal(torqueUi.duplicate, false, `${width}px dashboard duplicated torque shaft speed card`);
          assert.match(torqueUi.powerLabel || '', /^shaft power:/i);
          assert.doesNotMatch(torqueUi.powerLabel || '', /N2 required/i);
          assert.equal(torqueUi.cacheVersion, '20260924c');
        }
        if (route === '/hardware.html') {
          await page.waitForFunction(() => {
            const label = [...document.querySelectorAll('label')].find(label =>
              /Torque shaft speed/i.test(label.textContent));
            return document.body.textContent.includes('Reference shaft pickup') &&
              document.body.textContent.includes('Torque phase pickup') && label &&
              typeof registryDriverOptions === 'function' &&
              registryDriverOptions('input', 2, 'torque', 'torque').includes('NAU7802 load cell — enable I2C bus') &&
              [...document.querySelectorAll('label')].some(label =>
                /Torque shaft speed/i.test(label.textContent) && label.querySelector('input')?.checked);
          }, {timeout:25000});
        }
        console.log(`${width}px ${route} connected; document width ${extent.root}`);
      }
      await context.close();
    }
    assert.deepEqual(failures, [], failures.join('\n'));
    console.log('Live phase browser passed: 28 connected page loads at 320–1920px; speed and power visible; hardware subcards present.');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode=1;});
