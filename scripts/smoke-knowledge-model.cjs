const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } }),
      page = await context.newPage(),
      errors = [];
    let round = 0,
      path;
    page.on('pageerror', (error) => errors.push(error.message));
    await context.addInitScript(() => localStorage.setItem('profile-invitation-seen', '1'));
    const call = (id, name, args) => ({
      role: 'assistant',
      content: null,
      tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
    });
    await context.route('https://api.deepseek.com/**', async (route) => {
      const body = route.request().postDataJSON();
      let message,
        finish_reason = 'tool_calls';
      if (body.response_format) {
        finish_reason = 'stop';
        message = { role: 'assistant', content: '{"ok":true}' };
      } else {
        assert.ok(body.tools.some((t) => t.function.name === 'read_knowledge_note'));
        const result =
          body.messages.at(-1).role === 'tool' ? JSON.parse(body.messages.at(-1).content) : null;
        if (round++ === 0) message = call('list', 'list_knowledge_libraries', {});
        else if (round === 2) {
          assert.ok(result.libraries.some((library) => library.libraryId === 'prisoner'));
          message = call('search', 'search_knowledge', { libraryId: 'prisoner', query: '俯卧撑' });
        } else if (round === 3) {
          assert.ok(result.total > 0);
          path = result.results[0].path;
          message = call('read', 'read_knowledge_note', { libraryId: 'prisoner', path });
        } else {
          assert.equal(result.path, path);
          assert.equal(result.complete, true);
          assert.ok(result.markdown.includes('俯卧撑'));
          assert.ok(result.markdown.length > 1000);
          finish_reason = 'stop';
          message = { role: 'assistant', content: '已读取囚徒健身原文。' };
        }
      }
      if (body.stream) {
        const delta = message.tool_calls
          ? {
              role: 'assistant',
              tool_calls: message.tool_calls.map((call, index) => ({ ...call, index })),
            }
          : { role: 'assistant', content: message.content };
        await route.fulfill({
          contentType: 'text/event-stream',
          body: `data: ${JSON.stringify({ choices: [{ delta, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason }] })}\n\ndata: [DONE]\n\n`,
        });
      } else await route.fulfill({ json: { choices: [{ finish_reason, message }] } });
    });
    await page.goto('http://127.0.0.1:8081/');
    await page.getByRole('button', { name: '打开 DeepSeek 聊天', exact: true }).click();
    await page.getByRole('button', { name: '打开服务设置', exact: true }).click();
    await page.getByLabel('个人 DeepSeek 密钥', { exact: true }).fill('sk-isolated-knowledge');
    await page.getByRole('button', { name: '保存并连接', exact: true }).click();
    await page.getByText('已连接', { exact: true }).waitFor();
    await page.getByRole('button', { name: '关闭服务设置', exact: true }).click();
    await page.getByLabel('聊天输入', { exact: true }).fill('读取囚徒健身中俯卧撑的资料');
    await page.getByRole('button', { name: '发送聊天消息', exact: true }).click();
    await page.getByText('已读取囚徒健身原文。', { exact: true }).waitFor();
    assert.equal(round, 4);
    assert.deepEqual(errors, []);
    console.log('PASS streaming chat tool loop lists/searches/reads real local knowledge text');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
