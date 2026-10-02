// Uses fresh browser contexts and synthetic records, never the user's open tab.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const profile = { name: 'Quality QA', age: 30, sex: 'male', height: 175, weight: 75,
  goal: 'equipment', nutritionGoal: 'muscle_gain', dietPattern: 'balanced_cn', frequency: 4,
  equipmentSplit: 'upper_lower', experience: 'advanced', levels: { push: 5 },
  planId: 'equipment_training_v2', planStartedAt: new Date().toISOString() };
const now = new Date().toISOString();
const history = [{ id: 'retained-history', kind: 'running', workoutId: 'run', workoutName: '历史跑步',
  startedAt: now, completedAt: now, durationSeconds: 600, exercises: [], totalReps: 0 }];
(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-code-quality-'));
  const errors = [], warnings = [];
  const contextFor = async seed => {
    const context = await browser.newContext({ viewport: { width: 471, height: 871 } });
    await context.addInitScript(data => { if (!localStorage.getItem('quality-seeded')) {
      for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
      localStorage.setItem('quality-seeded', 'yes');
    } }, { user_profile: JSON.stringify(profile), sessions: JSON.stringify(history), ...seed });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (/strokeDasharray|TypeError|ReferenceError/.test(message.text())) warnings.push(message.text()); });
    await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    return { context, page };
  };
  try {
    const normal = await contextFor({});
    await normal.page.getByTestId('equipment-today-screen').waitFor();
    await normal.page.getByText('我的', { exact: true }).click();
    await normal.page.getByRole('button', { name: '编辑个人档案', exact: true }).click();
    await normal.page.getByLabel('姓名', { exact: true }).fill('Updated QA');
    await normal.page.getByLabel('体重kg', { exact: true }).fill('80');
    await normal.page.getByRole('button', { name: '保存修改', exact: true }).click();
    await normal.page.getByTestId('profile-edit-sheet').waitFor({ state: 'hidden' });
    let saved = await normal.page.evaluate(() => JSON.parse(localStorage.getItem('user_profile')));
    assert.equal(saved.name, 'Updated QA'); assert.equal(saved.weight, 80); assert.equal(saved.nutritionGoal, 'muscle_gain');
    assert.equal(await normal.page.evaluate(() => JSON.parse(localStorage.getItem('sessions'))[0].id), history[0].id);
    await normal.page.screenshot({ path: path.join(output, 'profile.png') });
    await normal.context.close();

    for (const key of ['user_profile', 'sessions', 'settings', 'daily_workout_edits', 'nutrition_journal_v1']) {
      const bad = '{malformed';
      const { context, page } = await contextFor({ [key]: bad });
      await page.getByTestId('storage-recovery').waitFor();
      assert.equal(await page.evaluate(key => localStorage.getItem(key), key), bad);
      if (key === 'user_profile') {
        assert.equal(await page.getByRole('button', { name: '清除并重新建档', exact: true }).count(), 1);
        assert.equal(await page.getByTestId('equipment-today-screen').count(), 0);
        await page.screenshot({ path: path.join(output, 'recovery.png') });
      } else {
        await page.getByTestId('equipment-today-screen').waitFor();
      }
      const replacement = key === 'user_profile' ? profile : key === 'sessions' ? history
        : key === 'settings' ? { vibration: false, restSeconds: 180 }
        : key === 'daily_workout_edits' ? {} : { version: 1, entries: [] };
      await page.evaluate(({ key, replacement }) => localStorage.setItem(key, JSON.stringify(replacement)), { key, replacement });
      await page.getByRole('button', { name: '重试读取', exact: true }).click();
      await page.getByTestId('storage-recovery').waitFor({ state: 'hidden' });
      await page.getByTestId('equipment-today-screen').waitFor();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sessions'))[0].id), history[0].id);
      await context.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
    console.log('PASS: field-only profile save, retained history, five isolated failure/recovery paths, no runtime errors. Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
