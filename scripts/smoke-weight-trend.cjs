// Isolated UI fixtures only: no real user storage, photos, or paid AI calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { waitForNutritionPage } = require('./nutrition-smoke-utils.cjs');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { emptyNutritionJournal, defaultNutritionPreferences } = require('../src/nutrition/engine.ts');
const { weightTrendWindow } = require('../src/data/weightTrend.ts');
const day = '2026-09-28', anchor = day + 'T10:30:00.000Z';
const history = [
  { date: '2026-08-02', kg: 78 }, { date: '2026-09-01', kg: 76.5 },
  { date: '2026-09-10', kg: 76 }, { date: '2026-09-22', kg: 75.8 },
  { date: '2026-09-26', kg: 75.1 }, { date: day, kg: 74.9 }, { date: day, kg: 74.5 },
  { date: '2026-10-01', kg: 30 }, { date: '2026-09-31', kg: 60 },
];
const profile = { name: '隔离体重测试', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery',
  nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, planId: 'prisoner',
  levels: { push: 5, pull: 5, squat: 5, legRaise: 5, bridge: 1, hspu: 1 }, experience: 'intermediate',
  sessionMinutes: 45, trainingRestSeconds: 180, planStartedAt: day + 'T01:00:00.000Z', weightHistory: history };
