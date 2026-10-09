// Detail-return regression in isolated storage, never the user's browser profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/UncoverBuildTools/browser-tests/node_modules/playwright');
const fixture = fs.readFileSync(require.resolve('./smoke-fitness-flows.cjs'), 'utf8');
const profile = vm.runInNewContext('(' + fixture.match(/const profile = ([\s\S]*?);\r?\n/)[1] + ')');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const width of [390, 739]) {
      const context = await browser.newContext({ viewport: { width, height: 871 }, reducedMotion: 'reduce' });
      try {
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(profile => {
          localStorage.setItem('profile-invitation-seen', '1');
          localStorage.setItem('user_profile', JSON.stringify(profile));
          localStorage.setItem('sessions', '[]');
        }, profile);
        await page.goto(process.env.APP_URL || 'http://127.0.0.1:8081/');
        const stored = await page.evaluate(() => [localStorage.getItem('user_profile'), localStorage.getItem('sessions')]);
        await page.getByRole('tab', { name: '切换到进阶', exact: true }).click();
        await page.getByRole('button', { name: '选择深蹲进阶路线', exact: true }).click();
        const row = page.getByTestId('progression-stage-squat_09');
        await row.scrollIntoViewIfNeeded();
        await page.waitForTimeout(150); // Let the throttled scroll event capture this position.
        const scrollBefore = await page.getByTestId('progression-list').evaluate(node => node.scrollTop);
        assert.ok(scrollBefore > 100, 'Exercise detail should be entered from a scrolled list');
        await row.getByRole('button', { name: /动作指导/ }).click();
        await page.getByRole('button', { name: '返回动作列表', exact: true }).waitFor();
        await page.getByRole('button', { name: '返回动作列表', exact: true }).click();
        await page.getByTestId('progression-screen').waitFor();
        assert.match(await page.getByTestId('progression-current-stage').innerText(), /深蹲/);
        await row.waitFor();
        await page.waitForFunction(expected => Math.abs(document.querySelector('[data-testid="progression-list"]').scrollTop - expected) < 2, scrollBefore);
        assert.equal(await page.getByTestId('progression-stage-push_06').count(), 0, 'Return must not reset to pushups');
        // Repeated entry / return and switching tabs keep the same route.
        await row.getByRole('button', { name: /动作指导/ }).click();
        await page.getByRole('button', { name: '返回动作列表', exact: true }).click();
        await page.getByRole('tab', { name: '切换到今日', exact: true }).click();
        await page.getByRole('tab', { name: '切换到进阶', exact: true }).click();
        assert.match(await page.getByTestId('progression-current-stage').innerText(), /深蹲/);
        // Search-driven selection also survives detail navigation.
        await page.getByRole('button', { name: '搜索动作', exact: true }).click();
        await page.getByTestId('progression-search').fill('悬挂握力');
        await page.getByTestId('progression-current-action').click();
        await page.getByRole('button', { name: '返回动作列表', exact: true }).click();
        assert.equal(await page.getByTestId('progression-search').inputValue(), '悬挂握力');
        assert.equal(await page.getByRole('button', { name: '收起动作搜索', exact: true }).count(), 1);
        assert.match(await page.getByTestId('progression-route-reveal').innerText(), /悬挂握力/);
        assert.deepEqual(await page.evaluate(() => [localStorage.getItem('user_profile'), localStorage.getItem('sessions')]), stored);
        assert.deepEqual(errors, []);
        console.log(`PASS ${width}px: squat detail return, repeat return, tab switch, cross-group search preserved; records unchanged`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
