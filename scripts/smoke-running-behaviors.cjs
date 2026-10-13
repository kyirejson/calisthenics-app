// Isolated synthetic-speed browser QA. No user tab, API key or real sensor is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-map.cjs'), 'utf8').split('(async () => {')[0].replace('speed: null', 'speed: window.qaSpeed ?? null');
const { chromium, prepare, emit, finish } = vm.runInNewContext(prefix + ';({chromium,prepare,emit,finish})', { require, process, console, Buffer, setTimeout, clearTimeout });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const width of [320, 390]) {
      const { context, page, errors } = await prepare(browser, width, 844);
      await page.evaluate(() => {
        window.qaSpoken = []; window.qaSpeed = 3;
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ lang: 'zh-CN' }], cancel: () => {}, speak: message => window.qaSpoken.push(message.text) } });
        window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      });
      await page.getByRole('button', { name: '打开跑步设置', exact: true }).click();
      await page.getByRole('switch', { name: '自动暂停', exact: true }).click();
      assert.equal(await page.getByRole('switch', { name: '语音播报', exact: true }).getAttribute('aria-checked'), 'true');
      assert.equal(await page.getByRole('switch', { name: '室内计步', exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: '保存跑步设置', exact: true }).click();
      await page.getByRole('button', { name: '开始跑步', exact: true }).click();
      await page.getByText('正在跑步', { exact: true }).waitFor();
      await emit(page, 0, 1); await emit(page, 10, 3);
      await page.evaluate(() => { window.qaSpeed = 0; });
      for (let i = 0; i <= 8; i++) await emit(page, 10, 1);
      await page.getByText('已自动暂停', { exact: true }).waitFor();
      await page.evaluate(() => { window.qaSpeed = 3; });
      for (let i = 0; i <= 3; i++) await emit(page, 1000 + i * 3, 1);
      await page.getByText('正在跑步', { exact: true }).waitFor();
      await emit(page, 1019, 3);
      await page.getByRole('button', { name: '暂停跑步', exact: true }).click();
      await emit(page, 3000, 60);
      await page.getByText('跑步已暂停', { exact: true }).waitFor();
      const spoken = await page.evaluate(() => window.qaSpoken);
      assert.ok(spoken.includes('开始跑步')); assert.ok(spoken.includes('已自动暂停，重新跑动后继续')); assert.ok(spoken.includes('已自动继续跑步'));
      await finish(page);
      const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('sessions')));
      assert.equal(sessions.length, 1); assert.ok(sessions[0].distanceKm >= .019 && sessions[0].distanceKm <= .021);
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`PASS running settings, automatic pause/recovery, manual pause, speech and saved distance at ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
