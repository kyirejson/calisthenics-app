// Isolated calendar / GPS / transition checks: simulated coordinates, no user data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-fitness-flows-'));
const profile = { name: '流程隔离检查', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery',
  nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, planId: 'prisoner',
  levels: { push: 5, pull: 5, squat: 5, legRaise: 5, bridge: 1, hspu: 1 },
  planLevels: { push: 5, pull: 5, squat: 5, legRaise: 5 }, experience: 'intermediate', sessionMinutes: 45,
  trainingRestSeconds: 180, planStartedAt: '2026-09-28T01:00:00.000Z', weightHistory: [] };
const records = page => page.evaluate(() => JSON.parse(localStorage.getItem('sessions')));
const distance = page => page.getByTestId('running-distance').innerText().then(text => Number.parseFloat(text));
const paneReady = (page, name) => page.waitForFunction(name => {
  const pane = document.querySelector(`[data-testid="${name}"]`);
  if (!pane || pane.getAttribute('aria-hidden') === 'true') return false;
  for (let outer = pane.parentElement; outer; outer = outer.parentElement) {
    if (!/auto|scroll/.test(getComputedStyle(outer).overflowX) || outer.scrollWidth <= outer.clientWidth) continue;
    return Math.abs(pane.getBoundingClientRect().left - outer.getBoundingClientRect().left - outer.clientLeft) < 1;
  }
  return false;
}, name);

