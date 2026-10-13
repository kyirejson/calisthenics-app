// Reproduce through the real repeat button, in isolated browser storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/UncoverBuildTools/browser-tests/node_modules/playwright');
const fixture = fs.readFileSync(require.resolve('./smoke-fitness-flows.cjs'), 'utf8');
const profile = vm.runInNewContext('(' + fixture.match(/const profile = ([\s\S]*?);\r?\n/)[1] + ')');
profile.experience = 'elite'; profile.frequency = 6;
async function finish(page, actual) {
  for (let step = 0; step < 80; step++) {
    const primary = page.getByTestId('training-primary');
    const label = await primary.innerText();
    if (label === '保存训练') {
      await primary.click();
      const summary = page.getByTestId(/^training-day-summary-/);
      await summary.waitFor();
      assert.equal(await page.getByTestId(/^training-day-chart-/).count(), 0, 'Saving does not force history open');
      await summary.getByRole('button', { name: /^展开.*训练历史$/ }).click(); return;
    }
    if (label === '完成这一组') await page.getByTestId('training-actual-input').fill(String(actual));
    await primary.click();
  }
  throw Error('Workout never reached final save');
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
  try {
    const page = await context.newPage(); const errors = [];
    // A Thursday pull/squat course is part of this fixture; do not depend on today's weekday.
    await page.clock.setFixedTime(new Date('2026-10-08T10:00:00+08:00'));
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(profile => { if (localStorage.getItem('repeat-test-seeded')) return; localStorage.setItem('repeat-test-seeded', '1'); localStorage.setItem('profile-invitation-seen', '1'); localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]'); }, profile);
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('button', { name: '开始今日训练  →', exact: true }).click();
    await finish(page, 9);
    const first = await page.evaluate(() => JSON.parse(localStorage.getItem('sessions')));
    assert.equal(first.length, 1);
    const exercised = first[0].exercises.find(item => item.category === 'pull');
    const firstTotal = exercised.sets.reduce((sum, set) => sum + set.reps, 0);
    await page.getByRole('button', { name: '查看引体向上进步记录', exact: true }).click();
    await page.getByRole('button', { name: '查看当日总量曲线', exact: true }).click();
    assert.match(await page.getByTestId('performance-tooltip').innerText(), new RegExp(`\\b${firstTotal} 次`));
    console.log('First chart:', await page.getByTestId('performance-tooltip').innerText());
    await page.getByRole('tab', { name: '切换到今日', exact: true }).click();
    await page.getByRole('button', { name: '再练一次', exact: true }).click();
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('sessions')))).length, 1, 'Opening repeat alone neither erases nor adds training');
    await finish(page, 6);
    const second = await page.evaluate(() => JSON.parse(localStorage.getItem('sessions')));
    assert.equal(second.length, 2, 'Repeat preserves both distinct training sessions');
    assert.notEqual(second[0].id, second[1].id);
    const total = second.flatMap(session => session.exercises).filter(item => item.exerciseId === exercised.exerciseId).flatMap(item => item.sets).reduce((sum, set) => sum + set.reps, 0);
    console.log('Saved sessions and expected total:', second.length, total);
    // Must return to the same action and daily-total metric, not silently reset to best.
    assert.equal(await page.getByRole('button', { name: '查看引体向上进步记录', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.match(await page.getByTestId('performance-tooltip').innerText(), new RegExp(`\\b${total} 次`));
    assert.ok(!(await page.getByTestId('unified-progress-card').innerText()).includes('2 次训练'));
    const summary = page.getByTestId(/^training-day-summary-/);
    assert.match(await summary.innerText(), /2 次训练/);
    const actionTotal = summary.getByTestId(`training-day-total-${exercised.exerciseId}:reps:false:none`);
    assert.equal(await actionTotal.innerText(), `${total} 次`);
    // A third repeat with only one completed group must accumulate too.
    await page.getByRole('tab', { name: '切换到今日', exact: true }).click();
    await page.getByRole('button', { name: '再练一次', exact: true }).click();
    await page.getByTestId('training-actual-input').fill('5');
    await page.getByTestId('training-primary').click();
    await page.getByRole('button', { name: '结束休息', exact: true }).click();
    await page.getByRole('button', { name: '结束训练', exact: true }).click();
    await page.getByRole('button', { name: '记录已完成组', exact: true }).click();
    await page.getByTestId(/^training-day-summary-/).waitFor();
    await page.getByRole('button', { name: /^展开.*训练历史$/ }).click();
    assert.match(await page.getByTestId('performance-tooltip').innerText(), new RegExp(`\\b${total + 5} 次`));
    assert.equal(await actionTotal.innerText(), `${total + 5} 次`);
    const third = (await page.evaluate(() => JSON.parse(localStorage.getItem('sessions')))).find(session => !first.some(old => old.id === session.id) && !second.some(old => old.id === session.id));
    assert.ok(third && third.completion === 'partial');
    const summaryDate = (await summary.getAttribute('data-testid')).replace('training-day-summary-', '');
    await page.getByRole('button', { name: '查看' + summaryDate + '训练记录', exact: true }).click();
    await page.getByRole('button', { name: '展开训练记录' + third.id, exact: true }).click();
    await page.getByRole('button', { name: '删除训练记录' + third.id, exact: true }).click();
    await page.getByRole('button', { name: '删除记录', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions')).length === 2);
    assert.match(await page.getByTestId('performance-tooltip').innerText(), new RegExp(`\\b${total} 次`));
    assert.equal(await actionTotal.innerText(), `${total} 次`);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await page.getByRole('tab', { name: '切换到数据', exact: true }).click();
    await page.getByRole('button', { name: '查看引体向上进步记录', exact: true }).click();
    await page.getByRole('button', { name: '查看当日总量曲线', exact: true }).click();
    assert.match(await page.getByTestId('performance-tooltip').innerText(), new RegExp(`\\b${total} 次`));
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('sessions')))).length, 2);
    assert.deepEqual(errors, []);
    console.log('PASS real repeat button: complete + partial repeats accumulate, deletion subtracts only its own record, retained chart choice, reload persistence');
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
