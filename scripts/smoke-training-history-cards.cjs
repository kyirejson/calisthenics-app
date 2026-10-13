// Isolated browser fixtures, no writes to the user's tab or real training records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/UncoverBuildTools/browser-tests/node_modules/playwright');
const fixture = fs.readFileSync(require.resolve('./smoke-fitness-flows.cjs'), 'utf8');
const profile = vm.runInNewContext('(' + fixture.match(/const profile = ([\s\S]*?);\r?\n/)[1] + ')');
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const now = new Date(), today = dayKey(now), yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), yesterday = dayKey(yesterdayDate);
const item = (id, name, count, reps, unit = 'reps') => ({ exerciseId: id, name, sets: Array.from({ length: count }, () => ({ reps, unit, completed: true })) });
const squat = count => item('squat_05', '标准深蹲', count, 12), push = count => item('push_05', '标准俯卧撑', count, 10), pull = count => item('pull_05', '标准引体向上', count, 6), grip = item('hang_grip_01', '悬挂握力', 1, 40, 'seconds');
const session = (id, date, exercises, durationSeconds, age) => ({ id, kind: 'strength', trainingDate: date, workoutId: 'qa', workoutName: '隔离验证', startedAt: new Date(now.getTime() - age * 60000).toISOString(), completedAt: new Date(now.getTime() - (age - 1) * 60000).toISOString(), durationSeconds, completion: 'complete', exercises });
const records = [session('first', today, [squat(2), push(2), pull(1), grip], 1080, 120), session('second', today, [squat(2), push(1), pull(1)], 840, 60), session('yesterday', yesterday, [push(1)], 0, 1440)];
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  fs.mkdirSync('D:/UncoverBuildTools/temp', { recursive: true });
  try {
    for (const width of [320, 390, 739]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
      try {
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(({ profile, records }) => { if (localStorage.getItem('history-chart-qa')) return; localStorage.setItem('history-chart-qa', '1'); localStorage.setItem('profile-invitation-seen', '1'); localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', JSON.stringify(records)); }, { profile, records });
        await page.goto(process.env.APP_URL || 'http://127.0.0.1:8081/');
        await page.getByRole('tab', { name: '切换到数据', exact: true }).click();
        const header = page.getByTestId('training-data-header');
        assert.equal(await header.getByTestId(/^training-day-chart-/).count(), 0);
        assert.equal(await page.getByTestId('today-training-summary').count(), 0);
        assert.equal(await page.getByTestId('profile-training-calendar').count(), 0, 'Records no longer live in Data');
        await page.getByRole('tab', { name: '切换到我的', exact: true }).click();
        assert.equal(await page.getByTestId(/^training-day-chart-/).count(), 0, 'Latest day defaults to collapsed');
        assert.equal(await page.getByTestId('history-day-' + yesterday).count(), 0, 'Older days require View all');
        const chart = page.getByTestId('training-day-summary-' + today);
        await chart.getByRole('button', { name: '展开' + today + '训练历史', exact: true }).click();
        await chart.scrollIntoViewIfNeeded();
        assert.equal(await chart.getByTestId(/^training-day-segment-/).count(), 4);
        assert.equal(await chart.getByTestId('training-day-sets-' + today).innerText(), '10 组');
        assert.equal(await chart.getByTestId('training-day-duration-' + today).innerText(), '32 分钟');
        assert.equal(await chart.getByTestId('training-day-total-squat_05:reps:false:none').innerText(), '48 次');
        assert.equal(await chart.getByTestId('training-day-total-hang_grip_01:seconds:false:none').innerText(), '40 秒');
        assert.equal(await chart.getByTestId(/^training-day-details-/).count(), 0);
        assert.equal(await chart.getByText('✓ 已记录', { exact: true }).count(), 0);
        assert.equal(await chart.getByRole('button', { name: /^查看.*训练明细$/ }).count(), 0);
        assert.equal(await page.getByRole('button', { name: '展开训练记录first', exact: true }).count(), 0, 'Old sentence/list is not the default history presentation');
        const bounds = await chart.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
        assert.equal(await chart.evaluate(node => [...node.querySelectorAll('*')].some(child => child.getBoundingClientRect().right > node.getBoundingClientRect().right + 2)), false, 'No card content overflow');
        await chart.screenshot({ path: `D:/UncoverBuildTools/temp/training-history-card-${width}.png` });
        const before = await page.evaluate(() => localStorage.getItem('sessions'));
        await chart.getByRole('button', { name: '展开悬挂握力当日组次明细', exact: true }).click();
        assert.match(await chart.getByTestId('training-day-details-hang_grip_01:seconds:false:none').innerText(), /40 秒/);
        await page.getByRole('button', { name: '查看全部训练历史', exact: true }).click();
        const older = page.getByTestId('training-day-summary-' + yesterday);
        await older.getByRole('button', { name: '展开' + yesterday + '训练历史', exact: true }).click();
        assert.equal(await chart.getByTestId(/^training-day-chart-/).count(), 0, 'Opening another day collapses the previous day');
        assert.equal(await page.getByTestId(/^training-day-chart-/).count(), 1);
        await older.getByRole('button', { name: '收起' + yesterday + '训练历史', exact: true }).click();
        assert.equal(await page.getByTestId(/^training-day-chart-/).count(), 0);
        await chart.getByRole('button', { name: '展开' + today + '训练历史', exact: true }).click();
        assert.equal(await chart.getByTestId(/^training-day-details-/).count(), 0, 'Reopening does not restore stale action expansion');
        await page.getByRole('button', { name: '关闭全部训练历史', exact: true }).click();
        await page.getByTestId('all-training-history').waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: '查看' + today + '训练记录', exact: true }).click();
        await page.getByRole('button', { name: '展开训练记录first', exact: true }).click();
        await page.getByRole('button', { name: '删除训练记录first', exact: true }).waitFor();
        assert.equal(await page.evaluate(() => localStorage.getItem('sessions')), before, 'Inspection never mutates data');
        await page.getByRole('button', { name: '删除训练记录first', exact: true }).click();
        await page.getByRole('button', { name: '删除记录', exact: true }).click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions')).length === 2);
        assert.equal(await chart.getByTestId('training-day-sets-' + today).innerText(), '4 组');
        assert.equal(await chart.getByTestId(/^training-day-segment-/).count(), 3);
        assert.equal(await chart.getByTestId('training-day-total-squat_05:reps:false:none').innerText(), '24 次');
        await page.getByRole('button', { name: '显示所有训练日期', exact: true }).click();
        await older.getByRole('button', { name: '展开' + yesterday + '训练历史', exact: true }).click();
        assert.ok(!(await older.innerText()).includes('今日训练'));
        assert.equal(await older.getByTestId('training-day-duration-' + yesterday).innerText(), '未记时');
        assert.equal(await older.getByTestId('training-day-sets-' + yesterday).innerText(), '1 组');
        await page.reload(); await page.getByRole('tab', { name: '切换到我的', exact: true }).click();
        assert.equal(await page.getByTestId(/^training-day-chart-/).count(), 0, 'Reload defaults to collapsed');
        await page.getByRole('button', { name: '展开' + today + '训练历史', exact: true }).click();
        assert.equal(await page.getByTestId('training-day-sets-' + today).innerText(), '4 组');
        assert.deepEqual(errors, []);
        console.log(`PASS ${width}px: history only, default collapsed, exclusive day accordion, real distribution/units, details, deletion, older date, missing time, reload`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
