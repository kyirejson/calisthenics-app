// Isolated synthetic photo QA: no real API charges, no user's browser data touched.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { waitForNutritionPage } = require('./nutrition-smoke-utils.cjs');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { emptyNutritionJournal, defaultNutritionPreferences } = require('../src/nutrition/engine.ts');
const { withIntakeEntry } = require('../src/nutrition/journal.ts');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-smart-photo-qa-'));
const date = '2026-09-29', now = date + 'T01:30:00.000Z';
const profile = { name: '隔离拍照测试', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn',
  frequency: 3, planId: 'prisoner', levels: { push: 5, pull: 3, squat: 5, legRaise: 3, bridge: 1, hspu: 1 }, experience: 'intermediate', sessionMinutes: 45,
  trainingRestSeconds: 180, planStartedAt: now, weightHistory: [] };
let journal = emptyNutritionJournal(); journal.preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: now };
const visual = { id: 'legacy-cashew', model: 'test-vision', items: [{ name: '旧盐焗腰果仁', portionLabel: '照片一份',
  nutrients: { calories: 180, protein: 5, carbs: 7, fat: 15, fiber: 1 }, calorieRange: { min: 120, max: 250 } }], assumptions: [], warnings: [] };
journal = withIntakeEntry(journal, { id: 'legacy-cashew-intake', date, slot: 'lunch', name: '旧盐焗腰果仁', source: 'photo_estimate', portions: [], photoEstimate: visual }, now);
const label = { name: '盐焗腰果仁', state: '开袋即食', basisUnit: 'g', basisAmount: 100, energyUnit: 'kJ', calories: 2515,
  protein: 23, carbs: 20, fat: 47, fiber: null, serving: null, packageGrams: 60, allergens: ['tree_nut'], warnings: ['请核对标签。'],
  origin: { provider: 'label_photo', identifier: 'deepseek-flash', fetchedAt: now, url: '', license: 'user-entered' } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64');
const button = (page, name) => page.getByRole('button', { name, exact: true });
const read = page => page.evaluate(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')));
const photoCount = page => page.evaluate(async () => new Promise((resolve, reject) => {
  const request = indexedDB.open('uncover-nutrition-photos-v1', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'id' });
  request.onerror = () => reject(request.error);
  request.onsuccess = () => { const db = request.result, tx = db.transaction('photos'), count = tx.objectStore('photos').count();
    count.onsuccess = () => resolve(count.result); tx.oncomplete = () => db.close(); };
}));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }), errors = [];
  try {
    for (const width of [320, 390, 650, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 871 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
      const calls = [];
      try {
        await context.addInitScript(({ profile, journal, now }) => {
          const OriginalDate = Date;
          class QAClock extends OriginalDate { constructor(...args) { super(...(args.length ? args : [OriginalDate.parse(now)])); } static now() { return OriginalDate.parse(now); } }
          window.Date = QAClock;
          if (!localStorage.getItem('smart-photo-seeded')) {
            localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]');
            localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal)); localStorage.setItem('smart-photo-seeded', 'yes');
          }
          const write = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, value) { if (window.qaFailPhotoWrite && key === 'nutrition_journal_v1') throw Error('Isolated photo save failure'); return write.call(this, key, value); };
        }, { profile, journal, now });
        await context.route('**/*', route => {
          const req = route.request(), url = new URL(req.url());
          if (url.origin === 'http://127.0.0.1:8081' || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
          if (url.origin !== 'http://127.0.0.1:8787') return route.abort();
          const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8081', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
          if (url.pathname === '/health') return route.fulfill({ status: 200, headers, json: { configured: true, provider: 'deepseek', model: 'deepseek-flash' } });
          calls.push(url.pathname);
          if (url.pathname.endsWith('/analyze-photo')) {
            assert.match(req.postDataJSON().imageDataUrl, /^data:image\/jpeg;base64,/);
            return route.fulfill({ status: 200, headers, json: { kind: 'label', draft: label } });
          }
          if (url.pathname.endsWith('/read-label')) return route.fulfill({ status: 200, headers, json: label });
          return route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(18000); page.on('pageerror', e => errors.push(e.message));
        const enter = async () => { await page.getByRole('tab', { name: '切换到饮食', exact: true }).click(); await waitForNutritionPage(page); };
        const snap = async name => page.screenshot({ path: path.join(out, name + '-' + width + '.png'), animations: 'disabled' });
        const upload = async name => { const chooser = page.waitForEvent('filechooser'); await button(page, name).click(); await (await chooser).setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: PNG }); };
        const review = async () => {
          await page.getByLabel('自定义食品名称', { exact: true }).waitFor();
          assert.equal(await page.getByLabel('标签能量', { exact: true }).inputValue(), '2515');
          assert.equal(await button(page, '保存食品，选择食用份量').isEnabled(), false);
          await page.getByRole('checkbox', { name: '已核对包装标签的数值单位及过敏原', exact: true }).click();
          await button(page, '保存食品，选择食用份量').click(); await button(page, '半包 · 30g').waitFor();
          await button(page, '半包 · 30g').click();
          await page.getByText('按核对标签计算', { exact: true }).waitFor();
        };
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await enter();
        const before = (await read(page)).entries[0];
        await button(page, '拍照记餐').click();
        assert.equal(calls.length, 0);
        await button(page, '同意联网，开始拍摄').click();
        await upload('从相册选择'); await review();
        await page.getByRole('radio', { name: '晚餐', exact: true }).click();
        assert.equal(await button(page, '确认，记录晚餐').isEnabled(), true);
        assert.equal(await page.getByRole('checkbox', { name: '保存饮食照片到本机', exact: true }).isChecked(), false);
        await page.getByRole('checkbox', { name: '保存饮食照片到本机', exact: true }).click();
        await snap('review-label');
        if (width === 320) {
          await page.evaluate(() => { window.qaFailPhotoWrite = true; }); await button(page, '确认，记录晚餐').click();
          await page.getByRole('alert').filter({ hasText: 'Isolated photo save failure' }).waitFor();
          assert.equal(await photoCount(page), 0); assert.equal((await read(page)).entries.length, 1);
          await page.evaluate(() => { window.qaFailPhotoWrite = false; });
        }
        await button(page, '确认，记录晚餐').click();
        await page.getByText('确认这一餐', { exact: true }).waitFor({ state: 'detached' });
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).entries.length === 2);
        let saved = await read(page), added = saved.entries.find(e => e.id !== before.id);
        assert.deepEqual(saved.entries.find(e => e.id === before.id), before);
        assert.equal(added.nutrients.calories, 180.3); assert.equal(added.nutrients.protein, 6.9); assert.equal(added.fiberIncomplete, true);
        assert.equal(added.photoEstimate.items[0].estimatedGrams, 30); assert.equal(added.photos.length, 1);
        assert.equal(await photoCount(page), 1); assert.equal(JSON.stringify(saved).includes('data:image'), false);
        await page.reload({ waitUntil: 'domcontentloaded' }); await enter();
        assert.deepEqual((await read(page)).entries.find(e => e.id === added.id), added);
        await button(page, '查看保存的饮食照片').click(); await button(page, '关闭照片').waitFor();
        assert.equal(await page.getByTestId('nutrition-record-details').isVisible(), false);
        await snap('saved-photo'); await button(page, '关闭照片').click();
        await button(page, '查看晚餐饮食记录').click(); await button(page, '删除').click(); await button(page, '删除记录').click();
        await page.waitForFunction(id => !JSON.parse(localStorage.getItem('nutrition_journal_v1')).entries.some(e => e.id === id), added.id);
        assert.equal(await photoCount(page), 0); await button(page, '关闭饮食记录').click();
        await button(page, '查看午餐饮食记录').click(); await button(page, '编辑').click();
        await page.getByText('份量未知 · 不能把这一份当成100g', { exact: true }).waitFor();
        await button(page, '补拍标签修正旧盐焗腰果仁').click();
        await page.getByRole('radio', { name: '营养标签', exact: true }).click(); await button(page, '同意联网，开始拍摄').click();
        await upload('从相册选择'); await review();
        await button(page, '保存并应用这项更正').click();
        await button(page, '保存本地纠正').waitFor();
        saved = await read(page); const corrected = saved.entries.find(e => e.id === before.id);
        assert.equal(saved.entries.length, 1); assert.equal(corrected.nutrients.calories, 180.3); assert.equal(corrected.createdAt, before.createdAt);
        assert.equal(corrected.photos, undefined); assert.equal(await photoCount(page), 0);
        await snap('corrected-legacy');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await button(page, '保存本地纠正').click();
        assert.deepEqual(calls, ['/v1/nutrition/analyze-photo', '/v1/nutrition/read-label']);
        console.log('PASS', width, 'automatic packaging routing, kJ/half-package, mandatory review, optional indexedDB photos, rollback, restart, viewer, deletion, legacy correction');
      } catch (error) { await pageFailure(context, width); throw error; }
      finally { await context.close(); }
    }
    assert.deepEqual(errors, []); console.log('Screenshots:', out);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
async function pageFailure(context, width) {
  const page = context.pages()[0];
  if (page) { await page.screenshot({ path: path.join(out, 'failure-' + width + '.png') }); console.error((await page.locator('body').innerText()).slice(-5000)); }
}
