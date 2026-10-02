// Compare the actual rendered scale of the two tabs, in isolated storage only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const baseline = process.argv.includes('--baseline');
const output = fs.mkdtempSync(path.join(os.tmpdir(), baseline ? 'uncover-layout-before-' : 'uncover-layout-after-'));
const profile = { name: '页面比例隔离验证', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery',
  nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, levels: { push: 5 }, planLevels: { push: 5 },
  experience: 'intermediate', sessionMinutes: 45, trainingRestSeconds: 180, planId: 'prisoner', planStartedAt: new Date().toISOString(), weightHistory: [] };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    for (const width of [320, 390, 681, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: true, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
      try {
        await context.addInitScript(profile => {
          localStorage.setItem('user_profile', JSON.stringify(profile));
          localStorage.setItem('sessions', '[]');
        }, profile);
        const page = await context.newPage(); page.setDefaultTimeout(10000);
        page.on('pageerror', error => errors.push(error.message));
        await page.route('http://127.0.0.1:8787/**', route => route.abort());
        await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        const measurements = {};
        let savedBefore;
        for (const [tab, title, list, control, exercise] of [
          ['数据', '进步记录', 'training-data-list', '查看俯卧撑进步记录', '标准俯卧撑 ›'],
          ['进阶', '进阶路线', 'progression-list', '选择俯卧撑进阶路线', '标准俯卧撑'],
        ]) {
          await page.getByText(tab, { exact: true }).click();
          await page.getByTestId(list).waitFor();
          if (tab === '进阶') await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-testid="progression-route-reveal"]')).opacity) === 1);
          measurements[tab] = await page.getByText(title, { exact: true }).evaluate(element => {
            let content = element.parentElement;
            while (content && getComputedStyle(content).maxWidth === 'none') content = content.parentElement;
            if (!content) throw new Error('找不到受限宽度的页面内容');
            const style = getComputedStyle(content), text = getComputedStyle(element), box = content.getBoundingClientRect();
            return { width: box.width, x: box.x, inset: parseFloat(style.paddingLeft), top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom),
              fontSize: parseFloat(text.fontSize), fontWeight: text.fontWeight, titleY: element.getBoundingClientRect().y };
          });
          measurements[tab].control = await page.getByRole('button', { name: control, exact: true }).getByText('俯卧撑', { exact: true }).evaluate(element => parseFloat(getComputedStyle(element).fontSize));
          measurements[tab].action = await page.getByText(exercise, { exact: true }).evaluate(element => parseFloat(getComputedStyle(element).fontSize));
          measurements[tab].background = await page.getByTestId(list).evaluate(element => getComputedStyle(element.parentElement).backgroundColor);
          const saved = await page.evaluate(() => ({ profile: localStorage.getItem('user_profile'), sessions: localStorage.getItem('sessions') }));
          if (!savedBefore) savedBefore = saved; else assert.deepEqual(saved, savedBefore);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
          await page.screenshot({ path: path.join(output, `${tab}-${width}.png`), animations: 'disabled' });
        }
        console.log(JSON.stringify({ viewport: width, ...measurements }));
        if (!baseline) {
          const data = measurements['数据'], progress = measurements['进阶'];
          for (const key of ['width', 'x', 'inset', 'top', 'bottom', 'fontSize', 'fontWeight', 'control', 'action', 'background']) assert.equal(progress[key], data[key], `${width}px ${key}`);
          assert.equal(progress.width, Math.min(width, 440));
          assert.equal(progress.inset, 16); assert.equal(progress.fontSize, 22);
          assert.ok(Math.abs(progress.titleY - data.titleY) < 6, 'page titles should align despite the extra progression subtitle');
          assert.equal((await page.getByTestId('progression-final-ring').boundingBox()).width, 64);
        }
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
    console.log((baseline ? 'BASELINE' : 'PASS') + ' two-tab layout measurements, 320 / 390 / 681 / 1280, original user storage untouched');
    console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
