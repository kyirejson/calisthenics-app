// Actual UI / source-image QA, isolated browser storage and no paid model calls.
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
const { withIntakeEntry } = require('../src/nutrition/journal.ts');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-fitness-ui-'));
const profile = { name: '界面隔离检查', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery',
  nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, planId: 'prisoner',
  levels: { push: 5, pull: 5, squat: 5, legRaise: 5, bridge: 1, hspu: 1 },
  planLevels: { push: 5, pull: 5, squat: 5, legRaise: 5 }, experience: 'intermediate', sessionMinutes: 45,
  trainingRestSeconds: 180, planStartedAt: '2026-09-28T01:00:00.000Z', weightHistory: [] };
let journal = emptyNutritionJournal();
journal.preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: '2026-09-28T01:00:00.000Z' };
journal = withIntakeEntry(journal, { id: 'ui-breakfast', date: '2026-09-28', slot: 'breakfast', name: '燕麦牛奶与鸡蛋',
  source: 'manual', portions: [{ foodId: 'oats-dry', grams: 50 }, { foodId: 'milk-2pct', grams: 250 }] });
const canvas = async (locator) => locator.evaluate(root => {
  const inner = [root, ...root.querySelectorAll('div')].find(element => getComputedStyle(element).maxWidth === '440px' && getComputedStyle(element).paddingLeft === '16px');
  if (!inner) throw new Error('Shared 440 / 16 canvas missing');
  const style = getComputedStyle(inner), box = inner.getBoundingClientRect();
  return { width: box.width, x: box.x, inset: Number.parseFloat(style.paddingLeft) };
});
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false, 'No page-level horizontal overflow');
const waitForPane = (page, testID) => page.waitForFunction(testID => {
  const pane = document.querySelector(`[data-testid="${testID}"]`);
  if (!pane || pane.getAttribute('aria-hidden') === 'true') return false;
  for (let frame = pane.parentElement; frame; frame = frame.parentElement) {
    if (!/auto|scroll/.test(getComputedStyle(frame).overflowX) || frame.scrollWidth <= frame.clientWidth) continue;
    return Math.abs(pane.getBoundingClientRect().left - frame.getBoundingClientRect().left - frame.clientLeft) < 1;
  }
  return false;
}, testID);

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'chrome' });
  const errors = [];
  try {
    for (const width of [320, 390, 681, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Shanghai', hasTouch: true, reducedMotion: 'reduce' });
      try {
        await context.addInitScript(({ profile, journal }) => {
          const OriginalDate = Date, anchor = OriginalDate.parse('2026-09-28T01:30:00.000Z'), started = performance.now();
          class QAClock extends OriginalDate { constructor(...args) { super(...(args.length ? args : [anchor + performance.now() - started])); } static now() { return anchor + performance.now() - started; } }
          window.Date = QAClock;
          localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]');
          localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal));
        }, { profile, journal });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        page.on('pageerror', error => errors.push(error.message));
        await page.route('http://127.0.0.1:8787/**', route => route.abort());
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.getByTestId('today-training-content').waitFor();
        const profileBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('user_profile')));
        const measurements = { training: await canvas(page.getByTestId('today-training-content')) };
        await noOverflow(page);
        assert.equal(await page.getByText('今日', { exact: true }).first().evaluate(el => parseFloat(getComputedStyle(el).fontSize)), 22);
        await page.waitForFunction(() => [...document.images].some(img => img.complete && img.naturalWidth === 628 && img.src.includes('image00559')));
        await page.screenshot({ path: path.join(output, `today-training-${width}.png`), animations: 'disabled' });

        await page.getByRole('tab', { name: '切换到饮食' }).click(); await waitForNutritionPage(page);
        measurements.nutrition = await canvas(page.getByTestId('nutrition-content'));
        assert.equal((await page.getByTestId('nutrition-energy-ring').boundingBox()).width, 64);
        assert.equal(await page.getByTestId('nutrition-recorded-energy').evaluate(el => parseFloat(getComputedStyle(el).fontSize)), 40);
        assert.ok(!Number.isNaN(Number(await page.getByTestId('nutrition-recorded-energy').innerText())));
        await noOverflow(page); await page.screenshot({ path: path.join(output, `today-nutrition-${width}.png`), animations: 'disabled' });
        await page.getByRole('button', { name: '搜索 / 自定义', exact: true }).click();
        await page.getByRole('button', { name: '关闭实际摄入编辑器', exact: true }).click();

        await page.getByRole('tab', { name: '切换到跑步' }).click();
        await waitForPane(page, 'today-running-page');
        await page.getByTestId('running-distance').waitFor();
        measurements.running = await canvas(page.getByTestId('running-content'));
        assert.equal(await page.getByTestId('running-distance').innerText(), '0.00 km', 'No invented run distance');
        await noOverflow(page); await page.screenshot({ path: path.join(output, `today-running-${width}.png`), animations: 'disabled' });

        await page.getByRole('tab', { name: '切换到训练' }).click();
        await waitForPane(page, 'today-training-page');
        await page.getByRole('button', { name: '开始今日训练  →', exact: true }).click();
        await page.getByTestId('training-screen-title').waitFor();
        measurements.session = await canvas(page.getByTestId('training-scroll'));
        assert.equal(await page.getByTestId('training-screen-title').evaluate(el => parseFloat(getComputedStyle(el).fontSize)), 22);
        assert.equal(await page.getByTestId('training-rest-time').evaluate(el => parseFloat(getComputedStyle(el).fontSize)), 56);
        await noOverflow(page); await page.screenshot({ path: path.join(output, `training-active-${width}.png`), animations: 'disabled' });
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sessions')).length), 0, 'Opening training does not record a workout');
        const before = await page.getByRole('checkbox').count();
        await page.getByText('＋ 加一组', { exact: true }).click(); assert.equal(await page.getByRole('checkbox').count(), before + 1);
        await page.getByLabel('第1组次', { exact: true }).fill('9');
        await page.getByRole('checkbox', { name: '第1组完成', exact: true }).check();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions')).length === 1);
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sessions'))[0]);
        assert.equal(saved.exercises.length, 1); assert.equal(saved.exercises[0].sets.length, 1); assert.equal(saved.exercises[0].sets[0].reps, 9);
        assert.equal(saved.totalReps, 9);
        const readRest = async () => (await page.getByTestId('training-rest-time').innerText()).split(':').reduce((minutes, seconds) => Number(minutes) * 60 + Number(seconds));
        const restBefore = await readRest();
        await page.getByText('＋30 秒', { exact: true }).click();
        assert.ok(await readRest() >= restBefore + 27, 'Extend the actual prescribed rest by 30 seconds');
        await page.getByRole('checkbox', { name: '第1组完成', exact: true }).uncheck();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions')).length === 0);
        await page.getByRole('button', { name: '查看当前动作指导', exact: true }).click();
        await page.getByRole('tab', { name: '资料原文与配图', exact: true }).click();
        await page.waitForFunction(() => [...document.images].some(img => img.complete && img.naturalWidth === 628 && img.src.includes('image00558')));
        await page.getByLabel('关闭动作指导', { exact: true }).click();
        await page.getByRole('button', { name: '保存并退出训练', exact: true }).click();
        await page.getByRole('button', { name: '退出', exact: true }).click();
        await page.getByTestId('today-training-content').waitFor();
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('user_profile'))), profileBefore, 'UI checks do not change chosen stages or plan after normal migration');

        for (const [key, measurement] of Object.entries(measurements)) { assert.equal(measurement.width, Math.min(width, 440), key); assert.equal(measurement.inset, 16, key); assert.equal(measurement.x, measurements.training.x, key); }
        console.log(JSON.stringify({ viewport: width, ...measurements }));
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
    console.log('PASS shared scales, original photographs, timer, added set, actual-only records; no runtime exceptions');
    console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); console.error('Screenshots: ' + output); process.exitCode = 1; });
