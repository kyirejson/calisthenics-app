// New browser contexts only: this never touches the user's tab or real records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/UncoverBuildTools/browser-tests/node_modules/playwright');
const fixture = fs.readFileSync(require.resolve('./smoke-fitness-flows.cjs'), 'utf8');
const profile = { ...vm.runInNewContext('(' + fixture.match(/const profile = ([\s\S]*?);\r?\n/)[1] + ')'), experience: 'elite', frequency: 6 };
async function prepare(browser, width, height, goal = 'street_mastery', date = '2026-10-08T01:00:00.000Z', overrides = {}) {
  const context = await browser.newContext({ viewport: { width, height }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
  await context.addInitScript(({ profile, goal, date }) => {
    const OriginalDate = Date, anchor = OriginalDate.parse(date), start = performance.now();
    class Clock extends OriginalDate { constructor(...args) { super(...(args.length ? args : [anchor + performance.now() - start])); } static now() { return anchor + performance.now() - start; } }
    window.Date = Clock;
    if (localStorage.getItem('today-overview-qa')) return;
    localStorage.setItem('today-overview-qa', '1'); localStorage.setItem('profile-invitation-seen', '1');
    localStorage.setItem('user_profile', JSON.stringify({ ...profile, goal })); localStorage.setItem('sessions', '[]');
  }, { profile: { ...profile, ...overrides }, goal, date });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('today-training-content').waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="today-workout-list"] img')].every(img => img.complete));
  return { context, page, errors };
}
const getScrollState = page => page.getByTestId('today-training-content').evaluate(root => {
  const scroll = [...root.querySelectorAll('div')].find(node => /auto|scroll/.test(getComputedStyle(node).overflowY));
  return { height: scroll.clientHeight, content: scroll.scrollHeight, top: scroll.scrollTop };
});
const waitForPane = (page, id) => page.waitForFunction(id => {
  const pane = document.querySelector(`[data-testid="${id}"]`);
  if (!pane || pane.getAttribute('aria-hidden') === 'true') return false;
  for (let outer = pane.parentElement; outer; outer = outer.parentElement) {
    if (!/auto|scroll/.test(getComputedStyle(outer).overflowX) || outer.scrollWidth <= outer.clientWidth) continue;
    return Math.abs(pane.getBoundingClientRect().left - outer.getBoundingClientRect().left - outer.clientLeft) < 1;
  }
  return false;
}, id);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  fs.mkdirSync('D:/UncoverBuildTools/temp', { recursive: true });
  try {
    for (const [width, height] of [[320, 780], [360, 800], [390, 844], [607, 871], [739, 871]]) {
      const { context, page, errors } = await prepare(browser, width, height);
      try {
        const before = await page.evaluate(() => localStorage.getItem('user_profile'));
        const list = page.getByTestId('today-workout-list'), rows = list.getByRole('button', { name: /^查看.*动作指导$/ });
        const rowCount = await rows.count(); assert.ok(rowCount >= 3);
        for (const [index, expectedSets, expectedValue] of [[0, 4, '4 次'], [1, 4, '10 次'], [2, 3, '10 秒']]) {
          const cells = rows.nth(index).locator('[data-testid^="today-prescribed-set-"]');
          assert.equal(await cells.count(), expectedSets);
          assert.deepEqual(await cells.allInnerTexts(), Array(expectedSets).fill(expectedValue));
        }
        const scroll = await getScrollState(page);
        console.log(`${width}x${height}: ${rowCount} actions, content ${scroll.content}px / viewport ${scroll.height}px`);
        await page.screenshot({ path: `D:/UncoverBuildTools/temp/today-overview-${width}.png` });
        if (width >= 360) assert.ok(scroll.content <= scroll.height + 2, 'Normal training day fits in one viewport');
        const typography = await rows.first().evaluate(row => {
          const name = row.querySelector('[data-testid^="today-exercise-name-"]');
          const photo = row.querySelector('[data-testid^="today-exercise-photo-"]');
          return { font: Number.parseFloat(getComputedStyle(name).fontSize), height: row.getBoundingClientRect().height, photo: photo.getBoundingClientRect().width };
        });
        if (width >= 390) {
          assert.equal(typography.font, 18, 'Action names match the editorial template');
          assert.ok(typography.height >= 94, 'Task panels retain their prescription hierarchy');
          assert.ok(typography.photo >= 60, 'Original artwork occupies the right of the task panel');
        } else {
          assert.equal(typography.font, 17, 'Small screens retain the compact readable scale');
        }
        const dock = page.getByTestId('today-start-dock'), start = dock.getByRole('button');
        const startBox = await start.boundingBox(), chatBox = await page.getByRole('button', { name: '打开 MAX 聊天', exact: true }).boundingBox();
        assert.ok(startBox.y >= 0 && startBox.y + startBox.height < height - 68);
        const overlap = startBox.x < chatBox.x + chatBox.width && startBox.x + startBox.width > chatBox.x && startBox.y < chatBox.y + chatBox.height && startBox.y + startBox.height > chatBox.y;
        assert.ok(!overlap, 'Start never overlaps the default chat bubble');
        assert.ok(Math.abs(startBox.y - chatBox.y) < 1, 'Start and chat share the template baseline');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.getByRole('button', { name: '10月9日 周五', exact: true }).click();
        await page.getByTestId('today-selected-day-notes').waitFor();
        assert.equal(await page.getByTestId('today-schedule-sheet').count(), 0, 'Date browsing never opens a detail modal');
        assert.match(await page.getByTestId('today-course-card').innerText(), /10月9日课程[\s\S]*推力与腹部/);
        assert.ok(await list.getByRole('button', { name: '查看标准俯卧撑动作指导', exact: true }).count());
        assert.equal(await page.getByRole('button', { name: '添加今日训练动作', exact: true }).count(), 0);
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('sessions'))), []);
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="today-workout-list"] img')].every(img => img.complete));
        await page.screenshot({ path: `D:/UncoverBuildTools/temp/today-selected-date-${width}.png` });
        if (width === 390) {
          await list.getByRole('button', { name: '查看标准俯卧撑动作指导', exact: true }).click();
          await page.getByRole('button', { name: '返回动作列表', exact: true }).click();
          await page.getByTestId('today-selected-day-notes').waitFor();
          assert.match(await page.getByTestId('today-course-card').innerText(), /10月9日课程[\s\S]*推力与腹部/);
          assert.equal(await page.getByRole('button', { name: '10月9日 周五', exact: true }).getAttribute('aria-pressed'), 'true');
          assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('sessions'))), []);
        }
        await page.getByRole('button', { name: '回到今日训练  →', exact: true }).click();
        assert.equal(await rows.count(), rowCount, 'Return restores the actual today actions');
        assert.equal(await page.getByTestId('today-selected-day-notes').count(), 0);
        if (width === 390) {
          await page.getByRole('button', { name: '打开 MAX 聊天', exact: true }).click();
          await page.getByRole('button', { name: '关闭 MAX 聊天', exact: true }).click();
          await page.getByRole('tab', { name: '切换到我的', exact: true }).click();
          assert.equal(await page.getByRole('button', { name: '打开 MAX 聊天', exact: true }).count(), 1, 'Other pages restore the floating chat');
          await page.getByRole('tab', { name: '切换到今日', exact: true }).click();
          await page.getByTestId('today-training-content').waitFor();
          assert.equal(await page.getByRole('button', { name: '打开 MAX 聊天', exact: true }).count(), 1, 'Today never duplicates chat controls');
        }
        assert.equal(await page.evaluate(() => localStorage.getItem('user_profile')), before);
        assert.deepEqual(errors, []);
        console.log(`PASS ${width}px: complete today actions, inline date course/notes, return without recording, CTA/chat/nav separation and unchanged data`);
      } finally { await context.close(); }
    }
    const { context, page, errors } = await prepare(browser, 390, 844);
    try {
      const list = page.getByTestId('today-workout-list'), count = await list.getByRole('button', { name: /^查看.*动作指导$/ }).count();
      for (const name of ['墙壁俯卧撑', '上斜俯卧撑', '膝盖俯卧撑', '半俯卧撑']) {
        await page.getByRole('button', { name: '添加今日训练动作', exact: true }).click();
        await page.getByRole('textbox', { name: '搜索训练动作', exact: true }).fill(name);
        await page.getByRole('button', { name: '添加' + name, exact: true }).click();
      }
      assert.equal(await list.getByRole('button', { name: /^查看.*动作指导$/ }).count(), count + 4);
      const scroll = await getScrollState(page); assert.ok(scroll.content > scroll.height);
      const dock = page.getByTestId('today-start-dock'), before = await dock.boundingBox();
      await list.getByRole('button', { name: '查看半俯卧撑动作指导', exact: true }).scrollIntoViewIfNeeded();
      const after = await dock.boundingBox(); assert.equal(after.y, before.y);
      await page.getByRole('button', { name: '移除半俯卧撑', exact: true }).click();
      assert.equal(await list.getByRole('button', { name: /^查看.*动作指导$/ }).count(), count + 3);
      await dock.getByRole('button').click(); await page.getByTestId('training-primary').waitFor();
      assert.deepEqual(errors, []); console.log('PASS extra actions remain scrollable, no cropping, pinned start, removal and real start route');
    } finally { await context.close(); }
    const advanced = await prepare(browser, 390, 844, 'street_mastery', '2026-10-08T01:00:00.000Z', { experience: 'supermax' });
    try {
      const rows = advanced.page.getByTestId('today-workout-list').getByRole('button', { name: /^查看.*动作指导$/ });
      assert.ok(await rows.count() > 0);
      for (let index = 0; index < await rows.count(); index++) {
        const row = rows.nth(index), cells = row.locator('[data-testid^="today-prescribed-set-"]');
        assert.equal(await cells.count(), 10, 'High-volume plans keep every prescribed set');
        const bounds = await row.boundingBox(), last = await cells.last().boundingBox();
        assert.ok(last.y + last.height <= bounds.y + bounds.height, 'Wrapped cells are not clipped');
      }
      await rows.last().scrollIntoViewIfNeeded();
      assert.equal(await advanced.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(advanced.errors, []);
      console.log('PASS high-volume prescriptions render all ten sets, wrap without cropping and retain fixed start');
    } finally { await advanced.context.close(); }
    for (const [goal, date, height] of [['weight_loss', '2026-10-08T01:00:00.000Z', 844], ['street_mastery', '2026-10-11T01:00:00.000Z', 844], ['street_mastery', '2026-10-08T01:00:00.000Z', 600]]) {
      const { context, page, errors } = await prepare(browser, 390, height, goal, date);
      try {
        const before = await page.evaluate(() => localStorage.getItem('user_profile'));
        await page.getByRole('tab', { name: '切换到饮食', exact: true }).click();
        await waitForPane(page, 'today-nutrition-page');
        await page.getByTestId('nutrition-energy-card').waitFor();
        await page.getByRole('tab', { name: '切换到训练', exact: true }).click();
        await waitForPane(page, 'today-training-page');
        assert.equal(await page.evaluate(() => localStorage.getItem('user_profile')), before);
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('sessions'))), []);
        const start = page.getByTestId('today-start-dock');
        if (await start.count()) {
          const box = await start.getByRole('button').boundingBox(); assert.ok(box.y >= 0 && box.y + box.height < height - 68);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []);
        console.log(`PASS ${goal}/${date.slice(0, 10)}/${height}px: nutrition switch, recovery or overflow fallback, accessible CTA and unchanged data`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
