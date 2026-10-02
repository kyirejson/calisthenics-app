// Isolated browser fixtures only; do not modify a user's profile or call a nutrition provider.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, f);
const { equipmentMovements } = require('../src/data/equipmentMovements.ts');
const { equipmentAdditions } = require('../src/data/equipmentAdditions.ts');
const { recommendationTiers } = require('../src/data/equipmentRecommendations.ts');
const { filterEquipmentMovements, initialEquipmentFilters } = require('../src/data/equipmentLibrary.ts');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-equipment-tiers-'));
const cards = page => page.getByRole('button', { name: /^查看.*器械动作指导$/ });
async function ready(page) {
  await page.waitForFunction(() => { const list = document.querySelector('[data-testid="equipment-movement-list"]'); return list && Number(getComputedStyle(list).opacity) > .999; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
}
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
  const errors = []; let details = 0;
  try {
    for (const width of [320, 390, 681, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: width === 390 ? 'no-preference' : 'reduce' });
      await context.addInitScript(() => { localStorage.setItem('user_profile', JSON.stringify({ name: '隔离等级验收', age: 30, sex: 'male', height: 175, weight: 75, goal: 'equipment', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', experience: 'intermediate', frequency: 3, levels: {}, planId: 'equipment_library', planStartedAt: new Date().toISOString() })); localStorage.setItem('sessions', '[]'); });
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /same key|Cannot update|Rendered fewer hooks|Rendered more hooks/i.test(message.text())) errors.push(message.text()); });
      await page.route('http://127.0.0.1:8787/**', route => route.abort());
      await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.getByText('进阶', { exact: true }).click();
      await ready(page);
      const initialLevels = await page.evaluate(() => JSON.parse(localStorage.getItem('user_profile')).levels);
      assert.equal(await cards(page).count(), 5);
      assert.equal(await page.getByRole('radio', { name: /推荐等级|级推荐动作/ }).count(), 0);
      assert.equal(await page.getByRole('radio', { name: '筛选全部肌群动作', exact: true }).count(), 0);
      assert.deepEqual(await page.getByTestId('equipment-muscle-filters').getByRole('radio').allTextContents(), ['上胸', '中胸', '下胸']);
      assert.deepEqual(await cards(page).allTextContents().then(texts => texts.map(text => text.match(/增肌 ([SABC])/)?.[1])), ['S', 'S', 'S', 'A', 'A']);
      for (const img of await page.getByTestId('equipment-movement-list').locator('img').all()) await img.evaluate(image => image.decode());
      await page.screenshot({ path: path.join(output, 'initial-' + width + '.png'), animations: 'disabled' });
      await page.getByRole('button', { name: '查看上斜推胸机器械动作指导', exact: true }).click();
      await page.getByTestId('equipment-modern-guide').waitFor();
      await page.getByRole('button', { name: '查看推荐等级说明', exact: true }).click();
      await page.getByText('等级怎么用', { exact: true }).waitFor();
      assert.ok((await page.getByText(/不是难度、晋级条件或科学认证/).count()) > 0);
      await page.getByRole('button', { name: '完成推荐等级说明', exact: true }).click();
      assert.equal(await page.getByTestId('equipment-illustration-equipment_chest_19').count(), 0);
      await page.getByRole('button', { name: '放大上斜推胸机动作示范图', exact: true }).locator('img').evaluate(image => image.decode());
      await page.getByRole('button', { name: '返回器械动作库', exact: true }).click();
      await ready(page); assert.equal(await cards(page).count(), 5);
      assert.equal(await page.getByRole('radio', { name: '筛选上胸肌群动作', exact: true }).getAttribute('aria-checked'), 'true');
      await page.getByLabel('搜索器械动作', { exact: true }).fill('不存在的动作xyz');
      await ready(page); assert.equal(await cards(page).count(), 0);
      await page.getByRole('button', { name: '清除动作库筛选', exact: true }).click();
      await page.getByLabel('搜索器械动作', { exact: true }).fill('腕伸');
      await ready(page); assert.equal(await cards(page).count(), 1);
      await page.getByLabel('搜索器械动作', { exact: true }).fill('器械');
      await ready(page);
      const expected = filterEquipmentMovements({ ...initialEquipmentFilters, query: '器械' });
      const cardNames = await cards(page).evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')));
      assert.deepEqual(cardNames, expected.map(item => '查看' + item.name + '器械动作指导'));
      const ranks = expected.map(item => recommendationTiers.indexOf(item.recommendation.tier));
      assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
      const samples = width === 390 ? equipmentMovements : width === 320 ? equipmentMovements.filter(item => equipmentAdditions.some(addition => addition.id === item.id)) : equipmentMovements.filter(item => item.id.endsWith('_01'));
      for (const item of samples) {
        await page.getByLabel('搜索器械动作', { exact: true }).fill(item.name);
        await ready(page);
        await page.getByRole('button', { name: '查看' + item.name + '器械动作指导', exact: true }).click();
        const guide = page.getByTestId('equipment-modern-guide'); await guide.waitFor();
        const text = await guide.textContent();
        assert.ok(text.includes(item.guide.setup) && text.includes(item.guide.execution) && text.includes(item.guide.control), item.id);
        assert.equal(await page.getByText('原书关联资料', { exact: true }).count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, item.id + ' detail overflow');
        assert.equal(await page.getByTestId('equipment-illustration-' + item.id).count(), 0);
        await page.getByRole('button', { name: '放大' + item.name + '动作示范图', exact: true }).locator('img').evaluate(image => image.decode());
        await page.getByRole('button', { name: '展开或收起器械动作依据', exact: true }).click();
        assert.equal(await page.getByRole('link', { name: /^打开/ }).count(), item.guide.sources.length + item.recommendation.sources.length);
        if (width === 390 && ['equipment_chest_19', 'equipment_core_13', 'equipment_arms_22'].includes(item.id)) await page.screenshot({ path: path.join(output, item.id + '.png'), animations: 'disabled' });
        await page.getByRole('button', { name: '返回器械动作库', exact: true }).click();
        await ready(page); details++;
      }
      const storage = await page.evaluate(() => ({ profile: JSON.parse(localStorage.getItem('user_profile')), sessions: JSON.parse(localStorage.getItem('sessions')) }));
      assert.deepEqual(storage.profile.levels, initialLevels); assert.deepEqual(storage.sessions, []);
      console.log(JSON.stringify({ width, detailChecks: samples.length, tiersAndNavigation: 'passed' }));
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ details, pageErrors: errors, screenshots: output }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
