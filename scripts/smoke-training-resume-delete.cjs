const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require('D:/UncoverBuildTools/browser-tests/node_modules/playwright');
const fixture = fs.readFileSync(require.resolve('./smoke-fitness-flows.cjs'), 'utf8');
const profile = vm.runInNewContext('(' + fixture.match(/const profile = ([\s\S]*?);\r?\n/)[1] + ')');
profile.experience = 'elite'; profile.frequency = 6;
(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
 const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
 try {
  const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-08T10:00:00+08:00'));
  await page.addInitScript(profile => { if (localStorage.getItem('resume-qa')) return; localStorage.setItem('resume-qa', '1'); localStorage.setItem('profile-invitation-seen', '1'); localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]'); }, profile);
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('button', { name: '开始今日训练  →', exact: true }).click();
  // Start from squat even if the generated course puts pull first.
  await page.getByRole('button', { name: '选择训练动作', exact: true }).click(); await page.getByRole('button', { name: '切换动作：标准深蹲', exact: true }).click();
  await page.getByTestId('training-actual-input').fill('10'); await page.getByTestId('training-primary').click();
  await page.getByRole('button', { name: '结束休息', exact: true }).click();
  await page.getByRole('button', { name: '调整训练组', exact: true }).click();
  assert.equal(await page.getByRole('checkbox').count(), 0);
  await page.getByRole('textbox', { name: /^修改第1组/ }).fill('12');
  await page.getByRole('button', { name: '关闭训练记录面板', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions'))?.[0]?.totalReps === 12);
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('sessions'))[0].id);
  await page.getByRole('button', { name: '保存并退出训练', exact: true }).click();
  await page.getByRole('button', { name: '保存并退出', exact: true }).click();
  assert.match(await page.getByTestId('today-completed-squat_05').innerText(), /已完成 1/);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await page.getByRole('button', { name: '继续今日训练  →', exact: true }).click();
  await page.getByRole('button', { name: '选择训练动作', exact: true }).click(); await page.getByRole('button', { name: '切换动作：标准深蹲', exact: true }).click();
  assert.match(await page.getByTestId('training-actual-input').getAttribute('aria-label'), /第2组/);
  await page.getByTestId('training-actual-input').fill('8'); await page.getByTestId('training-primary').click();
  await page.getByRole('button', { name: '保存并退出训练', exact: true }).click(); await page.getByRole('button', { name: '保存并退出', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sessions')));
  assert.equal(saved.length, 1); assert.equal(saved[0].id, id); assert.equal(saved[0].totalReps, 20);
  await page.getByRole('tab', { name: '切换到数据', exact: true }).click();
  await page.getByRole('button', { name: /^展开.*训练历史$/ }).click();
  await page.getByRole('button', { name: '删除2026-10-08全部训练记录', exact: true }).click();
  await page.getByRole('button', { name: '删除当日全部记录', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions')).length === 0);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await page.getByRole('tab', { name: '切换到数据', exact: true }).click(); assert.equal(await page.getByTestId(/^training-day-summary-/).count(), 0);
  await page.getByRole('tab', { name: '切换到今日', exact: true }).click(); assert.equal(await page.getByRole('button', { name: '继续今日训练  →', exact: true }).count(), 0);
  await page.getByRole('tab', { name: '切换到我的', exact: true }).click();
  for (const label of ['训练日历', '饮食与营养', '导出数据备份', '知识库']) assert.equal(await page.getByRole('button', { name: label, exact: true }).count(), 0);
  assert.equal(await page.getByText('震动反馈', { exact: true }).count(), 0);
  assert.deepEqual(errors, []); console.log('PASS partial squat exit/reload/resume, direct edit without rechecking, same-ID totals, whole-day deletion and Profile pruning');
 } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
