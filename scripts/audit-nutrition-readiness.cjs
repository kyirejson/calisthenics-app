// Readiness diagnostics in disposable browser contexts. Known gaps are reported,
// not blessed as passing feature tests. No real provider or user data is accessed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { waitForNutritionPage } = require('./nutrition-smoke-utils.cjs');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const { emptyNutritionJournal, defaultNutritionPreferences } = require('../src/nutrition/engine.ts');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-nutrition-readiness-'));
const profile = { name: '上线审核隔离用户', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery',
  nutritionGoal: 'performance', dietPattern: 'balanced_cn', frequency: 3, planId: 'prisoner',
  levels: { push: 5, pull: 5, squat: 5, legRaise: 5, bridge: 1, hspu: 1 },
  planLevels: { push: 5, pull: 5, squat: 5, legRaise: 5 }, experience: 'intermediate', sessionMinutes: 45,
  trainingRestSeconds: 180, planStartedAt: '2026-09-28T01:00:00.000Z', weightHistory: [] };
const read = page => page.evaluate(() => ({ profile: JSON.parse(localStorage.getItem('user_profile')), journal: JSON.parse(localStorage.getItem('nutrition_journal_v1')) }));
const shot = (page, name) => page.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' });
const findings = {};
async function addFood(page, query, name, slot = 'breakfast') {
  await page.getByRole('button', { name: '管理当日饮食记录', exact: true }).click();
  await page.getByRole('button', { name: '添加饮食记录', exact: true }).click();
  await page.getByRole('button', { name: slot === 'breakfast' ? '早餐' : '晚餐', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索食材名称或别名', exact: true }).fill(query);
  await page.getByRole('button', { name }).click();
  await page.getByRole('button', { name: '加入清单', exact: true }).click();
  await page.getByRole('button', { name: '保存实际摄入记录', exact: true }).click();
  await page.getByRole('button', { name: '关闭实际摄入编辑器', exact: true }).waitFor({ state: 'hidden' });
}
async function prepare(browser, width, screened = false) {
  const context = await browser.newContext({ viewport: { width, height: 871 }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
  const journal = emptyNutritionJournal();
  if (screened) journal.preferences = { ...defaultNutritionPreferences(profile), screeningCompletedAt: '2026-09-28T01:00:00.000Z' };
  await context.addInitScript(({ profile, journal }) => {
    const OriginalDate = Date, time = OriginalDate.parse('2026-09-28T10:30:00.000Z'), start = performance.now();
    class Clock extends OriginalDate { constructor(...args) { super(...(args.length ? args : [time + performance.now() - start])); } static now() { return time + performance.now() - start; } }
    window.Date = Clock;
    if (!localStorage.getItem('readiness-seeded')) {
      localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]');
      localStorage.setItem('nutrition_journal_v1', JSON.stringify(journal)); localStorage.setItem('readiness-seeded', 'yes');
    }
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === window.qaFailWrite) throw new Error('Isolated write rejection'); return write.call(this, key, value); };
  }, { profile, journal });
  let configured = false, photoWorks = false;
  const uploads = [];
  await context.route('http://127.0.0.1:8787/**', route => {
    const request = route.request(), headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8081', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.url().endsWith('/health')) return route.fulfill({ headers, json: { configured, model: 'readiness-fixture', provider: 'mock-only' } });
    if (request.url().endsWith('/analyze-photo')) {
      uploads.push(request.postDataJSON());
      return photoWorks ? route.fulfill({ headers, json: { id: 'readiness-photo', model: 'mock-only',
        items: [{ name: '测试米饭', portionLabel: '测试用小碗', nutrients: { calories: 130, protein: 2.7, carbs: 28.2, fat: .3, fiber: .4 }, calorieRange: { min: 90, max: 180 } }], assumptions: ['测试结果'], warnings: ['仅为隔离测试'] } })
        : route.fulfill({ status: 503, headers, json: { error: { message: '识图服务暂不可用；未保存记录。' } } });
    }
    return route.abort();
  });
  const open = async () => {
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('tab', { name: '切换到饮食', exact: true }).click(); await waitForNutritionPage(page);
    return page;
  };
  return { context, page: await open(), open, uploads, setConfigured: value => { configured = value; }, setPhotoWorks: value => { photoWorks = value; } };
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'chrome' });
  try {
    const fresh = await prepare(browser, 320);
    try {
      assert.equal(await fresh.page.getByTestId('nutrition-recorded-energy').innerText(), '—');
      assert.equal(await fresh.page.getByTestId('nutrition-next-meal').count(), 0);
      await addFood(fresh.page, '水煮蛋', /^水煮全蛋（熟、去壳）/);
      assert.equal((await read(fresh.page)).journal.entries.length, 1);
      assert.ok(Number(await fresh.page.getByTestId('nutrition-recorded-energy').innerText()) > 0);
      assert.equal(fresh.uploads.length, 0);
      await fresh.page.getByRole('button', { name: '告诉营养助手', exact: true }).click();
      await fresh.page.getByLabel('营养问题', { exact: true }).fill('营养目标设为增肌，饮食模式设为均衡');
      await fresh.page.getByRole('button', { name: '发送营养问题', exact: true }).click();
      await fresh.page.getByRole('button', { name: '确认保存营养偏好', exact: true }).waitFor();
      assert.equal((await read(fresh.page)).journal.preferences, null);
      await fresh.page.getByRole('button', { name: '确认保存营养偏好', exact: true }).click();
      await fresh.page.waitForFunction(() => JSON.parse(localStorage.getItem('nutrition_journal_v1')).preferences?.objective === 'muscle_gain');
      findings.onboarding = { assistantPreferenceRecording: true, noAutomaticHealthConfirmation: !(await read(fresh.page)).journal.preferences.screeningCompletedAt };
      await shot(fresh.page, 'first-use-assistant-320');
      await fresh.page.getByRole('button', { name: '关闭营养助手', exact: true }).click();
      fresh.setConfigured(true);
      await fresh.page.getByRole('button', { name: '拍照记餐', exact: true }).click();
      await fresh.page.getByText('营养服务已连接 · 照片结果为估算', { exact: true }).waitFor();
      assert.equal(fresh.uploads.length, 0, 'No upload before consent');
      await fresh.page.getByRole('button', { name: '同意本次发送照片', exact: true }).click();
      const image = await fresh.page.screenshot();
      const [chooser] = await Promise.all([fresh.page.waitForEvent('filechooser'), fresh.page.getByRole('button', { name: '从相册选', exact: true }).click()]);
      await chooser.setFiles({ name: 'readiness-fixture.png', mimeType: 'image/png', buffer: image });
      await fresh.page.getByRole('alert').filter({ hasText: '识图服务暂不可用' }).waitFor();
      assert.equal((await read(fresh.page)).journal.entries.length, 1, 'Service failure must not add a meal');
      findings.healthIndicator = { reportsConnectedWithHealthConfiguredOnly: true, photoCallReturned503: true, failedPhotoDidNotWrite: true };
      await shot(fresh.page, 'health-connected-but-photo-failed-320');
      fresh.setPhotoWorks(true);
      await fresh.page.getByRole('button', { name: '联网重新估算这张照片', exact: true }).click();
      await fresh.page.getByRole('radio', { name: '午餐', exact: true }).waitFor();
      const mealRadios = await fresh.page.getByRole('radio').evaluateAll(elements => elements.map(el => ({
        label: el.textContent, checked: el.getAttribute('aria-checked'), background: getComputedStyle(el).backgroundColor,
      })));
      findings.defaultCameraSlot = { localTime: '18:30', radios: mealRadios,
        visuallySelected: mealRadios.find(item => item.background === 'rgb(36, 46, 32)')?.label ?? 'not-determined' };
      assert.equal((await read(fresh.page)).journal.entries.length, 1, 'A successful response still needs user confirmation');
      await fresh.page.getByRole('button', { name: '关闭', exact: true }).click();
      console.log('VERIFIED first-use manual logging, assistant preferences, consent, failed-request preservation, confirmation boundary');
    } finally { await fresh.context.close(); }

    const partial = await prepare(browser, 390, true);
    try {
      await partial.page.getByRole('button', { name: '问营养助手', exact: true }).click();
      await partial.page.getByLabel('营养问题', { exact: true }).fill('我有糖尿病');
      await partial.page.getByRole('button', { name: '发送营养问题', exact: true }).click();
      await partial.page.getByRole('button', { name: '确认保存营养偏好', exact: true }).waitFor();
      await partial.page.evaluate(() => { window.qaFailWrite = 'nutrition_journal_v1'; });
      await partial.page.getByRole('button', { name: '确认保存营养偏好', exact: true }).click();
      await partial.page.getByRole('alert').filter({ hasText: /保存失败/ }).waitFor();
      const state = await read(partial.page);
      findings.partialProfileSave = { weightUnchanged: state.profile.weight, requestedMedicalFlagPersisted: state.journal.preferences.riskFlags.includes('medical_condition'), errorShown: true };
      assert.equal(state.journal.preferences.riskFlags.includes('medical_condition'), false);
      await shot(partial.page, 'atomic-preferences-save-failure-390');
      await partial.page.getByRole('button', { name: '关闭营养助手', exact: true }).click();
      findings.partialProfileSave.oldAutomaticTargetStillVisible = /\/ \d+ kcal/.test(await partial.page.getByTestId('nutrition-energy-card').innerText());
      await partial.page.evaluate(() => { window.qaFailWrite = null; });
    } finally { await partial.context.close(); }

    const windows = await prepare(browser, 390, true);
    try {
      const second = await windows.open();
      await addFood(windows.page, '水煮蛋', /^水煮全蛋（熟、去壳）/);
      const firstId = (await read(windows.page)).journal.entries[0].id;
      await addFood(second, '低脂奶', /^低脂牛奶（2%）/, 'dinner');
      const persisted = (await read(second)).journal.entries;
      findings.webMultipleWriters = { firstEntryRetained: persisted.some(entry => entry.id === firstId), persistedCountAfterTwoIndependentAdds: persisted.length };
    } finally { await windows.context.close(); }
    console.log('AUDIT_FINDINGS ' + JSON.stringify(findings));
    console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); console.error('Screenshots: ' + output); process.exitCode = 1; });
