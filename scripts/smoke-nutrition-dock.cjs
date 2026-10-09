// Synthetic profile and isolated browser; no real account, files or API requests.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [320, 390, 607, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 871 }, hasTouch: true });
      const page = await context.newPage(), errors = [];
      page.setDefaultTimeout(30000);
      page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(() => {
        localStorage.setItem('profile-invitation-seen', '1');
        localStorage.setItem('user_profile', JSON.stringify({ name: 'DOCK_QA', age: 30, sex: 'male', height: 175, weight: 75, goal: 'street_mastery', frequency: 2, experience: 'beginner', levels: {}, planStartedAt: new Date().toISOString() }));
      });
      await context.route('**/*', route => /^(http:\/\/127\.0\.0\.1:8081\/|data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort());
      await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded' });
      await page.getByRole('tab', { name: '切换到饮食', exact: true }).click();
      await page.getByText('今日饮食', { exact: true }).waitFor();
      assert.equal(await page.getByText('计算与知识依据', { exact: true }).count(), 0);
      const dock = page.getByRole('button', { name: '打开 DeepSeek 聊天', exact: true });
      const before = await dock.boundingBox();
      await page.mouse.move(before.x + 27, before.y + 27);
      await page.mouse.down();
      // Move well outside the button: pointer capture must keep the drag alive.
      await page.mouse.move(35, 230, { steps: 12 });
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelector('[aria-label="打开 DeepSeek 聊天"]')?.getBoundingClientRect().x === 16);
      const left = await dock.boundingBox();
      assert.ok(Math.abs(left.y - before.y) > 50);
      assert.equal(await page.getByLabel('聊天输入', { exact: true }).count(), 0, 'drag must not open chat');
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: left.x + 27, y: left.y + 27, id: 1 }] });
      for (let step = 1; step <= 12; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: left.x + 27 + (width - 40 - left.x - 27) * step / 12, y: left.y + 27 + (600 - left.y - 27) * step / 12, id: 1 }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(() => document.querySelector('[aria-label="打开 DeepSeek 聊天"]')?.getBoundingClientRect().x === window.innerWidth - 70);
      assert.equal(await page.getByLabel('聊天输入', { exact: true }).count(), 0, 'touch drag must not open chat');
      await dock.tap();
      await page.getByLabel('聊天输入', { exact: true }).waitFor();
      await page.getByRole('button', { name: '关闭 DeepSeek 聊天', exact: true }).click();
      await dock.focus(); await dock.press('Enter');
      await page.getByLabel('聊天输入', { exact: true }).waitFor();
      await page.getByRole('button', { name: '关闭 DeepSeek 聊天', exact: true }).click();
      await dock.click();
      await page.getByLabel('聊天输入', { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS nutrition cleanup + mouse/touch drag, tap, click and keyboard ${width}px`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
