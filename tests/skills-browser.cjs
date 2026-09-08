const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const output = path.resolve('pytest-tmp-skills-browser');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const passed = [];
  const scrollToSkills = async () => {
    await page.locator('#skills').evaluate(el => window.scrollTo({ top: el.offsetTop, behavior: 'instant' }));
    await page.waitForTimeout(1400);
  };
  try {
    await page.goto('http://127.0.0.1:5000/');
    await page.waitForTimeout(2000);
    await scrollToSkills();
    assert.equal(await page.locator('[data-skill-row]').count(), 10);
    const expected = ['Django', 'Python', 'HTML', 'CSS', 'Bootstrap', 'JavaScript', 'Cloudinary', 'IBM SPSS', 'MySQL', 'MongoDB'];
    assert.deepEqual(await page.locator('.skill-name').allTextContents(), expected);
    const first = page.locator('.skill-toggle').first();
    await first.scrollIntoViewIfNeeded();
    await first.hover();
    await page.waitForTimeout(450);
    assert.equal(await first.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('.cursor-label').textContent(), 'EXPLORE');
    assert.equal(await page.locator('.skill-detail').first().getAttribute('aria-hidden'), 'false');
    await page.screenshot({ path: path.join(output, 'skills-desktop-dark.png') });
    await page.mouse.move(5, 5);
    await first.focus();
    await page.keyboard.press('Enter');
    assert.equal(await first.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await first.getAttribute('aria-expanded'), 'false');
    for (const row of await page.locator('[data-skill-row]').all()) {
      await row.scrollIntoViewIfNeeded();
      await page.waitForTimeout(650);
      assert.equal(await row.locator('img').evaluate(img => img.complete && img.naturalWidth > 0), true);
      assert(Number(await row.evaluate(el => getComputedStyle(el).opacity)) > .95);
    }
    passed.push('Ten database-rendered skills, all logos, per-row reveals, hover, keyboard expansion, cursor');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(500);
    await page.locator('[data-theme-toggle]').click();
    await scrollToSkills();
    await first.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.screenshot({ path: path.join(output, 'skills-desktop-light.png') });
    const background = await page.locator('#skills').evaluate(el => getComputedStyle(el).backgroundColor);
    assert(background.includes('245, 242, 235'));
    // Existing-but-failed image also gets a graceful fallback, without a broken glyph.
    await page.locator('.skill-icon img').first().evaluate(img => img.dispatchEvent(new Event('error')));
    assert.equal(await page.locator('.skill-icon-fallback').first().isVisible(), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await first.evaluate(el => getComputedStyle(el.querySelector('.skill-name')).transitionDuration), '0s');
    assert.equal(await page.locator('.cursor-ring').isVisible(), false);
    passed.push('Light theme, missing-image fallback, live reduced-motion support');

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, colorScheme: 'dark' });
    const mobilePage = await mobile.newPage();
    mobilePage.on('pageerror', error => errors.push(error.message));
    await mobilePage.goto('http://127.0.0.1:5000/#skills');
    const mobileButton = mobilePage.locator('.skill-toggle').first();
    await mobileButton.scrollIntoViewIfNeeded();
    await mobilePage.waitForTimeout(1000);
    await mobileButton.tap();
    assert.equal(await mobileButton.getAttribute('aria-expanded'), 'true');
    await mobilePage.waitForTimeout(450);
    await mobilePage.screenshot({ path: path.join(output, 'skills-mobile.png') });
    await mobileButton.tap();
    assert.equal(await mobileButton.getAttribute('aria-expanded'), 'false');
    for (const width of [320, 390, 768]) {
      await mobilePage.setViewportSize({ width, height: 844 });
      assert(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await mobile.close();
    passed.push('Mobile tap expansion and no overflow at 320, 390 and 768 pixels');

    // Admin writes go only to a disposable in-memory test server on port 5001.
    await page.goto('http://127.0.0.1:5001/admin/login');
    await page.locator('input[name="identity"]').fill('skills-test');
    await page.locator('input[name="password"]').fill('skills-preview-test-only');
    await Promise.all([page.waitForURL('**/admin'), page.locator('input[type="submit"],button[type="submit"]').first().click()]);
    await page.locator('.admin-sidebar a[href="/admin/skills"]').click();
    await page.screenshot({ path: path.join(output, 'admin-skills.png') });
    await page.getByRole('link', { name: '+ Add skill' }).click();
    await page.locator('#name').fill('Browser QA Skill');
    await page.locator('#category').fill('Backend');
    await page.locator('#description').fill('Only in the isolated browser test site.');
    await page.locator('#icon_type').selectOption('initials');
    await page.locator('#accent_color').fill('#75B9EC');
    await page.locator('#display_order').fill('0');
    await page.locator('input[type="submit"]').click();
    const row = page.locator('tr').filter({ hasText: 'Browser QA Skill' });
    assert.equal(await row.count(), 1);
    await row.getByRole('link', { name: 'Edit', exact: true }).click();
    await page.locator('#description').fill('Updated from browser QA.');
    await page.screenshot({ path: path.join(output, 'admin-skill-edit.png') });
    await page.locator('input[type="submit"]').click();
    await row.getByRole('button', { name: 'Hide', exact: true }).click();
    assert(await row.getByText('Hidden', { exact: true }).isVisible());
    await row.getByRole('button', { name: 'Show', exact: true }).click();
    await row.locator('input[type="number"]').fill('99');
    await page.getByRole('button', { name: 'Save order' }).click();
    assert.equal(await page.locator('tbody tr').last().locator('strong').textContent(), 'Browser QA Skill');
    await row.getByRole('link', { name: 'Delete', exact: true }).click();
    assert(await page.getByRole('heading', { name: 'Delete Browser QA Skill?' }).isVisible());
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    assert.equal(await row.count(), 1);
    await row.getByRole('link', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete skill permanently' }).click();
    assert.equal(await row.count(), 0);
    passed.push('Admin add, edit, hide/show, reorder, cancel deletion and confirmed deletion');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed, screenshots: output }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
