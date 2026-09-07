// Optional visual regression runner: PLAYWRIGHT_MODULE can point at a bundled runtime.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

(async () => {
  const output = path.resolve('pytest-tmp-galaxy-browser-v3');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const errors = [];
  const url = process.env.PORTFOLIO_TEST_URL || 'http://127.0.0.1:5000/';
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    window.__draws = 0;
    for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!type) continue;
      for (const name of ['drawArrays', 'drawElements']) {
        const original = type.prototype[name];
        type.prototype[name] = function (...args) { window.__draws++; return original.apply(this, args); };
      }
    }
  });
  try {
    await page.goto(url);
    await page.locator('.is-webgl-ready').waitFor();
    await page.waitForTimeout(4500);
    assert(await page.evaluate(() => document.fonts.check('700 100px "Space Grotesk"')));
    assert.equal(await page.locator('h1').getAttribute('aria-label'), 'Ravi Kumar Tiwari');
    assert.equal(await page.locator('.hero-orb-canvas').count(), 1);
    assert.equal(await page.locator('.site-galaxy-canvas').count(), 1);
    const coverage = await page.locator('.hero-orb-canvas').boundingBox();
    assert(coverage.x <= 1 && coverage.width >= 1439, 'Canvas covers the full hero width');
    const before = await page.locator('.hero-skill').first().getAttribute('style');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(output, 'desktop-dark.png') });
    assert.notEqual(await page.locator('.hero-skill').first().getAttribute('style'), before, JSON.stringify({ errors, state: await page.locator('[data-hero-universe]').getAttribute('class'), before }));
    results.push('Desktop: full-width canvas, local display font, moving skill labels, one renderer');

    const start = await page.evaluate(() => window.__draws);
    await page.waitForTimeout(1000);
    const draws = await page.evaluate(() => window.__draws);
    assert(draws > start);
    await page.locator('.hero-cta').hover();
    assert.match(await page.locator('.cursor-ring').getAttribute('class'), /interactive/);
    await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.equal(await page.locator('.hero-name-solid').evaluate(el => getComputedStyle(el).webkitTextFillColor), 'rgb(22, 23, 24)');
    await page.screenshot({ path: path.join(output, 'desktop-light.png') });
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
    await page.waitForTimeout(4500);
    await page.locator('.hero-cta').click();
    await page.waitForTimeout(2200);
    assert(await page.evaluate(() => scrollY > 100));
    await page.evaluate(() => window.scrollTo({ top: 2100, behavior: 'instant' }));
    await page.waitForTimeout(600);
    const offscreen = await page.evaluate(() => window.__draws);
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.__draws), offscreen, 'Rendering pauses offscreen');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(2000);
    assert(await page.evaluate(() => window.__draws > 0));
    assert(await page.locator('.hero-name-solid').isVisible());
    results.push('Theme persists; CTA and cursor respond; scroll reverses; WebGL pauses offscreen');

    for (const width of [834, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(800);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}`);
      const visibleSkills = await page.locator('.hero-skill:visible').count();
      assert(visibleSkills <= (width < 768 ? 6 : 8));
      await page.screenshot({ path: path.join(output, `${width < 768 ? 'mobile' : 'tablet'}-dark.png`), fullPage: false });
    }
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    assert.equal(await page.locator('.mobile-menu').getAttribute('aria-hidden'), 'false');
    await page.keyboard.press('Escape');
    results.push('Tablet/mobile: fewer skills, no horizontal overflow, working mobile menu');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.ScrollTrigger.getAll().length), 0, 'Live motion changes revert scroll animations');
    const liveStatic = await page.locator('.hero-skill').first().getAttribute('style');
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.hero-skill').first().getAttribute('style'), liveStatic);
    results.push('Changing the motion preference during a visit stops hero and scroll animation');

    const reduced = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', colorScheme: 'dark' });
    reduced.on('pageerror', error => errors.push(error.message));
    await reduced.goto(url);
    await reduced.locator('.is-static').waitFor();
    const staticBefore = await reduced.locator('.hero-skill').first().getAttribute('style');
    await reduced.waitForTimeout(1200);
    assert.equal(await reduced.locator('.hero-skill').first().getAttribute('style'), staticBefore);
    assert.equal(await reduced.locator('.hero-name-sparkles').evaluate(el => getComputedStyle(el).display), 'none');
    await reduced.screenshot({ path: path.join(output, 'reduced-motion.png') });
    results.push('Reduced motion: static visible galaxy/planet/skills and no name flares');

    const fallback = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    await fallback.route('**/js/vendor/three.module.min.js', route => route.abort());
    await fallback.goto(url);
    await fallback.waitForTimeout(4000);
    assert.equal(await fallback.locator('.hero-space-fallback').evaluate(el => getComputedStyle(el).opacity), '1');
    assert(await fallback.locator('.hero-skill').first().isVisible());
    const rect = await fallback.locator('.hero-skill').first().boundingBox();
    assert(rect.x >= 0 && rect.x + rect.width <= 390);
    await fallback.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
    assert.equal(await fallback.locator('html').getAttribute('data-theme'), 'light');
    await fallback.screenshot({ path: path.join(output, 'module-fallback-light.png') });
    results.push('Module failure: CSS stars, static orb/labels, and working theme control');

    const shaderFallback = await browser.newPage({ viewport: { width: 834, height: 844 }, colorScheme: 'dark' });
    await shaderFallback.addInitScript(() => {
      const proto = WebGL2RenderingContext.prototype;
      const original = proto.shaderSource;
      proto.shaderSource = function (shader, source) {
        return original.call(this, shader, source.includes('uniform sampler2D uMap') ? 'invalid shader' : source);
      };
    });
    await shaderFallback.goto(url);
    await shaderFallback.locator('.is-webgl-fallback').waitFor();
    await shaderFallback.setViewportSize({ width: 390, height: 844 });
    await shaderFallback.waitForTimeout(600);
    const fallbackRects = await shaderFallback.locator('.hero-skill:visible').evaluateAll(elements => elements.map(el => ({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})));
    assert(fallbackRects.every(rect => rect.left >= -1 && rect.right <= 391));
    results.push('Shader failure restores the fallback; fallback labels remain visible after resize');

    await reduced.evaluate(() => document.querySelector('.hero-orb-canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await reduced.locator('.is-webgl-fallback').waitFor();
    assert.equal(await reduced.locator('.hero-orb-fallback').evaluate(el => getComputedStyle(el).opacity), '1');
    results.push('WebGL context loss restores the static fallback');
    assert.deepEqual(errors, [], 'No unexpected browser errors');
    console.log(JSON.stringify({ passed: results, screenshots: output }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
