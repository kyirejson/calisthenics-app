// Isolated local storage, fake credentials and model tool calls. No user records or live API traffic.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const output = process.env.MEAL_QA_OUTPUT || 'D:/UncoverBuildTools/temp/agent-meal-ui';
const sse = delta => `data: ${JSON.stringify({ choices: [{ delta, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: delta.tool_calls ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n`;
const call = (name, args) => ({ tool_calls: [{ index: 0, id: 'call-' + name, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  await fs.mkdir(output, { recursive: true });
  try {
    for (const width of [320, 390, 699]) {
      const context = await browser.newContext({ viewport: { width, height: 871 }, hasTouch: true });
      const page = await context.newPage(), errors = [];
      page.setDefaultTimeout(45000); page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(() => {
        if (sessionStorage.getItem('qa-initialized')) return;
        sessionStorage.setItem('qa-initialized', '1');
        const date = new Date().toLocaleDateString('en-CA');
        localStorage.setItem('profile-invitation-seen', '1');
        localStorage.setItem('user_profile', JSON.stringify({ name: 'MEAL_QA', age: 30, sex: 'male', height: 175, weight: 75, goal: 'street_mastery', frequency: 2, experience: 'beginner', levels: {}, planStartedAt: new Date().toISOString(), weightHistory: [{ date, kg: 74.5 }] }));
        localStorage.setItem('nutrition_journal_v1', JSON.stringify({ version: 1, entries: [], savedMeals: [], customFoods: [], days: {}, photoConsentAt: null, trainingTime: 'unspecified', preferences: { version: 1, objective: 'maintain', pattern: 'balanced', activity: 'light', allergens: [], riskFlags: [], screeningCompletedAt: new Date().toISOString() } }));
        localStorage.setItem('uncover.agent.connection.v1', JSON.stringify({ version: 1, mode: 'personal', provider: 'deepseek', model: 'deepseek-flash', deepseekKey: 'sk-isolated-meal-fixture' }));
      });
      let failAfterSave = true;
      await context.route('**/*', route => {
        const url = route.request().url();
        if (!url.startsWith('https://api.deepseek.com/')) return /^(http:\/\/127\.0\.0\.1:8081\/|data:|blob:)/.test(url) ? route.continue() : route.abort();
        const body = route.request().postDataJSON();
        const user = body.messages.findLast(row => row.role === 'user').content;
        const last = body.messages.at(-1);
        const date = new Date().toLocaleDateString('en-CA');
        let delta;
        if (last.role === 'user') delta = call('read_today_meals', {});
        else {
          const tool = body.messages.findLast(row => row.role === 'assistant' && row.tool_calls)?.tool_calls[0].function.name;
          if (tool === 'read_today_meals') {
            const result = JSON.parse(last.content);
            const operationKey = user.includes('三个') ? 'correct_1' : user.includes('没吃') ? 'delete_1' : user.includes('鸡胸肉') ? 'lunch_1' : 'breakfast_1';
            let operations;
            if (user.includes('没吃')) operations = [{ action: 'delete', entryId: result.entries.find(row => row.name === '鸡蛋').id }];
            else if (user.includes('三个')) operations = [{ action: 'update', entryId: result.entries.find(row => row.name === '鸡蛋').id, date, slot: 'breakfast', name: '鸡蛋', amount: '3 个', estimated: true, nutrients: { calories: 210, protein: 18, carbs: 1.5, fat: 15, fiber: 0 } }];
            else if (user.includes('鸡胸肉')) operations = [{ action: 'add', date, slot: 'lunch', name: '鸡胸肉', amount: null, estimated: false, nutrients: null }];
            else operations = [{ action: 'add', date, slot: 'breakfast', name: '鸡蛋', amount: '2 个', estimated: true, nutrients: { calories: 140, protein: 12, carbs: 1, fat: 10, fiber: 0 } }];
            delta = call('write_meal_records', { operationKey, operations });
          } else {
            assert.equal(JSON.parse(last.content).ok, true);
            if (failAfterSave) { failAfterSave = false; return route.fulfill({ status: 503, json: { error: { message: 'synthetic failure AFTER persisted meal' } } }); }
            delta = { content: user.includes('没吃') ? '这条早餐已删除。' : user.includes('三个') ? '早餐已更正。' : user.includes('鸡胸肉') ? '午餐已记录，份量待补。' : '早餐已记录。' };
          }
        }
        return route.fulfill({ contentType: 'text/event-stream', body: sse(delta) });
      });
      const readJournal = () => page.evaluate(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')));
      const chat = async (message, answer) => {
        await page.getByRole('button', { name: '打开 DeepSeek 聊天', exact: true }).click();
        await page.getByLabel('聊天输入', { exact: true }).fill(message);
        await page.getByRole('button', { name: '发送聊天消息', exact: true }).click();
        await page.getByText(answer, { exact: true }).waitFor();
        await page.getByRole('button', { name: '关闭 DeepSeek 聊天', exact: true }).click();
      };
      await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded' });
      await page.getByRole('tab', { name: '切换到饮食', exact: true }).click();
      await page.getByTestId('nutrition-empty-meals').waitFor();
      for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) await page.getByTestId('nutrition-meal-' + slot).waitFor();
      assert.equal(await page.getByText(/和 AI 记餐|对 AI 说说/).count(), 0);
      await page.screenshot({ path: path.join(output, `empty-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: '打开 DeepSeek 聊天', exact: true }).click();
      await page.getByLabel('聊天输入', { exact: true }).fill('今早吃了两个鸡蛋');
      await page.getByRole('button', { name: '发送聊天消息', exact: true }).click();
      await page.getByRole('alert').waitFor();
      assert.equal((await readJournal()).entries.length, 1, 'Write succeeded before model answer failed');
      await page.getByRole('button', { name: '发送聊天消息', exact: true }).click();
      await page.getByText('早餐已记录。', { exact: true }).waitFor();
      assert.equal((await readJournal()).entries.length, 1, 'Retried tool call does not duplicate persisted food');
      await page.getByRole('button', { name: '关闭 DeepSeek 聊天', exact: true }).click();
      assert.equal(await page.getByTestId('nutrition-recorded-energy').innerText(), '140');
      await chat('刚才说错了，是三个鸡蛋', '早餐已更正。');
      assert.equal((await readJournal()).entries.length, 1); assert.equal(await page.getByTestId('nutrition-recorded-energy').innerText(), '210');
      await chat('中午吃了鸡胸肉，份量不清楚', '午餐已记录，份量待补。');
      assert.equal((await readJournal()).entries.length, 2);
      assert.match(await page.getByTestId('nutrition-meal-lunch').innerText(), /份量待补/);
      assert.match(await page.getByTestId('nutrition-meal-lunch').innerText(), /—/);
      assert.equal(await page.getByTestId('nutrition-recorded-energy').innerText(), '210');
      const limits = await page.getByTestId('nutrition-content').evaluate(node => ({ right: node.getBoundingClientRect().right, width: innerWidth }));
      assert.ok(limits.right <= limits.width + 1, 'No horizontal overflow');
      await page.screenshot({ path: path.join(output, `recorded-${width}.png`), fullPage: true });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('tab', { name: '切换到饮食', exact: true }).click();
      await page.getByTestId('nutrition-meal-lunch').getByText('鸡胸肉', { exact: true }).waitFor();
      assert.equal(await page.getByTestId('nutrition-recorded-energy').innerText(), '210');
      await chat('早餐鸡蛋其实没吃，删掉那条', '这条早餐已删除。');
      assert.equal((await readJournal()).entries.length, 1);
      assert.equal(await page.getByTestId('nutrition-recorded-energy').innerText(), '—', 'Unknown-only records must not display zero calories');
      assert.match(await page.getByTestId('nutrition-meal-breakfast').innerText(), /暂无记录/);
      assert.deepEqual(errors, []);
      console.log(`PASS meal tool streaming + after-save retry + update + unknown + reload + delete + UI ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
