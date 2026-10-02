// Isolated storage, local fixture images and blocked paid/external requests.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { waitForNutritionPage } = require('./nutrition-smoke-utils.cjs');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { emptyNutritionJournal, defaultNutritionPreferences, createCustomFoodFromLabel } = require('../src/nutrition/engine.ts');
const { withCustomFood, withIntakeEntry } = require('../src/nutrition/journal.ts');
const now = '2026-09-29T01:30:00.000Z', day = '2026-09-29';
const profile = { name: '隔离配图测试', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn',
  frequency: 3, planId: 'prisoner', levels: { push: 5, pull: 3, squat: 5, legRaise: 3, bridge: 1, hspu: 1 }, experience: 'intermediate', sessionMinutes: 45,
  trainingRestSeconds: 180, planStartedAt: now, weightHistory: [] };
const missingPhotoFood = { ...createCustomFoodFromLabel({ id: 'custom-missing-photo', name: '缺图测试腰果', state: '即食', basisGrams: 100,
  energyUnit: 'kcal', calories: 600, protein: 23, carbs: 20, fat: 47, allergens: ['tree_nut'] }), artworkCategory: 'nuts',
  photo: { id: 'nutrition-photo-missing1234567890', kind: 'food', capturedAt: now } };
let journal = withCustomFood(emptyNutritionJournal(), missingPhotoFood);
journal.preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: now };
journal = withIntakeEntry(journal, { id: 'artwork-existing', date: day, slot: 'breakfast', name: missingPhotoFood.name,
  source: 'manual', portions: [{ foodId: missingPhotoFood.id, grams: 30 }] }, now);
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-food-artwork-qa-'));
const button = (page, name) => page.getByRole('button', { name, exact: true });
const read = page => page.evaluate(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')));
const files = page => page.evaluate(async () => {
  return await new Promise((resolve, reject) => { const request = indexedDB.open('uncover-nutrition-photos-v1', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('photos', { keyPath: 'id' }); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result; const all = db.transaction('photos', 'readonly').objectStore('photos').getAllKeys();
      all.onsuccess = () => { resolve(all.result); db.close(); }; all.onerror = () => { reject(all.error); db.close(); }; }; });
});
const thumbLoaded = async page => {
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="food-artwork-fallback"]')].every(node => {
    const img = node.querySelector('img') || node;
    return img.complete && img.naturalWidth > 0 && node.getBoundingClientRect().width > 0;
  }));
};

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }); const errors = [];
  try {
    for (const width of [320, 390, 650, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 871 }, reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai' });
      try {
        await context.addInitScript(({ profile, journal, now }) => {
          const RealDate = Date, timestamp = RealDate.parse(now);
          class QAClock extends RealDate { constructor(...args) { super(...(args.length ? args : [timestamp])); } static now() { return timestamp; } }
          window.Date = QAClock;
          if (!localStorage.getItem('food-artwork-seeded')) {
            localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]');
            localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal)); localStorage.setItem('food-artwork-seeded', 'yes');
          }
          const write = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, value) { if (window.qaFailPhotoWrite && key === 'nutrition_journal_v1') throw new Error('QA photo save failure'); return write.call(this, key, value); };
        }, { profile, journal, now });
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          if (url.origin === 'http://127.0.0.1:8081' || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
          if (url.origin === 'http://127.0.0.1:8787' && url.pathname === '/health') return route.fulfill({ status: 200,
            headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8081' }, json: { configured: false } });
          return route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(18000); page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
        const enter = async () => { await page.getByRole('tab', { name: '切换到饮食', exact: true }).click(); await waitForNutritionPage(page); };
        const editor = async () => { await button(page, '管理当日饮食记录').click(); await button(page, '添加饮食记录').click(); };
        const choosePicture = async () => { const request = page.waitForEvent('filechooser'); await button(page, '选择个人食品图片').click(); await (await request).setFiles(path.join(__dirname, '../assets/nutrition-foods/nuts-v1.jpg')); await page.getByLabel('待保存的个人食品照片', { exact: true }).waitFor(); await button(page, '保存食品标签').waitFor(); };
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await enter(); await thumbLoaded(page);
        assert.ok(await page.getByTestId('food-artwork-badge').filter({ hasText: '坚果图' }).isVisible());
        assert.equal((await read(page)).entries[0].nutrients.calories, 180);
        await editor(); await thumbLoaded(page);
        assert.equal(await page.getByTestId('nutrition-food-search-results').getByTestId('food-artwork').count(), 102);
        await button(page, '＋ 按包装标签添加食品').click(); await choosePicture();
        assert.deepEqual(await files(page), []); await button(page, '取消编辑标签').click(); assert.deepEqual(await files(page), []);
        await button(page, '＋ 按包装标签添加食品').click();
        await page.getByLabel('自定义食品名称', { exact: true }).fill('图片持久化腰果');
        await page.getByLabel('包装食用状态', { exact: true }).fill('即食');
        for (const [label, value] of [['标签能量', '600'], ['标签蛋白质 g', '23'], ['标签碳水化合物 g', '20'], ['标签脂肪 g', '47']]) await page.getByLabel(label, { exact: true }).fill(value);
        await button(page, '选择食品配图分类').click(); await page.getByRole('radio', { name: '食品图片分类：坚果', exact: true }).click(); await choosePicture();
        await page.evaluate(() => { window.qaFailPhotoWrite = true; }); await button(page, '保存食品标签').click();
        await page.getByRole('alert').filter({ hasText: 'QA photo save failure' }).waitFor();
        assert.deepEqual(await files(page), []); assert.equal((await read(page)).customFoods.length, 1);
        await page.evaluate(() => { window.qaFailPhotoWrite = false; }); await button(page, '保存食品标签').click();
        await page.getByText('添加：图片持久化腰果', { exact: true }).waitFor();
        let saved = await read(page); const food = saved.customFoods.find(food => food.name === '图片持久化腰果');
        assert.equal(food.artworkCategory, 'nuts'); assert.ok(food.photo.id); assert.deepEqual(await files(page), [food.photo.id]);
        await button(page, '加入清单').click(); await button(page, '保存实际摄入记录').click();
        await page.getByLabel('搜索食材名称或别名', { exact: true }).waitFor({ state: 'detached' });
        // Close record-management sheet to return to the actual meal cards.
        const closeRecords = page.getByRole('button', { name: /关闭.*饮食|关闭.*记录/ });
        if (await closeRecords.count()) await closeRecords.first().click();
        await page.reload({ waitUntil: 'domcontentloaded' }); await enter();
        await page.getByTestId('food-artwork-personal').waitFor();
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="food-artwork-personal"]')].some(node => +getComputedStyle(node).opacity === 1));
        await thumbLoaded(page); await page.screenshot({ path: path.join(out, width + '-meals.png'), animations: 'disabled' });
        saved = await read(page); const historical = saved.entries.find(entry => entry.slot === 'lunch');
        assert.equal(historical.customFoods[0].photo.id, food.photo.id);
        await editor(); await page.getByLabel('搜索食材名称或别名', { exact: true }).fill('图片持久化腰果');
        await page.getByText('图片持久化腰果 · 自定义', { exact: true }).click(); await button(page, '修改标签').click();
        await page.getByLabel('移除个人食品图片', { exact: true }).click(); await button(page, '保存食品标签').click();
        await page.getByText('添加：图片持久化腰果', { exact: true }).waitFor();
        saved = await read(page); assert.equal(saved.customFoods.find(f => f.id === food.id).photo, undefined);
        assert.deepEqual(saved.entries.find(entry => entry.id === historical.id), historical); assert.deepEqual(await files(page), [food.photo.id]);
        // Remove the remaining reference; the owned image should then be cleaned up.
        await button(page, '关闭实际摄入编辑器').click();
        await button(page, '查看午餐饮食记录').click(); await button(page, '删除').click(); await button(page, '删除记录').click();
        await page.waitForFunction(id => !JSON.parse(localStorage.getItem('nutrition_journal_v1')).entries.some(entry => entry.id === id), historical.id);
        await button(page, '添加饮食记录').waitFor(); assert.deepEqual(await files(page), []);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        console.log('PASS', width, 'all 101 food thumbnails, missing photo fallback, cancel, failed-save rollback, reload/reuse and immutable history');
      } catch (error) { const page = context.pages()[0]; if (page) { await page.screenshot({ path: path.join(out, 'failure-' + width + '.png') }); console.error((await page.locator('body').innerText()).slice(-3500)); } throw error; }
      finally { await context.close(); }
    }
    assert.deepEqual(errors, []); console.log('Screenshots:', out);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
