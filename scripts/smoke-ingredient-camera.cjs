// Isolated UI/workflow fixtures, not a vision accuracy benchmark or a paid provider call.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { waitForNutritionPage } = require('./nutrition-smoke-utils.cjs');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { emptyNutritionJournal, defaultNutritionPreferences } = require('../src/nutrition/engine.ts');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-ingredients-qa-'));
const now = '2026-09-29T01:30:00.000Z';
const profile = { name: '隔离食材测试', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, planId: 'prisoner', levels: { push: 5, pull: 3, squat: 5, legRaise: 3, bridge: 1, hspu: 1 }, experience: 'intermediate', sessionMinutes: 45, trainingRestSeconds: 180, planStartedAt: now, weightHistory: [] };
const journal = emptyNutritionJournal(); journal.preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: now };
const recognized = { kind: 'ingredients', id: 'ui-ingredient-result', model: 'offline-vision-fixture', dishName: '番茄炒鸡蛋', needsOilReview: true, warnings: ['原料份量为估计。'],
  ingredients: [{ name: '鸡蛋', role: 'food', state: 'raw', estimatedGrams: null, count: 2 }, { name: '番茄', role: 'food', state: 'raw', estimatedGrams: 250, count: 2 }] };
const button = (page, name) => page.getByRole('button', { name, exact: true });
const read = page => page.evaluate(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')));
const inputPhoto = fs.readFileSync(path.resolve(__dirname, '../assets/nutrition-ingredients/tomato.png'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }), errors = [];
  try {
    for (const width of [320, 390, 650, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 871 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
      let requests = 0, response = recognized;
      try {
        await context.addInitScript(({ profile, journal, now }) => {
          const Original = Date; class Clock extends Original { constructor(...args) { super(...(args.length ? args : [Original.parse(now)])); } static now() { return Original.parse(now); } } window.Date = Clock;
          if (!localStorage.getItem('ingredients-qa')) { localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]'); localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal)); localStorage.setItem('ingredients-qa', '1'); }
          const write = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (window.qaFailWrite && key === 'nutrition_journal_v1') throw Error('Isolated ingredient save failure'); return write.call(this, key, value); };
        }, { profile, journal, now });
        await context.route('**/*', route => {
          const req = route.request(), url = new URL(req.url());
          if (url.origin === 'http://127.0.0.1:8081' || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
          if (url.origin !== 'http://127.0.0.1:8787') return route.abort();
          const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8081', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
          if (url.pathname === '/health') return route.fulfill({ status: 200, headers, json: { configured: true, provider: 'deepseek', model: 'offline-vision-fixture' } });
          if (url.pathname.endsWith('/analyze-photo')) { requests++; assert.match(req.postDataJSON().imageDataUrl, /^data:image\/jpeg;base64,/); return route.fulfill({ status: 200, headers, json: response }); }
          return route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(18000); page.on('pageerror', error => errors.push(error.message));
        const enter = async () => { await page.getByRole('tab', { name: '切换到饮食', exact: true }).click(); await waitForNutritionPage(page); };
        const snap = async name => {
          // Wait for the native-style modal slide and all real assets, not just HTTP completion.
          await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].every(element => element.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running')));
          await page.evaluate(() => Promise.all([...document.images].map(image => image.decode().catch(() => {}))));
          if (name === 'ingredients') {
            await page.waitForFunction(() => [...document.images].filter(image => /鸡蛋|番茄|芥花/.test(image.alt)).every(image => image.naturalWidth > 0 && image.parentElement.getBoundingClientRect().width >= 44));
          }
          await page.screenshot({ path: path.join(out, width + '-' + name + '.png'), animations: 'disabled' });
        };
        const upload = async () => { const chooser = page.waitForEvent('filechooser'); await button(page, '从相册选择').click(); await (await chooser).setFiles({ name: 'synthetic-tomato.png', mimeType: 'image/png', buffer: inputPhoto }); await page.getByText('核对食材', { exact: true }).waitFor(); };
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await enter();
        await button(page, '拍照记餐').click(); assert.equal(requests, 0);
        assert.equal(await button(page, '从相册选择').isEnabled(), false);
        await snap('capture'); await button(page, '同意联网，开始拍摄').click(); await upload();
        assert.equal((await read(page)).entries.length, 0);
        assert.equal(await button(page, '按食材计算 ›').isEnabled(), false);
        assert.ok(await page.getByText('请确认用油量。', { exact: true }).isVisible());
        await page.getByRole('radio', { name: '普通', exact: true }).click();
        await snap('ingredients'); await button(page, '按食材计算 ›').click();
        await page.getByText('确认这一餐', { exact: true }).waitFor();
        assert.equal(await page.getByText('285', { exact: true }).isVisible(), true);
        await button(page, '展开食材与计算依据').click();
        assert.equal(await page.getByText('每100g 148 kcal · 食用 100.6g', { exact: true }).isVisible(), true);
        await button(page, '展开食材与计算依据').click(); await snap('meal');
        await button(page, '返回调整食材').click();
        await button(page, '增加鸡蛋').click(); await page.getByRole('radio', { name: '少油', exact: true }).click(); await page.getByRole('radio', { name: '一半', exact: true }).click();
        await button(page, '按食材计算 ›').click();
        assert.equal(await page.getByText('158', { exact: true }).isVisible(), true);
        await page.getByRole('radio', { name: '晚餐', exact: true }).click();
        assert.equal(await page.getByRole('checkbox', { name: '保存饮食照片到本机' }).isChecked(), false);
        if (width === 320) { await page.evaluate(() => { window.qaFailWrite = true; }); await button(page, '确认，记录晚餐').click(); await page.getByRole('alert').filter({ hasText: 'Isolated ingredient save failure' }).waitFor(); assert.equal((await read(page)).entries.length, 0); await page.evaluate(() => { window.qaFailWrite = false; }); }
        await button(page, '确认，记录晚餐').click(); await page.getByText('确认这一餐', { exact: true }).waitFor({ state: 'detached' });
        const saved = (await read(page)).entries[0]; assert.equal(saved.name, '番茄炒鸡蛋'); assert.equal(saved.photoEstimate.calculation, 'ingredients'); assert.equal(saved.nutrients.calories, 157.6); assert.equal(saved.photos, undefined);
        await page.getByText('食材计算', { exact: true }).waitFor();
        await page.reload({ waitUntil: 'domcontentloaded' }); await enter(); assert.deepEqual((await read(page)).entries[0], saved);
        // Unknown names and unknown mass do not get guessed database entries.
        response = { ...recognized, id: 'ui-unknown', needsOilReview: false, ingredients: [{ name: '未知混合菜', role: 'food', state: 'unknown', estimatedGrams: null, count: null }] };
        await button(page, '拍照记餐').click(); await button(page, '同意联网，开始拍摄').click(); await upload();
        assert.equal(await button(page, '按食材计算 ›').isEnabled(), false);
        await button(page, '选择对应食品库条目').click(); await page.getByRole('textbox', { name: '搜索食材' }).fill('全鸡蛋');
        await page.getByRole('button', { name: /^全鸡蛋（生、去壳）/ }).click();
        await button(page, '约1大个（去壳生蛋液50.3g）').click();
        assert.equal(await button(page, '按食材计算 ›').isEnabled(), true);
        await button(page, '按食材计算 ›').click(); assert.equal(await page.getByText('74', { exact: true }).isVisible(), true);
        await button(page, '返回').click(); await button(page, '返回').click(); await button(page, '返回').click();
        assert.equal((await read(page)).entries.length, 1); assert.equal(requests, 2);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        console.log('PASS', width, 'three screens, consent, explicit oil, counts/fraction recalc, source snapshots, save failure, reload, unknown matching, no automatic logging');
      } catch (error) { const page = context.pages()[0]; if (page) { await page.screenshot({ path: path.join(out, 'failure-' + width + '.png') }); console.error((await page.locator('body').innerText()).slice(-4500)); } throw error; }
      finally { await context.close(); }
    }
    assert.deepEqual(errors, []); console.log('Screenshots:', out);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
