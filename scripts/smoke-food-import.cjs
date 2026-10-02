// Isolated browser profiles + synthetic labels; no paid calls, user storage or external writes.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { waitForNutritionPage } = require('./nutrition-smoke-utils.cjs');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { emptyNutritionJournal, defaultNutritionPreferences } = require('../src/nutrition/engine.ts');
const { FOOD_DATA_VERSION } = require('../src/nutrition/catalog.ts');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-food-import-qa-'));
const day = '2026-09-29', now = day + 'T01:30:00.000Z';
const profile = { name: '隔离食品测试', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn',
  frequency: 3, planId: 'prisoner', levels: { push: 5, pull: 3, squat: 5, legRaise: 3, bridge: 1, hspu: 1 }, experience: 'intermediate', sessionMinutes: 45,
  trainingRestSeconds: 180, planStartedAt: now, weightHistory: [] };
const journal = emptyNutritionJournal(); journal.preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: now };
const origin = { provider: 'label_photo', identifier: 'deepseek-flash', fetchedAt: now, url: '', license: 'user-entered' };
const label = { name: '测试燕麦包装', state: '开袋即食', basisUnit: 'g', basisAmount: 100, energyUnit: 'kJ', calories: 800,
  protein: 10, carbs: 20, fat: 8, fiber: null, serving: { label: '一盒', grams: 180 }, allergens: ['milk'], warnings: ['请核对包装。'], origin };
