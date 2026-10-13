// Isolated profile / synthetic speech engine: tests UI and scheduling, not perceived audio quality.
const assert = require('node:assert/strict'), fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/UncoverBuildTools/browser-tests/node_modules/playwright');
require('./lib/register-typescript.cjs')();
const { normalizeProfile } = require('../src/store/profile.ts');
const { getPlanDay } = require('../src/domain/training/trainingPlans.ts');
const { exercises } = require('../src/domain/training/catalog.ts');
const { prescribeAddedExercise } = require('../src/domain/training/trainingPrescription.ts');
const anchor = '2026-10-13T01:00:00.000Z';
const profile = normalizeProfile({ name: 'VOICE_QA', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', frequency: 6, experience: 'elite', levels: { push: 5, pull: 5, squat: 5, legRaise: 5 }, planStartedAt: '2026-09-28T01:00:00.000Z' });
const hold = { ...prescribeAddedExercise(exercises.find(row => row.id === 'aux_hang'), profile), targetSets: 1, targetValue: 8, targetUnit: 'seconds' };
const completed = { ...prescribeAddedExercise(exercises.find(row => row.id === 'push_05'), profile), targetSets: 1, targetValue: 1 };
const holdSession = { id: 'voice-hold-fixture', workoutId: getPlanDay(profile, new Date(anchor)).day.workoutId, workoutName: 'VOICE_QA', trainingDate: '2026-10-13', startedAt: anchor, completedAt: anchor, durationSeconds: 1, inProgress: true, completion: 'partial',
  exercises: [{ exerciseId: completed.id, name: completed.name, category: completed.category, sets: [{ reps: 1, unit: 'reps', completed: true }] }],
  resumeState: { items: [completed, hold], warmupDone: true, sets: { [completed.id]: [{ reps: '1', completed: true }], [hold.id]: [{ reps: '8', completed: false }] } } };
async function prepare(browser, width, sessions = []) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, timezoneId: 'Asia/Shanghai' });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(35000); page.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(({ profile, sessions, anchor }) => {
    const OriginalDate = Date, start = performance.now(), timestamp = OriginalDate.parse(anchor);
    window.Date = class extends OriginalDate { constructor(...args) { super(...(args.length ? args : [timestamp + performance.now() - start])); } static now() { return timestamp + performance.now() - start; } };
    if (!sessionStorage.getItem('voice-qa')) { sessionStorage.setItem('voice-qa', '1'); localStorage.setItem('profile-invitation-seen', '1'); localStorage.setItem('user_profile', JSON.stringify(profile)); localStorage.setItem('sessions', JSON.stringify(sessions)); }
    window.__spoken = []; window.__speechFailure = false;
    window.__voiceHidden = false;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__voiceHidden ? 'hidden' : 'visible' });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      cancel() {}, getVoices: () => [{ lang: 'zh-CN', localService: true }],
      speak(utterance) { if (window.__speechFailure) { utterance.onerror?.({ error: 'not-allowed' }); return; } window.__spoken.push({ text: utterance.text, at: performance.now() }); utterance.onstart?.(); },
    } });
  }, { profile, sessions, anchor });
  await context.route('**/*', route => /^(http:\/\/127\.0\.0\.1:8081\/|data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('today-start-dock').getByRole('button').click(); await page.getByTestId('training-primary').waitFor();
  return { context, page, errors };
}
const spoken = page => page.evaluate(() => window.__spoken);
const waitSpoken = (page, size) => page.waitForFunction(size => window.__spoken.length >= size, size);
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  await fs.mkdir('D:/UncoverBuildTools/temp/training-voice-ui', { recursive: true });
  try {
    for (const width of [320, 390]) {
      const { context, page, errors } = await prepare(browser, width);
      assert.equal(await page.getByRole('button', { name: '打开 DeepSeek 聊天', exact: true }).count(), 0);
      assert.equal(await page.getByText('语音数数', { exact: true }).count(), 0);
      await page.getByTestId('training-actual-input').fill('3');
      await page.getByRole('button', { name: '打开训练设置', exact: true }).click();
      await page.getByText('喇叭设置', { exact: true }).waitFor();
      for (let i = 0; i < 4; i++) { await page.getByRole('button', { name: '减小报数间隔', exact: true }).click(); await page.waitForFunction(value => document.querySelector('[data-testid="training-voice-interval"]').textContent.startsWith(String(value)), 4 - i); }
      assert.equal(await page.getByRole('button', { name: '减小报数间隔', exact: true }).isDisabled(), true);
      await page.screenshot({ path: `D:/UncoverBuildTools/temp/training-voice-ui/settings-${width}.png` });
      await page.getByRole('button', { name: '关闭训练设置', exact: true }).click();
      await page.getByRole('switch', { name: '开启语音报数', exact: true }).click(); await waitSpoken(page, 3);
      assert.deepEqual((await spoken(page)).map(row => row.text), ['1', '2', '3']);
      assert.equal(await page.getByTestId('training-actual-input').inputValue(), '3');
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('sessions'))), []);
      await page.waitForTimeout(1200); assert.equal((await spoken(page)).length, 3, 'Stops at target');
      await page.getByTestId('training-primary').click(); await page.getByTestId('training-rest-time').waitFor();
      await page.waitForTimeout(1200); assert.equal((await spoken(page)).length, 3, 'No rep counting during rest');
      await page.getByTestId('training-primary').click(); await waitSpoken(page, 4); assert.equal((await spoken(page))[3].text, '1', 'Next set starts fresh');
      await page.evaluate(() => { window.__voiceHidden = true; document.dispatchEvent(new Event('visibilitychange')); });
      const hiddenSpoken = (await spoken(page)).length;
      await page.waitForTimeout(1300); assert.equal((await spoken(page)).length, hiddenSpoken, 'No background rep counting');
      await page.evaluate(() => { window.__voiceHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
      await waitSpoken(page, hiddenSpoken + 1); assert.equal((await spoken(page)).at(-1).text, '2', 'Foreground resumes without replaying lost ticks');
      await page.screenshot({ path: `D:/UncoverBuildTools/temp/training-voice-ui/toolbar-${width}.png` });
      await page.getByRole('switch', { name: '关闭语音报数', exact: true }).click();
      const stopped = (await spoken(page)).length; await page.waitForTimeout(1300); assert.equal((await spoken(page)).length, stopped);
      await page.evaluate(() => { window.__speechFailure = true; });
      await page.getByRole('switch', { name: '开启语音报数', exact: true }).click();
      await page.getByRole('alert').getByText(/not-allowed/).waitFor();
      assert.equal(await page.getByRole('switch', { name: '开启语音报数', exact: true }).getAttribute('aria-checked'), 'false');
      await page.evaluate(() => { window.__speechFailure = false; });
      await page.getByRole('switch', { name: '开启语音报数', exact: true }).click(); await waitSpoken(page, stopped + 1);
      assert.equal((await spoken(page)).at(-1).text, '1', 'Retry starts the spoken guide cleanly');
      await page.reload(); await page.getByTestId('today-start-dock').getByRole('button').click();
      await page.getByRole('button', { name: '打开训练设置', exact: true }).click(); assert.match(await page.getByTestId('training-voice-interval').innerText(), /^1/);
      assert.equal(await page.getByRole('switch', { name: '关闭语音报数', exact: true }).count(), 0, 'Fresh training defaults muted');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS voice icon + interval persistence + reps + target stop + rest + background + reset + failure retry + no fake records ${width}px`);
    }
    const { context, page, errors } = await prepare(browser, 390, [holdSession]);
    await page.getByRole('switch', { name: '开启语音报数', exact: true }).click();
    await page.getByTestId('training-rest-time').waitFor(); await waitSpoken(page, 1);
    assert.equal((await spoken(page))[0].text, '5', 'At five actual elapsed seconds, says five rather than one');
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    const holdSpoken = (await spoken(page)).length, holdTime = await page.getByTestId('training-rest-time').innerText();
    await page.waitForTimeout(1300); assert.equal((await spoken(page)).length, holdSpoken); assert.equal(await page.getByTestId('training-rest-time').innerText(), holdTime);
    await page.getByRole('button', { name: '继续', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[data-testid="training-rest-time"]'));
    await waitSpoken(page, 2);
    assert.deepEqual((await spoken(page)).map(row => row.text), ['5', '8'], 'The last real second is announced on natural completion');
    await page.getByRole('button', { name: '开始保持计时', exact: true }).click(); await waitSpoken(page, 3);
    assert.equal((await spoken(page)).at(-1).text, '5', 'Restarting the same set starts a fresh hold clock');
    await page.getByTestId('training-primary').click();
    await page.waitForTimeout(1300);
    assert.equal((await spoken(page)).length, 3, 'Stopping early does not announce unelapsed target seconds');
    const history = await page.evaluate(() => JSON.parse(localStorage.getItem('sessions')));
    assert.equal(history[0].exercises.flatMap(item => item.sets).filter(set => set.completed).length, 1, 'Hold voice does not auto-complete its set');
    assert.deepEqual(errors, []); await context.close(); console.log('PASS held seconds + actual elapsed + timer pause/resume + final second + same-set restart + early stop + no automatic completion');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
