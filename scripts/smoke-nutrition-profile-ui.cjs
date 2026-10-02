// Isolated browser QA. All people and meals below are fixtures; no user's tab or paid AI calls are used.
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
const { emptyNutritionJournal, defaultNutritionPreferences, sumNutrients } = require('../src/nutrition/engine.ts');
const { withIntakeEntry } = require('../src/nutrition/journal.ts');
const { buildNutritionMenu } = require('../src/nutrition/adjustments.ts');
const { getNutritionTrainingContext } = require('../src/nutrition/training.ts');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-nutrition-profile-ui-'));
const anchor = '2026-09-28T10:30:00.000Z', day = '2026-09-28';
const profile = { name: 'Uncover 界面检查', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery',
  nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, planId: 'prisoner',
  levels: { push: 5, pull: 5, squat: 5, legRaise: 5, bridge: 1, hspu: 1 },
  planLevels: { push: 5, pull: 5, squat: 5, legRaise: 5 }, experience: 'intermediate', sessionMinutes: 45,
  trainingRestSeconds: 180, planStartedAt: '2026-09-28T01:00:00.000Z', weightHistory: [] };
const session = (id, date, completed = true) => ({ id, trainingDate: date, startedAt: date + 'T01:00:00.000Z', completedAt: date + 'T01:20:00.000Z',
  workoutId: 'prisonerA', workoutName: '隔离训练记录', durationSeconds: 1200, totalReps: completed ? 8 : 0, completion: 'partial',
  exercises: [{ exerciseId: 'push_05', name: '标准俯卧撑', category: 'push', sets: [{ completed, reps: 8 }] }] });
