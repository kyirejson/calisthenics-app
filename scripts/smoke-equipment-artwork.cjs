// Isolated browser profiles: no real account, no paid API calls, no saved-user changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, f);
const { equipmentMovements } = require('../src/data/equipmentMovements.ts');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const artworkIds = new Set(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../assets/equipment-demos/provenance.json'), 'utf8')).entries.map(item => item.id));
const illustrated = equipmentMovements.filter(item => artworkIds.has(item.id));
const selected = process.env.EQUIPMENT_PARTIAL_SMOKE ? illustrated.filter(m => m.group === 'chest') : illustrated;
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-equipment-artwork-browser-'));

async function loaded(locator) {
  await locator.waitFor();
  await locator.evaluate(img => img.complete && img.naturalWidth ? undefined : new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Image decode timed out')), 15000);
    img.addEventListener('load', () => { clearTimeout(timeout); resolve(); }, { once: true });
    img.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Image failed to decode')); }, { once: true });
  }));
  const decoded = await locator.evaluate(img => ({ complete: img.complete, width: img.naturalWidth, height: img.naturalHeight, src: img.currentSrc || img.src }));
  assert.ok(decoded.complete && decoded.width >= 320, JSON.stringify(decoded));
}

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
  const errors = [], seen = [];
  try {
    for (const width of [320, 390, 681, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(() => { localStorage.setItem('user_profile', JSON.stringify({ name: '隔离图片验收', age: 30, sex: 'male', height: 175, weight: 75, goal: 'equipment', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', experience: 'intermediate', frequency: 3, levels: {}, planId: 'equipment_library', planStartedAt: new Date().toISOString() })); localStorage.setItem('sessions', '[]'); });
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && /same key|Cannot update|Rendered fewer hooks|Rendered more hooks/i.test(message.text())) errors.push(message.text()); });
      await page.route('http://127.0.0.1:8787/**', route => route.abort());
      await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.getByText('进阶', { exact: true }).click();
      await page.getByTestId('equipment-movement-list').waitFor();
      // Wait for the initial grid, not just later searched cards: a screenshot
      // taken before decoding can misleadingly show empty thumbnail slots.
      for (const thumbnail of await page.getByTestId('equipment-movement-list').locator('img').all()) await loaded(thumbnail);
      await page.waitForFunction(() => {
        const list = document.querySelector('[data-testid="equipment-movement-list"]');
        return list && Number(getComputedStyle(list).opacity) > .999;
      });
      await page.screenshot({ path: path.join(output, 'list-' + width + '.png'), animations: 'disabled' });
      // Narrow and normal phone: every image, detail, and enlargement. Wider layouts: representative views.
      const movements = width <= 390 ? selected : selected.filter(m => m.id.endsWith('_01'));
      for (const movement of movements) {
        await page.getByLabel('搜索器械动作', { exact: true }).fill(movement.name);
        await loaded(page.getByTestId('equipment-thumbnail-' + movement.id).locator('img').first());
        await page.getByRole('button', { name: '查看' + movement.name + '器械动作指导', exact: true }).click();
        const expand = page.getByRole('button', { name: '放大' + movement.name + '动作示范图', exact: true });
        await loaded(expand.locator('img').first());
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, movement.id + ' horizontal overflow at ' + width);
        if (movement.id.endsWith('_01')) await page.screenshot({ path: path.join(output, movement.id + '-' + width + '.png'), animations: 'disabled' });
        await expand.click();
        await page.getByRole('button', { name: '关闭动作大图', exact: true }).waitFor();
        await loaded(page.getByTestId('equipment-expanded-image').locator('img').first());
        if (width === 390 && movement.id.endsWith('_01')) await page.screenshot({ path: path.join(output, movement.id + '-expanded.png'), animations: 'disabled' });
        await page.getByRole('button', { name: '关闭动作大图', exact: true }).click();
        assert.equal(await page.locator('img[src*="arnold_image"]').count(), 0);
        await page.getByRole('button', { name: '返回器械动作库', exact: true }).click();
        seen.push({ width, id: movement.id });
      }
      await context.close();
      console.log(JSON.stringify({ width, checked: movements.length }));
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ detailChecks: seen.length, pageErrors: errors, screenshots: output }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
