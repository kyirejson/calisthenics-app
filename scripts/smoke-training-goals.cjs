// Isolated browser contexts only; never overwrite the user's browser profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = { name: '专题切换验收', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, levels: { push: 5 }, planLevels: { push: 5 }, experience: 'intermediate', sessionMinutes: 45, trainingRestSeconds: 180, planId: 'prisoner', planStartedAt: new Date().toISOString(), weightHistory: [] };
const session = { id: 'goal-history-preserved', kind: 'strength', workoutId: 'single_push_05', workoutName: '标准俯卧撑专项', startedAt: new Date(Date.now() - 86400000).toISOString(), completedAt: new Date(Date.now() - 86400000 + 600000).toISOString(), completion: 'complete', quality: 'solid', durationSeconds: 600, totalReps: 20, exercises: [{ exerciseId: 'push_05', name: '标准俯卧撑', sets: [{ reps: 20, completed: true, unit: 'reps' }] }] };
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-training-goals-'));
  const errors = [];
  try {
    for (const width of [320, 471, 659, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 668 }, reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai' });
      await context.addInitScript(({ base, session }) => {
        if (!localStorage.getItem('goal_qa_seeded')) {
          localStorage.setItem('user_profile', JSON.stringify(base));
          localStorage.setItem('sessions', JSON.stringify([session]));
          localStorage.setItem('goal_qa_seeded', 'yes');
        }
      }, { base, session });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/v1/nutrition/**', route => route.abort());
      await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByTestId('training-goal-selector').waitFor();
      const saved = () => page.evaluate(() => ({ profile: JSON.parse(localStorage.getItem('user_profile')), sessions: localStorage.getItem('sessions') }));
      const initial = await saved();
      let shape;
      for (const [current, next, label] of [['street_mastery', 'equipment', '器械训练'], ['equipment', 'weight_loss', '减肥控重'], ['weight_loss', 'street_mastery', '街头健身']]) {
        const selector = page.getByTestId('training-goal-selector');
        assert.equal(await selector.evaluate(node => getComputedStyle(node).minHeight), '44px');
        const before = await saved();
        await selector.click();
        const sheet = page.getByTestId('training-goal-sheet'); await sheet.waitFor();
        assert.equal(await sheet.getByRole('button', { name: /^选择(减肥控重|街头健身|器械训练)$/ }).count(), 3);
        assert.equal(await sheet.getByTestId('training-goal-option-' + current).getAttribute('aria-pressed'), 'true');
        assert.equal(await sheet.getByText(/可持续减重|按原书选择|每周 2–6|囚徒健身/).count(), 0);
        const box = await sheet.boundingBox();
        assert.ok(box.x >= 15 && box.x + box.width <= width - 15 && box.y >= 15 && box.y + box.height <= 653, JSON.stringify(box));
        const cardShape = { width: box.width, height: box.height };
        if (shape) assert.deepEqual(cardShape, shape); else shape = cardShape;
        assert.deepEqual(await saved(), before, 'opening the picker never mutates records');
        await page.screenshot({ path: path.join(output, `${current}-picker-${width}.png`), animations: 'disabled' });
        await sheet.getByRole('button', { name: '选择' + label, exact: true }).click();
        await page.waitForFunction(goal => JSON.parse(localStorage.getItem('user_profile')).goal === goal, next);
        await sheet.waitFor({ state: 'hidden' });
        assert.equal((await saved()).sessions, initial.sessions);
        assert.deepEqual((await saved()).profile.levels, initial.profile.levels);
        assert.deepEqual((await saved()).profile.planLevels, initial.profile.planLevels);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByTestId('training-goal-selector').getByText('街头健身', { exact: true }).waitFor();
      assert.equal((await saved()).sessions, initial.sessions);
      await page.getByText('我的', { exact: true }).click();
      await page.getByRole('button', { name: '训练专题', exact: true }).click();
      const profileSheet = page.getByTestId('profile-goal-sheet'); await profileSheet.waitFor();
      const profileBox = await profileSheet.boundingBox();
      assert.deepEqual({ width: profileBox.width, height: profileBox.height }, shape);
      await profileSheet.getByRole('button', { name: '关闭训练专题选择', exact: true }).click();
      await page.getByText('进阶', { exact: true }).click();
      await page.getByTestId('progression-screen').waitFor();
      assert.equal(await page.getByText(/终式目标/).count(), 0);
      assert.match(await page.getByTestId('progression-final-ring').innerText(), /0%/);
      assert.equal(await page.getByTestId('progression-final-ring').getAttribute('aria-valuenow'), '0');
      assert.match(await page.getByRole('button', { name: '展开全部已通过阶数', exact: true }).innerText(), /4 式已通过/);
      await page.screenshot({ path: path.join(output, `progress-${width}.png`), animations: 'disabled' });
      assert.equal((await saved()).sessions, initial.sessions);
      console.log(`PASS ${width}px: shared selectors/pickers, all three goals, persistent switch, history/levels preserved, simplified progression`);
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
