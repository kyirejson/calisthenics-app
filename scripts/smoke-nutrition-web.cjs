// Optional browser smoke test. Uses an isolated browser profile and mocked nutrition
// responses only. PLAYWRIGHT_PATH may point to an existing Playwright installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { waitForNutritionPage } = require('./nutrition-smoke-utils.cjs');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const engine = require('../src/nutrition/engine.ts');
const { withIntakeEntry } = require('../src/nutrition/journal.ts');
const photo = () => ({ id: 'smoke-photo', model: 'offline-smoke', items: [
  { name: '米饭', portionLabel: '一碗', nutrients: { calories: 260, protein: 5, carbs: 56, fat: 1, fiber: 1 }, calorieRange: { min: 210, max: 310 } },
  { name: '鸡胸', portionLabel: '一份', nutrients: { calories: 165, protein: 31, carbs: 0, fat: 4, fiber: 0 }, calorieRange: { min: 140, max: 210 } },
], assumptions: ['仅自动化测试'], warnings: ['隐藏配料未知'] });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [], notes = [];
  page.on('pageerror', error => errors.push(error.message));
  const readJournal = () => page.evaluate(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')));
  try {
    await page.route('http://127.0.0.1:8787/**', async route => {
      const request = route.request();
      const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8081', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (request.url().endsWith('/health')) return route.fulfill({ status: 200, headers, json: { configured: true, model: 'offline-smoke', provider: 'offline-smoke' } });
      if (request.url().endsWith('/analyze-photo')) {
        notes.push(request.postDataJSON().note || '');
        return route.fulfill({ status: 200, headers, json: { ...photo(), id: 'smoke-result-' + notes.length } });
      }
      return route.abort();
    });
    // Browser screenshot itself provides a valid in-memory image fixture. It is
    // only returned to the mocked endpoint and is never sent to a real provider.
    const imageBuffer = await page.screenshot();
    await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const day = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    const profile = { name: '隔离测试', age: 30, height: 180, weight: 75, sex: 'male', goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, levels: {}, experience: 'intermediate', sessionMinutes: 45, trainingRestSeconds: 180, planStartedAt: new Date().toISOString(), weightHistory: [] };
    let journal = engine.emptyNutritionJournal();
    journal.preferences = { ...engine.defaultNutritionPreferences(profile), screeningCompletedAt: new Date().toISOString() };
    journal = withIntakeEntry(journal, { id: 'smoke-manual', date: day, slot: 'lunch', name: '测试常用米饭', source: 'manual', portions: [{ foodId: 'rice-cooked', grams: 150 }] });
    journal = { ...journal, savedMeals: [journal.entries[0]] };
    await page.evaluate(({ profile, journal }) => { localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal)); }, { profile, journal });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: '切换到饮食' }).click();
    await waitForNutritionPage(page);
    assert.equal(await page.getByRole('button', { name: '换一道', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '展开或收起今日推荐菜单', exact: true }).count(), 0);
    console.log('PASS mobile dashboard / full-day menu removed');
    assert.equal(await page.getByRole('button', { name: '复用测试常用米饭', exact: true }).count(), 0);
    assert.equal(await page.getByTestId('nutrition-next-meal').count(), 0);
    await page.getByRole('button', { name: '管理当日饮食记录', exact: true }).click();
    await page.getByRole('button', { name: '添加饮食记录', exact: true }).click();
    await page.getByRole('button', { name: '早餐', exact: true }).click();
    await page.getByLabel('搜索食材名称或别名', { exact: true }).fill('白米饭');
    await page.getByRole('button', { name: /^长粒白米饭（熟/ }).click();
    await page.getByRole('button', { name: '加入清单', exact: true }).click();
    await page.getByRole('button', { name: '保存实际摄入记录', exact: true }).click();
    await page.getByRole('button', { name: '关闭实际摄入编辑器', exact: true }).waitFor({ state: 'hidden' });
    const copied = await readJournal();
    assert.equal(copied.entries.length, 2);
    assert.equal(copied.entries[0].slot, 'breakfast');
    assert.equal(copied.entries.find(entry => entry.id === 'smoke-manual').slot, 'lunch');
    console.log('PASS manual search remains in record management / unused saved meals are preserved');
    await page.getByRole('button', { name: '拍照记餐', exact: true }).click();
    await page.getByRole('button', { name: '同意本次发送照片', exact: true }).click();
    const upload = async name => {
      console.log('Selecting fixture', name);
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: '从相册选', exact: true }).click()]);
      // A previous result may still be mounted until the picker resolves.
      // Wait for THIS image's response before querying its replacement controls.
      const expectedCount = notes.length + 1;
      const [response] = await Promise.all([
        page.waitForResponse(response => response.url().endsWith('/analyze-photo') && response.request().method() === 'POST'),
        chooser.setFiles({ name, mimeType: 'image/png', buffer: imageBuffer }),
      ]);
      assert.equal(response.status(), 200);
      assert.equal((await response.json()).id, 'smoke-result-' + expectedCount);
      await page.getByRole('button', { name: '米饭：当前一半', exact: true }).waitFor();
      await page.waitForFunction(() => {
        const button = document.querySelector('[aria-label="米饭：当前一半"]');
        return button && !button.hasAttribute('disabled') && button.getAttribute('aria-disabled') !== 'true';
      });
    };
    await upload('meal-a.png');
    console.log('PASS photo selection / mocked result');
    await page.getByLabel('补充菜名或纠正识别，可选', { exact: true }).fill('只吃配菜');
    await page.getByRole('button', { name: '联网按补充说明重新估算', exact: true }).click();
    await page.getByRole('button', { name: '联网重新估算这张照片', exact: true }).waitFor();
    await upload('meal-b.png');
    assert.deepEqual(notes, ['', '只吃配菜', '']);
    assert.equal(await page.getByLabel('补充菜名或纠正识别，可选').inputValue(), '');
    await page.getByRole('button', { name: '移除鸡胸', exact: true }).click();
    await page.getByRole('button', { name: '米饭：当前一半', exact: true }).click();
    await page.getByRole('button', { name: '＋ 补充食物 / 用油', exact: true }).click();
    await page.getByLabel('查找漏识别的食物或用油').fill('芥花籽油');
    await page.getByRole('button', { name: /^芥花籽油 · / }).click();
    await page.getByRole('button', { name: '使用 约1茶匙（4.5g）', exact: true }).click();
    await page.getByRole('button', { name: '确认份量，记录这一餐', exact: true }).click();
    const saved = await readJournal();
    assert.equal(saved.entries.length, 3);
    const savedPhoto = saved.entries.find(entry => entry.source === 'photo_estimate');
    assert.equal(savedPhoto.photoEstimate.items.length, 2);
    assert.equal(savedPhoto.photoEstimate.items[0].nutrients.calories, 130);
    assert.equal(savedPhoto.photoEstimate.items[1].provenance.foodId, 'canola-oil');
    assert.equal(savedPhoto.nutrients.calories, 169.8);
    console.log('PASS new image clears old note / per-item corrections / missing oil / save');
    await page.reload({ waitUntil: 'domcontentloaded' });
    const restored = await readJournal();
    assert.deepEqual(restored.entries, saved.entries);
    assert.equal(restored.savedMeals.length, 1);
    assert.deepEqual(errors, []);
    console.log('PASS reload persistence; no page errors; no real model requests');
    for (const width of [320, 681, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('tab', { name: '切换到饮食' }).click();
      await waitForNutritionPage(page);
      const geometry = await page.getByRole('button', { name: '问营养助手', exact: true }).boundingBox();
      assert.ok(geometry && geometry.x >= 0 && geometry.x + geometry.width <= width, 'primary action must fit viewport');
      if (process.env.NUTRITION_SCREENSHOT_DIR) await page.screenshot({ path: require('node:path').join(process.env.NUTRITION_SCREENSHOT_DIR, `nutrition-${width}.png`), animations: 'disabled' });
    }
    assert.deepEqual(errors, []);
    console.log('PASS 320 / 681 / 1280 px layouts');
  } catch (error) {
    console.error((await page.locator('body').innerText()).slice(-2000));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
