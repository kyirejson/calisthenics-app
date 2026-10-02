// UI pruning regression: isolated profiles and synthetic meals only. AI and
// external network calls are blocked; the user's browser/storage are untouched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { waitForNutritionPage } = require('./nutrition-smoke-utils.cjs');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { emptyNutritionJournal, defaultNutritionPreferences, sumNutrients } = require('../src/nutrition/engine.ts');
const { withIntakeEntry } = require('../src/nutrition/journal.ts');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-nutrition-declutter-'));
const day = '2026-09-28', anchor = day + 'T10:30:00.000Z';
const profile = { name: '隔离界面测试', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery',
  nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 6, planId: 'prisoner',
  levels: { push: 5, pull: 5, squat: 5, legRaise: 5, bridge: 1, hspu: 1 }, experience: 'intermediate', sessionMinutes: 45,
  trainingRestSeconds: 180, planStartedAt: day + 'T01:00:00.000Z', weightHistory: [] };
let journal = emptyNutritionJournal();
journal.preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: anchor };
for (const [slot, grams] of [['breakfast', 200], ['lunch', 300]]) journal = withIntakeEntry(journal, {
  id: 'pruning-' + slot, date: day, slot, name: slot === 'breakfast' ? '已记早餐' : '已记午餐', source: 'manual',
  portions: [{ foodId: 'rice-cooked', grams }], now: anchor,
});
const read = page => page.evaluate(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')));
const button = (page, name) => page.getByRole('button', { name, exact: true });
async function inViewport(locator, width, height) {
  const box = await locator.boundingBox();
  assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, 'Control must fit the viewport');
  assert.ok(box.height >= 44, 'Control must retain a 44 px touch target');
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'chrome' });
  const errors = [], aiRequests = [];
  try {
    for (const width of [320, 390, 650, 681, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 871 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
      try {
        await context.addInitScript(({ profile, journal, anchor }) => {
          const OriginalDate = Date, start = performance.now(), time = OriginalDate.parse(anchor);
          class QAClock extends OriginalDate { constructor(...args) { super(...(args.length ? args : [time + performance.now() - start])); } static now() { return time + performance.now() - start; } }
          window.Date = QAClock;
          if (!localStorage.getItem('pruning-seeded')) {
            localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal));
            localStorage.setItem('sessions', '[]'); localStorage.setItem('pruning-seeded', 'yes');
          }
          const write = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, value) { if (window.qaFailWrite === key) throw new Error('Isolated save failure'); return write.call(this, key, value); };
        }, { profile, journal, anchor });
        await context.route('**/*', route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin === 'http://127.0.0.1:8081') return route.continue();
          if (url.origin === 'http://127.0.0.1:8787' && url.pathname === '/health') return route.fulfill({ status: 200,
            headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8081' }, json: { configured: false } });
          if (['/advice', '/analyze-photo'].includes(url.pathname)) aiRequests.push(url.pathname);
          return route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(12000);
        page.on('pageerror', error => errors.push(error.message));
        const enterDiet = async () => { await page.getByRole('tab', { name: '切换到饮食', exact: true }).click(); await waitForNutritionPage(page); };
        const screenshot = async name => page.screenshot({ path: path.join(output, name + '-' + width + '.png'), animations: 'disabled' });
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await enterDiet();
        await page.waitForFunction(day => JSON.parse(localStorage.getItem('nutrition_journal_v1')).days[day]?.targetHistory.length > 0, day);
        const baseline = await read(page), targets = baseline.days[day].targetHistory.at(-1).targets;
        const diet = page.getByTestId('nutrition-content');
        for (const label of ['记录完整度', '训练与饮食', '今日推荐菜单', '近 7 天复盘', '快捷记餐', '早餐建议', '午餐建议', '晚餐建议', '加餐建议', '饮食记录保存在本机 · 识图和问答经同意后联网处理']) {
          assert.equal(await diet.getByText(label, { exact: true }).count(), 0);
        }
        assert.equal(await page.getByTestId('nutrition-logging-controls').count(), 0);
        assert.equal(await button(page, '展开或收起今日推荐菜单').count(), 0);
        assert.equal(await button(page, '训练时段：晚上').count(), 0);
        assert.equal(await button(page, '设置训练时段').count(), 0);
        assert.equal(await button(page, '展开或收起每周饮食复盘').count(), 0);
        assert.equal(await button(page, '搜索 / 自定义').count(), 0);
        assert.equal(await button(page, '问营养助手').count(), 1);
        assert.equal(await page.getByTestId('nutrition-primary-actions').getByRole('button').count(), 2);
        const camera = await button(page, '拍照记餐').boundingBox(), assistant = await button(page, '问营养助手').boundingBox();
        assert.ok(Math.abs(camera.y - assistant.y) < 1 && assistant.x > camera.x + camera.width, 'Assistant must replace search beside the camera');
        await inViewport(button(page, '拍照记餐'), width, 871); await inViewport(button(page, '问营养助手'), width, 871);
        assert.equal(await page.getByTestId('nutrition-recorded-energy').innerText(), String(Math.round(sumNutrients(baseline.entries.map(entry => entry.nutrients)).calories)));
        await screenshot('diet-top');

        // Completeness checks remain in the user-opened records dialog.
        assert.equal(await page.getByTestId('nutrition-next-meal').count(), 0);
        assert.equal(await button(page, '查看做法').count(), 0);
        await button(page, '管理当日饮食记录').click();
        await page.getByTestId('nutrition-record-details').waitFor();
        assert.deepEqual((await read(page)).entries, baseline.entries);
        assert.deepEqual((await read(page)).days[day].confirmedSlots, []);
        await button(page, '关闭饮食记录').click();
        await button(page, '管理当日饮食记录').click();
        await page.getByRole('checkbox', { name: '确认早餐已记完整', exact: true }).click();
        await button(page, '取消').click();
        assert.deepEqual((await read(page)).days[day].confirmedSlots, []);
        await page.getByRole('checkbox', { name: '确认早餐已记完整', exact: true }).click();
        await button(page, '确认已记完整').click();
        await page.getByRole('checkbox', { name: '撤销早餐已记完整', exact: true }).waitFor();
        assert.equal(await page.getByRole('checkbox', { name: '撤销早餐已记完整', exact: true }).getAttribute('aria-checked'), 'true');
        assert.deepEqual((await read(page)).entries, baseline.entries);
        await button(page, '确认当日饮食全部记完整').click(); await button(page, '确认已记完整').click();
        await button(page, '撤销当日完整记录确认').waitFor();
        assert.ok((await read(page)).days[day].completedAt);
        await button(page, '撤销当日完整记录确认').click();
        await page.getByRole('checkbox', { name: '确认早餐已记完整', exact: true }).waitFor();
        assert.deepEqual((await read(page)).days[day].confirmedSlots, []);
        await page.getByTestId('nutrition-logging-controls').scrollIntoViewIfNeeded(); await screenshot('record-check');
        await button(page, '关闭饮食记录').click();
        await page.getByTestId('nutrition-logging-controls').waitFor({ state: 'detached' });
        assert.equal(await page.getByTestId('nutrition-logging-controls').count(), 0);
        assert.equal(await button(page, '核对已记餐次').count(), 0);

        await button(page, '管理当日饮食记录').click(); await button(page, '添加饮食记录').click();
        await page.getByLabel('搜索食材名称或别名', { exact: true }).waitFor();
        await button(page, '关闭实际摄入编辑器').click();
        assert.deepEqual((await read(page)).entries, baseline.entries);

        await page.reload({ waitUntil: 'domcontentloaded' }); await enterDiet();
        assert.deepEqual((await read(page)).entries, baseline.entries);
        assert.deepEqual((await read(page)).days[day].targetHistory.at(-1).targets, targets);
        assert.equal((await read(page)).trainingTime, baseline.trainingTime);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.getByText('计算与知识依据', { exact: true }).scrollIntoViewIfNeeded(); await screenshot('diet-bottom');

        // Removing page-bottom prose must not remove the consent gates themselves.
        await button(page, '拍照记餐').click(); await button(page, '同意联网，开始拍摄').waitFor(); await button(page, '返回').click();
        await button(page, '问营养助手').click(); await button(page, '助手语音输入').waitFor(); await button(page, '关闭营养助手').click();
        if (width === 320) {
          await page.setViewportSize({ width, height: 568 });
          await button(page, '管理当日饮食记录').click();
          await inViewport(button(page, '添加饮食记录'), width, 568); await inViewport(button(page, '关闭饮食记录'), width, 568);
          await page.getByTestId('nutrition-logging-controls').scrollIntoViewIfNeeded();
          await screenshot('short-record-check'); await button(page, '关闭饮食记录').click();
        }
        console.log('PASS ' + width + ' px: declutter / on-demand controls / confirmation and cancel / consent / persistence');
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []); assert.deepEqual(aiRequests, []);
    console.log('PASS no page errors / no real AI requests / isolated user data');
    console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); console.error('Screenshots: ' + output); process.exitCode = 1; });
