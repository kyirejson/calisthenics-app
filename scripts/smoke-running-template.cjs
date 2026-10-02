// Isolated browser fixtures; synthetic GPS and mocked tiles do not prove real map/GPS availability.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-run-template-'));
const profile = { name: '跑步隔离验证', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery',
  nutritionGoal: 'maintain', dietPattern: 'balanced_cn', frequency: 3, planId: 'prisoner',
  levels: { push: 5, pull: 5, squat: 5, legRaise: 5, bridge: 1, hspu: 1 },
  planLevels: { push: 5, pull: 5, squat: 5, legRaise: 5 }, experience: 'intermediate', sessionMinutes: 45,
  trainingRestSeconds: 180, planStartedAt: '2026-09-28T01:00:00.000Z', weightHistory: [] };
const distance = page => page.getByTestId('running-distance').innerText().then(text => Number.parseFloat(text));
const snapshot = page => page.evaluate(() => Object.fromEntries(['user_profile', 'sessions', 'settings', 'nutrition_journal_v1'].map(key => [key, localStorage.getItem(key)])));
async function open(browser, width, denied = false, height = 871, brokenMap = false) {
  const context = await browser.newContext({ viewport: { width, height }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce', ...(denied ? {} : { permissions: ['geolocation'] }) });
  await context.addInitScript(({ profile, denied }) => {
    const OriginalDate = Date, anchor = OriginalDate.parse('2026-09-28T01:30:00.000Z'), start = performance.now();
    class Clock extends OriginalDate { constructor(...args) { super(...(args.length ? args : [anchor + performance.now() - start + window.qaTimeOffset])); } static now() { return anchor + performance.now() - start + window.qaTimeOffset; } }
    window.qaTimeOffset = 0; window.Date = Clock;
    if (!localStorage.getItem('qa_running_seeded')) {
      localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]');
      localStorage.setItem('settings', JSON.stringify({ vibration: false, restSeconds: 150 }));
      localStorage.setItem('qa_running_seeded', 'yes');
    }
    const position = (latitude, longitude, accuracy = 5) => ({ timestamp: Date.now(), coords: { latitude, longitude, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null } });
    const watches = new Map(); let nextId = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (callback, error) => setTimeout(() => denied ? error({ code: 1, PERMISSION_DENIED: 1, message: 'QA permission denied' }) : callback(position(31.2304, 121.4737)), 0),
      watchPosition: callback => { const id = ++nextId; watches.set(id, callback); return id; }, clearWatch: id => watches.delete(id),
    } });
    window.qaGps = { emit: (lat, lng, accuracy = 5) => watches.forEach(callback => callback(position(lat, lng, accuracy))), count: () => watches.size };
  }, { profile, denied });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  await page.route('http://127.0.0.1:8787/**', route => route.abort());
  let mapFails = brokenMap;
  await page.route('https://server.arcgisonline.com/**', route => mapFails ? route.fulfill({ status: 403, contentType: 'text/plain', body: 'Fixture map unavailable' }) : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#1b2028"/><path d="M0 80h256M120 0v256" stroke="#343c48" stroke-width="8"/></svg>' }));
  await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByTestId('today-training-content').waitFor();
  await page.getByRole('tab', { name: '切换到跑步', exact: true }).click();
  await page.waitForFunction(() => {
    const pane = document.querySelector('[data-testid="today-running-page"]');
    if (!pane || pane.getAttribute('aria-hidden') === 'true') return false;
    for (let outer = pane.parentElement; outer; outer = outer.parentElement) {
      if (!/auto|scroll/.test(getComputedStyle(outer).overflowX) || outer.scrollWidth <= outer.clientWidth) continue;
      return Math.abs(pane.getBoundingClientRect().left - outer.getBoundingClientRect().left - outer.clientLeft) < 1;
    }
    return false;
  });
  return { context, page, repairMap: () => { mapFails = false; } };
}
async function shot(page, name) {
  await page.getByTestId('running-content').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' });
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL || 'chrome' });
  const errors = [];
  try {
    for (const width of [320, 390, 650, 681, 1280]) {
      const { context, page } = await open(browser, width);
      try {
        page.on('pageerror', error => errors.push(error.message));
        const before = await snapshot(page);
        const layout = await page.getByTestId('running-content').evaluate(el => {
          const map = el.querySelector('[data-testid="running-map"]'), a = el.getBoundingClientRect(), b = map.getBoundingClientRect();
          return { canvas: a.width, inset: b.left - a.left, mapRatio: b.width / b.height, scrollWidth: document.documentElement.scrollWidth, pageWidth: document.documentElement.clientWidth };
        });
        assert.equal(layout.canvas, Math.min(width, 440)); assert.equal(layout.inset, 16);
        assert.ok(Math.abs(layout.mapRatio - 1.38) < .01); assert.equal(layout.scrollWidth, layout.pageWidth);
        assert.equal(await page.getByText('按自己的节奏轻松跑或快走。', { exact: true }).count(), 0);
        assert.equal(await page.getByText('运动时请勿操作手机 · 未授权定位不记录路线或配速', { exact: true }).count(), 0);
        assert.equal(await distance(page), 0); assert.deepEqual(await snapshot(page), before);
        await page.getByRole('button', { name: '设置跑步目标', exact: true }).click();
        const sheet = page.getByTestId('running-goal-sheet'); await sheet.waitFor();
        assert.equal((await sheet.boundingBox()).width, Math.min(width - 32, 440));
        for (const button of ['保存跑步目标', '关闭跑步目标', '选择跑步目标5公里']) {
          assert.ok((await page.getByRole('button', { name: button, exact: true }).boundingBox()).height >= 44);
        }
        await page.getByRole('button', { name: '关闭跑步目标', exact: true }).click();
        assert.deepEqual(await snapshot(page), before, 'Opening or cancelling must not write a goal or a session');
        await shot(page, 'running-idle-' + width);
        console.log(`PASS ${width}px shared canvas, map ratio, controls, removed text, view/cancel without writes`);
        if (width !== 390) continue;

        await page.getByRole('button', { name: '设置跑步目标', exact: true }).click();
        await page.getByRole('textbox', { name: '跑步目标数值', exact: true }).fill('0');
        await page.getByRole('button', { name: '保存跑步目标', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: '请输入 0.5' }).waitFor();
        await page.getByRole('button', { name: '选择跑步目标5公里', exact: true }).click();
        await shot(page, 'running-goal-390');
        await page.getByRole('button', { name: '保存跑步目标', exact: true }).click();
        await sheet.waitFor({ state: 'hidden' });
        assert.deepEqual(JSON.parse((await snapshot(page)).settings), { vibration: false, restSeconds: 150, runningGoal: { kind: 'distance', value: 5 } });
        assert.equal((await snapshot(page)).user_profile, before.user_profile); assert.equal((await snapshot(page)).sessions, before.sessions);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('tab', { name: '切换到跑步', exact: true }).click();
        await page.getByTestId('running-goal-progress').filter({ hasText: '0.00 / 5 km' }).waitFor();
        await page.getByRole('button', { name: '开始记录', exact: true }).click();
        await page.waitForFunction(() => window.qaGps.count() === 1);
        await page.evaluate(() => { window.qaGps.emit(31.2304, 121.4737); window.qaTimeOffset += 120000; });
        await page.waitForFunction(() => document.querySelector('[data-testid="running-elapsed"]').textContent.startsWith('02:'));
        await page.evaluate(() => window.qaGps.emit(31.2314, 121.4737));
        await page.waitForFunction(() => document.querySelector('[data-testid="running-distance"]').textContent.startsWith('0.11'));
        for (const invalid of [[91, 121.4737, 5], [31.2315, NaN, 5], [31.26, 121.48, 100], [31.26, 121.48, -1]]) {
          await page.evaluate(([lat, lng, accuracy]) => window.qaGps.emit(lat, lng, accuracy), invalid);
        }
        assert.equal(await distance(page), .11);
        await page.getByRole('button', { name: '暂停记录', exact: true }).click();
        const pausedTime = await page.getByTestId('running-elapsed').innerText();
        await page.evaluate(() => { window.qaTimeOffset += 300000; window.qaGps.emit(31.3, 121.5); });
        assert.equal(await page.getByTestId('running-elapsed').innerText(), pausedTime);
        assert.equal(await distance(page), .11);
        await shot(page, 'running-paused-390');
        await page.getByRole('button', { name: '继续记录', exact: true }).click();
        await page.evaluate(() => window.qaGps.emit(31.2324, 121.4737));
        assert.equal(await distance(page), .11);
        await page.evaluate(() => { window.qaTimeOffset += 60000; window.qaGps.emit(31.2334, 121.4737); });
        await page.waitForFunction(() => document.querySelector('[data-testid="running-distance"]').textContent.startsWith('0.22'));
        await page.waitForFunction(() => document.querySelector('[data-testid="running-elapsed"]').textContent.startsWith('03:'));
        const routeBounds = await page.getByTestId('running-map').evaluate(el => {
          const line = el.querySelector('polyline'); if (!line) return null;
          const svg = line.closest('svg'), rect = svg.getBoundingClientRect();
          return { width: rect.width, height: rect.height, points: line.getAttribute('points').split(' ').map(p => p.split(',').map(Number)) };
        });
        assert.ok(routeBounds); for (const [x, y] of routeBounds.points) { assert.ok(x >= 0 && x <= routeBounds.width); assert.ok(y >= 0 && y <= routeBounds.height); }
        await page.getByRole('button', { name: '缩小地图', exact: true }).click();
        await page.getByRole('button', { name: '显示完整跑步路线', exact: true }).click();
        await shot(page, 'running-active-390');
        await page.evaluate(() => { window.qaSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'sessions') throw new DOMException('QA storage failure', 'QuotaExceededError'); return window.qaSetItem.call(this, key, value); }; });
        await page.getByRole('button', { name: '结束并保存', exact: true }).click();
        await page.getByText(/保存失败 · 数据仍保留/).waitFor();
        assert.equal(await distance(page), .22); assert.equal(await page.evaluate(() => window.qaGps.count()), 0);
        assert.deepEqual(JSON.parse((await snapshot(page)).sessions), []);
        await page.evaluate(() => { Storage.prototype.setItem = window.qaSetItem; });
        await page.getByRole('button', { name: '继续记录', exact: true }).click();
        await page.waitForFunction(() => window.qaGps.count() === 1);
        await page.evaluate(() => window.qaGps.emit(31.2344, 121.4737));
        assert.equal(await distance(page), .22, 'A save retry must not create a gap segment');
        await page.evaluate(() => window.qaGps.emit(31.2354, 121.4737));
        await page.waitForFunction(() => document.querySelector('[data-testid="running-distance"]').textContent.startsWith('0.33'));
        await page.getByRole('button', { name: '结束并保存', exact: true }).click();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions')).length === 1);
        const saved = JSON.parse((await snapshot(page)).sessions)[0];
        assert.equal(saved.kind, 'running'); assert.equal(saved.distanceKm, .33); assert.equal(saved.completion, 'partial');
        assert.ok(saved.durationSeconds >= 180 && saved.durationSeconds < 210, 'Active time excludes the five-minute pause');
        assert.equal(saved.route.length, 6); assert.equal(saved.totalReps, 0); assert.equal(await page.evaluate(() => window.qaGps.count()), 0);
        assert.equal((await snapshot(page)).user_profile, before.user_profile);
        await page.getByRole('button', { name: '设置跑步目标', exact: true }).click();
        await page.getByRole('button', { name: '清除自选跑步目标', exact: true }).click();
        await sheet.waitFor({ state: 'hidden' });
        assert.deepEqual(JSON.parse((await snapshot(page)).settings), { vibration: false, restSeconds: 150 });
        console.log('PASS goal persistence/validation, real segments, invalid fixes, wall-clock/pause, full route, save failure/resume/retry');
      } finally { await context.close(); }
    }
    const { context, page } = await open(browser, 390, true);
    try {
      page.on('pageerror', error => errors.push(error.message));
      await page.getByRole('button', { name: '开启定位', exact: true }).waitFor();
      await shot(page, 'running-no-permission-390');
      await page.getByRole('button', { name: '开始记录', exact: true }).click();
      await page.getByText(/仅记录运动时间 ·/).waitFor();
      assert.equal(await distance(page), 0); assert.equal(await page.evaluate(() => window.qaGps.count()), 0);
      await page.evaluate(() => { window.qaTimeOffset += 90000; });
      await page.waitForFunction(() => document.querySelector('[data-testid="running-elapsed"]').textContent.startsWith('01:'));
      await page.getByRole('button', { name: '结束并保存', exact: true }).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions')).length === 1);
      const record = JSON.parse((await snapshot(page)).sessions)[0];
      assert.equal(record.distanceKm, 0); assert.equal(record.route, undefined); assert.ok(record.durationSeconds >= 90);
      console.log('PASS denied location records time only; no invented distance/route/pace');
    } finally { await context.close(); }
    const failedMap = await open(browser, 390, false, 871, true);
    try {
      await failedMap.page.getByTestId('running-map-error').waitFor();
      await failedMap.page.getByRole('button', { name: '开始记录', exact: true }).click();
      await failedMap.page.waitForFunction(() => window.qaGps.count() === 1);
      await failedMap.page.evaluate(() => { window.qaGps.emit(31.2304, 121.4737); window.qaGps.emit(31.2314, 121.4737); });
      await failedMap.page.waitForFunction(() => document.querySelector('[data-testid="running-distance"]').textContent.startsWith('0.11'));
      await failedMap.page.getByTestId('running-map-error').waitFor();
      assert.ok(await failedMap.page.getByTestId('running-map').locator('polyline').count() > 0);
      await shot(failedMap.page, 'running-failed-map-390');
      failedMap.repairMap();
      await failedMap.page.getByRole('button', { name: '重试地图加载', exact: true }).click();
      await failedMap.page.waitForFunction(() => [...document.querySelectorAll('[data-testid="running-map"] img')].some(i => i.complete && i.naturalWidth === 256));
      await failedMap.page.getByTestId('running-map-error').waitFor({ state: 'hidden' });
      assert.equal(await distance(failedMap.page), .11);
      console.log('PASS map failure state and retry; real route/distance retained while the base map is unavailable');
    } finally { await failedMap.context.close(); }
    const landscape = await open(browser, 681, false, 400);
    try {
      await landscape.page.getByRole('button', { name: '设置跑步目标', exact: true }).click();
      const box = await landscape.page.getByTestId('running-goal-sheet').boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= 400, 'Goal sheet stays within a short viewport');
      await landscape.page.getByRole('button', { name: '保存跑步目标', exact: true }).click();
      console.log('PASS short-screen goal sheet scrolls to the save action');
    } finally { await landscape.context.close(); }
    assert.deepEqual(errors, []); console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); console.error('Screenshots: ' + output); process.exitCode = 1; });
