// Isolated browser fixtures only; never edits the user's browser profile or data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-map.cjs'), 'utf8').split('(async () => {')[0];
const { chromium, prepare } = vm.runInNewContext(prefix + ';({chromium,prepare})', { require, process, console, Buffer, setTimeout, clearTimeout });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [width, height] of [[390, 844], [320, 780], [607, 871], [390, 600]]) {
      const { context, page, errors } = await prepare(browser, width, height);
      await page.getByRole('tab', { name: '切换到我的', exact: true }).click();
      await page.getByTestId('profile-identity-panel').waitFor();
      const before = await page.evaluate(() => ({ profile: localStorage.getItem('user_profile'), sessions: localStorage.getItem('sessions') }));
      assert.equal(await page.getByText('应用与隐私', { exact: true }).count(), 1);
      assert.equal(await page.getByText('累计训练', { exact: true }).count(), 1);
      assert.equal(await page.getByText('DeepSeek 助手', { exact: true }).count(), 1);
      assert.equal(await page.getByText('数据与隐私', { exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const identity = await page.getByTestId('profile-identity-panel').boundingBox();
      const count = await page.getByTestId('profile-training-count').boundingBox();
      assert.ok(count.y >= identity.y && count.y + count.height <= identity.y + identity.height, 'Statistics belong inside the identity panel');
      const footer = await page.getByTestId('profile-footer').boundingBox();
      const nav = await page.getByRole('tab', { name: '切换到我的', exact: true }).boundingBox();
      await page.screenshot({ path: `D:/UncoverBuildTools/temp/profile-template-${width}-${height}.png` });
      if (height >= 780) assert.ok(footer.y + footer.height < nav.y, 'Full profile fits above the fixed navigation: ' + JSON.stringify({ footer, nav, identity }));
      await page.getByRole('button', { name: '编辑个人档案', exact: true }).click();
      await page.getByLabel('年龄', { exact: true }).waitFor(); await page.getByRole('button', { name: '取消', exact: true }).click();
      await page.getByRole('button', { name: '训练专题', exact: true }).click();
      await page.getByTestId('profile-goal-sheet').waitFor(); await page.getByRole('button', { name: '关闭训练专题选择', exact: true }).click();
      await page.getByRole('button', { name: 'DeepSeek 聊天', exact: true }).click();
      await page.getByRole('button', { name: '关闭 DeepSeek 聊天', exact: true }).click();
      await page.getByRole('button', { name: '清除本机数据', exact: true }).click();
      await page.getByRole('button', { name: '取消', exact: true }).click();
      assert.deepEqual(await page.evaluate(() => ({ profile: localStorage.getItem('user_profile'), sessions: localStorage.getItem('sessions') })), before);
      assert.deepEqual([...errors], []); await context.close();
      console.log(`PASS profile template ${width}x${height}: layout, edit, goal, chat, destructive cancel, unchanged data`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
