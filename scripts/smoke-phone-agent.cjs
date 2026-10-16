// Isolated browser UI + actual formal Agent loop. No native-phone success is simulated.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const baseUrl = process.env.CHAT_QA_URL || 'http://127.0.0.1:8081/';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [320, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 871 } });
      const page = await context.newPage(), errors = []; let count = 0;
      page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(() => {
        localStorage.setItem('profile-invitation-seen', '1');
        localStorage.setItem('uncover.agent.connection.v1', JSON.stringify({ version: 1, mode: 'personal', provider: 'deepseek', model: 'deepseek-flash', deepseekKey: 'sk-isolated-phone-fixture' }));
      });
      await context.route('**/*', route => {
        const url = route.request().url();
        if (!url.startsWith('https://api.deepseek.com/')) return url.startsWith(baseUrl) || /^(data:|blob:)/.test(url) ? route.continue() : route.abort();
        const request = route.request().postDataJSON();
        assert.ok(request.tools.some(row => row.function.name === 'phone_gesture'));
        const reply = count++ === 0 ? { tool_calls: [{ index: 0, id: 'actual-status', type: 'function', function: { name: 'read_phone_status', arguments: '{}' } }] }
          : { content: '浏览器不能操作手机，请安装新版 Android APK。' };
        if (count === 2) {
          const actual = JSON.parse(request.messages.at(-1).content);
          assert.equal(actual.native, false); assert.equal(actual.code, 'native_required'); assert.equal(actual.enabled, false);
        }
        return route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: reply, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: reply.tool_calls ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n` });
      });
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '打开 MAX 聊天', exact: true }).click();
      await page.getByRole('button', { name: '打开服务设置', exact: true }).click();
      const toggle = page.getByRole('switch', { name: 'MAX 通用手机控制', exact: true });
      await toggle.scrollIntoViewIfNeeded(); assert.equal(await toggle.isDisabled(), true); assert.equal(await toggle.isChecked(), false);
      await page.getByText('MAX · 手机控制', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '开启 MAX 手机无障碍控制', exact: true }).count(), 0);
      assert.ok(await page.getByText('控件不足时可由 MAX 按需调用本机截图识字', { exact: false }).count());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByRole('button', { name: '关闭服务设置', exact: true }).click();
      await page.getByLabel('聊天输入', { exact: true }).fill('请打开手机上的一个应用');
      await page.getByRole('button', { name: '发送聊天消息', exact: true }).click();
      await page.getByText('浏览器不能操作手机，请安装新版 Android APK。', { exact: true }).waitFor();
      assert.equal(count, 2); assert.deepEqual(errors, []);
      await context.close(); console.log(`PASS ${width}px phone settings + opt-in off + real native_required through formal model/tool loop; no fake phone execution`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
