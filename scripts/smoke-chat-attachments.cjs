// Isolated fake credentials, synthetic files and mocked responses; never sends user files.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fixtures = require('./chat-file-fixtures.cjs');
const output = process.env.CHAT_QA_OUTPUT || 'D:/UncoverBuildTools/temp/chat-ui-template';
const baseUrl = process.env.CHAT_QA_URL || 'http://127.0.0.1:8081/';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [320, 390, 607]) {
      const context = await browser.newContext({ viewport: { width, height: 871 } }), page = await context.newPage(), errors = [], requests = [];
      page.setDefaultTimeout(45000); page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(() => {
        localStorage.setItem('profile-invitation-seen', '1');
        localStorage.setItem('user_profile', JSON.stringify({ name: 'CHAT_QA', age: 30, sex: 'male', height: 175, weight: 75, goal: 'street_mastery', frequency: 2, experience: 'beginner', levels: {}, planStartedAt: new Date().toISOString() }));
        localStorage.setItem('uncover.agent.connection.v1', JSON.stringify({ version: 1, mode: 'personal', provider: 'deepseek', model: 'deepseek-flash', deepseekKey: 'sk-isolated-chat-fixture' }));
      });
      let fail = true;
      await context.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith('https://api.deepseek.com/')) {
          const body = route.request().postDataJSON(); requests.push(body);
          if (fail) { fail = false; return route.fulfill({ status: 503, json: { error: { message: 'synthetic retry test' } } }); }
          const content = '## 已阅读文字\n附件正文已进入这次消息。\n\n- 保留原文\n- 可继续讨论';
          // Chat requests SSE; match the actual protocol rather than return non-stream JSON.
          return body.stream ? route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n` }) : route.fulfill({ json: { choices: [{ finish_reason: 'stop', message: { content } }] } });
        }
        return url.startsWith(baseUrl) || /^(data|blob):/.test(url) ? route.continue() : route.abort();
      });
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '打开 DeepSeek 聊天', exact: true }).click();
      await page.getByLabel('聊天输入').waitFor();
      await page.waitForFunction(() => document.querySelector('[aria-label="关闭 DeepSeek 聊天"]').getBoundingClientRect().top <= 10);
      await page.screenshot({ path: path.join(output, `welcome-${width}.png`) });
      const input = page.getByLabel('聊天输入');
      const composer = page.getByTestId('chat-composer');
      assert.equal(await page.getByText(/支持 PDF|PDF · DOCX · TXT · MD/).count(), 0);
      assert.equal(await input.evaluate(node => getComputedStyle(node).fontSize), '16px', 'Phone-friendly input type does not trigger iOS small-font zoom');
      assert.equal(await page.getByRole('button', { name: '发送聊天消息', exact: true }).isDisabled(), true);
      await input.fill('第一行');
      await input.press('Enter');
      assert.equal(await input.inputValue(), '第一行\n', 'Enter inserts a newline, never sends or dismisses the input');
      assert.equal(requests.length, 0);
      assert.equal(await input.evaluate(node => document.activeElement === node), true);
      await input.fill(Array.from({ length: 12 }, (_, index) => `手机多行输入第 ${index + 1} 行`).join('\n'));
      await page.waitForFunction(() => document.querySelector('[aria-label="聊天输入"]').clientHeight >= 120);
      assert.ok((await input.boundingBox()).height <= 133, 'Long drafts scroll within a bounded editor');
      assert.equal(await input.evaluate(node => node.scrollHeight > node.clientHeight), true);
      assert.equal(await input.evaluate(node => getComputedStyle(node).scrollbarWidth), 'none', 'No white scrollbar rail or arrows');
      assert.equal(await input.evaluate(node => getComputedStyle(node).resize), 'none', 'No desktop resize handle');
      assert.notEqual(await input.evaluate(node => getComputedStyle(node).overflowY), 'hidden', 'Long input must remain scrollable');
      await page.setViewportSize({ width, height: 420 });
      await page.waitForFunction(() => document.querySelector('[aria-label="聊天输入"]').clientHeight <= 106);
      const keyboardBox = await composer.boundingBox();
      assert.ok(keyboardBox.y >= 0 && keyboardBox.y + keyboardBox.height <= 420, 'Resized phone viewport keeps composer visible');
      const sendBox = await page.getByRole('button', { name: '发送聊天消息', exact: true }).boundingBox();
      assert.ok(sendBox.width >= 44 && sendBox.height >= 44, 'Send remains a comfortable touch target');
      await page.screenshot({ path: path.join(output, `short-viewport-${width}.png`) });
      await input.fill('短输入');
      await page.waitForFunction(() => document.querySelector('[aria-label="聊天输入"]').clientHeight <= 50);
      await input.fill('');
      await page.setViewportSize({ width, height: 871 });
      await page.getByRole('button', { name: '添加聊天附件', exact: true }).click();
      const picker = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: '选择附件文件', exact: true }).click();
      await (await picker).setFiles([
        { name: '训练记录.md', mimeType: 'text/markdown', buffer: Buffer.from('# 本周训练\n深蹲完成 4 组。') },
        { name: '就餐资料.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: fixtures.docx() },
        { name: 'readable.pdf', mimeType: 'application/pdf', buffer: fixtures.pdf() },
        { name: 'scan.pdf', mimeType: 'application/pdf', buffer: fixtures.pdf('') },
      ]);
      await page.getByText('读取失败', { exact: false }).first().waitFor();
      await page.waitForFunction(() => !document.body.innerText.includes('正在读取文字'));
      assert.equal(await page.getByTestId('chat-file-sheet').getByText(/文字已就绪/).count(), 3);
      await page.screenshot({ path: path.join(output, `files-${width}.png`) });
      await page.getByRole('button', { name: '移除附件 scan.pdf', exact: true }).click();
      await page.getByRole('button', { name: '完成附件选择', exact: true }).click();
      assert.equal(await composer.getByText('训练记录.md', { exact: true }).count(), 1, 'Pending attachments stay inside the composer');
      await page.getByLabel('聊天输入').fill('请查看这些资料');
      await page.getByRole('button', { name: '打开服务设置', exact: true }).click();
      await page.getByRole('button', { name: '关闭服务设置', exact: true }).click();
      assert.equal(await page.getByLabel('聊天输入').inputValue(), '请查看这些资料');
      await page.getByRole('button', { name: '发送聊天消息', exact: true }).click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.getByLabel('聊天输入').inputValue(), '请查看这些资料');
      assert.equal(await composer.getByText('训练记录.md', { exact: true }).count(), 1, 'Failed send preserves the retry attachment');
      await page.getByRole('button', { name: '发送聊天消息', exact: true }).click();
      await page.getByText('附件正文已进入这次消息。', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('聊天输入').inputValue(), '');
      assert.equal(await page.getByTestId('chat-pending-files').count(), 0, 'Successful send clears the pending attachment tray');
      assert.equal(await page.getByText('训练记录.md', { exact: true }).count(), 1, 'Retry keeps one persisted user message, not two');
      const userMessage = requests[1].messages.find(message => message.role === 'user');
      assert.match(userMessage.content, /深蹲完成 4 组/);
      assert.match(userMessage.content, /附件测试：豆腐 & 鸡蛋/);
      assert.match(userMessage.content, /Actual PDF attachment text/);
      assert.doesNotMatch(userMessage.content, /scan\.pdf/);
      assert.deepEqual(requests[0].messages, requests[1].messages);
      assert.ok(requests[1].tools.some(tool => tool.function.name === 'read_music_settings'));
      assert.ok(requests[1].tools.some(tool => tool.function.name === 'write_meal_records'));
      assert.equal(requests[1].model, 'deepseek-flash');
      await page.screenshot({ path: path.join(output, `conversation-${width}.png`) });
      assert.ok(await page.getByLabel('聊天输入').isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '打开 DeepSeek 聊天', exact: true }).click();
      await page.getByText('附件正文已进入这次消息。', { exact: true }).waitFor();
      assert.equal(await page.getByText('训练记录.md', { exact: true }).count(), 1, 'Reload restores the common conversation once');
      assert.equal(requests.length, 2, 'Restoring history never replays model or mutating tool requests');
      assert.deepEqual(errors, []);
      console.log(`PASS chat UI + actual MD/DOCX/PDF + scanned rejection + failure/retry at ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
