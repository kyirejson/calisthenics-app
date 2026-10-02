// Real app browser QA using isolated localStorage and synthetic records only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { getSeriesExercises, parseMasteryCriteria } = require('../src/data/progression.ts');
const { localDayKey } = require('../src/data/trainingHistory.ts');

const profile = { name: 'UI隔离验证', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn',
  frequency: 3, levels: { push: 5, hspu: 1 }, experience: 'intermediate', sessionMinutes: 45, trainingRestSeconds: 180,
  planId: 'prisoner', planStartedAt: new Date().toISOString(), weightHistory: [] };
function record(id, offset, values, extra = {}) {
  const at = new Date(); at.setDate(at.getDate() + offset); at.setSeconds(at.getSeconds() - 30);
  return { id, workoutId: 'qa-lesson', workoutName: '隔离测试力量课', startedAt: at.toISOString(), completedAt: at.toISOString(),
    trainingDate: localDayKey(at), durationSeconds: 1200, completion: 'complete', kind: 'strength', quality: 'solid',
    totalReps: values.reduce((sum, value) => sum + value, 0), exercises: [{ exerciseId: 'push_05', name: '标准俯卧撑', category: 'push',
      sets: values.map(value => ({ reps: value, completed: true, unit: 'reps' })) }], ...extra };
}
function exam(id, offset) {
  const exercise = getSeriesExercises('push')[3], criteria = parseMasteryCriteria(exercise);
  const result = record(id, offset, Array(criteria.sets).fill(criteria.value), { workoutId: 'single_' + exercise.id, workoutName: '隔离测试专项验收' });
  result.exercises[0].exerciseId = exercise.id;
  result.exercises[0].name = exercise.name;
  result.exercises[0].constraintsConfirmed = true;
  result.exercises[0].sets.forEach(set => { set.unit = criteria.unit; });
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  async function open(records, reducedMotion = 'no-preference') {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, timezoneId: 'Asia/Shanghai', hasTouch: true, reducedMotion });
    await context.addInitScript(({ profile, records }) => {
      if (!localStorage.getItem('__uncover_progress_qa_seeded')) {
        localStorage.setItem('user_profile', JSON.stringify(profile));
        localStorage.setItem('sessions', JSON.stringify(records));
        localStorage.setItem('__uncover_progress_qa_seeded', '1');
      }
    }, { profile, records });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://127.0.0.1:8787/**', route => route.abort());
    await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText('数据', { exact: true }).click();
    await page.getByTestId('progress-plot').waitFor();
    return { context, page };
  }
  const snapshot = async (page, name) => { if (process.env.PROGRESS_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PROGRESS_SCREENSHOT_DIR, name + '.png'), animations: 'disabled' }); };
  const settled = page => page.waitForFunction(() => {
    const element = document.querySelector('[data-testid="progress-curve-rise"]');
    if (!element) return false;
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return Math.abs(matrix.m22 - 1) < 0.001;
  });
  const top = page => page.getByTestId('training-data-list').evaluate(element => new Promise(resolve => {
    // RN Web replaces node.scrollTo with its x/y API; DOM top/behavior would animate.
    element.scrollTop = 0;
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  let main;
  try {
    const empty = await open([], 'reduce');
    await empty.page.getByText('你的曲线，从第一组开始', { exact: true }).waitFor();
    assert.equal(await empty.page.getByTestId('performance-record-dot').count(), 0);
    assert.equal(await empty.page.getByTestId('performance-series-line').count(), 0);
    assert.equal((await empty.page.getByTestId('history-personal-best').innerText()).trim(), '—');
    assert.equal((await empty.page.getByTestId('reviewed-training-streak').innerText()).trim(), '—');
    assert.equal((await empty.page.getByTestId('weekly-training-streak').innerText()).trim(), '0 周');
    await snapshot(empty.page, 'progress-empty-390');
    await empty.context.close();
    console.log('PASS empty state: no fabricated curve, achievement, symmetry, RIR or forty-eight-day streak');

    const single = await open([record('one', -1, [18])], 'reduce');
    assert.equal(await single.page.getByTestId('performance-record-dot').count(), 1);
    assert.equal(await single.page.getByTestId('performance-series-line').count(), 0);
    await settled(single.page);
    await snapshot(single.page, 'progress-single-390');
    await single.context.close();
    console.log('PASS one actual point / reduced motion settles immediately');

    const records = [record('old-pr', -120, [75, 60]), exam('exam-a', -10), exam('exam-b', -8),
      record('first', -4, [12, 10]), record('middle', -2, [16, 12]), record('latest', 0, [18, 14]), record('extra', 0, [9], { quality: undefined })];
    const hold = record('hold', -1, [54]);
    hold.exercises[0] = { exerciseId: 'hspu_01', name: '靠墙顶立', category: 'hspu', sets: [{ reps: 54, completed: true, unit: 'seconds' }] };
    records.push(hold);
    main = await open(records);
    const page = main.page;
    const before = await page.evaluate(() => localStorage.getItem('sessions'));
    const profileBefore = await page.evaluate(() => localStorage.getItem('user_profile'));
    const firstTransform = await page.getByTestId('progress-curve-rise').evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m22);
    assert.ok(firstTransform < 0.99, 'curve must begin growing from the baseline rather than appear fully drawn');
    const riseFrames = await page.evaluate(() => new Promise(resolve => {
      const frames = [];
      const capture = () => {
        const element = document.querySelector('[data-testid="progress-curve-rise"]');
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
        const height = element.offsetHeight;
        frames.push({ scale: matrix.m22, baseline: height / 2 + matrix.m22 * height / 2 + matrix.m42, height });
        if (matrix.m22 < 0.999) requestAnimationFrame(capture); else resolve(frames);
      };
      capture();
    }));
    assert.ok(riseFrames.length > 2, 'upward reveal should have visible intermediate frames');
    riseFrames.forEach((frame, index) => {
      assert.ok(Math.abs(frame.baseline - frame.height) < 0.05, 'the baseline must remain fixed while the curve rises');
      if (index) assert.ok(frame.scale >= riseFrames[index - 1].scale - 0.001, 'rise must not jump backwards');
    });
    await settled(page);
    assert.equal(await page.getByTestId('performance-record-dot').count(), 3);
    assert.equal(await page.getByTestId('performance-series-line').count(), 1);
    assert.match(await page.getByTestId('performance-tooltip').innerText(), /18/);
    assert.match(await page.getByTestId('performance-tooltip').innerText(), /含未填写反馈/);
    assert.match(await page.getByTestId('history-personal-best').innerText(), /75/);
    assert.equal((await page.getByTestId('reviewed-training-streak').innerText()).trim(), '—');
    await snapshot(page, 'progress-rise-final-390');
    console.log('PASS baseline-to-actual animation / latest date selected / all-time PR / unknown feedback is not no pain');

    await page.getByRole('button', { name: '查看上一条成绩', exact: true }).click();
    assert.match(await page.getByTestId('performance-tooltip').innerText(), /16/);
    const afterSelection = await page.getByTestId('progress-curve-rise').evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m22);
    assert.ok(afterSelection > 0.999, 'inspecting a point must not replay the entry animation');
    await page.getByRole('button', { name: '查看下一条成绩', exact: true }).click();
    await page.getByRole('button', { name: '查看当日总量曲线', exact: true }).click();
    await settled(page);
    assert.match(await page.getByTestId('performance-tooltip').innerText(), /41/);
    assert.equal(await page.getByText(/^单组参考 /).count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('sessions')), before);
    console.log('PASS best vs daily sum / same-day sessions merged / inspection does not replay or alter records');

    await page.getByRole('button', { name: '查看单组最佳曲线', exact: true }).click();
    await page.getByRole('button', { name: '查看全部训练曲线', exact: true }).click();
    await settled(page);
    assert.equal(await page.getByTestId('performance-record-dot').count(), 4);
    await page.getByText('100', { exact: true }).waitFor();
    const dots = await page.getByTestId('performance-record-dot').evaluateAll(nodes => nodes.map(node => ({ x: Number(node.getAttribute('cx')), y: Number(node.getAttribute('cy')) })));
    assert.ok(dots.every(dot => dot.x >= 12 && dot.y >= 0 && dot.y <= 166));
    console.log('PASS real calendar spacing / old records retained / Y scale includes genuine highs');

    await page.getByRole('button', { name: '选择查看的动作阶数', exact: true }).click();
    await page.getByRole('button', { name: '选择第6阶窄距俯卧撑', exact: true }).click();
    await page.getByText('你的曲线，从第一组开始', { exact: true }).waitFor();
    assert.equal(await page.getByTestId('performance-record-dot').count(), 0);
    await page.getByRole('button', { name: '选择查看的动作阶数', exact: true }).click();
    await page.getByRole('button', { name: '选择第5阶标准俯卧撑', exact: true }).click();
    await settled(page);
    await page.getByRole('button', { name: '查看倒立撑进步记录', exact: true }).click();
    await settled(page);
    assert.match(await page.getByTestId('performance-tooltip').innerText(), /54\s*秒/);
    await page.getByRole('button', { name: '查看俯卧撑进步记录', exact: true }).click();
    await settled(page);
    console.log('PASS all-step selection does not change profile / seconds are never displayed as repetitions');

    await top(page);
    await page.getByRole('button', { name: '上一个月', exact: true }).scrollIntoViewIfNeeded();
    const expected = new Date(); expected.setDate(1); expected.setMonth(expected.getMonth() - 12);
    for (let index = 0; index < 12; index++) await page.getByRole('button', { name: '上一个月', exact: true }).click();
    assert.equal(await page.getByTestId('training-calendar-month').innerText(), expected.getFullYear() + '年' + (expected.getMonth() + 1) + '月');
    await page.getByRole('button', { name: '回到本月训练日历', exact: true }).click();
    const today = localDayKey(new Date());
    await page.getByRole('button', { name: '查看' + today + '训练记录', exact: true }).click();
    await page.getByRole('button', { name: '展开训练记录latest', exact: true }).waitFor();
    await page.getByRole('button', { name: '展开训练记录latest', exact: true }).click();
    await page.getByRole('button', { name: '删除训练记录latest', exact: true }).click();
    await page.getByRole('button', { name: '删除记录', exact: true }).click();
    await page.waitForFunction(() => !JSON.parse(localStorage.getItem('sessions')).some(session => session.id === 'latest'));
    await page.getByRole('button', { name: '查看全部训练历史', exact: true }).click();
    await top(page);
    await settled(page);
    assert.match(await page.getByTestId('performance-tooltip').innerText(), /9\s*次/);
    console.log('PASS year-safe calendar / click-to-history / explicit deletion recalculates chart');

    for (const width of [320, 390, 681, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await top(page);
      const box = await page.getByTestId('unified-progress-card').boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width);
      const tip = await page.getByTestId('performance-tooltip').boundingBox();
      assert.ok(tip && tip.x >= box.x && tip.x + tip.width <= box.x + box.width);
      await snapshot(page, 'progress-' + width);
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await top(page);
    const client = await main.context.newCDPSession(page);
    const plotBox = await page.getByTestId('performance-touch-surface').boundingBox();
    const x = plotBox.x + plotBox.width / 2, y = plotBox.y + 110;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let index = 1; index <= 5; index++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - index * 24 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => document.querySelector('[data-testid="training-data-list"]').scrollTop > 40);
    console.log('PASS 320 / 390 / 681 / 1280 layouts / vertical touch scrolling remains available on the chart');

    await top(page);
    const touchBox = await page.getByTestId('performance-touch-surface').boundingBox();
    const startX = touchBox.x + touchBox.width - 26, touchY = touchBox.y + 125;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: touchY }] });
    for (let index = 1; index <= 8; index++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX - (touchBox.width - 72) * index / 8, y: touchY }] });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => document.querySelector('[data-testid="performance-tooltip"]').innerText.includes('75'));
    const nextPoint = page.getByRole('button', { name: '查看下一条成绩', exact: true });
    await nextPoint.focus(); await page.keyboard.press('Enter');
    assert.match(await page.getByTestId('performance-tooltip').innerText(), /12\s*次/);
    console.log('PASS horizontal touch selects actual points / keyboard-accessible inspection buttons');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '查看近30天训练曲线', exact: true }).click();
    await settled(page);
    assert.ok(await page.getByTestId('progress-curve-rise').evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m22 > 0.999));
    console.log('PASS system reduced-motion preference can change while the page is open');

    const savedRecords = await page.evaluate(() => localStorage.getItem('sessions'));
    assert.ok(!JSON.parse(savedRecords).some(session => session.id === 'latest'));
    assert.equal(await page.evaluate(() => localStorage.getItem('user_profile')), profileBefore);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('数据', { exact: true }).click();
    await settled(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('sessions')), savedRecords);
    assert.equal(await page.evaluate(() => localStorage.getItem('user_profile')), profileBefore);
    assert.match(await page.getByTestId('performance-tooltip').innerText(), /9\s*次/);
    assert.deepEqual(errors, []);
    console.log('PASS persisted deletion survives reload / profile unchanged / no page errors / no paid model requests / original user tab untouched');
  } catch (error) {
    if (main?.page) {
      console.error((await main.page.locator('body').innerText()).slice(-2400));
      await snapshot(main.page, 'progress-failure');
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
