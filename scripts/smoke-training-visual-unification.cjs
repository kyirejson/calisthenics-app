// Isolated profiles, simulated clock, read-only browsing. Never touches the user's tab.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/UncoverBuildTools/browser-tests/node_modules/playwright');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const { getTrainingDayView } = require('../src/domain/training/trainingDayView.ts');
const { getWeekSchedule } = require('../src/domain/training/trainingPlans.ts');
const { equipmentSessionPlan } = require('../src/domain/training/equipment/equipmentTraining.ts');
const { getEquipmentMovement } = require('../src/data/equipment.ts');
const fixture = fs.readFileSync(require.resolve('./smoke-fitness-flows.cjs'), 'utf8');
const base = vm.runInNewContext('(' + fixture.match(/const profile = ([\s\S]*?);\r?\n/)[1] + ')');
const anchor = '2026-10-09T01:00:00.000Z';
const unit = item => ({ seconds: '秒', meters: '米', steps: '步', reps: '次' })[item.targetUnit];

async function inspectDetail(page, goal, width) {
  const footer = page.getByTestId('movement-detail-footer');
  await footer.waitFor();
  const originalPosition = await footer.boundingBox();
  assert.ok(originalPosition.y >= 0 && originalPosition.y + originalPosition.height <= 872);
  const scroll = page.getByTestId('movement-detail-scroll');
  assert.equal(await scroll.evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
  await scroll.evaluate(node => { node.scrollTop = node.scrollHeight; });
  const scrolledPosition = await footer.boundingBox();
  assert.equal(scrolledPosition.y, originalPosition.y, 'Detail actions stay fixed outside reading content');
  if (goal === 'equipment') {
    const guide = page.getByTestId('equipment-modern-guide');
    assert.match(await guide.innerText(), /准备与设置[\s\S]*动作过程[\s\S]*呼吸与收尾/);
    await page.getByRole('tab', { name: '指导依据', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="movement-detail-scroll"]').scrollTop === 0);
    await page.getByText('指导与评级依据', { exact: true }).waitFor();
    assert.ok(await page.getByRole('link').count() > 0);
    assert.equal(await page.getByTestId('equipment-modern-guide').count(), 0);
    await page.getByRole('tab', { name: '动作指导', exact: true }).click();
  } else {
    const standards = page.getByTestId('exercise-training-standards');
    if (await standards.count()) {
      assert.equal(await standards.getByRole('button').count(), 0, 'Standards are always readable, not disclosures');
      for (const row of await standards.locator('[data-testid^="exercise-standard-"]').all()) {
        assert.ok((await row.innerText()).split('\n').filter(Boolean).length >= 2, 'Every standard shows its label and actual value without a click');
      }
      await standards.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `D:/UncoverBuildTools/temp/detail-standards-${goal}-${width}.png`, animations: 'disabled' });
    }
    assert.equal(await page.getByText('资料来源', { exact: true }).count(), 0);
    assert.equal(await page.getByText(/^来源：/).count(), 0);
    assert.equal(await page.getByText(/^[低中高]风险动作$/).count(), 0);
    await page.getByRole('tab', { name: '资料原文与配图', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="movement-detail-scroll"]').scrollTop === 0);
    assert.equal(await page.getByTestId('movement-detail-metrics').count(), 0, 'Original reading does not duplicate overview stats');
    assert.equal(await page.getByTestId('exercise-detail-original-photo').count(), 0);
    assert.equal(await page.getByText(/^[低中高]风险动作$/).count(), 0);
    assert.ok(await scroll.innerText());
    await scroll.evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `D:/UncoverBuildTools/temp/detail-original-${goal}-${width}.png` });
    await page.getByRole('tab', { name: '速览指导', exact: true }).click();
    assert.equal(await page.getByTestId('movement-detail-metrics').count(), 1);
  }
  await scroll.evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: `D:/UncoverBuildTools/temp/detail-${goal}-${width}.png`, animations: 'disabled' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.getByRole('button', { name: goal === 'equipment' ? '返回器械动作库' : '返回动作列表', exact: true }).click();
}

