// Third-stage browser QA: a new isolated context, synthetic records, and mocked
// AI responses only. Never accesses the user's open tab/storage or a paid model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { waitForNutritionPage } = require('./nutrition-smoke-utils.cjs');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { emptyNutritionJournal, defaultNutritionPreferences } = require('../src/nutrition/engine.ts');
const { withIntakeEntry } = require('../src/nutrition/journal.ts');
const { withDailyTargetSnapshot, withMealLoggingConfirmation, createNutritionTargetSnapshot } = require('../src/nutrition/timeline.ts');
const { dateAtNoon, offsetDate } = require('../src/nutrition/validation.ts');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [], adviceRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')));
  const screenshot = async name => { if (process.env.NUTRITION_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.NUTRITION_SCREENSHOT_DIR, name + '.png'), animations: 'disabled' }); };
  const changeDay = async label => {
    await page.getByRole('button', { name: '选择饮食记录日期', exact: true }).click();
    await page.getByRole('button', { name: label, exact: true }).click();
  };
  try {
    await page.route('http://127.0.0.1:8787/**', async route => {
      const request = route.request();
      const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8081', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (request.url().endsWith('/health')) return route.fulfill({ status: 200, headers, json: { configured: true, model: 'offline-smoke', provider: 'offline-smoke' } });
      if (request.url().endsWith('/advice')) {
        adviceRequests.push(request.postDataJSON());
        return route.fulfill({ status: 200, headers, json: {
          answer: adviceRequests.length === 1 ? '可以先看看这餐的替换草案，确认后才改变推荐菜单。' : '先以完整记录和训练安排为基础，普通食物搭配即可。',
          sources: [{ title: 'NIDDK：成人健康饮食与记录习惯', url: 'https://www.niddk.nih.gov/health-information/weight-management/healthy-eating-physical-activity-for-life/health-tips-for-adults' }],
          ...(adviceRequests.length === 1 ? { action: { type: 'swap_meal', slot: 'dinner', focus: 'quick' } } : {}),
        } });
      }
      return route.abort();
    });
    await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const day = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
    const profile = { name: 'QA_PERSON_NOT_UPLOADED', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn',
      frequency: 3, levels: {}, experience: 'intermediate', sessionMinutes: 45, trainingRestSeconds: 180, planStartedAt: new Date().toISOString(), weightHistory: [] };
    const training = { type: 'strength', title: '历史测试课程', plannedMinutes: 45, completedMinutes: 0, completedSets: 0, sessionCount: 0, status: 'planned' };
    const sessions = [{ id: 'smoke-checked', workoutId: 'prisonerA', workoutName: '有效组测试', startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), trainingDate: day,
      durationSeconds: 1200, totalReps: 8, completion: 'partial', exercises: [{ exerciseId: 'push_05', name: '标准俯卧撑', category: 'push', sets: [{ completed: true, reps: 8 }] }] }];
    let journal = emptyNutritionJournal();
    journal.preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: new Date().toISOString() };
    for (let i = 1; i <= 4; i++) {
      const date = offsetDate(day, -i);
      journal = withDailyTargetSnapshot(journal, date, createNutritionTargetSnapshot(profile, journal, training, dateAtNoon(date).toISOString()));
      journal = withIntakeEntry(journal, { id: 'smoke-history-' + i, date, slot: 'lunch', name: '历史测试餐', source: 'manual', portions: [{ foodId: 'rice-cooked', grams: 180 }] });
      journal = withMealLoggingConfirmation(journal, date, 'day', true);
    }
    for (const [id, slot, grams] of [['smoke-breakfast', 'breakfast', 200], ['smoke-lunch', 'lunch', 300]]) {
      journal = withIntakeEntry(journal, { id, date: day, slot, name: '测试已吃' + slot, source: 'manual', portions: [{ foodId: 'rice-cooked', grams }] });
    }
    for (const slot of ['breakfast', 'lunch', 'snack']) journal = withMealLoggingConfirmation(journal, day, slot, true);
    await page.evaluate(({ profile, journal, sessions }) => {
      localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal)); localStorage.setItem('sessions', JSON.stringify(sessions));
    }, { profile, journal, sessions });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: '切换到饮食' }).click();
    await waitForNutritionPage(page);
    await page.waitForFunction(day => JSON.parse(localStorage.getItem('nutrition_journal_v1')).days[day]?.targetHistory.length >= 1, day);
    console.log('PASS automatic observed target snapshot / no historical backfill');
    await page.getByRole('button', { name: '问营养助手', exact: true }).click();
    assert.equal(await page.getByText('本地菜单工具 · 不需联网同意', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '同意并开始', exact: true }).count(), 0);
    const before = await read();
    await page.getByLabel('营养问题', { exact: true }).fill('帮我换晚餐');
    await page.getByRole('button', { name: '发送营养问题', exact: true }).click();
    await page.getByRole('button', { name: '同意并开始', exact: true }).click();
    await page.getByRole('button', { name: '确认应用菜单草案', exact: true }).waitFor();
    const unconfirmed = await read();
    assert.equal(adviceRequests[0].history.length, 0);
    assert.equal(adviceRequests[0].context.logging.confirmedSlots.length, 3);
    assert.equal(adviceRequests[0].context.weekly.completeDays, 4);
    assert.equal(adviceRequests[0].context.training.completedSets, 1);
    assert.equal(JSON.stringify(adviceRequests[0]).includes(profile.name), false);
    await page.getByLabel('营养问题', { exact: true }).fill('为什么这样安排？');
    await page.getByRole('button', { name: '发送营养问题', exact: true }).click();
    await page.getByText('先以完整记录和训练安排为基础，普通食物搭配即可。', { exact: true }).waitFor();
    assert.equal(adviceRequests[1].history.length, 2);
    assert.equal(adviceRequests[1].history[0].content, '帮我换晚餐');
    assert.deepEqual((await read()).mealOverrides, unconfirmed.mealOverrides);
    await screenshot('agent-proposal-390');
    await page.getByRole('button', { name: '确认应用菜单草案', exact: true }).click();
    await page.getByText('已更新推荐 · 摄入记录未改变', { exact: true }).waitFor();
    assert.deepEqual((await read()).entries, before.entries);
    await page.getByRole('button', { name: '关闭营养助手', exact: true }).click();
    console.log('PASS multi-turn context / guarded action intent / explicit confirmation / unchanged food logs');
    assert.equal(await page.getByRole('button', { name: '查看当日目标记录', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '营养设置', exact: true }).count(), 0);
    await changeDay('前一天饮食记录');
    await page.getByText(/当日保存参考 /).waitFor();
    for (let i = 0; i < 4; i++) await changeDay('前一天饮食记录');
    await page.getByText('该日未保存目标 · 不补造历史参考值', { exact: true }).waitFor();
    await changeDay('回到今天饮食记录');
    console.log('PASS historical target snapshots / missing-history state');
    const saved = await read();
    await page.reload({ waitUntil: 'domcontentloaded' });
    const restored = await read();
    assert.deepEqual(restored.entries, saved.entries);
    assert.deepEqual(restored.mealOverrides, saved.mealOverrides);
    for (const width of [320, 681, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('tab', { name: '切换到饮食' }).click();
      await waitForNutritionPage(page);
      for (const label of ['问营养助手', '管理当日饮食记录']) {
        const geometry = await page.getByRole('button', { name: label, exact: true }).boundingBox();
        assert.ok(geometry && geometry.x >= 0 && geometry.x + geometry.width <= width, label + ' must fit viewport');
      }
      await page.getByRole('button', { name: '选择饮食记录日期', exact: true }).scrollIntoViewIfNeeded();
      await screenshot('nutrition-loop-' + width);
    }
    assert.deepEqual(errors, []);
    console.log('PASS refresh persistence / 320, 681, 1280 px / no page errors / no paid calls');
  } catch (error) {
    console.error((await page.locator('body').innerText()).slice(-3000));
    await screenshot('loop-failure');
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
