const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.setContent(`<!doctype html><html><body><main class="document">
    <figure><img alt="OpenTurbine system page with a deliberately long mobile caption" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='900'%3E%3Crect width='1600' height='900' fill='%2325323d'/%3E%3C/svg%3E"><figcaption>OpenTurbine system page with a deliberately long mobile caption that must not move the close button outside the screen</figcaption></figure>
  </main></body></html>`);
  await page.addStyleTag({ path: path.resolve('site/assets/css/site.css') });
  await page.addScriptTag({ path: path.resolve('site/assets/js/site.js') });
  await page.locator('main img').click();
  const initial = await page.evaluate(() => {
    const root = document.documentElement;
    const close = document.querySelector('.image-lightbox__close').getBoundingClientRect();
    const image = document.querySelector('.image-lightbox__image').getBoundingClientRect();
    return { overflow: root.scrollWidth - innerWidth, closeRight: close.right, imageLeft: image.left, imageRight: image.right };
  });
  assert.ok(initial.overflow <= 0, `lightbox overflowed by ${initial.overflow}px`);
  assert.ok(initial.closeRight <= 390, `close button ended at ${initial.closeRight}px`);
  assert.ok(initial.imageLeft >= 0 && initial.imageRight <= 390,
    `fitted image bounds were ${initial.imageLeft}..${initial.imageRight}px`);
  await page.locator('.image-lightbox__image').click();
  assert.equal(await page.locator('.image-lightbox__image').evaluate(el => el.classList.contains('is-zoomed')), true);
  const viewport = page.locator('.image-lightbox__viewport');
  assert.ok(await viewport.evaluate(el => el.scrollWidth > el.clientWidth), 'zoomed image should pan inside the lightbox');
  await page.locator('.image-lightbox__image').evaluate(el => el.click());
  assert.equal(await page.locator('.image-lightbox__image').evaluate(el => el.classList.contains('is-zoomed')), false);
  await page.locator('.image-lightbox__close').click();
  assert.equal(await page.locator('.image-lightbox').getAttribute('hidden'), '');
  await browser.close();
  console.log('Mobile site lightbox fits, zooms, pans, restores, and closes.');
})().catch(error => { console.error(error); process.exit(1); });