async function prepare(browser, width, reducedMotion = 'reduce') {
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Shanghai', permissions: ['geolocation'], reducedMotion });
  await context.addInitScript(profile => {
    const OriginalDate = Date, anchor = OriginalDate.parse('2026-09-28T01:30:00.000Z'), start = performance.now();
    class Clock extends OriginalDate { constructor(...args) { super(...(args.length ? args : [anchor + performance.now() - start])); } static now() { return anchor + performance.now() - start; } }
    window.Date = Clock;
    localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]');
    const position = (latitude, longitude, accuracy = 5) => ({ timestamp: Date.now(), coords: { latitude, longitude, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null } });
    const watches = new Map(); let nextId = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: callback => setTimeout(() => callback(position(31.2304, 121.4737)), 0),
      watchPosition: callback => { const id = ++nextId; watches.set(id, callback); return id; },
      clearWatch: id => watches.delete(id),
    } });
    window.qaGps = { emit: (lat, lng, accuracy = 5) => watches.forEach(callback => callback(position(lat, lng, accuracy))), count: () => watches.size };
  }, profile);
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  await page.route('http://127.0.0.1:8787/**', route => route.abort());
  await page.route('https://server.arcgisonline.com/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path fill="#1b2028" d="M0 0h256v256H0z"/></svg>' }));
  await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByTestId('today-training-content').waitFor();
  return { context, page };
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'chrome' });
  const errors = [];
  try {
    for (const width of [320, 390, 681, 1280]) {
      const { context, page } = await prepare(browser, width);
      try {
        page.on('pageerror', error => errors.push(error.message));
        const before = await page.evaluate(() => JSON.parse(localStorage.getItem('user_profile')));
        await page.getByRole('button', { name: '查看全年训练日历', exact: true }).click();
        const sheet = page.getByTestId('year-schedule-sheet'); await sheet.waitFor();
        assert.equal((await sheet.boundingBox()).width, Math.min(width, 440));
        await page.getByRole('button', { name: '下一个月', exact: true }).click();
        await page.getByRole('button', { name: /^2026年10月14日，/ }).click();
        const detail = sheet.getByTestId('schedule-day-detail'); await detail.waitFor();
        assert.ok(await detail.getByRole('button', { name: /^查看.+动作指导$/ }).count() > 0);
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="year-schedule-sheet"] img')].some(img => img.complete && img.naturalWidth === 628));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
        await page.screenshot({ path: path.join(output, `calendar-${width}.png`), animations: 'disabled' });
        await page.getByRole('button', { name: '返回本月日历', exact: true }).click();
        await page.getByRole('button', { name: '关闭全年日程', exact: true }).click();
        assert.deepEqual(await records(page), []);
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('user_profile'))), before);

        if (width === 390) {
          await page.getByRole('tab', { name: '切换到跑步', exact: true }).click(); await paneReady(page, 'today-running-page');
          assert.deepEqual(await records(page), []); assert.equal(await distance(page), 0);
          await page.getByRole('button', { name: '开始记录', exact: true }).click();
          await page.waitForFunction(() => window.qaGps.count() === 1);
          await page.evaluate(() => window.qaGps.emit(31.2304, 121.4737));
          await page.evaluate(() => window.qaGps.emit(31.2314, 121.4737));
          await page.waitForFunction(() => document.querySelector('[data-testid="running-distance"]').textContent.includes('0.11'));
          assert.equal(await distance(page), 0.11, 'Actual coordinate segment is about 111m');
          await page.evaluate(() => window.qaGps.emit(31.26, 121.48, 100));
          assert.equal(await distance(page), 0.11, 'Reject low-accuracy location');
          await page.getByRole('button', { name: '暂停记录', exact: true }).click();
          await page.evaluate(() => window.qaGps.emit(31.25, 121.48));
          assert.equal(await distance(page), 0.11, 'Paused movement is not counted');
          await page.getByRole('button', { name: '继续记录', exact: true }).click();
          await page.evaluate(() => window.qaGps.emit(31.2324, 121.4737));
          assert.equal(await distance(page), 0.11, 'Resume starts a new segment, not a teleport');
          await page.evaluate(() => window.qaGps.emit(31.2334, 121.4737));
          await page.waitForFunction(() => document.querySelector('[data-testid="running-distance"]').textContent.includes('0.22'));
          // Simulate storage rejection; the recorder must retain the real route and allow retry.
          await page.evaluate(() => { window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'sessions') throw new DOMException('QA quota', 'QuotaExceededError'); return window.qaSetItem.call(this, key, value); }; });
          await page.getByRole('button', { name: '结束并保存', exact: true }).click();
          await page.getByText(/保存失败 · 数据仍保留/).waitFor();
          assert.equal(await distance(page), 0.22); assert.deepEqual(await records(page), []);
          await page.evaluate(() => { Storage.prototype.setItem = window.qaSetItem; });
          await page.getByRole('button', { name: '结束并保存', exact: true }).click();
          await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions')).length === 1);
          const saved = (await records(page))[0];
          assert.equal(saved.kind, 'running'); assert.equal(saved.distanceKm, 0.22); assert.equal(saved.totalReps, 0);
          assert.deepEqual(saved.exercises, []); assert.equal(saved.route.length, 4);
          assert.ok(saved.durationSeconds >= 1); assert.equal(await page.evaluate(() => window.qaGps.count()), 0);
          await page.getByRole('button', { name: '开始记录', exact: true }).waitFor();
          assert.equal(await distance(page), 0);
          console.log('PASS real-coordinate distance, pause/resume, accuracy filter, failed-save retry; no invented strength reps');
        }
        console.log(`PASS ${width}px calendar pagination / future date actions / originals / unchanged profile`);
      } finally { await context.close(); }
    }

    const { context, page } = await prepare(browser, 390, 'no-preference');
    try {
      page.on('pageerror', error => errors.push(error.message));
      await page.getByRole('button', { name: '开始今日训练  →', exact: true }).click();
      await page.getByTestId('training-action-reveal').waitFor();
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-testid="training-action-reveal"]')).opacity) > .99);
      await page.evaluate(() => {
        window.qaMotion = []; const end = performance.now() + 750;
        const sample = () => { const element = document.querySelector('[data-testid="training-action-reveal"]'); if (element) window.qaMotion.push(Number(getComputedStyle(element).opacity)); if (performance.now() < end) requestAnimationFrame(sample); else window.qaMotionDone = true; };
        requestAnimationFrame(sample);
      });
      await page.getByRole('button', { name: '下一个动作 →', exact: true }).click();
      await page.waitForFunction(() => window.qaMotionDone);
      const values = await page.evaluate(() => window.qaMotion);
      assert.ok(values.some(value => value > .05 && value < .95), 'Transition has intermediate frames');
      const start = values.indexOf(Math.min(...values));
      for (let index = start + 1; index < values.length; index++) assert.ok(values[index] + .002 >= values[index - 1], 'Opacity progresses monotonically');
      assert.ok(values.at(-1) > .99);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByText('上一个', { exact: true }).click();
      assert.equal(await page.getByTestId('training-action-reveal').evaluate(el => Number(getComputedStyle(el).opacity)), 1);
      assert.deepEqual(await records(page), []);
      console.log('PASS smooth action reveal and reduced-motion setting; switching actions does not create records');
    } finally { await context.close(); }
    assert.deepEqual(errors, []); console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); console.error('Screenshots: ' + output); process.exitCode = 1; });
