// Real browser QA, synthetic profile / sessions in isolated contexts only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { getProgressionStatus } = require('../src/data/progression.ts');
const profile = { name: '进阶隔离验证', age: 30, height: 175, weight: 75, sex: 'male', goal: 'street_mastery', nutritionGoal: 'maintain', dietPattern: 'balanced_cn',
  frequency: 3, levels: { push: 5 }, planLevels: { push: 5 }, experience: 'intermediate', sessionMinutes: 45, trainingRestSeconds: 180,
  planId: 'prisoner', planStartedAt: new Date().toISOString(), weightHistory: [] };
function exam(id, offset) {
  const status = getProgressionStatus('push', profile, []), criteria = status.criteria;
  const at = new Date(); at.setDate(at.getDate() + offset); at.setSeconds(at.getSeconds() - 30);
  return { id, workoutId: 'single_' + status.current.id, workoutName: '标准俯卧撑专项', startedAt: at.toISOString(), completedAt: at.toISOString(), kind: 'strength',
    durationSeconds: 1200, quality: 'solid', completion: 'complete', totalReps: criteria.sets * criteria.value,
    exercises: [{ exerciseId: status.current.id, name: status.current.name, category: 'push', constraintsConfirmed: true,
      sets: Array.from({ length: criteria.sets }, () => ({ reps: criteria.value, completed: true, unit: criteria.unit })) }] };
}
const output = process.env.PROGRESSION_SCREENSHOT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-progression-ui-'));
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
  const errors = [];
  const contexts = [];
  async function open(selected, records = [], reducedMotion = 'reduce', width = 390, height = 900, failCover = false) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, timezoneId: 'Asia/Shanghai', reducedMotion });
    contexts.push(context);
    await context.addInitScript(({ selected, records }) => {
      if (!localStorage.getItem('__uncover_progression_seeded')) {
        localStorage.setItem('user_profile', JSON.stringify(selected)); localStorage.setItem('sessions', JSON.stringify(records));
        localStorage.setItem('__uncover_progression_seeded', '1');
      }
    }, { selected, records });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://127.0.0.1:8787/**', route => route.abort());
    if (failCover) await page.route('**/*image00559*', route => route.abort());
    await page.goto('http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText('进阶', { exact: true }).click();
    await page.getByTestId('progression-screen').waitFor();
    return { context, page };
  }
  const snapshot = async (page, filename) => { await page.screenshot({ path: path.join(output, filename + '.png'), animations: 'disabled' }); };
  const top = page => page.getByTestId('progression-list').evaluate(element => new Promise(resolve => { element.scrollTop = 0; requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
  const saved = page => page.evaluate(() => ({ profile: localStorage.getItem('user_profile'), sessions: localStorage.getItem('sessions') }));
  const settled = page => page.waitForFunction(() => {
    const node = document.querySelector('[data-testid="progression-route-reveal"]');
    return node && Number(getComputedStyle(node).opacity) > 0.999 && Math.abs(new DOMMatrixReadOnly(getComputedStyle(node).transform).m42) < 0.001;
  });
  try {
    const manual = await open(profile);
    const page = manual.page;
    await settled(page);
    const before = await saved(page);
    assert.equal(await page.getByText(/终式目标/).count(), 0);
    assert.equal(await page.getByRole('button', { name: /^查看终式.*动作指导$/ }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '查看第10式单臂俯卧撑动作指导，待解锁', exact: true }).count(), 1);
    assert.equal(await page.getByTestId('progression-final-ring').locator('circle').nth(1).getAttribute('stroke'), '#343C48');
    assert.equal((await page.getByTestId('progression-exam-count').innerText()).trim(), '专项验收 0/2');
    assert.match(await page.getByRole('button', { name: '展开全部已通过阶数', exact: true }).innerText(), /4 式已通过/);
    assert.equal(await page.getByRole('button', { name: '解锁下一式', exact: true }).count(), 0);
    await snapshot(page, 'progression-manual-390');
    await page.getByRole('button', { name: '展开全部已通过阶数', exact: true }).click();
    assert.match(await page.getByTestId('progression-stage-push_01').innerText(), /已通过/);
    assert.match(await page.getByTestId('progression-stage-push_02').innerText(), /已通过/);
    assert.match(await page.getByTestId('progression-stage-push_03').innerText(), /已通过/);
    assert.match(await page.getByTestId('progression-stage-push_04').innerText(), /已通过/);
    await page.getByRole('button', { name: '收起已通过阶数', exact: true }).click();
    assert.deepEqual(await saved(page), before);
    console.log('PASS manual step five passes lower steps, creates no exams, folding changes no data');

    await page.getByRole('button', { name: '放大查看标准俯卧撑动作配图', exact: true }).click();
    await page.getByTestId('progression-artwork-viewer').waitFor();
    const source = () => page.getByTestId('progression-artwork-viewer').locator('img').getAttribute('src');
    const coverSource = await source();
    assert.match(coverSource, /image00559/);
    await page.getByRole('button', { name: '查看第1张动作原图', exact: true }).click();
    assert.match(await source(), /image00558/);
    assert.notEqual(await source(), coverSource);
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[data-testid="progression-artwork-canvas"]');
      const image = canvas?.querySelector('img');
      if (!image?.naturalWidth || !image.naturalHeight) return false;
      const expected = Math.max(120, Math.min(430, innerHeight * 0.53, canvas.clientWidth / (image.naturalWidth / image.naturalHeight)));
      return Math.abs(canvas.clientHeight - expected) < 2;
    });
    assert.equal(await page.getByTestId('progression-artwork-canvas').evaluate(element => Array.from(element.querySelectorAll('*'))
      .some(node => getComputedStyle(node).backgroundImage !== 'none' && getComputedStyle(node).backgroundSize === 'contain')), true);
    await snapshot(page, 'progression-photo-original');
    await page.getByRole('button', { name: '放大动作原图', exact: true }).click();
    assert.ok((await page.getByTestId('progression-artwork-canvas').boundingBox()).width > 390);
    await snapshot(page, 'progression-photo-expanded');
    await page.getByRole('button', { name: '恢复完整原图', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByTestId('progression-artwork-viewer').waitFor({ state: 'hidden' });
    assert.deepEqual(await saved(page), before);
    console.log('PASS original images use separate files, full-size viewer, magnify / fit, Escape closes');

    assert.equal(await page.getByRole('button', { name: '查看街头技巧分类', exact: true }).count(), 0);
    assert.match(await page.getByTestId('progression-screen').innerText(), /\/ 17 个终式已解锁/);
    for (const [group, route] of [['六艺基础', '引体向上'], ['关节与支援', '悬挂握力'], ['爆发六功', '功夫打挺']]) {
      await top(page);
      await page.getByRole('button', { name: '查看' + group + '分类', exact: true }).click();
      await page.getByRole('button', { name: '选择' + route + '进阶路线', exact: true }).click();
      await settled(page);
      await page.getByTestId('progression-current-stage').waitFor();
      await snapshot(page, 'progression-group-' + route);
    }
    assert.deepEqual(await saved(page), before);
    console.log('PASS all three browse groups / removed module absent / final total updated');

    await top(page);
    await page.getByRole('button', { name: '搜索动作', exact: true }).click();
    await page.getByTestId('progression-search').fill('窄距俯卧撑');
    await settled(page);
    assert.match(await page.getByTestId('progression-stage-push_06').innerText(), /窄距俯卧撑/);
    await page.getByTestId('progression-search').fill('这项动作不存在000');
    await page.getByText('没有找到相关动作', { exact: true }).waitFor();
    await page.getByRole('button', { name: '清空动作搜索', exact: true }).click();
    await page.getByRole('button', { name: '收起动作搜索', exact: true }).click();
    await page.getByRole('button', { name: '查看进阶规则', exact: true }).click();
    assert.match(await page.getByTestId('progression-rules').innerText(), /选择较高阶，低阶即视为已通过/);
    assert.deepEqual(await saved(page), before);
    console.log('PASS cross-category search, empty state, rule explanation; browsing never changes records');

    await page.getByRole('button', { name: '查看第6式窄距俯卧撑动作指导，待解锁', exact: true }).click();
    await page.getByText('设为当前第 6 式（同步当前阶与计划）', { exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('user_profile')).levels.push === 6);
    assert.equal((await saved(page)).sessions, before.sessions);
    await page.getByRole('button', { name: '返回动作列表', exact: true }).click();
    await page.getByTestId('progression-screen').waitFor();
    assert.match(await page.getByRole('button', { name: '展开全部已通过阶数', exact: true }).innerText(), /5 式已通过/);
    assert.match(await page.getByTestId('progression-exam-count').innerText(), /0\/2/);
    console.log('PASS manually choosing a higher step in the actual UI passes lower stages without creating records');

    const final = await open({ ...profile, levels: { push: 11 }, planLevels: { push: 10 } });
    assert.match(await final.page.getByTestId('progression-final-ring').innerText(), /6%/);
    assert.equal(await final.page.getByTestId('progression-current-stage').count(), 0);
    assert.match(await final.page.getByTestId('progression-stage-push_10').innerText(), /终式已解锁/);
    await snapshot(final.page, 'progression-final-unlocked');
    console.log('PASS selected higher step acknowledges core final, actual 1/17 rounds to 6 percent');

    const ready = await open(profile, [exam('exam-a', -4), exam('exam-b', -2)]);
    assert.match(await ready.page.getByTestId('progression-exam-count').innerText(), /2\/2/);
    const beforeConfirm = await saved(ready.page);
    await ready.page.getByRole('button', { name: '解锁下一式', exact: true }).click();
    await ready.page.getByText('再练一练', { exact: true }).click();
    assert.deepEqual(await saved(ready.page), beforeConfirm);
    await ready.page.evaluate(() => {
      window.__progressionOriginalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'user_profile') throw new DOMException('隔离测试：存储空间不足', 'QuotaExceededError');
        return window.__progressionOriginalSetItem.call(this, key, value);
      };
    });
    await ready.page.getByRole('button', { name: '解锁下一式', exact: true }).click();
    await ready.page.getByText('确认进阶', { exact: true }).click();
    await ready.page.locator('#app-web-toast').filter({ hasText: '保存失败' }).waitFor();
    assert.deepEqual(await saved(ready.page), beforeConfirm);
    assert.match(await ready.page.getByTestId('progression-exam-count').innerText(), /2\/2/);
    await ready.page.evaluate(() => { Storage.prototype.setItem = window.__progressionOriginalSetItem; delete window.__progressionOriginalSetItem; });
    console.log('PASS cancelling or failing to save never changes the current level or training records');
    const recordsBefore = (await saved(ready.page)).sessions;
    await ready.page.getByRole('button', { name: '解锁下一式', exact: true }).click();
    await ready.page.getByText('确认进阶', { exact: true }).click();
    await ready.page.waitForFunction(() => JSON.parse(localStorage.getItem('user_profile')).levels.push === 6);
    await ready.page.getByText('窄距俯卧撑', { exact: true }).first().waitFor();
    assert.match(await ready.page.getByTestId('progression-exam-count').innerText(), /0\/2/);
    assert.equal((await saved(ready.page)).sessions, recordsBefore);
    await ready.page.reload({ waitUntil: 'domcontentloaded' });
    await ready.page.getByText('进阶', { exact: true }).click();
    assert.equal(await ready.page.evaluate(() => JSON.parse(localStorage.getItem('user_profile')).levels.push), 6);
    console.log('PASS recorded eligibility, confirm, persistent advance; original training records preserved');

    const narrow = await open({ ...profile, levels: { push: 1 }, planLevels: { push: 1 } }, [], 'reduce', 320);
    await settled(narrow.page); await snapshot(narrow.page, 'progression-narrow-320');
    const overflow = await narrow.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(overflow, false);
    for (const group of ['六艺基础', '关节与支援', '爆发六功']) {
      const box = await narrow.page.getByRole('button', { name: '查看' + group + '分类', exact: true }).boundingBox();
      assert.ok(box.height >= 44 && box.x >= 0 && box.x + box.width <= 320);
    }
    console.log('PASS 320px layout, three categories on one row, accessible tap targets / reduced motion');

    for (const [width, height] of [[390, 640], [681, 871], [1280, 900]]) {
      const responsive = await open(profile, [], 'reduce', width, height);
      await settled(responsive.page);
      assert.equal(await responsive.page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
      const boxes = await Promise.all(['六艺基础', '关节与支援', '爆发六功'].map(group => responsive.page.getByRole('button', { name: '查看' + group + '分类', exact: true }).boundingBox()));
      assert.ok(boxes.every(box => box && box.height >= 44 && Math.abs(box.y - boxes[0].y) < 1));
      if (height === 640) {
        await responsive.page.getByRole('button', { name: '放大查看标准俯卧撑动作配图', exact: true }).click();
        await responsive.page.getByRole('button', { name: '查看标准俯卧撑动作指导', exact: true }).scrollIntoViewIfNeeded();
        await snapshot(responsive.page, 'progression-short-viewer');
        await responsive.page.getByRole('button', { name: '关闭动作配图', exact: true }).click();
        assert.equal(JSON.parse((await saved(responsive.page)).sessions).length, 0);
      }
      await snapshot(responsive.page, 'progression-responsive-' + width + 'x' + height);
    }
    console.log('PASS short mobile / tablet / desktop layouts, no horizontal clipping, photo guide reachable');

    const failedImage = await open(profile, [], 'reduce', 390, 900, true);
    const failedImageBefore = await saved(failedImage.page);
    await failedImage.page.getByRole('button', { name: '放大查看标准俯卧撑动作配图', exact: true }).click();
    await failedImage.page.getByTestId('progression-artwork-viewer').getByText('图片暂不可用，请按文字指导练习', { exact: true }).waitFor();
    await failedImage.page.getByRole('button', { name: '查看第1张动作原图', exact: true }).click();
    await failedImage.page.waitForFunction(() => Boolean(document.querySelector('[data-testid="progression-artwork-viewer"] img')?.naturalWidth));
    await failedImage.page.keyboard.press('Escape');
    assert.deepEqual(await saved(failedImage.page), failedImageBefore);
    console.log('PASS image request failure shows a usable fallback; a separate source frame still loads');

    const animated = await open(profile, [], 'no-preference');
    await animated.page.getByRole('button', { name: '选择引体向上进阶路线', exact: true }).click();
    const frames = await animated.page.evaluate(() => new Promise(resolve => {
      const samples = [];
      const capture = () => {
        const element = document.querySelector('[data-testid="progression-route-reveal"]');
        const opacity = Number(getComputedStyle(element).opacity);
        const y = new DOMMatrixReadOnly(getComputedStyle(element).transform).m42;
        samples.push({ opacity, y });
        if (opacity < 0.999 || samples.length < 2) requestAnimationFrame(capture); else resolve(samples);
      };
      requestAnimationFrame(capture);
    }));
    assert.ok(frames.some(frame => frame.opacity < 0.99 && frame.y > 0));
    frames.forEach((frame, index) => { if (index) assert.ok(frame.opacity >= frames[index - 1].opacity - 0.001 && frame.y <= frames[index - 1].y + 0.001); });
    await settled(animated.page);
    assert.deepEqual(errors, []);
    console.log('PASS smooth route transition has intermediate monotonic frames, no browser runtime errors');
    console.log('Screenshots: ' + output);
  } finally { await Promise.all(contexts.map(context => context.close())); await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
