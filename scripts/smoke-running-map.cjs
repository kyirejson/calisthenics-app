// Isolated browser GPS / storage fixtures; never writes into the user's open tab.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/UncoverBuildTools/browser-tests/node_modules/playwright');
const source = fs.readFileSync(require.resolve('./smoke-fitness-flows.cjs'), 'utf8');
const profile = vm.runInNewContext('(' + source.match(/const profile = ([\s\S]*?);\r?\n/)[1] + ')');
const output = 'D:/UncoverBuildTools/temp/running-browser-qa'; fs.mkdirSync(output, { recursive: true });
const records = page => page.evaluate(() => JSON.parse(localStorage.getItem('sessions')));
const waitRunPane = page => page.waitForFunction(() => { const pane = document.querySelector('[data-testid="today-running-page"]'); return pane && pane.getAttribute('aria-hidden') !== 'true' && Math.abs(pane.getBoundingClientRect().left - (innerWidth > 440 ? (innerWidth - 440) / 2 : 0)) < 2; });
async function prepare(browser, width = 390, height = 844, denied = false, pendingGps = false) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai' });
  await context.addInitScript(({ profile, denied, pendingGps }) => {
    if (!localStorage.getItem('running-map-qa')) { localStorage.setItem('running-map-qa', '1'); localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', '[]'); localStorage.setItem('profile-invitation-seen', '1'); }
    let offset = Number(sessionStorage.getItem('running-qa-clock')) || 0, metres = 0, next = 0; const watches = new Map(), originalNow = performance.now.bind(performance), OriginalDate = Date;
    const anchor = OriginalDate.now(), start = originalNow();
    class Clock extends OriginalDate { constructor(...args) { super(...(args.length ? args : [anchor + originalNow() - start + offset])); } static now() { return anchor + originalNow() - start + offset; } }
    window.Date = Clock; Object.defineProperty(performance, 'now', { value: () => originalNow() + offset });
    const position = accuracy => ({ timestamp: Clock.now(), coords: { latitude: 39.91 + metres / 111195.08, longitude: 116.4, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null } });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition: (success, failure) => { const id = ++next; watches.set(id, { success, failure }); setTimeout(() => denied ? failure({ code: 1 }) : pendingGps ? undefined : success(position(5)), 10); return id; }, clearWatch: id => watches.delete(id),
    } });
    window.qaGps = { advance: seconds => { offset += seconds * 1000; sessionStorage.setItem('running-qa-clock', offset); }, emit: (distance, seconds, accuracy = 5) => { metres = distance; offset += seconds * 1000; sessionStorage.setItem('running-qa-clock', offset); watches.forEach(watch => watch.success(position(accuracy))); }, deny: () => watches.forEach(watch => watch.failure({ code: 1 })), count: () => watches.size };
  }, { profile, denied, pendingGps });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
  // Repeated automated pan/zoom must not make production OSM requests. Real map
  // loading was checked separately; these fixture tiles only exercise layout/events.
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e0e3dc"/><path d="M0 80h256M90 0v256" stroke="#aaa" stroke-width="9"/></svg>' }));
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 45000 }); await page.getByTestId('today-training-content').waitFor();
  await page.getByRole('tab', { name: '切换到跑步', exact: true }).click();
  await page.waitForFunction(() => { const pane = document.querySelector('[data-testid="today-running-page"]'); return pane && pane.getAttribute('aria-hidden') !== 'true' && pane.getBoundingClientRect().left >= -1 && pane.getBoundingClientRect().left < innerWidth; });
  return { context, page, errors };
}
async function locate(page) { await page.getByRole('button', { name: '检查跑步定位', exact: true }).click(); await page.getByText(/定位就绪/).waitFor(); }
async function start(page) { await locate(page); await page.getByRole('button', { name: '开始跑步', exact: true }).click(); await page.getByText('正在跑步', { exact: true }).waitFor(); }
async function finish(page) {
  await page.getByRole('button', { name: '结束并保存跑步', exact: true }).click();
  const save = page.getByRole('button', { name: '结束并保存', exact: true });
  if (await save.count()) { await save.click(); await page.getByRole('button', { name: '关闭跑步总结', exact: true }).click(); }
  else { await page.getByRole('button', { name: '结束跑步', exact: true }).click(); await page.getByTestId('run-completion-notice').waitFor(); }
  await page.getByRole('button', { name: '开始跑步', exact: true }).waitFor();
}
async function emit(page, distance, seconds = 3, accuracy = 5) { await page.evaluate(([d, s, a]) => window.qaGps.emit(d, s, a), [distance, seconds, accuracy]); }
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [width, height] of [[320, 780], [390, 844], [607, 871], [390, 600]]) {
      const { context, page, errors } = await prepare(browser, width, height);
      try {
        await locate(page);
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="run-map-tile"] img, img[data-testid="run-map-tile"]')].some(image => image.complete && image.naturalWidth > 0));
        // A successful fix removes the status row and resizes the map. Wait for
        // its onLayout/attribution update before comparing geometry.
        await page.waitForFunction(() => { const map = document.querySelector('[data-testid="run-map"]')?.getBoundingClientRect(), credit = document.querySelector('[aria-label="OpenStreetMap 地图版权"]')?.getBoundingClientRect(); return map && credit && credit.bottom <= map.bottom + 1; });
        const before = await page.evaluate(() => localStorage.getItem('user_profile'));
        const { map, dock, credit } = await page.evaluate(() => ({ map: document.querySelector('[data-testid="run-map"]').getBoundingClientRect().toJSON(), dock: document.querySelector('[data-testid="run-control-dock"]').getBoundingClientRect().toJSON(), credit: document.querySelector('[aria-label="OpenStreetMap 地图版权"]').getBoundingClientRect().toJSON() }));
        assert.ok(map.height >= (height < 700 ? 120 : 180)); assert.ok(dock.y + dock.height <= height - 60, 'Controls remain above navigation');
        assert.ok(credit.y + credit.height <= map.y + map.height + 1, 'Map attribution must remain inside the visible map');
        const shrink = await page.getByRole('button', { name: '缩小跑步地图', exact: true }).boundingBox(), recenter = await page.getByRole('button', { name: '地图回到当前位置', exact: true }).boundingBox();
        assert.ok(shrink.x + shrink.width <= recenter.x || recenter.x + recenter.width <= shrink.x || shrink.y + shrink.height <= recenter.y || recenter.y + recenter.height <= shrink.y, 'Map buttons must not overlap on short screens');
        const startBox = await page.getByRole('button', { name: '开始跑步', exact: true }).boundingBox(), chat = await page.getByRole('button', { name: '打开 MAX 聊天', exact: true }).boundingBox();
        // The host dock is draggable, not a fixed RunScreen child. Validate hit
        // areas and navigation clearance instead of an obsolete shared baseline.
        assert.ok(chat.y >= 0 && chat.y + chat.height <= height - 60, 'Chat remains above navigation');
        assert.ok(startBox.x + startBox.width < chat.x, 'Chat never covers the start action');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: `${output}/idle-${width}-${height}.png` });
        const tileBefore = await page.getByTestId('run-map-tile').first().locator('img').getAttribute('src');
        await page.mouse.move(map.x + map.width / 2, map.y + map.height / 2); await page.mouse.down(); await page.mouse.move(map.x + map.width / 2 + 80, map.y + map.height / 2 + 50, { steps: 6 }); await page.mouse.up();
        await page.getByRole('button', { name: '放大跑步地图', exact: true }).click(); assert.notEqual(await page.getByTestId('run-map-tile').first().locator('img').getAttribute('src'), tileBefore);
        await page.getByRole('button', { name: '地图回到当前位置', exact: true }).click();
        assert.deepEqual(await records(page), []); assert.equal(await page.evaluate(() => localStorage.getItem('user_profile')), before); assert.deepEqual(errors, []);
        console.log(`PASS ${width}x${height}: fixture tile loading, attribution, pan/zoom/recenter, CTA/chat/nav layout, no fabricated records`);
      } finally { await context.close(); }
    }
    const { context, page, errors } = await prepare(browser);
    try {
      await start(page);
      for (let i = 1; i <= 10; i++) await emit(page, i * 10);
      await page.waitForFunction(() => Number(document.querySelector('[data-testid="run-distance"]').textContent) >= .09);
      await page.getByRole('button', { name: '暂停跑步', exact: true }).click(); await page.getByText('跑步已暂停', { exact: true }).waitFor();
      const paused = await page.getByTestId('run-duration').innerText(); await emit(page, 1000, 60); await page.waitForTimeout(1100);
      assert.equal(await page.getByTestId('run-duration').innerText(), paused); assert.equal(await page.getByTestId('run-distance').innerText(), '0.10');
      await page.getByRole('button', { name: '继续跑步', exact: true }).click(); await page.getByText('正在跑步', { exact: true }).waitFor();
      await emit(page, 1010); await emit(page, 1020);
      await page.getByRole('tab', { name: '切换到饮食', exact: true }).click(); await emit(page, 1030);
      await page.getByRole('tab', { name: '切换到数据', exact: true }).click(); await emit(page, 1040);
      await page.getByRole('tab', { name: '切换到今日', exact: true }).click(); await page.getByText('正在跑步', { exact: true }).waitFor();
      await page.route('https://tile.openstreetmap.org/**', route => route.abort()); await page.getByRole('button', { name: '放大跑步地图', exact: true }).click();
      await page.getByText('地图暂时无法加载', { exact: true }).waitFor(); await emit(page, 1050);
      await page.waitForFunction(() => Number(document.querySelector('[data-testid="run-distance"]').textContent) >= .14);
      await page.screenshot({ path: output + '/offline-recording.png' }); await page.unroute('https://tile.openstreetmap.org/**');
      // Failed durable history write keeps the finished draft, then one retry saves one ID.
      await page.evaluate(() => { const original = Storage.prototype.setItem; window.qaRestoreStorage = () => { Storage.prototype.setItem = original; }; Storage.prototype.setItem = function(key, value) { if (key === 'sessions') throw Error('QA disk full'); return original.call(this, key, value); }; });
      await page.getByRole('button', { name: '结束并保存跑步', exact: true }).click(); await page.getByRole('button', { name: '结束并保存', exact: true }).click();
      await page.getByRole('button', { name: '重试保存跑步', exact: true }).waitFor(); assert.equal((await records(page)).length, 0);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('uncover.running.web-journal.v2')).phase), 'finished');
      await page.evaluate(() => window.qaRestoreStorage()); await page.getByRole('button', { name: '重试保存跑步', exact: true }).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions')).length === 1);
      await page.getByRole('button', { name: '关闭跑步总结', exact: true }).click();
      const saved = (await records(page))[0]; assert.equal(saved.kind, 'running'); assert.ok(Math.abs(saved.distanceKm - .15) < .01); assert.equal(saved.runSegments.length, 2); assert.ok(saved.durationSeconds < 70, 'Pause never enters duration');
      await page.getByRole('tab', { name: '切换到数据', exact: true }).click();
      await page.getByRole('tab', { name: '切换到我的', exact: true }).click();
      const date = new Date(saved.startedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
      const day = page.getByTestId('history-day-' + date); await day.getByRole('button', { name: '展开' + date + '训练历史', exact: true }).click();
      await page.getByTestId('history-run-' + saved.id).waitFor(); assert.ok(!(await day.innerText()).includes('0 组')); console.log('PASS real mileage/pace, pause exclusion, page changes, offline GPS, save failure/retry and My history');
      await page.getByRole('tab', { name: '切换到今日', exact: true }).click(); await page.getByRole('tab', { name: '切换到跑步', exact: true }).click(); await waitRunPane(page);
      await emit(page, 0, 3); await start(page); await emit(page, 0, 3); await emit(page, 20, 4); await page.waitForTimeout(1100);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await page.getByText('跑步已暂停', { exact: true }).waitFor();
      assert.ok(await page.getByText(/上次记录已恢复/).count());
      await emit(page, 1000, 3); // Movement during interruption is map-only, not running distance.
      await page.getByRole('button', { name: '继续跑步', exact: true }).click(); await page.getByText('正在跑步', { exact: true }).waitFor();
      await emit(page, 1010, 3); await emit(page, 1020, 3);
      try { await page.waitForFunction(() => Number(document.querySelector('[data-testid="run-distance"]').textContent) >= .01); }
      catch (failure) { console.error('QA resume checkpoint:', await page.evaluate(() => localStorage.getItem('uncover.running.web-journal.v2'))); throw failure; }
      await finish(page); await page.waitForFunction(() => JSON.parse(localStorage.getItem('sessions')).length === 2);
      assert.notEqual((await records(page))[0].id, (await records(page))[1].id); assert.deepEqual(errors, []); console.log('PASS reload restores paused checkpoint, resume does not bridge gaps, repeated runs retain independent records');
    } finally { await context.close(); }
    for (const [w, h] of [[320, 600], [390, 844]]) {
      const waiting = await prepare(browser, w, h, false, true);
      try {
        const page = waiting.page;
        await page.getByRole('button', { name: '检查跑步定位', exact: true }).click();
        await page.getByText('定位请求已启动', { exact: true }).waitFor();
        await page.evaluate(() => window.qaGps.advance(35));
        await page.getByText('尚未收到位置坐标', { exact: true }).waitFor();
        assert.ok(!(await page.getByTestId('today-running-page').innerText()).includes('未授权'));
        await emit(page, 0, 1, 80); await page.getByText('已定位，精度不足', { exact: true }).waitFor();
        await emit(page, 0, 1, 5); await page.getByText(/定位就绪/).waitFor();
        assert.equal(await page.getByText('尚未收到位置坐标', { exact: true }).count(), 0);
        assert.deepEqual(await records(page), []);
        const dock = await page.getByTestId('run-control-dock').boundingBox(); assert.ok(dock.y + dock.height <= h - 60);
        assert.deepEqual(waiting.errors, []); console.log(`PASS ${w}x${h}: no-fix wait, weak fix, automatic recovery and visible controls`);
      } finally { await waiting.context.close(); }
    }
    const denied = await prepare(browser, 390, 844, true);
    try {
      await denied.page.getByRole('button', { name: '检查跑步定位', exact: true }).click(); await denied.page.getByText(/访问被拒绝.*浏览器错误 1/).waitFor();
      assert.deepEqual(await records(denied.page), []);
      await denied.page.getByRole('button', { name: '开始跑步', exact: true }).click(); await denied.page.getByText('正在跑步', { exact: true }).waitFor();
      await denied.page.waitForFunction(() => { const value = document.querySelector('[data-testid="run-duration"]')?.textContent; return value && value !== '00:00'; }, undefined, { timeout: 5000 });
      assert.equal(await denied.page.getByTestId('run-distance').innerText(), '—');
      await finish(denied.page); assert.deepEqual(await records(denied.page), []);
      assert.deepEqual(denied.errors, []); console.log('PASS denied GPS allows timing and ending without creating zero-distance history');
    } finally { await denied.context.close(); }
    const indoor = await prepare(browser, 320, 600, true);
    try {
      const page = indoor.page;
      await page.getByRole('button', { name: '选择室内跑', exact: true }).click();
      await page.getByRole('button', { name: '开始跑步', exact: true }).click(); await page.getByText('正在跑步', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.qaGps.count()), 0); assert.equal(await page.getByTestId('run-map').count(), 0);
      await page.evaluate(() => window.qaGps.advance(600)); await page.waitForTimeout(1100);
      await page.getByRole('button', { name: '结束并保存跑步', exact: true }).click();
      await page.getByRole('textbox', { name: '室内跑距离（公里，可选）', exact: true }).fill('bad'); await page.getByRole('button', { name: '保存室内跑', exact: true }).click();
      await page.getByText(/请输入 0–1000 公里/).waitFor();
      await page.getByRole('textbox', { name: '室内跑距离（公里，可选）', exact: true }).fill('2.5'); await page.getByRole('button', { name: '保存室内跑', exact: true }).click();
      await page.getByRole('button', { name: '开始跑步', exact: true }).waitFor();
      await page.getByText('保存室内跑', { exact: true }).waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: '关闭跑步总结', exact: true }).click();
      const saved = (await records(page))[0]; assert.equal(saved.runMode, 'indoor'); assert.equal(saved.distanceKm, 2.5); assert.equal(saved.distanceSource, 'manual'); assert.deepEqual(saved.route, []);
      await page.getByRole('tab', { name: '切换到我的', exact: true }).click(); await page.getByRole('button', { name: /^展开.*训练历史$/ }).click(); await page.getByTestId('profile-latest-history').getByText(/手动填写距离/).waitFor();
      await page.screenshot({ path: output + '/indoor-history.png' }); assert.deepEqual(indoor.errors, []);
      console.log('PASS indoor mode: no GPS request, short-screen controls, distance validation and labeled manual distance in history');
    } finally { await indoor.context.close(); }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
