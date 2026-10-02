// Synthetic isolated profiles only. No real account changes or paid API calls.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, f);
const { equipmentMuscleRegions, filterEquipmentMovements, getInitialEquipmentRegion } = require('../src/data/equipmentLibrary.ts');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const groups = { chest: '胸部', shoulders: '肩部', back: '背部', legs: '腿部', core: '核心', arms: '手臂' };
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-equipment-muscle-ui-'));
async function ready(page) {
  await page.waitForFunction(() => { const list = document.querySelector('[data-testid="equipment-movement-list"]'); return list && Number(getComputedStyle(list).opacity) > .999; });
  for (const img of await page.getByTestId('equipment-movement-list').locator('img').all()) await img.evaluate(image => image.decode());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
}
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
  const errors = []; let muscleChecks = 0;
  try {
    for (const width of [320, 390, 681, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: width === 390 ? 'no-preference' : 'reduce' });
      await context.addInitScript(() => { localStorage.setItem('user_profile', JSON.stringify({ name: '隔离肌群验收', age: 30, sex: 'male', height: 175, weight: 75, goal: 'equipment', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', experience: 'intermediate', frequency: 3, levels: {}, planId: 'equipment_library', planStartedAt: new Date().toISOString() })); localStorage.setItem('sessions', '[]'); });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /same key|Cannot update|Rendered fewer hooks|Rendered more hooks/i.test(message.text())) errors.push(message.text()); });
      await page.route('http://127.0.0.1:8787/**', route => route.abort());
      await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.getByText('进阶', { exact: true }).click();
      await ready(page);
      assert.equal(await page.getByRole('tab').count(), 6);
      assert.equal(await page.getByRole('button', { name: /^查看.*器械动作指导$/ }).count(), 5);
      await page.screenshot({ path: path.join(directory, 'upper-chest-' + width + '.png'), animations: 'disabled' });
      await page.getByRole('button', { name: '筛选器材', exact: true }).click();
      await page.getByRole('radio', { name: '筛选哑铃动作', exact: true }).click();
      await ready(page);
      assert.equal(await page.getByRole('button', { name: /^查看.*器械动作指导$/ }).count(), 1);
      await page.getByRole('button', { name: '查看30° 上斜哑铃卧推器械动作指导', exact: true }).click();
      await page.getByRole('button', { name: '返回器械动作库', exact: true }).click();
      await ready(page);
      assert.equal(await page.getByRole('button', { name: /^查看.*器械动作指导$/ }).count(), 1, 'detail return keeps gear and muscle');
      assert.equal(await page.getByRole('radio', { name: '筛选上胸肌群动作', exact: true }).getAttribute('aria-checked'), 'true');
      await page.getByRole('button', { name: '筛选器材', exact: true }).click();
      await page.screenshot({ path: path.join(directory, 'gear-sheet-' + width + '.png'), animations: 'disabled' });
      await page.getByRole('radio', { name: '筛选全部器材动作', exact: true }).click();
      await page.getByLabel('搜索器械动作', { exact: true }).fill('帕洛夫');
      await ready(page);
      assert.equal(await page.getByRole('button', { name: /^查看.*器械动作指导$/ }).count(), 1);
      assert.equal(await page.getByTestId('equipment-muscle-overview').count(), 0, 'global search must not look like upper-chest results');
      await page.getByRole('button', { name: '清除器械动作搜索', exact: true }).click();
      await ready(page);
      assert.equal(await page.getByRole('button', { name: /^查看.*器械动作指导$/ }).count(), 5);
      assert.equal(await page.getByRole('radio', { name: '筛选全部肌群动作', exact: true }).count(), 0);
      await page.getByRole('radio', { name: '筛选中胸肌群动作', exact: true }).click();
      await ready(page);
      await page.getByTestId('equipment-library-scroll').evaluate(element => { element.scrollTop = 500; });
      await page.waitForTimeout(120); // Allow the native/web throttled scroll event to reach the navigation snapshot.
      await page.getByRole('button', { name: '查看平板哑铃卧推器械动作指导', exact: true }).click();
      await page.getByRole('button', { name: '返回器械动作库', exact: true }).click();
      await ready(page);
      await page.waitForFunction(() => document.querySelector('[data-testid="equipment-library-scroll"]').scrollTop >= 490);
      for (const [group, label] of Object.entries(groups)) {
        await page.getByRole('tab', { name: '查看' + label + '器械动作', exact: true }).click();
        await ready(page);
        assert.equal(await page.getByRole('button', { name: /^查看.*器械动作指导$/ }).count(), filterEquipmentMovements({ group, region: getInitialEquipmentRegion(group), gear: 'all', query: '' }).length);
        for (const region of equipmentMuscleRegions.filter(item => item.group === group)) {
          await page.getByRole('radio', { name: '筛选' + region.label + '肌群动作', exact: true }).click();
          await ready(page);
          assert.equal(await page.getByRole('button', { name: /^查看.*器械动作指导$/ }).count(), filterEquipmentMovements({ group, region: region.key, gear: 'all', query: '' }).length);
          assert.ok(await page.getByTestId('equipment-muscle-overview').locator('svg').count());
          if (width === 390) await page.screenshot({ path: path.join(directory, region.key + '.png'), animations: 'disabled' });
          muscleChecks++;
        }
      }
      await page.getByLabel('搜索器械动作', { exact: true }).fill('没有这个动作xyz');
      await ready(page);
      await page.getByRole('button', { name: '清除动作库筛选', exact: true }).click();
      await ready(page);
      assert.equal(await page.getByRole('button', { name: /^查看.*器械动作指导$/ }).count(), filterEquipmentMovements({ group: 'arms', region: getInitialEquipmentRegion('arms'), gear: 'all', query: '' }).length);
      console.log(JSON.stringify({ width, muscleFilters: equipmentMuscleRegions.length, gearAndSearch: 'passed' }));
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ muscleChecks, pageErrors: errors, screenshots: directory }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
