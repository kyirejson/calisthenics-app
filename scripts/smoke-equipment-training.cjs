// Isolated browser contexts only; never connects to or rewrites the user's open tab.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = { name: 'Training QA', age: 30, sex: 'male', height: 175, weight: 75, goal: 'equipment', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, equipmentSplit: 'bro', experience: 'advanced', levels: { push: 5 }, planId: 'equipment_training_v1', planStartedAt: new Date(Date.now() - 14 * 86400000).toISOString() };
(async () => {
 const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
 const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-equipment-v2-')), errors = [];
 try {
  for (const width of [320, 471, 659]) {
   const context = await browser.newContext({ viewport: { width, height: 871 }, reducedMotion: 'reduce' });
   await context.addInitScript(profile => { if (!localStorage.getItem('equipment_v2_qa')) { localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', JSON.stringify([{ id: 'historical', workoutId: 'equipment_bro_3_0', workoutName: '历史课程', kind: 'strength', startedAt: new Date(Date.now() - 86400000).toISOString(), exercises: [{ exerciseId: 'equipment_chest_03', sets: [{ reps: 8, completed: true, loadKg: 30 }] }] }])); localStorage.setItem('equipment_v2_qa', 'yes'); } }, base);
   const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
   await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
   await page.getByTestId('equipment-today-screen').waitFor();
   const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('user_profile')));
   assert.equal(stored.frequency, 5); assert.equal(stored.planId, 'equipment_training_v2'); assert.equal(stored.levels.push, 5);
   assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sessions'))[0].id), 'historical');
   assert.equal(await page.getByTestId('equipment-today-screen').getByText(/第 \d+ 周|重量待校准|适应期|基础推荐/).count(), 0);
   await page.getByRole('button', { name: '设置器械训练计划', exact: true }).click();
   const card = await page.getByTestId('equipment-plan-editor').boundingBox();
   assert.ok(card.x >= 15 && card.x + card.width <= width - 15);
   assert.equal(await page.getByTestId('equipment-frequency-wheel').getAttribute('aria-valuemin'), '5');
   assert.equal(await page.getByTestId('equipment-time-slider').count(), 0);
   const beforeCancel = await page.evaluate(() => localStorage.getItem('user_profile'));
   await page.getByRole('radio', { name: '选择上 / 下肢分化', exact: true }).click();
   assert.equal(await page.getByTestId('equipment-frequency-wheel').getAttribute('aria-valuemin'), '2');
   await page.getByRole('button', { name: '关闭器械设置', exact: true }).click();
   assert.equal(await page.evaluate(() => localStorage.getItem('user_profile')), beforeCancel);
   await page.getByRole('button', { name: '设置器械训练计划', exact: true }).click();
   await page.getByRole('radio', { name: '选择推 / 拉 / 腿', exact: true }).click();
   const wheel = page.getByTestId('equipment-frequency-wheel');
   await wheel.focus(); await page.keyboard.press('End');
   assert.equal(await wheel.getAttribute('aria-valuenow'), '6');
   await page.getByRole('button', { name: '编辑预览动作', exact: true }).click();
   await page.getByRole('button', { name: '替换坐姿水平对敛推胸机', exact: true }).click();
   await page.getByRole('button', { name: '替换为平板哑铃卧推', exact: true }).click();
   await page.getByRole('button', { name: '器械与偏好', exact: true }).click();
   const gear = ['哑铃', '杠铃', '史密斯', '固定器械', '绳索', '自重器材', '辅助器材'];
   for (const name of gear) await page.getByRole('checkbox', { name: '可用' + name, exact: true }).click();
   assert.equal(await page.getByRole('button', { name: '保存计划', exact: true }).isDisabled(), true);
   for (const name of gear) await page.getByRole('checkbox', { name: '可用' + name, exact: true }).click();
   assert.equal(await page.getByRole('button', { name: '保存计划', exact: true }).isEnabled(), true);
   await page.getByRole('button', { name: '保存计划', exact: true }).click();
   await page.getByTestId('equipment-today-screen').getByText('推力训练 A', { exact: true }).waitFor();
   await page.screenshot({ path: path.join(output, 'today-' + width + '.png'), animations: 'disabled' });
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
   await page.getByRole('button', { name: /^开始训练/ }).click();
   await page.getByTestId('training-screen-title').waitFor();
   await page.getByLabel('第1组重量kg', { exact: true }).fill('30');
   await page.getByLabel('第1组次', { exact: true }).fill('10');
   await page.getByRole('checkbox', { name: '第1组完成', exact: true }).click();
   await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions'))?.some(s => s.planSnapshot?.schemaVersion === 4));
   const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('sessions')).find(s => s.planSnapshot?.schemaVersion === 4).planSnapshot);
   assert.equal(snapshot.spec, undefined); assert.equal(snapshot.budgetSeconds, undefined);
   await page.getByText('＋ 加一组', { exact: true }).click();
   assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('sessions')).find(s => s.planSnapshot?.schemaVersion === 4).planSnapshot), snapshot);
   await page.reload({ waitUntil: 'domcontentloaded' });
   await page.getByTestId('equipment-today-screen').waitFor();
   await page.getByTestId('equipment-today-screen').getByText('部分完成', { exact: true }).waitFor();
   assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sessions')).some(s => s.id === 'historical')), true);
   await context.close();
  }
  assert.deepEqual(errors, []); console.log('PASS: 320/471/659px migration, preserved history, glass modal, limits/wheel, cancel/save, gear validation, replacement, schema-4 record and unchanged original snapshot. Screenshots: ' + output);
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
