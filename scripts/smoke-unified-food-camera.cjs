// Isolated fake camera + mocked food service. Never sends user photos or uses paid APIs.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { waitForNutritionPage } = require('./nutrition-smoke-utils.cjs');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { emptyNutritionJournal, defaultNutritionPreferences } = require('../src/nutrition/engine.ts');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-unified-camera-qa-'));
const now = '2026-09-29T01:30:00.000Z';
const profile = { name: '统一相机隔离测试', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, planId: 'prisoner', levels: { push: 5, pull: 3, squat: 5, legRaise: 3, bridge: 1, hspu: 1 }, experience: 'intermediate', sessionMinutes: 45, trainingRestSeconds: 180, planStartedAt: now, weightHistory: [] };
const journal = emptyNutritionJournal(); journal.preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: now };
const product = { name: '统一相机测试食品', state: '开袋即食', basisUnit: 'g', basisAmount: 100, energyUnit: 'kJ', calories: 2515, protein: 23, carbs: 20, fat: 47, fiber: null, serving: null, packageGrams: 60, allergens: ['tree_nut'], warnings: ['请核对包装'], origin: { provider: 'open_food_facts', identifier: '3017620422003', fetchedAt: now, url: 'https://world.openfoodfacts.org/product/3017620422003', license: 'ODbL-1.0' } };
const button = (page, name) => page.getByRole('button', { name, exact: true });
const radio = (page, name) => page.getByRole('radio', { name, exact: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const errors = [];
  try {
    for (const width of [320, 390, 650, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 871 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce', permissions: ['camera'] });
      const calls = []; let configured = true, delay = false, fail = false, release;
      try {
        await context.addInitScript(({ profile, journal, now }) => {
          const OriginalDate = Date; window.Date = class extends OriginalDate { constructor(...args) { super(...(args.length ? args : [OriginalDate.parse(now)])); } static now() { return OriginalDate.parse(now); } };
          localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]'); localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal));
          window.qaBarcode = ''; window.qaFormat = 'ean_13'; window.qaDetectCount = 0;
          window.BarcodeDetector = class { async detect() { window.qaDetectCount++; return window.qaBarcode ? [{ rawValue: window.qaBarcode, format: window.qaFormat, boundingBox: { x: 0, y: 0, width: 100, height: 40 }, cornerPoints: [] }] : []; } };
        }, { profile, journal, now });
        await context.route('**/*', async route => {
          const req = route.request(), url = new URL(req.url());
          if (url.origin === 'http://127.0.0.1:8081' || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
          if (url.origin !== 'http://127.0.0.1:8787') return route.abort();
          const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8081', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
          if (url.pathname === '/health') return route.fulfill({ status: 200, headers, json: { configured, provider: 'deepseek', model: 'test-only' } });
          calls.push(url.pathname);
          if (delay) await new Promise(resolve => { release = resolve; });
          try {
            if (fail) return await route.fulfill({ status: 404, headers, json: { error: '测试条码未收录，请拍营养标签' } });
            if (url.pathname.endsWith('/lookup-barcode')) return await route.fulfill({ status: 200, headers, json: product });
            return await route.abort();
          } catch { /* The client intentionally aborts pending recognition on close/switch. */ }
        });
        const page = await context.newPage(); page.setDefaultTimeout(18000); page.on('pageerror', e => errors.push(e.message));
        const fresh = async () => { await button(page, '拍照记餐').click(); await button(page, '开启相机').waitFor(); };
        const open = async () => { if (await button(page, '同意联网，开始拍摄').count()) await button(page, '同意联网，开始拍摄').click(); await button(page, '开启相机').click(); await page.waitForFunction(() => document.querySelector('video')?.readyState === 4); };
        const originalVideo = async () => page.evaluate(() => { window.qaOriginalVideo = document.querySelector('video'); });
        const sameVideo = async () => assert.equal(await page.evaluate(() => document.querySelectorAll('video').length === 1 && document.querySelector('video') === window.qaOriginalVideo), true);
        const takeSnapshot = async name => page.screenshot({ path: path.join(output, name + '-' + width + '.png'), animations: 'disabled' });
        const waitCalls = async count => { for (let i = 0; i < 100 && calls.length < count; i++) await page.waitForTimeout(20); assert.equal(calls.length, count); };
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.getByRole('tab', { name: '切换到饮食', exact: true }).click(); await waitForNutritionPage(page); await fresh();
        assert.equal(await button(page, '开启相机').isEnabled(), false); assert.equal(await button(page, '从相册选择').isEnabled(), false);
        await radio(page, '条码').click(); await page.getByLabel('商品条码', { exact: true }).fill(product.origin.identifier);
        assert.equal(await button(page, '查询商品条码').isEnabled(), false); assert.equal(calls.length, 0);
        await radio(page, '食物').click(); await open(); await originalVideo();
        for (const name of ['营养标签', '条码', '食物']) {
          await radio(page, name).click(); await sameVideo();
          assert.equal(await button(page, '同意联网，开始拍摄').count(), 0);
          assert.equal(await button(page, '关闭食品导入').count(), 0);
          await takeSnapshot('live-' + name);
        }
        assert.equal(calls.length, 0);
        await radio(page, '条码').click();
        await page.evaluate(() => { window.qaBarcode = '3017620422004'; });
        await page.waitForFunction(() => window.qaDetectCount >= 2); assert.equal(calls.length, 0);
        await page.evaluate(() => { window.qaBarcode = '3017620422003'; window.qaFormat = 'qr_code'; window.qaDetectCount = 0; });
        await page.waitForFunction(() => window.qaDetectCount >= 2); assert.equal(calls.length, 0);
        delay = true;
        await page.evaluate(() => { window.qaFormat = 'ean_13'; });
        await page.waitForFunction(() => document.body.innerText.includes('正在查询食品…'));
        await waitCalls(1); await sameVideo();
        await radio(page, '食物').click(); delay = false; release();
        await sameVideo(); assert.equal(await page.getByLabel('自定义食品名称', { exact: true }).count(), 0);
        await button(page, '返回').click(); await page.waitForFunction(() => !document.querySelector('video'));
        // No configured vision model is needed for barcode lookup. Failure retains this camera.
        configured = false; fail = true; await fresh(); await radio(page, '条码').click(); await open(); await originalVideo();
        await page.evaluate(() => { window.qaBarcode = ''; });
        await page.getByLabel('商品条码', { exact: true }).fill(product.origin.identifier); await button(page, '查询商品条码').click();
        await page.getByRole('alert').waitFor(); await sameVideo();
        fail = false; await button(page, '查询商品条码').click();
        await page.getByLabel('自定义食品名称', { exact: true }).waitFor(); assert.equal(await page.locator('video').count(), 0);
        assert.equal(await page.getByLabel('自定义食品名称', { exact: true }).inputValue(), product.name);
        assert.equal(await button(page, '保存食品，选择食用份量').isEnabled(), false);
        await button(page, '返回').click(); assert.equal(await button(page, '同意联网，开始拍摄').count(), 0);
        await button(page, '返回').click();
        // Barcode gallery and shutter share the same route, rather than uploading to the vision model.
        configured = true;
        for (const source of ['gallery', 'shutter']) {
          await page.evaluate(() => { window.qaBarcode = ''; window.qaFormat = 'ean_13'; });
          await fresh(); await radio(page, '条码').click();
          if (source === 'shutter') {
            await open(); await page.waitForFunction(() => !document.querySelector('[aria-label="拍摄照片"]')?.disabled);
            await page.evaluate(() => { window.qaBarcode = '3017620422003'; document.querySelector('[aria-label="拍摄照片"]').click(); });
          } else {
            await page.evaluate(() => { window.qaBarcode = '3017620422003'; });
            const image = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 128, 64); return canvas.toDataURL('image/png').split(',')[1]; });
            const chooser = page.waitForEvent('filechooser'); await button(page, '从相册选择').click();
            await (await chooser).setFiles({ name: 'synthetic-barcode.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
          }
          await page.getByLabel('自定义食品名称', { exact: true }).waitFor();
          assert.equal(await page.getByLabel('自定义食品名称', { exact: true }).inputValue(), product.name);
          await button(page, '返回').click(); assert.equal(await button(page, '同意联网，开始拍摄').count(), 0); await button(page, '返回').click();
        }
        // Close while a query is pending: late responses cannot create a review or a meal.
        delay = true; await fresh(); await radio(page, '条码').click();
        await page.getByLabel('商品条码', { exact: true }).fill(product.origin.identifier); await button(page, '查询商品条码').click();
        await page.getByText('正在查询食品…', { exact: true }).waitFor(); await waitCalls(6); await button(page, '返回').click(); delay = false; release();
        assert.equal(await page.getByLabel('自定义食品名称', { exact: true }).count(), 0);
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')));
        assert.equal(saved.entries.length, 0); assert.equal(saved.customFoods.length, 0);
        assert.ok(saved.photoConsentAt);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(calls, Array(6).fill('/v1/nutrition/lookup-barcode'));
        await fresh(); await button(page, '管理拍照联网授权').click(); await button(page, '撤回拍照联网授权').click();
        await button(page, '同意联网，开始拍摄').waitFor();
        assert.equal(await button(page, '开启相机').isEnabled(), false);
        assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')))).photoConsentAt, null);
        await button(page, '同意联网，开始拍摄').click();
        await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('nutrition_journal_v1')).photoConsentAt);
        console.log('PASS', width, 'consent persists across camera openings and revokes immediately, same live camera across modes, invalid/QR ignored, abort on switch/close, barcode without vision, live/gallery/shutter, retry and mandatory review, no automatic writes');
      } catch (error) { const page = context.pages()[0]; if (page) { await page.screenshot({ path: path.join(output, 'failure-' + width + '.png') }); console.error((await page.locator('body').innerText()).slice(-3500)); } throw error; }
      finally { release?.(); await context.close(); }
    }
    assert.deepEqual(errors, []); console.log('Screenshots:', output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
