// Isolated browser fixture: old records remain; no-distance runs do not create new ones.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/UncoverBuildTools/browser-tests/node_modules/playwright');
const source = fs.readFileSync(require.resolve('./smoke-fitness-flows.cjs'), 'utf8');
const profile = vm.runInNewContext('(' + source.match(/const profile = ([\s\S]*?);\r?\n/)[1] + ')');
const stamp = new Date(Date.now() - 60000).toISOString();
const legacy = [0, 1].map(index => ({ id: 'legacy-timer-' + index, workoutId: 'outdoor_running', workoutName: '旧仅计时记录', startedAt: stamp, completedAt: stamp, durationSeconds: 30, exercises: [], totalReps: 0, kind: 'running', runMode: 'outdoor', completion: 'complete', distanceSource: 'unmeasured' }));
const storage = page => page.evaluate(() => localStorage.getItem('sessions'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const [width, height] of [[320, 600], [390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
      try {
        await context.addInitScript(({ profile, legacy }) => {
          if (!localStorage.getItem('empty-run-history-qa')) { localStorage.setItem('empty-run-history-qa', '1'); localStorage.setItem('profile-invitation-seen', '1'); localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', JSON.stringify(legacy)); }
          Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { watchPosition(success, fail) { setTimeout(() => fail({ code: 1 }), 0); return 1; }, getCurrentPosition(success, fail) { setTimeout(() => fail({ code: 1 }), 0); }, clearWatch() {} } });
        }, { profile, legacy });
        const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message)); page.setDefaultTimeout(30000);
        await page.route('https://tile.openstreetmap.org/**', route => route.abort());
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded' });
        const before = await storage(page);
        await page.getByRole('tab', { name: '切换到数据', exact: true }).click();
        assert.equal(await page.getByTestId('running-statistics-note').count(), 0);
        assert.equal(await storage(page), before, 'Legacy records are preserved, not silently deleted');
        await page.getByRole('tab', { name: '切换到今日', exact: true }).click(); await page.getByRole('tab', { name: '切换到跑步', exact: true }).click();
        await page.getByRole('button', { name: '开始跑步', exact: true }).click(); await page.getByRole('button', { name: '暂停跑步', exact: true }).waitFor();
        await page.getByRole('button', { name: '进入跑步全屏', exact: true }).click();
        await page.getByTestId('run-focus').getByRole('button', { name: '结束并保存跑步', exact: true }).click(); await page.getByRole('button', { name: '结束跑步', exact: true }).click();
        await page.getByTestId('run-completion-notice').waitFor(); await page.getByTestId('run-focus').waitFor({ state: 'hidden' });
        assert.equal(await storage(page), before); assert.equal(await page.getByText('跑步已保存', { exact: true }).count(), 0);
        assert.equal(await page.evaluate(() => localStorage.getItem('uncover.running.web-journal.v2')), null);
        for (const input of ['', '0']) {
          await page.getByRole('button', { name: '选择室内跑', exact: true }).click(); await page.getByRole('button', { name: '开始跑步', exact: true }).click();
          await page.getByRole('button', { name: '暂停跑步', exact: true }).waitFor();
          await page.getByRole('button', { name: '结束并保存跑步', exact: true }).click();
          await page.getByRole('textbox', { name: '室内跑距离（公里，可选）', exact: true }).fill(input);
          await page.getByRole('button', { name: '保存室内跑', exact: true }).click(); await page.getByTestId('run-completion-notice').waitFor();
          assert.equal(await storage(page), before); assert.equal(await page.getByText('跑步已保存', { exact: true }).count(), 0);
        }
        await page.getByRole('button', { name: '开始跑步', exact: true }).click(); await page.getByRole('button', { name: '暂停跑步', exact: true }).waitFor();
        await page.getByRole('button', { name: '结束并保存跑步', exact: true }).click();
        await page.getByRole('textbox', { name: '室内跑距离（公里，可选）', exact: true }).fill('2.5');
        await page.getByRole('button', { name: '保存室内跑', exact: true }).click(); await page.getByText('跑步已保存', { exact: true }).waitFor();
        const after = JSON.parse(await storage(page)); assert.equal(after.length, 3); assert.equal(after.find(row => !row.id.startsWith('legacy-')).distanceKm, 2.5);
        assert.deepEqual(after.filter(row => row.id.startsWith('legacy-')), legacy); assert.deepEqual(errors, []);
        console.log(`PASS ${width}x${height}: legacy records unchanged, no timer-only statistics, outdoor/fullscreen and empty/zero indoor runs end without history, positive indoor distance saves normally`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
