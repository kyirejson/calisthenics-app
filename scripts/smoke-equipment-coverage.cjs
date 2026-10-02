const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(require('node:fs').readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, f);
const expectedSets = require('../src/data/equipmentDosePolicy.ts').equipmentWeeklyUnits.flatMap(unit => unit.doses).reduce((sum, dose) => sum + dose.sets, 0);
// Exhaustive UI coverage test uses a separate synthetic browser context.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const profile = { name: 'Coverage QA', age: 30, sex: 'male', height: 175, weight: 75, goal: 'equipment', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 6, equipmentSplit: 'ppl', experience: 'advanced', levels: {}, planId: 'equipment_training_v2', planStartedAt: new Date().toISOString() };
(async () => {
 const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
 const context = await browser.newContext({ viewport: { width: 471, height: 871 }, reducedMotion: 'reduce' }), errors = [];
 try {
  await context.addInitScript(p => { localStorage.setItem('user_profile', JSON.stringify(p)); localStorage.setItem('sessions', '[]'); }, profile);
  const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByTestId('equipment-today-screen').waitFor();
  await page.getByRole('button', { name: '设置器械训练计划', exact: true }).click();
  await page.getByRole('button', { name: '查看每周肌群覆盖', exact: true }).click();
  for (const [label, min] of [['选择传统五分化', 5], ['选择推 / 拉 / 腿', 3], ['选择上 / 下肢分化', 2]]) {
   await page.getByRole('radio', { name: label, exact: true }).click();
   const wheel = page.getByTestId('equipment-frequency-wheel');
   assert.equal(await wheel.getAttribute('aria-valuemin'), String(min));
   await wheel.focus(); await page.keyboard.press('Home');
   for (let n = min; n <= 6; n++) {
    assert.equal(await wheel.getAttribute('aria-valuenow'), String(n));
    assert.equal(await page.getByTestId('equipment-region-row').count(), 28);
    assert.equal(await page.getByTestId('equipment-volume-review').getByText(/已安排/).count(), 28);
    assert.match(await page.getByTestId('equipment-volume-review').innerText(), /33 项动作功能/);
    assert.match(await page.getByTestId('equipment-week-summary').innerText(), new RegExp(expectedSets + ' 工作组'));
    assert.equal(await page.getByTestId('equipment-plan-training-day').count(), n);
    assert.equal(await page.getByRole('button', { name: '保存计划', exact: true }).isEnabled(), true);
    await page.getByRole('button', { name: '预览下一周', exact: true }).click();
    assert.equal(await page.getByTestId('equipment-volume-review').getByText(/已安排/).count(), 28);
    await page.getByRole('button', { name: '预览上一周', exact: true }).click();
    await wheel.focus(); if (n < 6) await page.keyboard.press('ArrowDown');
   }
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  assert.deepEqual(errors, []); console.log('PASS: all 11 selectable combinations show 28 regional targets and 33 movement functions, invariant weekly sets, every-week coverage and matching day counts.');
 } finally { await context.close(); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
