// Isolated browser and synthetic credentials; operator files and real accounts are never read.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 844 } }), page = await context.newPage(), errors = [];
      page.on('pageerror', e=>errors.push(e.message)); page.setDefaultTimeout(30000);
      await context.addInitScript(() => {
        if (sessionStorage.getItem('isolated-services')) return;
        localStorage.setItem('user_profile', JSON.stringify({ name: 'ISOLATED_QA', age: 30, sex: 'male', height: 175, weight: 75, goal: 'equipment', frequency: 6, equipmentSplit: 'ppl', experience: 'advanced', levels: {}, planStartedAt: new Date().toISOString(), planId: 'equipment_training_v2' }));
        sessionStorage.setItem('isolated-services','1');
      });
      const chatRequests = [];
      await context.route('**/*', async route => {
        const req = route.request(), url = req.url();

        if (url.startsWith('https://api.deepseek.com/')) {
          const body = req.postDataJSON();
          if (!body.response_format) chatRequests.push(body);
          return route.fulfill({ json: { choices: [{ finish_reason: 'stop', message: { content: body.response_format ? '{"ok":true}' : '你好，司令。' } }] } });
        }
        return url.startsWith('http://127.0.0.1:8081/') || /^(data|blob):/.test(url) ? route.continue() : route.abort();
      });
      await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded' });
      assert.equal(await page.getByRole('button', { name: '打开全局个人助手', exact: true }).count(),0);
      await page.getByText('饮食', { exact: true }).click();
      await page.getByText('今日饮食', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '拍照记餐', exact: true }).count(),0);
      assert.equal(await page.getByRole('button', { name: '问营养助手', exact: true }).count(),0);
      await page.getByRole('tab', { name: '切换到我的', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: '服务设置', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'DeepSeek 聊天', exact: true }).click();
      await page.getByLabel('聊天输入', { exact: true }).fill('未发送的草稿');
      await page.getByRole('button', { name: '打开服务设置', exact: true }).click();
      await page.getByLabel('个人 DeepSeek 密钥', { exact: true }).fill('sk-isolated-ui-fixture');
      await page.getByRole('button', { name: '保存并连接', exact: true }).click();
      await page.getByText('已连接', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('个人 DeepSeek 密钥', { exact: true }).count(),0);
      assert.equal(await page.getByRole('button', { name: '保存并连接', exact: true }).count(),0);
      assert.equal(await page.getByText('网易云音乐', { exact: true }).count(), 0);
      assert.equal(await page.getByLabel('音乐名称', { exact: true }).count(), 0);
      assert.equal(await page.getByText('浏览器密钥仅保存在当前页面内存。', { exact: true }).count(), 0);
      await page.getByRole('button', { name: '关闭服务设置', exact: true }).click();
      assert.equal(await page.getByLabel('聊天输入', { exact: true }).inputValue(), '未发送的草稿');
      await page.getByLabel('聊天输入', { exact: true }).fill('叫我司令');
      await page.getByRole('button', { name: '发送聊天消息', exact: true }).click();
      await page.getByText('你好，司令。', { exact: true }).waitFor();
      await page.getByLabel('聊天输入', { exact: true }).fill('我叫什么？');
      await page.getByRole('button', { name: '发送聊天消息', exact: true }).click();
      await page.getByText('你好，司令。', { exact: true }).nth(1).waitFor();
      assert.deepEqual(chatRequests[0].messages.filter(m=>m.role!=='system'), [{ role: 'user', content: '叫我司令' }]);
      assert.deepEqual(chatRequests[1].messages.filter(m=>m.role!=='system'), [{ role: 'user', content: '叫我司令' }, { role: 'assistant', content: '你好，司令。' }, { role: 'user', content: '我叫什么？' }]);
      assert.ok(chatRequests.every(r => r.tools.length===9));
      await page.getByRole('button', { name: '关闭 DeepSeek 聊天', exact: true }).click();
      await page.getByRole('tab', { name: '切换到今日', exact: true }).click();
      const floating = page.getByRole('button', { name: '打开 DeepSeek 聊天', exact: true });
      const before = await floating.boundingBox();
      await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
      await page.mouse.down();
      await page.mouse.move(35, 240, { steps: 12 });
      await page.mouse.up();
      await page.waitForFunction(() => {
        const el = document.querySelector('[aria-label="打开 DeepSeek 聊天"]');
        return el && el.getBoundingClientRect().x < window.innerWidth / 2;
      });
      const after = await floating.boundingBox();
      assert.ok(after.x < width / 2 && Math.abs(after.y - before.y) > 50, 'floating chat should drag and snap without opening');
      await page.getByRole('button', { name: '打开 DeepSeek 聊天', exact: true }).click();
      assert.equal(await page.getByText('你好，司令。', { exact: true }).count(), 2);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '打开 DeepSeek 聊天', exact: true }).click();
      await page.getByRole('button', { name: '打开服务设置', exact: true }).click();
      await page.getByText('已保存', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('个人 DeepSeek 密钥', { exact: true }).count(), 0);
      await page.getByRole('button', { name: '清除 API Key', exact: true }).click();
      await page.getByRole('button', { name: '清除', exact: true }).click();
      await page.getByText('未连接', { exact: true }).waitFor();
      assert.equal(await page.getByText('网易云音乐', { exact: true }).count(), 0);
      await page.getByRole('button', { name: '关闭服务设置', exact: true }).click();
      assert.equal(await page.getByText('你好，司令。', { exact: true }).count(), 0);
      assert.equal(await page.getByText('助手记忆',{exact:true}).count(),0); assert.deepEqual(errors,[]);
      await context.close(); console.log('PASS independent integration panels '+width+'px');
    }
  } finally { await browser.close(); }
})().catch(e=>{ console.error(e); process.exitCode=1; });
