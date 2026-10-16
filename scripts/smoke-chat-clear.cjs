// Real browser chat flow, mocked model, isolated personal records. No live API or user data.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const baseUrl = process.env.CHAT_QA_URL || 'http://127.0.0.1:8081/';
const withoutContext = value => Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'uncover.agent.conversation.v1'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [320, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 871 } });
      const page = await context.newPage(), requests = [], errors = [];
      page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(() => {
        localStorage.setItem('profile-invitation-seen', '1');
        localStorage.setItem('user_profile', JSON.stringify({ name: 'CLEAR_QA', age: 30, sex: 'male', height: 175, weight: 75, goal: 'street_mastery', frequency: 2, experience: 'beginner', levels: {}, planStartedAt: new Date().toISOString() }));
        localStorage.setItem('uncover.agent.connection.v1', JSON.stringify({ version: 1, mode: 'personal', provider: 'deepseek', model: 'deepseek-flash', deepseekKey: 'sk-isolated-clear-fixture' }));
      });
      let fail = false;
      await context.route('**/*', route => {
        const url = route.request().url();
        if (!url.startsWith('https://api.deepseek.com/')) return url.startsWith(baseUrl) || /^(data:|blob:)/.test(url) ? route.continue() : route.abort();
        requests.push(route.request().postDataJSON());
        if (fail) return route.fulfill({ status: 503, json: {} });
        const content = 'QA 回复 ' + requests.length;
        return route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n` });
      });
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '打开 MAX 聊天', exact: true }).click();
      const input = page.getByLabel('聊天输入', { exact: true });
      const send = page.getByRole('button', { name: '发送聊天消息', exact: true });
      await input.fill('旧对话标记 OLD_CONTEXT'); await send.click();
      await page.getByText('QA 回复 1', { exact: true }).waitFor();
      const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
      await input.fill(' /CLEAR '); await send.click();
      await page.getByTestId('chat-context-notice').waitFor();
      assert.equal(requests.length, 1, 'Clear never sends a request');
      assert.equal(await page.getByText('QA 回复 1', { exact: true }).count(), 0);
      assert.equal(await page.getByText('旧对话标记 OLD_CONTEXT', { exact: true }).count(), 0);
      assert.equal(await input.inputValue(), '');
      const cleared = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
      assert.equal(cleared['uncover.agent.conversation.v1'], undefined, 'Clear removes only the common conversation context');
      assert.deepEqual(withoutContext(cleared), withoutContext(before), 'Clear preserves every persistent domain and memory');
      await input.fill('新问题 NEW_CONTEXT'); await send.click();
      await page.getByText('QA 回复 2', { exact: true }).waitFor();
      assert.deepEqual(requests[1].messages.filter(row => row.role !== 'system'), [{ role: 'user', content: '新问题 NEW_CONTEXT' }]);
      assert.doesNotMatch(JSON.stringify(requests[1].messages), /OLD_CONTEXT|QA 回复 1|\/clear/i);
      assert.equal(await page.getByTestId('chat-context-notice').count(), 0);
      // An unreadable attachment and a failed model reply must not block local clearing.
      fail = true;
      await input.fill('失败消息'); await send.click(); await page.getByRole('alert').waitFor();
      await page.getByRole('button', { name: '添加聊天附件', exact: true }).click();
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: '选择附件文件', exact: true }).click();
      await (await chooser).setFiles({ name: 'unsupported.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not-supported') });
      await page.getByText('读取失败', { exact: false }).waitFor();
      await page.getByRole('button', { name: '完成附件选择', exact: true }).click();
      await input.fill('清空上下文');
      assert.equal(await send.isDisabled(), false); await send.click();
      await page.getByTestId('chat-context-notice').waitFor();
      assert.equal(requests.length, 3);
      assert.equal(await page.getByRole('alert').count(), 0);
      assert.equal(await page.getByTestId('chat-pending-files').count(), 0);
      assert.equal(await page.getByText('QA 回复 2', { exact: true }).count(), 0);
      assert.deepEqual(withoutContext(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))), withoutContext(before));
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS /clear + Chinese alias + new context isolation + bad attachment + failure + storage preservation ${width}px`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
