// Reuse the same isolated GPS/storage fixture as the running regression suite.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('./smoke-running-map.cjs'), 'utf8').split('(async () => {')[0];
const { chromium, prepare, start } = vm.runInNewContext(source + ';({chromium,prepare,start})', { require, process, console });
(async () => {
 const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
 const { context, page, errors } = await prepare(browser);
 try {
  await page.getByRole('button', { name: '设置跑步目标', exact: true }).click(); await page.getByRole('radio', { name: '5 公里' }).click();
  await page.getByRole('button', { name: '开始跑步', exact: true }).click(); await page.getByTestId('run-countdown').waitFor(); await page.getByRole('button', { name: '取消开始跑步', exact: true }).click();
  assert.equal(await page.getByTestId('run-countdown').count(), 0); assert.equal(await page.getByRole('button', { name: '进入跑步全屏', exact: true }).count(), 0);
  await start(page); await page.getByRole('button', { name: '进入跑步全屏', exact: true }).click();
  const focus = page.getByTestId('run-focus'); await focus.waitFor();
  await focus.getByRole('button', { name: '锁定跑步屏幕', exact: true }).click();
  const unlock = page.getByRole('button', { name: '长按解锁跑步屏幕', exact: true }); await unlock.click(); assert.equal(await page.getByTestId('run-touch-lock').count(), 1);
  const box = await unlock.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(1100); await page.mouse.up(); await page.getByTestId('run-touch-lock').waitFor({ state: 'hidden' });
  await focus.getByRole('button', { name: '暂停跑步', exact: true }).click(); await focus.getByText('跑步已暂停', { exact: true }).waitFor(); await focus.getByRole('button', { name: '继续跑步', exact: true }).click();
  await focus.getByRole('button', { name: '退出跑步全屏，继续记录', exact: true }).click(); await focus.waitFor({ state: 'hidden' });
  await page.evaluate(() => { window.qaGps.emit(0, 3); for (let i = 1; i <= 220; i++) window.qaGps.emit(i * 10, 3); });
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="run-distance"]').textContent) > 2.1);
  await page.getByRole('button', { name: '结束并保存跑步', exact: true }).click(); await page.getByRole('button', { name: '结束并保存', exact: true }).click();
  await page.getByRole('button', { name: '关闭跑步总结', exact: true }).waitFor(); assert.equal(await page.getByTestId('run-splits').count(), 1);
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('sessions'))[0]); assert.equal(record.runSplits.length, 2); assert.ok(record.runSplits.every(split => split.seconds > 0));
  await page.waitForTimeout(400); await page.screenshot({ path: 'D:/UncoverBuildTools/temp/running-browser-qa/run-summary-upgraded.png' });
  await page.getByRole('button', { name: '关闭跑步总结', exact: true }).click(); assert.equal(errors.length, 0);
  console.log('PASS running goals, cancellable countdown, full-screen pause/resume, hold-only unlock, real kilometre splits and saved receipt');
 } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