(async () => {
  fs.mkdirSync('D:/UncoverBuildTools/temp', { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [320, 390, 607]) for (const goal of ['street_mastery', 'weight_loss', 'equipment']) {
      const selected = { ...base, goal, experience: goal === 'street_mastery' ? 'elite' : 'intermediate', frequency: goal === 'equipment' || goal === 'street_mastery' ? 6 : 3,
        planStartedAt: anchor, planId: goal === 'equipment' ? 'equipment_training_v2' : goal === 'weight_loss' ? 'personal_v1' : 'prisoner',
        ...(goal === 'equipment' ? { equipmentSplit: 'ppl' } : {}) };
      const context = await browser.newContext({ viewport: { width, height: 871 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
      try {
        await context.addInitScript(({ selected, anchor }) => {
          const OriginalDate = Date, timestamp = OriginalDate.parse(anchor), started = performance.now();
          class Clock extends OriginalDate { constructor(...args) { super(...(args.length ? args : [timestamp + performance.now() - started])); } static now() { return timestamp + performance.now() - started; } }
          window.Date = Clock;
          if (localStorage.getItem('visual-qa')) return;
          localStorage.setItem('visual-qa', '1'); localStorage.setItem('profile-invitation-seen', '1');
          localStorage.setItem('user_profile', JSON.stringify(selected)); localStorage.setItem('sessions', '[]');
        }, { selected, anchor });
        await context.route('**/*', route => /^(http:\/\/127\.0\.0\.1:8081\/|data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort());
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded' });
        await page.getByTestId('today-course-card').waitFor();
        const stored = await page.evaluate(() => localStorage.getItem('user_profile'));
        const profile = JSON.parse(stored), now = new Date(anchor);
        const expected = goal === 'equipment'
          ? equipmentSessionPlan(getWeekSchedule(profile, now).find(day => day.date.getDate() === 9).workoutId, profile, now).items
          : getTrainingDayView(profile, [], {}, now, null).exercises;
        const list = page.getByTestId('today-workout-list');
        assert.ok(expected.length > 0);
        assert.equal(await list.getByRole('button', { name: /动作指导$/ }).count(), expected.length, 'No training actions are cropped');
        for (const item of expected) {
          const row = page.getByTestId('today-exercise-' + item.id);
          const cells = row.locator('[data-testid^="today-prescribed-set-"]');
          assert.equal(await cells.count(), item.targetSets);
          const value = goal === 'equipment' ? item.repRange.join('–') : item.targetValue;
          assert.deepEqual(await cells.allInnerTexts(), Array(item.targetSets).fill(`${value} ${unit(item)}`));
          assert.match(await row.innerText(), new RegExp('组间休息 ' + item.restSeconds + ' 秒'));
          if (item.perSide) assert.match(await row.innerText(), /每侧/);
          const nameStyle = await page.getByTestId('today-exercise-name-' + item.id).evaluate(node => getComputedStyle(node).fontSize);
          assert.equal(nameStyle, width === 320 ? '17px' : '18px', 'All goals share one type scale');
        }
        const sections = ['today-date-rail', 'today-schedule-controls', 'today-course-card', 'today-workout-list'];
        const positions = await Promise.all(sections.map(id => page.getByTestId(id).boundingBox()));
        positions.forEach((box, index) => { assert.ok(box.x >= 0 && box.x + box.width <= width + 1); if (index) assert.ok(box.y >= positions[index - 1].y + positions[index - 1].height - 1); });
        assert.equal(await page.getByText('本周训练进度', { exact: true }).count(), 0);
        const start = page.getByTestId('today-start-dock');
        const pinned = await start.boundingBox();
        await list.getByRole('button', { name: /动作指导$/ }).last().scrollIntoViewIfNeeded();
        assert.equal((await start.boundingBox()).y, pinned.y);
        const button = await start.getByRole('button').boundingBox();
        assert.ok(button.y > 0 && button.y + button.height < 871 - 68);
        const chat = await page.getByRole('button', { name: '打开 DeepSeek 聊天', exact: true }).boundingBox();
        assert.ok(button.x + button.width <= chat.x || button.y + button.height <= chat.y || chat.y + chat.height <= button.y, 'Default chat cannot obscure start');
        await page.getByTestId(goal === 'equipment' ? 'equipment-today-scroll' : 'today-training-content').evaluate(root => {
          const scroll = root.matches('[data-testid="equipment-today-scroll"]') ? root : [...root.querySelectorAll('div')].find(node => /auto|scroll/.test(getComputedStyle(node).overflowY));
          scroll.scrollTop = 0;
        });
        await page.screenshot({ path: `D:/UncoverBuildTools/temp/today-unified-${goal}-${width}.png`, animations: 'disabled' });
        await page.getByTestId('today-exercise-' + expected[0].id).click();
        if (goal === 'equipment') {
          const movement = getEquipmentMovement(expected[0].id);
          assert.ok((await page.getByTestId('equipment-modern-guide').innerText()).includes(movement.guide.execution));
        }
        await inspectDetail(page, goal, width);
        await page.getByTestId('today-course-card').waitFor();
        if (goal === 'equipment') {
          await page.getByRole('button', { name: '调整器械训练计划', exact: true }).click();
          await page.getByTestId('equipment-plan-editor').waitFor();
          await page.getByRole('button', { name: '关闭器械设置', exact: true }).click();
          await page.getByTestId('equipment-rest-day').first().click();
          assert.match(await page.getByTestId('today-course-card').innerText(), /恢复日/);
          assert.equal(await list.getByRole('button', { name: /动作指导$/ }).count(), 0);
          await start.getByRole('button').click();
          assert.equal(await list.getByRole('button', { name: /动作指导$/ }).count(), expected.length);
        }
        assert.equal(await page.evaluate(() => localStorage.getItem('user_profile')), stored, 'Read-only browsing cannot change the plan');
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('sessions'))), []);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        assert.deepEqual(errors, []);
        console.log(`PASS ${goal}/${width}px: shared dates/course/tasks/start, exact prescriptions, complete list, fixed detail actions, original/evidence reading and unchanged data`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
