// Fresh browser storage and fake provider routes only; never reads a real user's key.
const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { emptyNutritionJournal } = require('../src/nutrition/engine.ts');
const b = (page, name) => page.getByRole('button', { name, exact: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Shanghai' }), page = await context.newPage();
      page.setDefaultTimeout(15000); const errors = [], calls = [], gateway = [];
      page.on('pageerror', error => errors.push(error.message));
      const profile = { name: 'ISOLATED_CONNECTION_QA', age: 30, sex: 'male', height: 175, weight: 75, goal: 'equipment', frequency: 6, equipmentSplit: 'ppl', experience: 'advanced', levels: {}, planStartedAt: new Date().toISOString(), planId: 'equipment_training_v2' };
      const journal = emptyNutritionJournal(); journal.assistant.consentAt = new Date().toISOString(); journal.assistant.consentScope = 2;
      await context.addInitScript(({ profile, journal }) => { if (!sessionStorage.getItem('connection-qa')) { localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal)); localStorage.setItem('agent_connection_return_v1', JSON.stringify({ view: 'connection', at: Date.now() })); sessionStorage.setItem('connection-qa', '1'); } }, { profile, journal });
      await context.route('**/*', route => {
        const request = route.request(), url = request.url();
        const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8081', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
        if (/api\.(deepseek|tavily)\.com|open\.bigmodel\.cn/u.test(url)) {
          if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
          calls.push({ url, body: request.postDataJSON(), headers: request.headers() });
          if (url.includes('tavily')) return route.fulfill({ headers, json: { results: [{ title: '隔离测试资料', url: 'https://fdc.nal.usda.gov/data-documentation.html', content: '训练与饮食记录需要基于实际信息。' }] } });
          if (url.endsWith('/web_search')) return route.fulfill({ headers, json: { search_result: [{ title: '智谱隔离测试资料', link: 'https://fdc.nal.usda.gov/data-documentation.html', content: '核对实际训练和饮食记录。' }] } });
          const body = request.postDataJSON(), source = body.messages[0].content.match(/web-[a-f0-9]{24}/u)?.[0];
          const content = body.max_tokens === 32 ? { ok: true } : { answer: '请结合真实训练记录核对计划，资料来源可在下方查看。', sourceIds: [source || 'protein'] };
          return route.fulfill({ headers, json: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] } });
        }
        if (url.startsWith('http://127.0.0.1:8787/')) {
          if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
          gateway.push(url); return route.fulfill({ headers, json: { configured: false, model: 'none', provider: 'offline', readiness: 'unconfigured' } });
        }
        return url.startsWith('http://127.0.0.1:8081/') || url.startsWith('data:') || url.startsWith('blob:') ? route.continue() : route.abort();
      });
      try {
        await page.goto('http://127.0.0.1:8081/');
        await page.getByTestId('agent-connection-settings').waitFor();
        assert.equal(await page.evaluate(() => localStorage.getItem('agent_connection_return_v1')), null, 'one-use return marker restores settings after process restart');
        await page.getByRole('radio', { name: '个人密钥直连', exact: true }).click();
        await page.getByLabel('个人 DeepSeek 密钥', { exact: true }).fill('sk-isolated-browser-only'); await page.getByLabel('个人 Tavily 密钥', { exact: true }).fill('tvly-isolated-browser-only');
        await b(page, '保存连接设置').click(); await page.getByText(/设置已保存，尚未测试连接/).waitFor();
        assert.equal(calls.length, 0); assert.equal(await page.getByLabel('个人 DeepSeek 密钥', { exact: true }).inputValue(), '');
        const gatewayBefore = gateway.length;
        await b(page, '测试 DeepSeek 连接').click(); await page.getByText(/DeepSeek 当前连接测试通过/).waitFor();
        await b(page, '测试 Tavily 搜索').click(); await page.getByText(/Tavily 当前搜索测试通过/).waitFor();
        assert.equal(calls.length, 2);
        const box = await page.getByLabel('个人 DeepSeek 密钥', { exact: true }).boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
        if (process.env.NUTRITION_SCREENSHOT_DIR) await page.screenshot({ path: process.env.NUTRITION_SCREENSHOT_DIR + '/connection-' + width + '.png' });
        await b(page, '返回助手对话').click(); await page.getByLabel('营养问题', { exact: true }).fill('搜索训练资料'); await b(page, '发送营养问题').click();
        await page.getByText('请结合真实训练记录核对计划，资料来源可在下方查看。', { exact: true }).waitFor();
        assert.equal(gateway.length, gatewayBefore); assert.equal(calls.length, 4);
        assert.ok(calls.every(call => !JSON.stringify(call.body).includes('isolated-browser-only')));
        await page.getByLabel('营养问题', { exact: true }).fill('sk-do-not-archive-this-key'); await b(page, '发送营养问题').click();
        await page.getByText(/密钥不能发到聊天/).waitFor(); assert.equal(calls.length, 4);
        await page.getByRole('radio', { name: '智谱聊天与搜索', exact: true }).click();
        await page.getByLabel('个人智谱密钥', { exact: true }).fill('isolated-browser-id.isolated-browser-secret');
        await b(page, '保存并验证连接').click(); await page.getByText(/设置已保存。智谱 当前连接测试通过/).waitFor();
        assert.equal(calls.length, 5); assert.equal(calls.at(-1).url, 'https://open.bigmodel.cn/api/paas/v4/chat/completions');
        assert.equal(await page.getByLabel('个人智谱密钥', { exact: true }).inputValue(), '');
        await b(page, '测试智谱搜索').click(); await page.getByText(/智谱 当前搜索测试通过/).waitFor();
        assert.equal(calls.length, 6); assert.ok(calls.at(-1).url.endsWith('/web_search'));
        await b(page, '返回助手对话').click(); await page.getByLabel('营养问题', { exact: true }).fill('搜索训练资料'); await b(page, '发送营养问题').click();
        await page.getByText('请结合真实训练记录核对计划，资料来源可在下方查看。', { exact: true }).nth(1).waitFor();
        await page.getByText('已联网检索 · 1 个来源', { exact: true }).last().waitFor();
        assert.equal(calls.length, 8); assert.equal(gateway.length, gatewayBefore);
        await b(page, '打开助手连接设置').click();
        const stored = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))));
        assert.equal(/sk-isolated-browser|tvly-isolated-browser|sk-do-not-archive|isolated-browser-secret/u.test(stored), false);
        await b(page, '删除本机全部 API 密钥').click(); await page.getByText(/本机密钥已清除/).waitFor();
        assert.equal(await b(page, '测试智谱连接').isDisabled(), true);
        await b(page, '关闭营养助手').click(); await page.reload(); await b(page, '打开全局个人助手').click(); await b(page, '打开助手连接设置').click();
        await page.getByRole('radio', { name: '个人密钥直连', exact: true }).click(); await page.getByText('DeepSeek · 未配置', { exact: true }).waitFor();
        assert.deepEqual(errors, []);
        console.log(`PASS personal connection ${width}px: explicit tests, isolated provider keys, official routes, real citations, no chat/storage leakage, deletion and reload`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