const product = { ...label, name: '测试条码食品', energyUnit: 'kcal', calories: 200, origin: { provider: 'open_food_facts', identifier: '3017620422003',
  fetchedAt: now, url: 'https://world.openfoodfacts.org/product/3017620422003', license: 'ODbL-1.0' } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64');
const button = (page, name) => page.getByRole('button', { name, exact: true });
const read = page => page.evaluate(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }); const errors = [];
  try {
    for (const width of [320, 390, 650, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 871 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
      const calls = [];
      try {
        await context.addInitScript(({ profile, journal, now }) => {
          const OriginalDate = Date, anchor = OriginalDate.parse(now);
          class QAClock extends OriginalDate { constructor(...args) { super(...(args.length ? args : [anchor])); } static now() { return anchor; } }
          window.Date = QAClock;
          if (!localStorage.getItem('food-import-seeded')) {
            localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]');
            localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal)); localStorage.setItem('food-import-seeded', 'yes');
          }
          const write = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, value) { if (window.qaFailFoodWrite && key === 'nutrition_journal_v1') throw new Error('Isolated food save failure'); return write.call(this, key, value); };
        }, { profile, journal, now });
        await context.route('**/*', route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin === 'http://127.0.0.1:8081' || url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
          const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8081', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };
          if (url.origin !== 'http://127.0.0.1:8787') return route.abort();
          if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
          if (url.pathname === '/health') return route.fulfill({ status: 200, headers, json: { configured: true, provider: 'deepseek', model: 'deepseek-flash' } });
          calls.push(url.pathname);
          if (url.pathname.endsWith('/read-label')) return route.fulfill({ status: 200, headers, json: label });
          if (url.pathname.endsWith('/lookup-barcode')) return route.fulfill({ status: 200, headers, json: product });
          return route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
        const enter = async () => { await page.getByRole('tab', { name: '切换到饮食', exact: true }).click(); await waitForNutritionPage(page); };
        const editor = async () => { await button(page, '管理当日饮食记录').click(); await button(page, '添加饮食记录').click(); };
        const snapshot = async name => page.screenshot({ path: path.join(output, name + '-' + width + '.png'), animations: 'disabled' });
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await enter(); await editor();
        await page.getByLabel('搜索食材名称或别名', { exact: true }).fill('米粉'); await page.getByText('米粉（干、参考）', { exact: true }).waitFor();
        await page.getByText('米粉（熟、沥水参考）', { exact: true }).waitFor();
        await button(page, '拍营养标签').click();
        assert.equal(await button(page, '从相册选择').isEnabled(), false); assert.equal(calls.length, 0);
        await button(page, '同意联网，开始拍摄').click();
        await snapshot('label-import');
        const chooser = page.waitForEvent('filechooser'); await button(page, '从相册选择').click();
        await (await chooser).setFiles({ name: 'synthetic-label.png', mimeType: 'image/png', buffer: PNG });
        await page.getByLabel('自定义食品名称', { exact: true }).waitFor();
        assert.equal(await page.getByLabel('标签能量', { exact: true }).inputValue(), '800');
        assert.equal(await page.getByLabel('标签膳食纤维 g（可留空）', { exact: true }).inputValue(), '');
        assert.equal(await button(page, '保存食品标签').isEnabled(), false);
        assert.equal((await read(page)).customFoods.length, 0);
        await page.getByRole('checkbox', { name: '已核对包装标签的数值单位及过敏原', exact: true }).click();
        await snapshot('label-review');
        if (width === 320) {
          await page.evaluate(() => { window.qaFailFoodWrite = true; }); await button(page, '保存食品标签').click();
          await page.getByRole('alert').filter({ hasText: 'Isolated food save failure' }).waitFor();
          assert.equal((await read(page)).customFoods.length, 0); assert.equal(await page.getByLabel('自定义食品名称', { exact: true }).inputValue(), label.name);
          await page.evaluate(() => { window.qaFailFoodWrite = false; });
        }
        await button(page, '保存食品标签').click(); await page.getByText('添加：' + label.name, { exact: true }).waitFor();
        let saved = await read(page); assert.equal(saved.customFoods.length, 1); assert.equal(saved.entries.length, 0);
        assert.equal(saved.customFoods[0].source.origin.provider, 'label_photo'); assert.equal(saved.customFoods[0].fiberKnown, false);
        assert.ok(Math.abs(saved.customFoods[0].per100g.calories - 800 / 4.184) < 0.0001);
        await button(page, '加入清单').click(); await button(page, '保存实际摄入记录').click();
        await page.getByLabel('搜索食材名称或别名', { exact: true }).waitFor({ state: 'detached' });
        saved = await read(page); assert.equal(saved.entries.length, 1); assert.equal(saved.entries[0].foodDataVersion, FOOD_DATA_VERSION);
        assert.equal(saved.entries[0].customFoods[0].source.origin.provider, 'label_photo'); const meal = saved.entries[0];
        await editor(); await button(page, '扫商品条码').click();
        await page.getByLabel('商品条码', { exact: true }).fill('3017620422004');
        await button(page, '同意联网，开始拍摄').click();
        assert.equal(await button(page, '查询商品条码').isEnabled(), false);
        await page.getByLabel('商品条码', { exact: true }).fill(product.origin.identifier); await button(page, '查询商品条码').click();
        await page.getByLabel('自定义食品名称', { exact: true }).waitFor();
        await page.getByRole('checkbox', { name: '已核对包装标签的数值单位及过敏原', exact: true }).click(); await button(page, '保存食品标签').click();
        await page.getByText('添加：' + product.name, { exact: true }).waitFor();
        assert.equal((await read(page)).customFoods.length, 2);
        // Importing the same barcode updates one personal record instead of creating duplicates.
        await button(page, '扫商品条码').click(); await page.getByLabel('商品条码', { exact: true }).fill(product.origin.identifier);
        await button(page, '同意联网，开始拍摄').click(); await button(page, '查询商品条码').click();
        await page.getByText(/此条码已在个人食品库中/).waitFor();
        await page.getByRole('checkbox', { name: '已核对包装标签的数值单位及过敏原', exact: true }).click(); await button(page, '保存食品标签').click();
        await page.getByText('添加：' + product.name, { exact: true }).waitFor();
        saved = await read(page); assert.equal(saved.customFoods.length, 2); assert.deepEqual(saved.entries[0], meal);
        await snapshot('food-selected');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await button(page, '关闭实际摄入编辑器').click();
        await page.reload({ waitUntil: 'domcontentloaded' }); await enter();
        saved = await read(page); assert.equal(saved.customFoods.length, 2); assert.deepEqual(saved.entries[0], meal);
        assert.equal(saved.customFoods.find(f => f.source.origin.provider === 'open_food_facts').source.license, 'ODbL-1.0');
        assert.deepEqual(calls, ['/v1/nutrition/read-label', '/v1/nutrition/lookup-barcode', '/v1/nutrition/lookup-barcode']);
        console.log('PASS', width, 'consent, label import, missing fiber, checked save, kJ conversion, durable sources, barcode dedup, untouched historical intake');
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []); console.log('Screenshots:', output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