const journal = emptyNutritionJournal();
journal.preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: anchor };
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-weight-trend-'));
const button = (page, name) => page.getByRole('button', { name, exact: true });
const read = page => page.evaluate(() => JSON.parse(localStorage.getItem('user_profile')));
async function fit(locator, width, height) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= height + 1);
  assert.ok(box.height >= 44, 'Controls must have at least 44 px touch targets');
}
async function expectWindow(page, records, days) {
  const result = weightTrendWindow(records, days, new Date(anchor));
  const mean = result.average === undefined ? '—' : result.average.toFixed(1);
  await page.waitForFunction(mean => document.querySelector('[data-testid="weight-window-average"]')?.textContent === mean + ' kg', mean);
  assert.equal(await page.getByTestId('weight-window-count').count(), 0);
  assert.equal(await page.getByTestId('weight-selected-record').count(), 0);
  assert.equal(await page.getByText('实测记录', { exact: true }).count(), 0);
  assert.equal(await page.getByText('圆点为实测 · 点选查看', { exact: true }).count(), 0);
  assert.equal(await button(page, '上一条体重记录').count(), 0);
  assert.equal(await button(page, '下一条体重记录').count(), 0);
  assert.equal(await page.locator('[data-testid^="weight-point-"]').count(), result.records.length);
  assert.equal(await page.getByTestId('weight-trend-line').count(), result.records.length > 1 ? 1 : 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'chrome' });
  const errors = [], aiRequests = [];
  try {
    for (const width of [320, 390, 650, 681, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 871 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
      try {
        await context.addInitScript(({ profile, journal, anchor }) => {
          const OriginalDate = Date, start = performance.now(), time = OriginalDate.parse(anchor);
          class QAClock extends OriginalDate { constructor(...args) { super(...(args.length ? args : [time + performance.now() - start])); } static now() { return time + performance.now() - start; } }
          window.Date = QAClock;
          if (!localStorage.getItem('weight-qa-seeded')) {
            localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal));
            localStorage.setItem('sessions', '[]'); localStorage.setItem('weight-qa-seeded', 'yes');
          }
          const write = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, value) { if (window.qaFailWrite === key) throw new Error('Isolated weight save failure'); return write.call(this, key, value); };
        }, { profile, journal, anchor });
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          if (url.origin === 'http://127.0.0.1:8081') return route.continue();
          if (['/advice', '/analyze-photo'].includes(url.pathname)) aiRequests.push(url.pathname);
          return route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(12000);
        page.on('pageerror', error => errors.push(error.message));
        const enter = async () => { await page.getByRole('tab', { name: '切换到饮食', exact: true }).click(); await waitForNutritionPage(page); };
        const shot = async name => { await page.getByText('计算与知识依据', { exact: true }).scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, name + '-' + width + '.png'), animations: 'disabled' }); };
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await enter();
        assert.equal(await page.getByText('快捷记餐', { exact: true }).count(), 0);
        assert.equal(await page.getByTestId('nutrition-next-meal').count(), 0);
        await expectWindow(page, history, 30);
        await fit(button(page, '查看近7天体重趋势'), width, 871);
        await fit(button(page, '查看近30天体重趋势'), width, 871);
        await fit(button(page, '查看近90天体重趋势'), width, 871);
        assert.equal(await page.getByText('确认后计入，未记录不代表没有吃。', { exact: true }).count(), 0);
        await shot('weight-30');
        await button(page, '查看近7天体重趋势').click(); await expectWindow(page, history, 7);
        assert.equal(await page.getByTestId('weight-trend-plot').getAttribute('role'), 'img');
        await shot('weight-7');
        await button(page, '查看近90天体重趋势').click(); await expectWindow(page, history, 90);
        await shot('weight-90');

        await button(page, '记录体重').click();
        await page.getByLabel('今日体重kg', { exact: true }).fill('400');
        await button(page, '保存体重').click();
        await page.getByText('体重请输入 30–300 kg 范围内的有效数值。', { exact: true }).waitFor();
        assert.deepEqual((await read(page)).weightHistory, history);
        await page.getByLabel('今日体重kg', { exact: true }).fill('74.2');
        if (width === 390) {
          await page.evaluate(() => { window.qaFailWrite = 'user_profile'; });
          await button(page, '保存体重').click();
          await page.getByRole('alert').filter({ hasText: 'Isolated weight save failure' }).waitFor();
          assert.equal(await page.getByLabel('今日体重kg', { exact: true }).inputValue(), '74.2');
          assert.deepEqual((await read(page)).weightHistory, history);
          await expectWindow(page, history, 90);
          await page.evaluate(() => { window.qaFailWrite = null; });
        }
        await button(page, '保存体重').click();
        await page.waitForFunction(day => JSON.parse(localStorage.getItem('user_profile')).weightHistory.filter(item => item.date === day).length === 1, day);
        const saved = await read(page);
        assert.equal(saved.weightHistory.find(item => item.date === day).kg, 74.2);
        assert.equal(saved.weight, profile.weight, 'A measurement must not silently replace the planning weight');
        await expectWindow(page, saved.weightHistory, 90);
        await page.reload({ waitUntil: 'domcontentloaded' }); await enter();
        assert.deepEqual((await read(page)).weightHistory, saved.weightHistory);
        await expectWindow(page, saved.weightHistory, 30);

        for (const samples of [[], [{ date: day, kg: 74.5 }]]) {
          await page.evaluate(samples => {
            const profile = JSON.parse(localStorage.getItem('user_profile'));
            localStorage.setItem('user_profile', JSON.stringify({ ...profile, weightHistory: samples }));
          }, samples);
          await page.reload({ waitUntil: 'domcontentloaded' }); await enter();
          await expectWindow(page, samples, 30);
          assert.equal(await page.getByTestId('weight-trend-empty').count(), samples.length ? 0 : 1);
          await shot(samples.length ? 'weight-single' : 'weight-empty');
        }
        if (width === 390) {
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          await page.evaluate(history => {
            const profile = JSON.parse(localStorage.getItem('user_profile'));
            localStorage.setItem('user_profile', JSON.stringify({ ...profile, weightHistory: history }));
          }, history);
          await page.reload({ waitUntil: 'domcontentloaded' }); await enter();
          await button(page, '查看近7天体重趋势').click();
          await button(page, '查看近90天体重趋势').click();
          await expectWindow(page, history, 90);
          await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-testid="weight-trend-plot"]').parentElement).opacity) >= .99);
          await shot('weight-motion-settled');
        }
        if (width === 320) {
          await page.setViewportSize({ width, height: 568 });
          await button(page, '记录体重').click();
          await fit(button(page, '保存体重'), width, 568);
        }
        console.log('PASS ' + width + ' px: calendar-based points / ranges and means / simplified chart / save and persistence / empty and single-point states');
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []); assert.deepEqual(aiRequests, []);
    console.log('PASS no browser errors / no real AI requests; screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); console.error('Screenshots: ' + output); process.exitCode = 1; });
