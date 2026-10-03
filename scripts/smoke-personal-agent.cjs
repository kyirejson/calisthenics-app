// Isolated browser contexts; no user storage, microphone, photos or paid provider.
const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { emptyNutritionJournal } = require('../src/nutrition/engine.ts');
const b = (page, name) => page.getByRole('button', { name, exact: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Shanghai' });
      const page = await context.newPage(); page.setDefaultTimeout(15000); const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      const profile = { name: 'ISOLATED_AGENT_QA', age: 30, sex: 'male', height: 175, weight: 75, goal: 'equipment', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 6, equipmentSplit: 'ppl', experience: 'advanced', levels: {}, planStartedAt: new Date().toISOString(), planId: 'equipment_training_v2' };
      profile.weightHistory = Array.from({ length: 14 }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - i); return { date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, kg: 75 }; });
      const journal = emptyNutritionJournal();
      await context.addInitScript(({ profile, journal }) => { if (!sessionStorage.getItem('personal-agent-qa')) { localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal)); sessionStorage.setItem('personal-agent-qa', '1'); } }, { profile, journal });
      await context.route('**/*', route => {
        const request = route.request(), url = request.url();
        if (url.startsWith('http://127.0.0.1:8787/')) {
          const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8081', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
          if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
          if (url.endsWith('/health')) return route.fulfill({ headers, json: { configured: false, model: 'none', provider: 'offline', readiness: 'unconfigured' } });
          requests.push(url); return route.abort();
        }
        return url.startsWith('http://127.0.0.1:8081/') || url.startsWith('data:') || url.startsWith('blob:') ? route.continue() : route.abort();
      });
      try {
        await page.goto('http://127.0.0.1:8081/'); await b(page, '打开全局个人助手').waitFor();
        const initialDock = await b(page, '打开全局个人助手').boundingBox();
        await page.mouse.move(initialDock.x + 24, initialDock.y + 24); await page.mouse.down(); await page.mouse.move(24, 220, { steps: 18 }); await page.mouse.up();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).assistant.agentPreferences?.dockAnchor?.edge === 'left');
        assert.equal(await page.getByLabel('营养问题', { exact: true }).count(), 0, 'drag must not open the assistant');
        const leftDock = await b(page, '打开全局个人助手').boundingBox(); assert.ok(leftDock.x >= 0 && leftDock.x < 24);
        const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')));
        const send = async text => { await page.getByLabel('营养问题', { exact: true }).fill(text); await b(page, '发送营养问题').click(); };
        for (const [tab, scene] of [['进阶', '进阶动作库'], ['数据', '训练数据'], ['我的', '个人档案'], ['今日', '今日训练']]) {
          await page.getByRole('tab', { name: '切换到' + tab, exact: true }).click(); await b(page, '打开全局个人助手').click();
          await page.getByText('当前场景 · ' + scene, { exact: true }).waitFor(); await b(page, '关闭营养助手').click();
        }
        await b(page, '打开全局个人助手').click(); await send('今天练什么'); await page.getByText(/本机课表/).waitFor(); assert.equal(requests.length, 0);
        await send('今天训练减载'); await b(page, '确认训练调整').waitFor(); assert.equal((await read()).assistant.trainingOverlays, undefined);
        await b(page, '确认训练调整').click(); await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('nutrition_journal_v1')).assistant.trainingOverlays?.equipment);
        assert.equal((await read()).assistant.trainingOverlays.equipment.courses && Object.keys((await read()).assistant.trainingOverlays.equipment.courses).length, 1);
        await send('撤销今天训练调整'); await b(page, '确认训练调整').click(); await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('nutrition_journal_v1')).assistant.trainingOverlays.equipment.courses).length === 0);
        await b(page, '查看助手记忆').click(); await page.getByRole('radio', { name: '完全访问', exact: true }).click(); await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).assistant.authorization?.mode === 'full_access');
        await page.getByLabel('网易云训练歌单').fill('123456'); await b(page, '保存训练歌单').click(); await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).assistant.agentPreferences?.musicPlaylist === '123456');
        await page.getByRole('switch', { name: '主动训练关怀', exact: true }).click(); await page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).assistant.agentPreferences?.proactive === true);
        await b(page, '返回助手对话').click(); await send('今天训练减载'); await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('nutrition_journal_v1')).assistant.trainingOverlays.equipment.courses).length === 1); assert.equal(await b(page, '确认训练调整').count(), 0);
        await b(page, '助手拍照记餐').click(); await page.getByTestId('food-camera-sheet').getByText('拍照记餐', { exact: true }).waitFor(); await page.getByTestId('food-camera-sheet').getByRole('button', { name: '返回', exact: true }).click(); await page.getByLabel('营养问题', { exact: true }).waitFor();
        const box = await page.getByTestId('assistant-composer').boundingBox(); assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1);
        await b(page, '关闭营养助手').click();
        assert.equal(await page.getByTestId('agent-proactive-card').count(), 0, 'proactive card must stay collapsed until requested');
        await b(page, '展开个人助手关怀').click(); await page.getByTestId('agent-proactive-card').waitFor();
        await b(page, '忽略这条关怀').click(); await page.getByTestId('agent-proactive-card').waitFor({ state: 'detached' });
        await page.reload(); await b(page, '打开全局个人助手').waitFor();
        assert.ok((await b(page, '打开全局个人助手').boundingBox()).x < 24, 'dock edge survives restart');
        assert.ok((await read()).assistant.trainingOverlays.equipment); assert.equal((await read()).assistant.agentPreferences.musicPlaylist, '123456');
        assert.equal(await page.getByText(/已应用助手调整/).count(), 1); assert.equal(await b(page, '调整计划').count(), 0);
        assert.deepEqual(errors, []); assert.equal(requests.length, 0);
        if (process.env.NUTRITION_SCREENSHOT_DIR) await page.screenshot({ path: process.env.NUTRITION_SCREENSHOT_DIR + '/personal-agent-' + width + '.png' });
        console.log(`PASS personal agent ${width}px: global routes, offline query, confirmed/direct training, paired undo, photo entry, persisted music/proactive settings, truthful dose audit`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
