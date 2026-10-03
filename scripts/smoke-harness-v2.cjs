// Isolated IndexedDB, localStorage and mocked provider; never touches user data or paid APIs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { waitForNutritionPage } = require('./nutrition-smoke-utils.cjs');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { emptyNutritionJournal } = require('../src/nutrition/engine.ts');
const { memoryTokens } = require('../src/nutrition/personalKnowledge.ts');
const { screeningStatement } = require('../src/nutrition/preferenceIntent.mjs');
const b = (page, name) => page.getByRole('button', { name, exact: true });
(async () => {
  const { validateAdviceRequest } = await import('../server/validation.mjs');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [320, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Shanghai' });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const requests = [], errors = []; page.on('pageerror', e => errors.push(e.message));
      const profile = { name: 'PRIVATE_TEST_NAME', age: 30, sex: 'male', height: 175, weight: 75, goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, levels: {}, experience: 'intermediate', planStartedAt: new Date().toISOString(), weightHistory: [] };
      const journal = emptyNutritionJournal();
      await context.addInitScript(({ profile, journal }) => {
        if (!sessionStorage.getItem('harness-v2-seeded')) { localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal)); sessionStorage.setItem('harness-v2-seeded', '1'); }
      }, { profile, journal });
      await context.route('**/*', async route => {
        const req = route.request(), url = req.url();
        if (url.startsWith('http://127.0.0.1:8787/')) {
          const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8081', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
          if (url.endsWith('/health')) return route.fulfill({ headers, json: { configured: true, readiness: 'ready', model: 'offline', provider: 'offline' } });
          if (url.endsWith('/search-food')) return route.fulfill({ headers, json: { candidates: [], message: '请补充主要食材和做法后重新搜索。' } });
          const input = req.postDataJSON(); validateAdviceRequest(input); requests.push(input);
          let reply = { answer: '你之前提到过，上胸是训练重点。', sources: [] };
          if (input.question.includes('香菜')) reply = { answer: '已整理忌口，交由本机保存。', sources: [], intent: { type: 'remember', kind: 'avoid', text: '香菜' } };
          if (input.question.includes('鸡蛋')) reply = { answer: '交由本机核算并记录。', sources: [], intent: { type: 'log_intake', slot: 'breakfast', items: [{ name: '水煮鸡蛋', state: 'cooked', quantity: 2, unit: 'piece' }] } };
          if (input.question.includes('未知食品')) reply = { answer: '请补充食品和份量。', sources: [], intent: { type: 'log_intake', slot: null, items: [{ name: '未知食品', state: 'unknown', quantity: null, unit: null }] } };
          return route.fulfill({ headers, json: reply });
        }
        if (url.startsWith('http://127.0.0.1:8081/') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
        return route.abort();
      });
      const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')));
      const open = async () => { await page.getByRole('tab', { name: '切换到饮食' }).click(); await waitForNutritionPage(page); assert.equal(await b(page, '营养设置').count(), 0); assert.equal(await b(page, '查看当日目标记录').count(), 0); await b(page, '问营养助手').click(); };
      const send = async text => { await page.getByLabel('营养问题', { exact: true }).fill(text); await b(page, '发送营养问题').click(); };
      try {
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await open();
        await send('营养目标设为增肌，饮食模式设为均衡');
        await b(page, '确认保存营养偏好').waitFor(); assert.equal((await read()).preferences, null);
        await b(page, '确认保存营养偏好').click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).preferences?.objective === 'muscle_gain');
        assert.equal((await read()).preferences.screeningCompletedAt, null);
        await b(page, '填写无上述健康情况声明').click();
        assert.equal(await page.getByLabel('营养问题', { exact: true }).inputValue(), screeningStatement);
        await b(page, '发送营养问题').click(); await b(page, '确认保存营养偏好').click();
        await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('nutrition_journal_v1')).preferences?.screeningCompletedAt);
        assert.equal(requests.length, 0, 'Preference recording must work locally without model calls');
        await b(page, '查看助手记忆').click(); await b(page, '建立个人训练知识库').click();
        const answers = ['自重技能', '每周三次，周一三五', '家中有单杠', '持续训练中', '重点上胸与引体向上', '无已知限制'];
        for (const answer of answers) {
          await page.getByPlaceholder('可补充具体情况，也可跳过', { exact: true }).fill(answer);
          await b(page, '档案下一题').click();
        }
        await b(page, '保存个人训练档案').click(); await b(page, '建立个人训练知识库').waitFor();
        if (process.env.NUTRITION_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.NUTRITION_SCREENSHOT_DIR, 'harness-v2-memory-' + width + '.png') });
        assert.equal((await read()).assistant.personalProfiles.street_mastery.priorities, answers[4]);
        await page.getByRole('radio', { name: '完全访问', exact: true }).click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).assistant.authorization?.mode === 'full_access');
        await b(page, '返回助手对话').click(); await send('饮食模式改为蛋奶素，我对花生过敏');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).preferences?.pattern === 'vegetarian');
        assert.deepEqual((await read()).preferences.allergens, ['peanut']);
        assert.equal(await b(page, '确认保存营养偏好').count(), 0);
        await send('删除花生过敏原记录');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).preferences?.allergens.length === 0);
        await send('记住我不吃香菜'); await b(page, '同意并开始').click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).assistant.facts.some(f => f.text === '香菜'));
        assert.equal(await b(page, '确认助手记忆').count(), 0);
        await send('早餐吃了两个水煮鸡蛋，帮我记录');
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).entries.length === 1);
        assert.equal((await read()).entries[0].nutrients.calories, 155); assert.equal(await b(page, '确认助手记餐').count(), 0);
        const beforeNoMeal = requests.length;
        await send('晚餐，我没吃');
        await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('nutrition_journal_v1')).days).some(d => d.skippedSlots?.includes('dinner')));
        assert.equal(await b(page, '确认助手餐次状态').count(), 0); assert.equal((await read()).entries.length, 1); assert.equal(requests.length, beforeNoMeal);
        await send('晚餐撤销没吃');
        await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('nutrition_journal_v1')).days).every(d => !d.skippedSlots?.includes('dinner')));
        await send('帮我记录未知食品'); await b(page, '保存助手记餐').waitFor();
        assert.equal(await b(page, '保存助手记餐').isDisabled(), true); assert.equal((await read()).entries.length, 1);
        const rows = Array.from({ length: 140 }, (_, i) => {
          const question = i === 0 ? '我的上胸重点要长期记住' : '普通训练话题';
          const createdAt = new Date(Date.now() - (150 - i) * 60000).toISOString(), id = 'browser-history-' + i;
          return { id, createdAt, question, answer: '已了解。', topic: 'street_mastery', cursor: createdAt + '|' + id, tokens: memoryTokens(question) };
        });
        await page.evaluate(rows => new Promise((resolve, reject) => {
          const r = indexedDB.open('uncover-assistant-memory-v2', 1);
          r.onerror = () => reject(r.error); r.onsuccess = () => { const db = r.result, tx = db.transaction('turns', 'readwrite'); rows.forEach(row => tx.objectStore('turns').put(row)); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => reject(tx.error); };
        }), rows);
        await b(page, '关闭营养助手').click(); await page.reload({ waitUntil: 'domcontentloaded' }); await open();
        await b(page, '加载更早助手对话').click();
        await send('你还记得我的上胸重点吗'); await page.getByText('你之前提到过，上胸是训练重点。', { exact: true }).waitFor();
        assert.ok(requests.at(-1).harness.evidence.some(r => r.id === 'browser-history-0'));
        assert.equal(requests.at(-1).harness.mode, 'full_access');
        assert.equal(requests.at(-1).harness.personalProfile.priorities, answers[4]);
        assert.equal(JSON.stringify(requests).includes(profile.name), false);
        await b(page, '查看助手记忆').click(); await b(page, '删除助手记忆香菜').click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).assistant.facts.length === 0);
        const residue = await page.evaluate(() => new Promise(resolve => { const r = indexedDB.open('uncover-assistant-memory-v2', 1); r.onsuccess = () => { const db = r.result, q = db.transaction('turns').objectStore('turns').getAll(); q.onsuccess = () => { db.close(); resolve(q.result.filter(t => t.question.includes('香菜') || t.answer.includes('香菜')).length); }; }; }));
        assert.equal(residue, 0); assert.equal((await read()).entries.length, 1);
        assert.deepEqual(errors, []);
        console.log('PASS Harness V2 ' + width + 'px: questionnaire, restart, actual snapshot contract, 140-turn IndexedDB recall, full-access tools, unknown-food refinement, forget purge');
      } catch (error) { console.error((await page.locator('body').innerText()).slice(-2500)); throw error; }
      finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
