// Read-only ECU dashboard/layout audit. Card preferences are browser-local.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const candidates = [
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
].filter(Boolean);
const executablePath = candidates.find(file => fs.existsSync(file));

(async () => {
  const base = process.argv[2] || 'http://192.168.4.1';
  const browser = await chromium.launch({headless:true, ...(executablePath ? {executablePath} : {})});
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      localStorage.setItem('ot_beta_notice_ack_v1', '1');
      localStorage.setItem('ot_theme_onboarded_v1', '1');
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(base + '/', {waitUntil:'domcontentloaded', timeout:30000});
    await page.waitForFunction(() => /connected/i.test(document.getElementById('conn-label')?.textContent || ''), {timeout:25000});
    assert.equal(await page.locator('.dashboard-hide-card:visible').count(), 0);
    await page.locator('#dashboard-card-edit-btn').click();
    for (const id of ['uptime-card','hour-meter-card','system-card','last-event-card'])
      assert.equal(await page.locator(`#${id} .dashboard-hide-card`).count(), 1, `${id} is not hideable`);
    assert.equal(await page.locator('.mode-row .dashboard-hide-card').count(), 0, 'engine state/controls became hideable');
    await page.locator('#uptime-card .dashboard-hide-card').click();
    assert.ok(await page.locator('#uptime-card').evaluate(el => el.classList.contains('dashboard-user-hidden')));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.getElementById('uptime-card')?.classList.contains('dashboard-customizable-card'));
    assert.ok(await page.locator('#uptime-card').evaluate(el => el.classList.contains('dashboard-user-hidden')));
    await page.locator('#dashboard-card-edit-btn').click();
    await page.getByRole('button', {name:'Show Uptime'}).click();
    assert.ok(!await page.locator('#uptime-card').evaluate(el => el.classList.contains('dashboard-user-hidden')));
    await page.locator('#dashboard-arrange-btn').click();
    assert.ok(await page.locator('#dashboard-custom-section').isVisible());
    const before = await page.locator('#uptime-card').evaluate(el => [...el.parentElement.children].indexOf(el));
    await page.locator('#uptime-card .dashboard-drag-handle').focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#uptime-card').evaluate(el => [...el.parentElement.children].indexOf(el)), before + 1);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.getElementById('dashboard-custom-section')?.hidden === false);
    assert.ok(await page.locator('#dashboard-custom-section').isVisible(), 'custom order did not persist');
    await page.locator('#dashboard-card-edit-btn').click();
    await page.locator('#dashboard-reset-btn').click();
    assert.ok(!await page.locator('#dashboard-custom-section').isVisible(), 'default groups not restored');

    await page.goto(base + '/hardware.html', {waitUntil:'domcontentloaded', timeout:30000});
    await page.waitForFunction(() => /Loaded|Converted/i.test(document.getElementById('save-msg')?.textContent || ''), {timeout:25000});
    assert.deepEqual(await page.locator('main > .hw-section').evaluateAll(rows => rows.slice(-3).map(row => row.id)),
      ['hardware-buses-panel','hardware-profile-section','hardware-next-section']);
    await page.goto(base + '/controllers.html', {waitUntil:'domcontentloaded', timeout:30000});
    await page.waitForSelector('#controller-overview [data-controller-card]');
    await page.evaluate(() => {
      OTDialog.alert('Pulsed Starter Assist requires N1.', {
        links:OTValidationLinks(['Pulsed Starter Assist requires N1.'])
      });
    });
    await page.getByRole('button', {name:'Open Starter assist in Sequence'}).click();
    await page.waitForURL(/\/sequence\.html#starter-assist$/);
    await page.waitForFunction(() => getComputedStyle(document.getElementById('tab-startup')).display !== 'none');
    assert.deepEqual(pageErrors, []);
    console.log('Live dashboard/layout audit passed: hide, reorder, persist and reset stay browser-local; engine controls, Hardware panel order and validation route are correct.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
