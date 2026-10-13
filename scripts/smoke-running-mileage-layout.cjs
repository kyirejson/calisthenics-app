// Isolated mobile-width browser profiles. Speech/GPS are synthetic, not real-device evidence.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/UncoverBuildTools/browser-tests/node_modules/playwright');
require('./lib/register-typescript.cjs')();
const { normalizeProfile } = require('../src/store/profile.ts');
const profile = normalizeProfile({ name: '布局验证', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', experience: 'elite', frequency: 6, levels: { push: 5, pull: 5, squat: 5, legRaise: 5 }, planStartedAt: '2026-10-01T01:00:00.000Z' });
const at = day => new Date(2026, 9, day, 9).toISOString();
const run = (id, day, km) => ({ id, workoutId: 'outdoor_running', workoutName: '户外跑', kind: 'running', runMode: 'outdoor', startedAt: at(day), completedAt: at(day), durationSeconds: 1800, exercises: [], totalReps: 0, completion: 'complete', distanceKm: km, distanceSource: 'location' });
const records = [run('older', 1, 29.8), run('mon', 12, 5), run('tue', 13, 7.8), { id: 'strength', workoutId: 'single_push_05', workoutName: '标准俯卧撑', kind: 'strength', startedAt: at(13), completedAt: at(13), trainingDate: '2026-10-13', durationSeconds: 600, totalReps: 10, completion: 'complete', exercises: [{ exerciseId: 'push_05', name: '标准俯卧撑', category: 'push', sets: [{ reps: 10, unit: 'reps', completed: true }] }] }];

async function prepare(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, timezoneId: 'Asia/Shanghai', reducedMotion: 'reduce' });
  await context.addInitScript(({ profile, records }) => {
    const OriginalDate = Date, originalNow = performance.now.bind(performance), epoch = new OriginalDate(2026, 9, 13, 18).getTime();
    window.__runShift = 0;
    window.Date = class extends OriginalDate { constructor(...args) { super(...(args.length ? args : [epoch + originalNow() + window.__runShift])); } static now() { return epoch + originalNow() + window.__runShift; } };
    performance.now = () => originalNow() + window.__runShift;
    if (!localStorage.getItem('mileage-layout-qa')) { localStorage.setItem('mileage-layout-qa', '1'); localStorage.setItem('profile-invitation-seen', '1'); localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', JSON.stringify(records)); }
    window.__runSpoken = []; window.__runFix = null;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition() {}, watchPosition(callback) { window.__runFix = callback; return 1; }, clearWatch() { window.__runFix = null; } } });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [{ lang: 'zh-CN' }], cancel() {}, speak(message) { window.__runSpoken.push(message.text); } } });
  }, { profile, records });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(30000); page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', route => /^(http:\/\/127\.0\.0\.1:8081\/|data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded' });
  return { context, page, errors };
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  fs.mkdirSync('D:/UncoverBuildTools/temp/run-mileage-layout', { recursive: true });
  try {
    for (const [width, height] of [[320, 780], [390, 844], [539, 668], [390, 600], [607, 871]]) {
      const { context, page, errors } = await prepare(browser, width, height);
      try {
        const navigation = [];
        for (const tab of ['今日', '进阶', '数据', '我的']) {
          await page.getByRole('tab', { name: '切换到' + tab, exact: true }).click();
          const box = await page.getByTestId('bottom-navigation').boundingBox(); navigation.push(box);
          assert.equal(Math.round(box.y + box.height), height, 'Every navigation touches viewport bottom');
          assert.equal(Math.round(box.height), 68); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        }
        for (const box of navigation) assert.deepEqual(box, navigation[0]);
        assert.equal(await page.getByText('DeepSeek 助手', { exact: true }).count(), 0);
        await page.getByTestId('profile-training-calendar').waitFor();
        assert.equal(await page.getByTestId('profile-latest-history').getByTestId(/^history-day-/).count(), 1);
        assert.equal(await page.getByTestId('history-day-2026-10-12').count(), 0, 'Older days are not expanded into My');
        await page.getByRole('button', { name: '查看全部训练历史', exact: true }).click();
        const full = page.getByTestId('all-training-history'); await full.waitFor();
        assert.equal(await full.getByTestId(/^history-day-/).count(), 3);
        assert.equal(await page.getByTestId('profile-latest-history').count(), 0, 'Full history never duplicates the underlying latest record');
        await page.getByRole('button', { name: '关闭全部训练历史', exact: true }).click();
        await full.waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: '查看2026-10-12训练记录', exact: true }).click();
        await full.waitFor(); assert.equal(await full.getByTestId(/^history-day-/).count(), 1);
        await page.getByRole('button', { name: '关闭全部训练历史', exact: true }).click();
        await full.waitFor({ state: 'hidden' });
        await page.getByTestId('profile-training-calendar').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `D:/UncoverBuildTools/temp/run-mileage-layout/my-${width}-${height}.png` });
        await page.getByRole('tab', { name: '切换到数据', exact: true }).click();
        assert.equal(await page.getByTestId('training-calendar-month').count(), 0); assert.equal(await page.getByTestId(/^history-day-/).count(), 0);
        await page.getByTestId('running-data-section').scrollIntoViewIfNeeded();
        assert.equal(await page.getByTestId('run-week-mileage').innerText(), '12.8 km'); assert.equal(await page.getByTestId('run-month-mileage').innerText(), '42.6 km');
        await page.getByRole('tab', { name: '查看本月跑步里程', exact: true }).click();
        assert.match(await page.getByTestId('running-mileage-chart').getAttribute('aria-label'), /本月/);
        await page.screenshot({ path: `D:/UncoverBuildTools/temp/run-mileage-layout/data-${width}-${height}.png` });
        // Deleting an existing run is reflected in totals, bars and milestone credit.
        await page.getByRole('tab', { name: '切换到我的', exact: true }).click();
        await page.getByRole('button', { name: '查看2026-10-13训练记录', exact: true }).click();
        await page.getByRole('button', { name: '删除跑步记录tue', exact: true }).click();
        await page.getByRole('button', { name: '删除记录', exact: true }).click();
        await page.waitForFunction(() => !JSON.parse(localStorage.getItem('sessions')).some(row => row.id === 'tue'));
        await page.getByRole('button', { name: '关闭全部训练历史', exact: true }).click();
        await full.waitFor({ state: 'hidden' });
        await page.getByRole('tab', { name: '切换到数据', exact: true }).click();
        assert.equal(await page.getByTestId('run-week-mileage').innerText(), '5 km');
        assert.equal(await page.getByTestId('run-month-mileage').innerText(), '34.8 km');
        assert.match(await page.getByTestId('running-milestone').innerText(), /34\.8/);
        assert.doesNotMatch(await page.getByTestId('running-mileage-chart').getAttribute('aria-label'), /7\.8公里/);
        await page.getByRole('tab', { name: '切换到今日', exact: true }).click(); await page.getByRole('tab', { name: '切换到跑步', exact: true }).click();
        await page.getByRole('switch', { name: '关闭跑步语音播报', exact: true }).waitFor();
        assert.equal(await page.getByTestId('running-screen').getByText('本周', { exact: true }).count(), 0);
        assert.equal(await page.getByTestId('running-screen').getByText('本月', { exact: true }).count(), 0);
        const runDock = await page.getByTestId('run-control-dock').boundingBox(), nav = await page.getByTestId('bottom-navigation').boundingBox(); assert.ok(runDock.y + runDock.height <= nav.y);
        await page.getByRole('switch', { name: '关闭跑步语音播报', exact: true }).click(); await page.getByRole('switch', { name: '开启跑步语音播报', exact: true }).waitFor();
        await page.getByRole('switch', { name: '开启跑步语音播报', exact: true }).click();
        await page.screenshot({ path: `D:/UncoverBuildTools/temp/run-mileage-layout/run-${width}-${height}.png` });
        await page.getByRole('button', { name: '开始跑步', exact: true }).click(); await page.getByRole('button', { name: '暂停跑步', exact: true }).waitFor();
        await page.evaluate(() => { const fix = metres => window.__runFix({ coords: { latitude: metres / 111195.08, longitude: 0, accuracy: 5, speed: 3 }, timestamp: Date.now() }); fix(0); for (let i = 1; i <= 101; i++) { window.__runShift += 3800; fix(i * 10); } });
        await page.waitForFunction(() => window.__runSpoken.some(text => text.includes('1公里')));
        const count = await page.evaluate(() => window.__runSpoken.filter(text => text.includes('1公里')).length); assert.equal(count, 1);
        assert.equal(await page.getByTestId('running-screen').getByText(/您已跑了1公里/).count(), 0, 'Audio-only announcement, never printed');
        await page.getByRole('switch', { name: '关闭跑步语音播报', exact: true }).click(); await page.getByRole('button', { name: '暂停跑步', exact: true }).click();
        await page.getByRole('button', { name: '继续跑步', exact: true }).waitFor(); await page.getByRole('button', { name: '继续跑步', exact: true }).click();
        await page.getByRole('switch', { name: '开启跑步语音播报', exact: true }).click();
        assert.equal(await page.evaluate(() => window.__runSpoken.filter(text => text.includes('1公里')).length), 1);
        assert.deepEqual(errors, []);
        console.log(`PASS ${width}x${height}: unified navigation, latest-only history, full/date lists, deletion recalculates running stats/milestone, voice default/toggle, single audio-only kilometre`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
