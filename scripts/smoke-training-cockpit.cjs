const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/UncoverBuildTools/browser-tests/node_modules/playwright');
const fixture = fs.readFileSync(require.resolve('./smoke-fitness-flows.cjs'), 'utf8');
const profile = vm.runInNewContext('(' + fixture.match(/const profile = ([\s\S]*?);\r?\n/)[1] + ')');
profile.experience = 'elite'; profile.frequency = 6;
async function prepare(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(profile => { if (localStorage.getItem('cockpit-smoke-seeded')) return; localStorage.setItem('cockpit-smoke-seeded', '1'); localStorage.setItem('profile-invitation-seen', '1'); localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]'); }, profile);
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByTestId('today-training-content').waitFor();
  await page.getByRole('button', { name: '开始今日训练  →', exact: true }).click();
  await page.getByTestId('training-primary').waitFor();
  return { context, page, errors };
}
const records = page => page.evaluate(() => JSON.parse(localStorage.getItem('sessions')) || []);
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const width of [320, 360, 390, 739]) {
      const { context, page, errors } = await prepare(browser, width);
      try {
        assert.equal((await records(page)).length, 0, 'Opening training never creates a record');
        assert.equal(await page.getByRole('button', { name: '打开 MAX 聊天', exact: true }).count(), 0, 'Training has no header chat or floating assistant');
        await page.getByTestId('training-actual-input').fill('8');
        await page.screenshot({ path: `D:/UncoverBuildTools/temp/training-cockpit-active-${width}.png` });
        await page.getByTestId('training-primary').click();
        await page.getByTestId('training-rest-time').waitFor();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions'))?.[0]?.exercises?.[0]?.sets?.[0]?.reps === 8);
        await page.getByRole('button', { name: '暂停', exact: true }).click();
        await page.getByText('已暂停', { exact: true }).waitFor();
        const time = await page.getByTestId('training-rest-time').innerText();
        await page.waitForTimeout(1100);
        assert.equal(await page.getByTestId('training-rest-time').innerText(), time);
        await page.getByRole('button', { name: '+30 秒', exact: true }).click();
        assert.notEqual(await page.getByTestId('training-rest-time').innerText(), time);
        await page.screenshot({ path: `D:/UncoverBuildTools/temp/training-cockpit-rest-${width}.png` });
        await page.getByRole('button', { name: '结束休息', exact: true }).click();
        assert.match(await page.getByTestId('training-actual-input').getAttribute('aria-label'), /^第2组/);
        await page.getByRole('button', { name: '调整训练组', exact: true }).click();
        await page.getByRole('textbox', { name: /^修改第1组/ }).fill('7');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions'))?.[0]?.totalReps === 7);
        assert.equal(await page.getByRole('checkbox').count(), 0);
        await page.getByRole('button', { name: '关闭训练记录面板', exact: true }).click();
        await page.getByTestId('training-actual-input').fill('6');
        await page.getByTestId('training-primary').click();
        await page.getByRole('button', { name: '结束休息', exact: true }).click();
        await noOverflow(page);
        await page.getByRole('button', { name: '结束训练', exact: true }).click();
        await page.getByRole('button', { name: '记录已完成组', exact: true }).click();
        const summary = page.getByTestId(/^training-day-summary-/); await summary.waitFor();
        assert.equal(await page.getByTestId(/^training-day-chart-/).count(), 0);
        await summary.getByRole('button', { name: /^展开.*训练历史$/ }).click();
        assert.match(await summary.innerText(), /已保存/);
        assert.equal(await summary.getByText('✓ 本次训练已保存', { exact: true }).count(), 0);
        assert.match(await summary.innerText(), /13 次/);
        await summary.getByRole('button', { name: /^展开.*当日组次明细$/ }).first().click();
        assert.match(await summary.innerText(), /7 次/); assert.match(await summary.innerText(), /6 次/);
        const saved = await records(page);
        assert.equal(saved.length, 1); assert.equal(saved[0].completion, 'partial');
        assert.equal(saved[0].quality, undefined, 'No subjective quality is invented after removing feedback');
        assert.equal(await page.getByText('训练感觉如何？', { exact: true }).count(), 0);
        assert.equal(saved[0].exercises[0].sets.length, 2); assert.equal(saved[0].totalReps, 13);
        await page.screenshot({ path: `D:/UncoverBuildTools/temp/training-cockpit-data-${width}.png` });
        const summaryDate = (await summary.getAttribute('data-testid')).replace('training-day-summary-', '');
        await page.getByRole('button', { name: '查看' + summaryDate + '训练记录', exact: true }).click();
        await page.getByRole('button', { name: '展开训练记录' + saved[0].id, exact: true }).click();
            await page.getByRole('button', { name: '删除训练记录' + saved[0].id, exact: true }).waitFor();
        await noOverflow(page);
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await page.getByRole('tab', { name: '切换到我的', exact: true }).click();
        await page.getByRole('button', { name: /^展开.*训练历史$/ }).click();
        assert.match(await page.getByTestId(/^training-day-summary-/).innerText(), /13 次/);
        assert.deepEqual(errors, []);
        console.log(`PASS ${width}px: actual edit/reset/confirm, rest controls, save to My, latest summary/detail and reload persistence`);
      } finally { await context.close(); }
    }
    const { context, page, errors } = await prepare(browser, 390);
    try {
      let safety = 0;
      while ((await page.getByTestId('training-primary').innerText()) !== '保存训练') {
        if (++safety > 70) throw Error('Workout did not finish');
        const primary = page.getByTestId('training-primary'); const label = await primary.innerText();
        if (label === '完成这一组' && await page.getByRole('button', { name: '开始保持计时', exact: true }).count()) {
          const before = (await records(page))[0]?.exercises.flatMap(item => item.sets).length || 0;
          await page.getByTestId('training-actual-input').fill('1');
          await page.getByRole('button', { name: '开始保持计时', exact: true }).click();
          await page.getByTestId('training-rest-time').waitFor({ state: 'hidden' });
          assert.equal((await records(page))[0]?.exercises.flatMap(item => item.sets).length || 0, before, 'Holding timer never records a group automatically');
        }
        if (label === '完成这一组') await page.getByTestId('training-actual-input').fill('9');
        await primary.click();
      }
      await page.getByTestId('training-primary').click();
      await page.getByTestId(/^training-day-summary-/).waitFor();
      const [session] = await records(page);
      assert.equal(session.completion, 'complete');
      assert.equal(session.quality, undefined);
      assert.equal(await page.getByText('训练感觉如何？', { exact: true }).count(), 0);
      const sets = session.exercises.flatMap(item => item.sets);
      assert.ok(sets.length > 2); assert.ok(sets.every(set => set.completed && set.reps === 9));
      await page.getByTestId(/^training-day-summary-/).getByRole('button', { name: /^展开.*训练历史$/ }).click();
      await page.getByTestId(/^training-day-summary-/).waitFor();
      assert.match(await page.getByTestId(/^training-day-summary-/).innerText(), /已保存/);
      assert.deepEqual(errors, []);
      console.log('PASS complete workout: per-action advance, final save, all actual groups and no duplicates');
    } finally { await context.close(); }
    const failure = await prepare(browser, 390);
    try {
      const p = failure.page;
      await p.getByTestId('training-actual-input').fill('8');
      await p.getByTestId('training-primary').click();
      await p.waitForFunction(() => JSON.parse(localStorage.getItem('sessions'))?.[0]?.exercises?.[0]?.sets?.[0]?.reps === 8);
      await p.getByRole('button', { name: '结束休息', exact: true }).click();
      await p.evaluate(() => { window.originalStorageWrite = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'sessions') throw new DOMException('Isolated persistence failure', 'QuotaExceededError'); return window.originalStorageWrite.call(this, key, value); }; });
      await p.getByRole('button', { name: '结束训练', exact: true }).click();
      await p.getByRole('button', { name: '记录已完成组', exact: true }).click();
      await p.getByRole('alert').getByText('保存失败，已完成内容仍在本页，请重试。', { exact: true }).waitFor();
      assert.equal(await p.getByTestId(/^training-day-summary-/).count(), 0, 'No navigation before persistence succeeds');
      assert.equal((await records(p))[0].exercises[0].sets[0].reps, 8);
      await p.evaluate(() => { Storage.prototype.setItem = window.originalStorageWrite; });
      await p.getByRole('button', { name: '结束训练', exact: true }).click();
      await p.getByRole('button', { name: '记录已完成组', exact: true }).click();
      await p.getByTestId(/^training-day-summary-/).waitFor();
      assert.equal((await records(p)).length, 1, 'Retry overwrites one stable record, no duplicate');
      assert.deepEqual(failure.errors, []);
      console.log('PASS persistence failure: stays in training, keeps actual sets, retry saves once and navigates to My');
    } finally { await failure.context.close(); }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
