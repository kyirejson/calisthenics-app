// Isolated browser contexts and fake speech/model providers. Never use a user's
// tab, microphone, photos, credentials, saved diet or paid API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { waitForNutritionPage } = require('./nutrition-smoke-utils.cjs');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { emptyNutritionJournal, defaultNutritionPreferences } = require('../src/nutrition/engine.ts');
const { FOODS } = require('../src/nutrition/catalog.ts');
const { normalizeDishFood } = require('../src/nutrition/dishEstimate.ts');
const b = (page, name) => page.getByRole('button', { name, exact: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [320, 390, 650, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Shanghai' });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const requests = [], errors = [];
      const unknownDish = normalizeDishFood({ id: 'custom-dish-browser', name: '待核对测试菜（番茄炒蛋做法）', source: { kind: 'recipe_estimate', recipe: {
        description: '鸡蛋、番茄和少量油，参考配方估算', cookedGrams: 400, ingredients: [{ foodId: 'egg-raw', grams: 100 }, { foodId: 'tomato-raw', grams: 300 }, { foodId: 'canola-oil', grams: 10 }],
        sources: [{ title: '离线测试菜谱来源', url: 'https://www.xiachufang.com/recipe/qa/' }], fetchedAt: '2026-10-02T01:00:00Z',
      } } }, FOODS);
      page.on('pageerror', e => errors.push(e.message));
      const profile = { name: 'PRIVATE_QA_NAME', age: 30, sex: 'male', height: 175, weight: 75, goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, levels: {}, experience: 'intermediate', sessionMinutes: 45, trainingRestSeconds: 180, planStartedAt: new Date().toISOString(), weightHistory: [] };
      const journal = emptyNutritionJournal(); journal.preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: new Date().toISOString() };
      await context.addInitScript(({ profile, journal }) => {
        if (!sessionStorage.getItem('assistant-qa-seeded')) { localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal)); sessionStorage.setItem('assistant-qa-seeded', 'yes'); }
        window.SpeechRecognition = class extends EventTarget {
          constructor() { super(); window.assistantQASpeech = this; }
          start() { this.dispatchEvent(new Event('start')); }
          stop() { this.dispatchEvent(new Event('end')); }
          abort() { this.dispatchEvent(new Event('end')); }
          result(text, isFinal = true) { const result = [{ transcript: text, confidence: 0.98 }]; result.isFinal = isFinal; const event = new Event('result'); Object.assign(event, { resultIndex: 0, results: [result] }); this.dispatchEvent(event); }
        };
        window.webkitSpeechRecognition = window.SpeechRecognition;
      }, { profile, journal });
      await context.route('**/*', async route => {
        const req = route.request(), url = req.url();
        if (url.startsWith('http://127.0.0.1:8787/')) {
          const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8081', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
          if (url.endsWith('/health')) return route.fulfill({ headers, json: { configured: true, model: 'offline', provider: 'offline' } });
          if (url.endsWith('/search-food')) return route.fulfill({ headers, json: { candidates: [unknownDish], message: '请确认匹配菜品，再填写份量。' } });
          if (url.endsWith('/advice')) {
            const input = req.postDataJSON(); requests.push(input);
            let reply = { answer: '原书强调循序渐进，训练与恢复应相互配合。', sources: [], references: [{ id: 'cc-' + 'a'.repeat(24), title: '囚徒健身一 · 训练计划', excerpt: '隔天练习，留出恢复时间。', lineStart: 10, lineEnd: 12 }] };
            if (input.question.includes('香菜')) reply = { answer: '确认后我会记住这项忌口。', sources: [], intent: { type: 'remember', kind: 'avoid', text: '香菜' } };
            else if (input.question.includes('水煮鸡蛋')) reply = { answer: '已整理早餐，请核对份量后确认记餐。', sources: [], intent: { type: 'log_intake', slot: 'breakfast', items: [{ name: '水煮鸡蛋', state: 'cooked', quantity: 2, unit: 'piece' }] } };
            else if (input.question.includes('不存在')) reply = { answer: '库中未找到对应食品，请先补充食品信息。', sources: [], intent: { type: 'log_intake', slot: null, items: [{ name: '不存在的菜', state: 'unknown', quantity: null, unit: null }] } };
            else if (input.question.includes('长回答')) reply = { answer: '可以只记录你想记录的餐，其他餐留空也可以；明确没吃和没有记录是两种不同状态。'.repeat(5), sources: [] };
            else if (input.question.includes('超大')) reply = { answer: '长'.repeat(8001), sources: [], intent: { type: 'remember', kind: 'need', text: '不应保存' } };
            if (input.webSearch) reply = { ...reply, search: { status: 'searched', count: 1 }, searchSources: [{ title: '测试搜索来源', url: 'https://fdc.nal.usda.gov/data-documentation.html' }] };
            return route.fulfill({ headers, json: reply });
          }
          return route.abort();
        }
        if (url.startsWith('http://127.0.0.1:8081/') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')));
      const readArchive = () => page.evaluate(() => new Promise((resolve, reject) => {
        const open = indexedDB.open('uncover-assistant-memory-v2', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result, tx = db.transaction('turns', 'readonly'), request = tx.objectStore('turns').getAll();
          tx.oncomplete = () => { db.close(); resolve(request.result); };
          tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
        };
      }));
      const send = async text => { await page.getByLabel('营养问题', { exact: true }).fill(text); await b(page, '发送营养问题').click(); };
      const hold = async () => { const box = await b(page, '按住语音输入').boundingBox(); assert.ok(box); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(250); };
      try {
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.getByRole('tab', { name: '切换到饮食' }).click(); await waitForNutritionPage(page);
        await b(page, '问营养助手').click();
        assert.equal(await page.getByText('围绕今天的训练与饮食来聊', { exact: true }).count(), 0);
        assert.equal(await page.getByText('本地菜单工具 · 不需联网同意', { exact: true }).count(), 0);
        assert.equal(await b(page, '同意并开始').count(), 0);
        await b(page, '助手语音输入').click(); await hold(); await page.mouse.up(); await b(page, '同意并开始').click();
        await hold();
        assert.equal(await b(page, '发送营养问题').isDisabled(), true);
        assert.equal(await page.getByLabel('营养问题', { exact: true }).count(), 0);
        await page.getByText('正在听 · 松开转文字，上滑取消', { exact: true }).waitFor();
        await page.evaluate(() => window.assistantQASpeech.result('早餐吃了两个水煮', false));
        await page.getByText('早餐吃了两个水煮', { exact: true }).waitFor();
        await page.evaluate(() => window.assistantQASpeech.result('早餐吃了两个水煮鸡蛋，帮我记录'));
        await page.mouse.up();
        assert.equal(await page.getByLabel('营养问题', { exact: true }).inputValue(), '早餐吃了两个水煮鸡蛋，帮我记录');
        assert.equal(requests.length, 0); assert.equal((await read()).entries.length, 0);
        await b(page, '发送营养问题').click();
        await page.getByTestId('assistant-intake-draft').waitFor();
        assert.equal(await page.getByLabel('记餐食品1克重', { exact: true }).inputValue(), '100');
        assert.match(await page.getByTestId('assistant-intake-draft').innerText(), /155/);
        assert.equal((await read()).entries.length, 0);
        await b(page, '确认助手记餐').scrollIntoViewIfNeeded();
        if (width === 390) {
          await page.evaluate(() => { window.assistantQASetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k === 'nutrition_journal_v1') throw new Error('QA disk full'); return window.assistantQASetItem.call(this, k, v); }; });
          await b(page, '确认助手记餐').click(); await page.getByText('QA disk full', { exact: true }).waitFor();
          assert.equal((await read()).entries.length, 0);
          await page.evaluate(() => { Storage.prototype.setItem = window.assistantQASetItem; });
        }
        await b(page, '确认助手记餐').click();
        await page.getByText('已记录这一餐', { exact: true }).waitFor();
        assert.equal((await read()).entries.length, 1); assert.equal((await read()).entries[0].nutrients.calories, 155);
        assert.equal(await b(page, '确认助手记餐').count(), 0);
        await send('记住我不吃香菜'); await b(page, '确认助手记忆').waitFor();
        assert.equal((await read()).assistant.facts.length, 0);
        await b(page, '确认助手记忆').click(); await page.getByText('已记住，可在“记忆”中查看或删除。', { exact: true }).waitFor();
        assert.equal((await read()).assistant.facts[0].text, '香菜');
        await b(page, '关闭营养助手').click(); await b(page, '问营养助手').click();
        assert.equal(await page.getByTestId('assistant-intake-draft').count(), 0, 'persisted history must not restore executable proposals');
        await send('囚徒健身六练怎么安排？'); await b(page, '查看助手回答依据').waitFor();
        const latest = requests.at(-1); assert.ok(latest.history.length <= 12 && latest.history.length >= 2);
        assert.deepEqual(latest.memory, [{ kind: 'avoid', text: '香菜' }]); assert.equal(JSON.stringify(latest).includes(profile.name), false);
        assert.equal(await page.getByText('隔天练习，留出恢复时间。', { exact: true }).count(), 0);
        await b(page, '查看助手回答依据').click(); await page.getByText('隔天练习，留出恢复时间。', { exact: true }).waitFor();
        for (const text of await page.getByTestId('assistant-reply').allTextContents()) assert.ok(text.length <= 8000);
        for (const label of ['助手语音输入', '发送营养问题', '关闭营养助手']) { const rect = await b(page, label).boundingBox(); assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width + 1, label + ' fits viewport'); }
        if (width === 390) {
          await send('记录不存在的菜'); await b(page, '确认助手记餐').waitFor(); assert.equal(await b(page, '确认助手记餐').isDisabled(), true); assert.equal((await read()).entries.length, 1);
          const draft = page.getByTestId('assistant-intake-draft').last();
          assert.equal(await draft.getByLabel('记餐食品1克重', { exact: true }).isEditable(), false);
          await draft.getByRole('button', { name: '确认菜品1为' + unknownDish.name, exact: true }).click();
          assert.equal(await draft.getByLabel('记餐食品1克重', { exact: true }).inputValue(), '');
          await draft.getByLabel('记餐食品1克重', { exact: true }).fill('200');
          await draft.getByRole('button', { name: '修改记餐餐次', exact: true }).click();
          await draft.getByRole('radio', { name: '记餐到午餐', exact: true }).click();
          await draft.getByRole('button', { name: '确认助手记餐', exact: true }).click();
          await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).entries.length === 2);
          assert.equal((await read()).entries[0].nutrients.calories, 146.8);
          assert.equal((await read()).entries[0].customFoods[0].source.kind, 'recipe_estimate');
          await page.getByRole('switch', { name: '联网搜索', exact: true }).click(); await send('查一下饮食资料');
          await page.getByText('已联网检索 · 1 个来源', { exact: true }).waitFor(); assert.equal(requests.at(-1).webSearch, true);
          // Simulate the mobile browser's visual viewport shrinking while its
          // layout viewport remains 900px. This is not a real OPPO IME test.
          await page.evaluate(() => { Object.defineProperty(window.visualViewport, 'height', { configurable: true, get: () => 480 }); window.visualViewport.dispatchEvent(new Event('resize')); });
          await page.waitForFunction(() => document.querySelector('[data-testid="assistant-keyboard-frame"]').getBoundingClientRect().height === 480);
          await page.getByLabel('营养问题', { exact: true }).fill('中文输入仍可见');
          const composer = await page.getByTestId('assistant-composer').boundingBox(); assert.ok(composer.y + composer.height <= 481);
          await page.evaluate(() => { delete window.visualViewport.height; window.visualViewport.dispatchEvent(new Event('resize')); });
          await send('测试长回答'); await page.getByTestId('assistant-reply').last().filter({ hasText: '可以只记录' }).waitFor();
          const fullReply = await page.getByTestId('assistant-reply').last().innerText(); assert.ok(fullReply.length > 50);
          assert.equal((await readArchive()).find(turn => turn.question === '测试长回答')?.answer, fullReply);
          await send('测试超大回答'); await page.getByText('营养助手响应无效，请重试。', { exact: true }).waitFor(); assert.equal(await b(page, '确认助手记忆').count(), 0);
          await page.getByLabel('营养问题', { exact: true }).fill('原有输入'); await b(page, '助手语音输入').click(); await hold();
          await page.evaluate(() => window.assistantQASpeech.result('这段应取消', false));
          await page.mouse.move(180, 600); await page.mouse.up(); await b(page, '切换键盘输入').click();
          assert.equal(await page.getByLabel('营养问题', { exact: true }).inputValue(), '原有输入');
          await b(page, '助手语音输入').click(); await hold();
          await b(page, '关闭营养助手').evaluate(el => el.click()); await page.mouse.up(); await page.evaluate(() => window.assistantQASpeech.result('关闭后不能写入')); await b(page, '问营养助手').click();
          assert.equal(await page.getByLabel('营养问题', { exact: true }).inputValue(), '');
          await b(page, '助手语音输入').click(); await hold();
          await page.evaluate(() => { const error = new Event('error'); Object.assign(error, { error: 'not-allowed', message: 'QA blocked permission' }); window.assistantQASpeech.dispatchEvent(error); });
          await page.getByText('未允许麦克风或语音权限，请在系统设置开启，或使用键盘输入。', { exact: true }).waitFor();
          await page.mouse.up();
          assert.equal(await page.getByLabel('营养问题', { exact: true }).isEditable(), true);
        }
        if (process.env.NUTRITION_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.NUTRITION_SCREENSHOT_DIR, 'assistant-' + width + '.png') });
        const requestsBeforeStatus = requests.length, entriesBeforeStatus = (await read()).entries.length;
        await send('晚餐，我没吃'); await b(page, '确认助手餐次状态').waitFor();
        assert.equal(requests.length, requestsBeforeStatus, 'explicit meal state must not need a paid model');
        await b(page, '确认助手餐次状态').click();
        await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('nutrition_journal_v1')).days).some(d => d.skippedSlots?.includes('dinner')));
        assert.equal((await read()).entries.length, entriesBeforeStatus);
        await send('晚餐撤销没吃'); await b(page, '确认助手餐次状态').click();
        await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('nutrition_journal_v1')).days).every(d => !d.skippedSlots?.includes('dinner')));
        const before = await readArchive(); await b(page, '关闭营养助手').click();
        await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('tab', { name: '切换到饮食' }).click(); await waitForNutritionPage(page); await b(page, '问营养助手').click();
        assert.equal((await readArchive()).length, before.length);
        if (width === 390) assert.equal(await page.getByTestId('assistant-reply').filter({ hasText: '可以只记录' }).count(), 1, 'full long reply survives reload');
        await b(page, '查看助手记忆').click(); await b(page, '清空助手对话').click(); await b(page, '确认清空助手对话').click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).assistant.conversations.length === 0);
        assert.equal((await readArchive()).length, 0, 'clear removes the actual archive, not only the legacy journal field');
        assert.equal((await read()).entries.length, width === 390 ? 2 : 1); assert.equal((await read()).assistant.facts.length, 1);
        await b(page, '删除助手记忆香菜').click(); await b(page, '确认忘记助手记忆').click(); await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).assistant.facts.length === 0);
        assert.equal((await read()).entries.length, width === 390 ? 2 : 1); assert.deepEqual(errors, []);
        await b(page, '关闭营养助手').click(); await b(page, '管理当日饮食记录').click();
        await page.getByTestId('nutrition-logging-controls').waitFor();
        assert.equal(await page.getByText('0 / 4 已核对', { exact: true }).count(), 0);
        await b(page, '标记晚餐没吃').click();
        await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('nutrition_journal_v1')).days).some(d => d.skippedSlots?.includes('dinner')));
        const controls = page.getByTestId('nutrition-logging-controls'), rect = await controls.boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1);
        assert.equal((await read()).entries.length, entriesBeforeStatus);
        assert.ok(Object.values((await read()).days).every(d => !d.completedAt));
        await b(page, '撤销晚餐状态').click(); await b(page, '记录早餐').click();
        assert.equal(await page.getByRole('radio', { name: '记餐到早餐', exact: true }).getAttribute('aria-checked'), 'true');
        await b(page, '关闭实际摄入编辑器').click();
        console.log('PASS assistant ' + width + 'px: hold/release voice, consent, database food, memory, optional/no-meal states, sources, safe cleanup' + (width === 390 ? ', unknown dish confirmation/amount, online search, keyboard viewport, long replies, upward cancellation' : ''));
      } catch (error) { console.error('Original browser failure:', error); console.error((await page.locator('body').innerText()).slice(-3500)); if (await page.getByTestId('assistant-keyboard-frame').count()) console.error(await page.getByTestId('assistant-keyboard-frame').evaluate(e => ({ rect: e.getBoundingClientRect().toJSON(), children: [...e.querySelectorAll('[role=button], [data-testid=assistant-composer], [data-testid=assistant-network-consent]')].map(n => ({ name: n.getAttribute('aria-label') || n.getAttribute('data-testid'), rect: n.getBoundingClientRect().toJSON() })), viewport: { h: window.visualViewport.height, y: window.visualViewport.offsetTop, scroll: window.scrollY } }))); throw error; }
      finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
