// Isolated synthetic profiles only; never changes the user's browser storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = { name: '器械验收', age: 30, sex: 'male', height: 175, weight: 75, goal: 'street_mastery', nutritionGoal: 'performance', dietPattern: 'balanced_cn', frequency: 3, sessionMinutes: 45, experience: 'intermediate', levels: { push: 5 }, planLevels: { push: 5 }, planId: 'prisoner', planStartedAt: new Date().toISOString() };
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-equipment-ui-'));
  const errors = [];
  try {
    for (const width of [320, 390, 681, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: width === 390 ? 'no-preference' : 'reduce' });
      await context.addInitScript(profile => { localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]'); }, base);
      const page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message));
      await page.route('http://127.0.0.1:8787/**', route => route.abort());
      await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByRole('button', { name: '选择训练目标', exact: true }).click();
      await page.getByRole('button', { name: '选择器械训练', exact: true }).click();
      await page.getByText('器械训练', { exact: true }).first().waitFor();
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('user_profile')));
      assert.equal(stored.goal, 'equipment'); assert.equal(stored.nutritionGoal, 'performance'); assert.equal(stored.levels.push, 5);
      assert.equal(await page.getByText('浏览器械动作', { exact: true }).count(), 0);
      await page.getByText('进阶', { exact: true }).click();
      await page.getByTestId('equipment-movement-list').waitFor();
      assert.equal(await page.getByRole('tab').count(), 6);
      assert.equal(await page.getByRole('button', { name: /^查看.*器械动作指导$/ }).count(), 5);
      assert.equal(await page.getByRole('radio', { name: '筛选全部肌群动作', exact: true }).count(), 0);
      await page.getByRole('radio', { name: '筛选中胸肌群动作', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: /^查看.*器械动作指导$/ }).count(), 10);
      assert.equal(await page.locator('img[src*="arnold_image"]').count(), 0);
      await page.waitForFunction(() => { const list = document.querySelector('[data-testid="equipment-movement-list"]'); return list && Number(getComputedStyle(list).opacity) > .999 && Math.abs(new DOMMatrixReadOnly(getComputedStyle(list).transform).m42) < .01; });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(output, `equipment-${width}.png`), animations: 'disabled' });
      await page.getByRole('button', { name: '查看平板哑铃卧推器械动作指导', exact: true }).click();
      await page.getByTestId('equipment-modern-guide').waitFor();
      assert.equal(await page.getByText('原书关联资料', { exact: true }).count(), 0);
      assert.equal(await page.locator('img[src*="arnold_image"]').count(), 0);
      assert.equal(await page.getByRole('button', { name: /^放大.*原书配图$/ }).count(), 0);
      assert.equal(await page.getByText('训练此动作', { exact: true }).count(), 0);
      await page.getByRole('button', { name: '返回器械动作库', exact: true }).click();
      await page.getByRole('tab', { name: '查看腿部器械动作', exact: true }).click();
      assert.equal(await page.getByRole('radio', { name: '筛选股四头肌肌群动作', exact: true }).getAttribute('aria-checked'), 'true');
      await page.getByLabel('搜索器械动作', { exact: true }).fill('平板支撑');
      assert.equal(await page.getByRole('button', { name: /^查看.*器械动作指导$/ }).count(), 1);
      await page.getByRole('button', { name: '查看背部负重平板支撑器械动作指导', exact: true }).click();
      assert.equal(await page.locator('img[src*="arnold_image00914"]').count(), 0);
      await page.getByRole('button', { name: '返回器械动作库', exact: true }).click();
      await page.getByText('我的', { exact: true }).click();
      assert.equal(await page.getByText('训练日历', { exact: true }).count(), 1);
      await page.getByText('训练专题', { exact: true }).click();
      await page.getByRole('button', { name: '选择街头健身', exact: true }).click();
      await page.getByText('进阶', { exact: true }).click();
      await page.getByTestId('progression-screen').waitFor();
      assert.equal(await page.getByText('六艺基础', { exact: true }).count(), 1);
      assert.equal(await page.getByRole('button', { name: '查看街头技巧分类', exact: true }).count(), 0);
      console.log(`PASS ${width}px: module switch, counts, independent demo images, no book photos, original progression restored`);
      await context.close();
    }
    assert.deepEqual(errors, []); console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
