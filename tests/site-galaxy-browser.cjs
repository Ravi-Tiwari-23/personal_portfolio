const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const output = path.resolve('pytest-tmp-site-galaxy'); fs.mkdirSync(output, { recursive:true });
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:900},colorScheme:'dark'});
  const errors = []; const passed = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__galaxyFrames = 0;
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function(...args) {
      if (this.canvas.classList.contains('site-galaxy-canvas')) window.__galaxyFrames++;
      return clear.apply(this,args);
    };
  });
  const visit = async pathname => {
    await page.goto(`http://127.0.0.1:5000${pathname}`); await page.waitForTimeout(1600);
    assert.equal(await page.locator('.site-galaxy.is-ready').count(),1);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),'No horizontal overflow');
  };
  try {
    await visit('/'); await page.waitForTimeout(2800);
    const paused = await page.evaluate(() => window.__galaxyFrames);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__galaxyFrames),paused,'Background pauses while hero covers it');
    for (const section of ['about','skills','projects','contact']) {
      await page.locator(`#${section}`).evaluate(el=>window.scrollTo({top:el.offsetTop,behavior:'instant'}));
      await page.waitForTimeout(1500);
      const frame = await page.evaluate(() => window.__galaxyFrames);
      await page.waitForTimeout(350);
      assert(await page.evaluate(() => window.__galaxyFrames) > frame,`${section} galaxy animates`);
      const background = await page.locator(`#${section}`).evaluate(el=>getComputedStyle(el).backgroundColor);
      assert(background.includes('rgba'),`${section} lets the galaxy show through`);
      await page.screenshot({path:path.join(output,`home-${section}.png`)});
    }
    await page.locator('.site-footer').evaluate(el=>window.scrollTo({top:el.offsetTop,behavior:'instant'}));
    await page.waitForTimeout(1600); await page.screenshot({path:path.join(output,'footer.png')});
    passed.push('Home sections and footer expose the animated field; hero background is not duplicated');

    for (const route of ['/about','/projects','/contact']) {
      await visit(route);
      const frame = await page.evaluate(() => window.__galaxyFrames);
      await page.waitForTimeout(350);
      assert(await page.evaluate(() => window.__galaxyFrames) > frame);
      assert.equal(await page.locator('.hero-orb-canvas').count(),0);
      await page.screenshot({path:path.join(output,`${route.slice(1)}-dark.png`)});
    }
    await page.getByLabel('Your name', {exact:false}).count();
    await page.locator('input[name="name"]').fill('Visual check');
    assert.equal(await page.locator('input[name="name"]').inputValue(),'Visual check');
    await page.locator('input[name="name"]').fill('');
    await page.getByRole('button',{name:'Switch to light theme',exact:true}).click();
    await page.waitForTimeout(700); await page.screenshot({path:path.join(output,'contact-light.png')});
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await page.getByRole('button',{name:'Switch to dark theme',exact:true}).click();
    passed.push('About, Projects and Contact share the galaxy; forms and theme toggle remain usable');

    await visit('/projects');
    const link = await page.locator('.project-row > a').first().getAttribute('href');
    await visit(link); await page.screenshot({path:path.join(output,'project-detail.png')});
    passed.push('Project case-study page includes the shared background');
    await page.setViewportSize({width:390,height:844});
    await visit('/about'); await page.screenshot({path:path.join(output,'mobile-about.png')});
    await visit('/contact'); await page.screenshot({path:path.join(output,'mobile-contact.png')});
    await page.emulateMedia({reducedMotion:'reduce'}); await page.waitForTimeout(200);
    const staticFrame = await page.evaluate(() => window.__galaxyFrames); await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.__galaxyFrames),staticFrame);
    passed.push('Mobile has no overflow; reduced motion stops the background animation');
    await page.goto('http://127.0.0.1:5000/admin/login');
    assert.equal(await page.locator('.site-galaxy').count(),0);
    assert.equal(await page.locator('script[src*="galaxy"]').count(),0);
    passed.push('Admin remains separate and does not load galaxy assets');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed,screenshots:output},null,2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