const sessions = [session('one', day), session('two', day), session('three', '2026-09-27'), session('future', '2026-10-01'), session('opened', day, false)];
let journal = emptyNutritionJournal();
journal.preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: '2026-09-28T01:00:00.000Z' };
const menu = buildNutritionMenu(profile, journal, getNutritionTrainingContext(profile, sessions, {}, day), day);
let recorded = journal;
for (const slot of ['breakfast', 'lunch']) {
  const meal = menu.meals.find(item => item.slot === slot);
  recorded = withIntakeEntry(recorded, { id: 'ui-' + slot, date: day, slot, name: meal.name, portions: meal.ingredients, source: 'planned_meal', now: anchor });
}
const geometry = locator => locator.evaluate(root => {
  const content = [root, ...root.querySelectorAll('div')].find(el => getComputedStyle(el).maxWidth === '440px' && getComputedStyle(el).paddingLeft === '16px');
  if (!content) throw new Error('Shared content canvas not found');
  const style = getComputedStyle(content), box = content.getBoundingClientRect();
  return { width: box.width, x: box.x, inset: parseFloat(style.paddingLeft) };
});
const read = page => page.evaluate(() => ({ profile: JSON.parse(localStorage.getItem('user_profile')), entries: JSON.parse(localStorage.getItem('nutrition_journal_v1')).entries,
  sessions: JSON.parse(localStorage.getItem('sessions')), settings: JSON.parse(localStorage.getItem('settings')) }));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'chrome' });
  const errors = [];
  try {
    for (const width of [320, 390, 681, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
      try {
        await context.addInitScript(({ profile, journal, sessions, anchor }) => {
          const OriginalDate = Date, start = performance.now(), time = OriginalDate.parse(anchor);
          class QAClock extends OriginalDate { constructor(...args) { super(...(args.length ? args : [time + performance.now() - start])); } static now() { return time + performance.now() - start; } }
          window.Date = QAClock;
          if (!localStorage.getItem('ui-seeded')) {
            localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal));
            localStorage.setItem('sessions', JSON.stringify(sessions)); localStorage.setItem('ui-seeded', 'yes');
          }
          const write = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, value) { if (window.qaFailWrite === key) throw new Error('Isolated persistence failure'); return write.call(this, key, value); };
        }, { profile, journal, sessions, anchor });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        page.on('pageerror', error => errors.push(error.message));
        await page.route('http://127.0.0.1:8787/**', route => route.abort());
        const enterDiet = async () => { await page.getByRole('tab', { name: '切换到饮食', exact: true }).click(); await waitForNutritionPage(page); };
        const snapshot = async name => page.screenshot({ path: path.join(output, name + '-' + width + '.png'), animations: 'disabled' });
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await enterDiet();
        await page.getByTestId('nutrition-empty-meals').waitFor();
        assert.equal(await page.getByTestId('nutrition-recorded-energy').innerText(), '—');
        assert.equal(await page.getByTestId('nutrition-recorded-meals').count(), 0);
        const hero = await page.getByTestId('nutrition-energy-card').boundingBox();
        assert.ok(hero.height <= 220, 'Compact energy card should be no taller than 220 px');
        await snapshot('diet-empty');

        await page.evaluate(recorded => localStorage.setItem('nutrition_journal_v1', JSON.stringify(recorded)), recorded);
        await page.reload({ waitUntil: 'domcontentloaded' }); await enterDiet();
        const before = await read(page);
        const expected = Math.round(sumNutrients(before.entries.map(entry => entry.nutrients)).calories);
        assert.equal(await page.getByTestId('nutrition-recorded-energy').innerText(), String(expected));
        assert.equal(await page.getByTestId('nutrition-recorded-meals').getByRole('button').count(), 2);
        assert.equal((await page.getByTestId('nutrition-energy-ring').boundingBox()).width, 64);
        const recipeImages = await page.getByTestId('meal-recipe-image').count();
        assert.ok(recipeImages >= 2, 'Both logged fixture recipes should have matching illustrations');
        await page.waitForFunction(count => [...document.images].filter(img => img.src.includes('nutrition-recipes') && img.complete && img.naturalWidth >= 512).length >= count, recipeImages);
        const positions = {};
        for (const label of ['拍照记餐', '查看早餐饮食记录', '问营养助手']) positions[label] = (await page.getByRole('button', { name: label, exact: true }).boundingBox()).y;
        assert.ok(Math.abs(positions['拍照记餐'] - positions['问营养助手']) < 1 && positions['拍照记餐'] < positions['查看早餐饮食记录']);
        await snapshot('diet-recorded');
        const dietScale = await geometry(page.getByTestId('nutrition-content'));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

        await page.getByRole('button', { name: '查看早餐饮食记录', exact: true }).click();
        await page.getByTestId('nutrition-record-details').waitFor();
        await page.getByRole('button', { name: '编辑', exact: true }).click();
        await page.getByRole('button', { name: '关闭实际摄入编辑器', exact: true }).click();
        assert.deepEqual((await read(page)).entries, before.entries, 'Opening and cancelling intake editing changes no food records');
        await page.getByRole('button', { name: '选择饮食记录日期', exact: true }).click();
        await page.getByRole('button', { name: '前一天饮食记录', exact: true }).click();
        await page.getByText('该日未保存目标 · 不补造历史参考值', { exact: true }).waitFor();
        await page.getByRole('button', { name: '选择饮食记录日期', exact: true }).click();
        await page.getByRole('button', { name: '回到今天饮食记录', exact: true }).click();
        assert.deepEqual((await read(page)).entries, before.entries);

        await page.getByText('数据', { exact: true }).click();
        await page.getByTestId('training-data-list').waitFor();
        const dataScale = await geometry(page.getByTestId('training-data-list'));
        assert.match(await page.getByTestId('month-training-count').innerText(), /^本月 3 次/);
        await page.getByText('我的', { exact: true }).click();
        await page.getByTestId('profile-title').waitFor();
        const profileScale = await geometry(page.getByTestId('profile-content'));
        assert.deepEqual(profileScale, dataScale); assert.deepEqual(dietScale, dataScale);
        assert.equal(await page.getByTestId('profile-title').evaluate(el => parseFloat(getComputedStyle(el).fontSize)), 22);
        assert.equal(await page.getByTestId('profile-training-count').innerText(), '3 次');
        assert.equal(await page.getByTestId('profile-training-days').innerText(), '2 天');
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(13, 17, 20)');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await snapshot('profile');
        await page.getByRole('button', { name: '编辑个人档案', exact: true }).click();
        await page.getByTestId('profile-edit-sheet').waitFor();
        await snapshot('profile-edit');
        await page.getByRole('button', { name: '关闭档案编辑', exact: true }).click();
        await page.getByRole('button', { name: '训练专题', exact: true }).click();
        await page.getByTestId('profile-goal-sheet').waitFor();
        await page.getByRole('button', { name: '关闭训练专题选择', exact: true }).click();
        assert.deepEqual((await read(page)).profile, before.profile);

        if (width === 390) {
          await page.getByRole('button', { name: '编辑个人档案', exact: true }).click();
          await page.getByLabel('姓名', { exact: true }).fill('本地保存检查');
          await page.getByLabel('体重kg', { exact: true }).fill('76');
          await page.getByRole('button', { name: '保存修改', exact: true }).click();
          await page.waitForFunction(() => JSON.parse(localStorage.getItem('user_profile')).name === '本地保存检查');
          await page.getByRole('switch', { name: '震动反馈', exact: true }).click();
          await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings')).vibration === false);
          await page.evaluate(() => { window.qaFailWrite = 'settings'; });
          await page.getByRole('switch', { name: '震动反馈', exact: true }).click();
          await page.getByText('偏好未能保存，请重试。', { exact: true }).waitFor();
          assert.equal(await page.getByRole('switch', { name: '震动反馈', exact: true }).getAttribute('aria-checked'), 'false');
          await page.evaluate(() => { window.qaFailWrite = null; });
          await page.getByRole('button', { name: '清除本机数据', exact: true }).click();
          await page.getByRole('button', { name: '取消', exact: true }).click();
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.getByText('我的', { exact: true }).click();
          await page.getByTestId('profile-title').waitFor();
          const restored = await read(page);
          assert.equal(restored.profile.name, '本地保存检查'); assert.equal(restored.profile.weight, 76); assert.equal(restored.settings.vibration, false);
          assert.deepEqual(restored.entries, before.entries); assert.deepEqual(restored.sessions, before.sessions);
        }
        console.log(JSON.stringify({ viewport: width, energyCardHeight: hero.height, dietScale, dataScale, profileScale }));
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
    console.log('PASS compact real-data meals, dates, identical page scale, accurate training counts, profile/settings persistence and failure recovery');
    console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); console.error('Screenshots: ' + output); process.exitCode = 1; });
