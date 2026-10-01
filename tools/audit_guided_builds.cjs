#!/usr/bin/env node
// Exercise built Pages output at its real repository subpath, not raw Markdown.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const built = path.resolve(process.env.OT_BUILT_SITE || '_site');
const prefix = '/OpenTurbine-ESP32-Gas-Turbine-ECU';
const mime = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
let searchRequests = 0;
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  if (!url.pathname.startsWith(prefix+'/')) { res.writeHead(404).end(); return; }
  let name = decodeURIComponent(url.pathname.slice(prefix.length));
  if (name.endsWith('/')) name += 'index.html';
  const file = path.resolve(built,'.'+name);
  if (!file.startsWith(built+path.sep) || !fs.existsSync(file)) {res.writeHead(404).end();return;}
  const headers = {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'};
  if (file === path.join(built,'docs-search.json')) {
    searchRequests++;
    headers['Cache-Control'] = 'public, max-age=3600'; // Prove the finder bypasses an otherwise reusable cached index.
  }
  res.writeHead(200,headers);
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  const browser = await chromium.launch({headless:true,...(process.env.OT_BROWSER_EXECUTABLE?{executablePath:process.env.OT_BROWSER_EXECUTABLE}:{})});
  const routes = ['','get-started/','reference/','user-guide/','hardware/','example-system/','troubleshooting/','faq/','safety/','developers/','about/','guided-builds/','guided-builds/basic/','guided-builds/control/','guided-builds/extend/','guided-builds/parts/'];
  const errors = [];
  try {
    // Every channel introduced by a lesson must retain its configured-card view.
    const configuredCards = {
      basic: ['start','stop','n1','tot','throttle','starter','fuel','igniter','spi','n1-warnings','temperature-warnings','bench-fuel-zero'],
      control: ['pressure','oil-pump','shutoff','brightness','light'],
      extend: ['n2','battery','oil-temperature','fan','cover','torque','thrust','i2c','current']
    };
    for (const [lesson, cards] of Object.entries(configuredCards)) {
      const html = fs.readFileSync(path.join(built,'guided-builds',lesson,'index.html'),'utf8');
      for (const card of cards) assert.ok(html.includes(`${card}-configured.png`), `${lesson} lacks configured ${card} card`);
    }
    const basicHtml = fs.readFileSync(path.join(built,'guided-builds/basic/index.html'),'utf8');
    assert.ok(basicHtml.indexOf('spi-configured.png') < basicHtml.indexOf('tot-configured.png'),'SPI setup must precede temperature card');
    assert.ok(basicHtml.indexOf('throttle-configured.png') < basicHtml.indexOf('throttle-calibration.png'),'Hardware must precede throttle calibration');
    for (const shot of ['fuel-minimum-calibration','automatic-idle-off'])
      assert.ok(basicHtml.includes(`${shot}.png`),`fuel/idle explanation lacks ${shot}`);
    for (const shot of ['sequence-bench-startup','sequence-bench-shutdown','sequence-bench-fuel-action'])
      assert.ok(basicHtml.includes(`${shot}.png`), `complete sequence lacks ${shot}`);
    const settingRecords = JSON.parse(fs.readFileSync(path.resolve('site/_data/config_search.json'),'utf8'));
    const guideHtml = fs.readFileSync(path.join(built,'user-guide/index.html'),'utf8');
    assert.ok(guideHtml.includes('engine-backup-restore.png'),'restore procedure needs its focused card');
    for (const key of ['fi_mode','fi_fixed']) {
      assert.ok(settingRecords.some(record=>record.url===`/user-guide/#field-${key}`),`${key} missing from setting search`);
      assert.ok(guideHtml.includes(`id="field-${key}"`),`${key} missing from field reference`);
    }
    for (const colorScheme of ['dark','light']) {
      const page = await browser.newPage({colorScheme});
      page.on('pageerror',error => errors.push(error.message));
      for (const width of [320,390,768,1024,1200,1440]) {
        await page.setViewportSize({width,height:900});
        for (const route of routes) {
          const response = await page.goto(`${base}/${route}`);
          assert.equal(response.status(),200,route);
          await page.evaluate(() => document.fonts.ready);
          await page.locator('main img').evaluateAll(images=>images.forEach(img=>{img.loading='eager';}));
          await page.waitForFunction(()=>[...document.querySelectorAll('main img')].every(img=>img.complete));
          assert.ok(await page.locator('h1').textContent(),route);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth-innerWidth);
          assert.ok(overflow <= 1,`${colorScheme} ${width} ${route}: overflow ${overflow}`);
          assert.equal(await page.locator('main img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0)),true,route+' images');
          assert.equal(await page.locator('main img').evaluateAll(images=>images.every(img=>img.alt.trim())),true,route+' image descriptions');
        }
      }
      await page.close();
    }
    const page = await browser.newPage({viewport:{width:390,height:844}});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(`${base}/guided-builds/basic/`);
    assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto','reduced motion disables smooth scrolling');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.goto(`${base}/guided-builds/basic/#n1`);
    assert.equal(new URL(page.url()).hash,'#n1');
    const diagram = page.locator('main img').first();
    await diagram.focus(); await page.keyboard.press('Enter');
    await page.locator('.image-lightbox__close').waitFor();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.image-lightbox__close').evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Escape');
    assert.equal(await diagram.evaluate(el=>el===document.activeElement),true,'focus returns to diagram');
    assert.equal(await page.locator('[data-flow-toggle]').count(),0,'decorative animation removed');
    await page.goto(`${base}/guided-builds/extend/`);
    assert.equal(await page.locator('.build-hint').count(),0,'unsupported challenge removed');
    assert.equal(await page.locator('#challenge').textContent(),'7 · Measure shaft torque with two pickups');
    assert.equal(await page.locator('#thrust').textContent(),'8 · Measure thrust with an I²C load cell');
    await page.locator('.menu-button').click();
    assert.equal(await page.locator('#site-nav').isVisible(),true);
    await page.getByRole('link',{name:'Guided Builds',exact:true}).click();
    assert.equal(new URL(page.url()).pathname,`${prefix}/guided-builds/`);
    await page.goto(`${base}/reference/`);
    await page.locator('#docs-query').fill('Maximum N1 Speed');
    const result=page.locator('[data-search-results] a').first();
    await result.waitFor();
    assert.equal(await result.textContent(),'Maximum N1 Speed');
    await result.click();
    assert.equal(new URL(page.url()).hash,'#field-rpm_limit');
    await page.waitForFunction(()=>document.querySelector('#field-rpm_limit').closest('details').open);
    assert.equal(await page.locator('#field-rpm_limit').isVisible(),true,'deep setting link expands its reference');
    for (const [label,key] of [['Running Idle Mode','fi_mode'],['Fixed Running Idle Fuel (%)','fi_fixed']]) {
      const requestsBefore = searchRequests;
      await page.goto(`${base}/reference/`);
      await page.locator('#docs-query').fill(label);
      const setting = page.locator('[data-search-results] a').first();
      await setting.waitFor();
      assert.equal(await setting.textContent(),label);
      assert.ok(searchRequests > requestsBefore,'revisiting the finder fetches a current index despite cache headers');
      await setting.click();
      assert.equal(new URL(page.url()).hash,`#field-${key}`);
      assert.equal(await page.locator(`#field-${key}`).isVisible(),true,'new idle reference opens from search');
    }
    const extendHtml = fs.readFileSync(path.join(built,'guided-builds/extend/index.html'),'utf8');
    for (const shot of ['phase-torque-calibration','thrust-calibration'])
      assert.ok(extendHtml.includes(`${shot}.png`),`${shot} controls need their focused view`);
    await page.locator('#guide-contents > summary').click();
    assert.equal(await page.locator('#guide-contents ol li a').count(),16,'setup order renders as navigable list');
    await page.locator('#field-query').fill('Maximum N1 Speed');
    await page.locator('[data-field-status]').getByText(/matching fields/).waitFor();
    assert.ok(await page.locator('.reference-section tbody tr:not([hidden])').count()>0);
    assert.ok(await page.locator('.reference-section tbody tr[hidden]').count()>0);
    await page.locator('#field-query').fill('thisworddoesnotexist');
    assert.equal(await page.locator('[data-field-status]').textContent(),'0 matching fields');
    await page.locator('#field-query').fill('');
    assert.equal(await page.locator('.reference-section tbody tr:not([hidden])').count(),settingRecords.length);
    await page.goto(`${base}/guided-builds/basic/`);
    await page.locator('[data-reading-toggle]').click();
    assert.equal(await page.locator('.build-screen').first().isVisible(),false);
    assert.equal(await page.locator('.build-figure img[src$="power.svg"]').isVisible(),true,'compact mode retains wiring');
    await page.goto(`${base}/guided-builds/control/`);
    assert.equal(await page.locator('.build-screen').first().isVisible(),false,'compact choice persists');
    await page.locator('[data-reading-toggle]').click();
    assert.equal(await page.locator('.build-screen').first().isVisible(),true);
    await page.locator('.menu-button').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.menu-button').getAttribute('aria-expanded'),'false');
    await page.goto(`${base}/reference/`);
    await page.locator('.menu-button').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.menu-button').getAttribute('aria-expanded'),'false','menu escape works on image-free pages');
    const noJS = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
    const plain = await noJS.newPage();
    await plain.goto(`${base}/guided-builds/basic/`);
    assert.equal(await plain.locator('#verify').isVisible(),true,'verification is available without JS');
    assert.equal(await plain.locator('.build-level-nav a').count(),4);
    assert.ok(await plain.locator('.doc-outline a').count()>=10,'static section outline');
    assert.equal(await plain.locator('#site-nav').isVisible(),true,'no-JS navigation stays available');
    await noJS.close();
    assert.deepEqual(errors,[],'no JavaScript errors');
    if (process.env.OT_AUDIT_SHOTS) {
      const folder = path.resolve(process.env.OT_AUDIT_SHOTS);fs.mkdirSync(folder,{recursive:true});
      const readyImages=async()=>{
        await page.locator('main img').evaluateAll(images=>images.forEach(img=>{img.loading='eager';}));
        await page.waitForFunction(()=>[...document.querySelectorAll('main img')].every(img=>img.complete&&img.naturalWidth>0));
      };
      await page.setViewportSize({width:1440,height:1100});await page.emulateMedia({colorScheme:'dark'});
      await page.goto(`${base}/guided-builds/`);await readyImages();await page.screenshot({path:path.join(folder,'levels-desktop.png'),fullPage:true});
      await page.setViewportSize({width:390,height:844});await page.goto(`${base}/guided-builds/basic/#n1`);
      await readyImages();await page.screenshot({path:path.join(folder,'basic-mobile.png')});
      for (const route of ['basic','control','extend','parts']) {
        await page.setViewportSize({width:1200,height:1000});await page.goto(`${base}/guided-builds/${route}/`);
        await readyImages();await page.screenshot({path:path.join(folder,`${route}-full.png`),fullPage:true});
      }
      await page.setViewportSize({width:1200,height:1200});
      await page.goto(`${base}/reference/`);await page.screenshot({path:path.join(folder,'reference-desktop.png'),fullPage:true});
      await page.locator('#docs-query').fill('Maximum N1 Speed');await page.locator('[data-search-results] a').first().waitFor();
      await page.screenshot({path:path.join(folder,'reference-search.png')});
      await page.goto(`${base}/user-guide/#field-rpm_limit`);await readyImages();await page.screenshot({path:path.join(folder,'field-reference.png')});
      await page.goto(`${base}/user-guide/#backups`);await readyImages();await page.screenshot({path:path.join(folder,'guide-backup-restore.png')});
      await page.goto(`${base}/hardware/`);await readyImages();await page.screenshot({path:path.join(folder,'hardware-reference.png'),fullPage:true});
      await page.goto(`${base}/guided-builds/control/`);await readyImages();
      for (const name of ['controller-create','controller-mapping','controller-states','oil-feedback-settings']) {
        const figure=page.locator(`figure:has(img[src$="/${name}.png"])`);
        await figure.evaluate(el=>el.scrollIntoView({block:'start'}));
        await page.evaluate(()=>scrollBy(0,-75));
        await page.screenshot({path:path.join(folder,`guide-${name}.png`)});
      }
      for (const file of fs.readdirSync(path.join(built,'assets/images/guided-builds')).filter(name=>name.endsWith('.svg'))) {
        await page.goto(`${base}/assets/images/guided-builds/${file}`);
        const outside=await page.locator('svg text').evaluateAll(texts=>texts.filter(el=>{const b=el.getBBox();return b.x<0||b.x+b.width>999||b.y+b.height>600}).map(el=>el.textContent));
        assert.deepEqual(outside,[],file+' labels must fit inside drawing');
      }
    }
    console.log('Public documentation passes all-page layout, search, deep field links, compact reading, keyboard, themes, reduced-motion and no-JS checks.');
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error => { console.error(error);server.close();process.exit(1); });
