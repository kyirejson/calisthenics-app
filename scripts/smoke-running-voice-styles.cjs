// Isolated browser with real bundled WAV decode and Web Audio playback scheduling.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-map.cjs'), 'utf8').split('(async () => {')[0];
const { chromium, prepare, start, emit, finish } = vm.runInNewContext(prefix + ';({chromium,prepare,start,emit,finish})', { require, process, console });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const [width, height] of [[320, 600], [390, 844]]) {
      const fixture = await prepare(browser, width, height), { page, context, errors } = fixture;
      try {
        await page.evaluate(() => {
          window.qaAudio = [];
          const original = AudioBufferSourceNode.prototype.start;
          AudioBufferSourceNode.prototype.start = function(when, offset = 0, duration) {
            const values = this.buffer.getChannelData(0), rate = this.buffer.sampleRate;
            let energy = 0; for (let index = Math.floor(offset * rate); index < Math.min(values.length, (offset + duration) * rate); index++) energy += Math.abs(values[index]);
            const item = { when, offset, duration, energy, ended: false }; window.qaAudio.push(item);
            this.addEventListener('ended', () => { item.ended = true; }); return original.call(this, when, offset, duration);
          };
        });
        await page.getByRole('button', { name: '打开跑步设置', exact: true }).click();
        await page.getByRole('radio', { name: '男声', exact: true }).click();
        try { await page.waitForFunction(() => document.querySelector('[role="radio"][aria-label="男声"]')?.getAttribute('aria-checked') === 'true'); }
        catch (failure) { console.error('Voice selector QA:', await page.evaluate(() => ({ radios: [...document.querySelectorAll('[role="radio"]')].map(node => ({ label: node.getAttribute('aria-label'), checked: node.getAttribute('aria-checked') })), options: localStorage.getItem('uncover.running.options.v1'), alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent) }))); throw failure; }
        const choice = await page.getByRole('radio', { name: '男声', exact: true }).boundingBox(); assert.ok(choice.height >= 44 && choice.x >= 0 && choice.x + choice.width <= width);
        await page.screenshot({ path: `D:/UncoverBuildTools/temp/running-browser-qa/voice-settings-${width}.png` });
        await page.getByRole('button', { name: '保存跑步设置', exact: true }).click();
        await page.getByRole('radio', { name: '男声', exact: true }).waitFor({ state: 'hidden' });
        await start(page); await page.waitForFunction(() => window.qaAudio.length >= 1 && window.qaAudio[0].ended);
        await emit(page, 0); for (let i = 1; i <= 105; i++) await emit(page, i * 10);
        await page.waitForFunction(() => window.qaAudio.length >= 8); await page.waitForFunction(() => window.qaAudio.at(-1).ended);
        const before = await page.evaluate(() => JSON.parse(localStorage.getItem('uncover.running.web-journal.v2')));
        await page.getByRole('button', { name: '打开跑步设置', exact: true }).click(); await page.getByRole('radio', { name: '女声', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[role="radio"][aria-label="女声"]')?.getAttribute('aria-checked') === 'true');
        await page.getByRole('button', { name: '关闭跑步设置', exact: true }).click();
        const after = await page.evaluate(() => JSON.parse(localStorage.getItem('uncover.running.web-journal.v2')));
        assert.equal(after.id, before.id); assert.equal(after.phase, 'running'); assert.equal(after.options.voiceStyle, 'female'); assert.equal(after.spokenKm, before.spokenKm);
        const utterances = await page.evaluate(() => window.qaAudio.length);
        for (let i = 106; i <= 205; i++) await emit(page, i * 10);
        await page.waitForFunction(n => window.qaAudio.length > n && window.qaAudio.at(-1).ended, utterances);
        const audio = await page.evaluate(() => window.qaAudio); assert.ok(audio.every(item => item.energy > 1));
        await finish(page); await page.reload({ waitUntil: 'domcontentloaded' });
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('uncover.running.options.v1')).voiceStyle), 'female');
        assert.equal(errors.length, 0, errors.join('\n')); console.log(`PASS ${width}x${height}: both real PCM voices decoded/played, automatic persistence, active switch preserves stopwatch/watermark, each km once, mobile hit targets`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
