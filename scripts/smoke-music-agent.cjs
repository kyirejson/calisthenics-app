// Isolated browser profile and synthetic model. Tests settings/tool plumbing, not Android playback.
const assert = require('node:assert/strict'), fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/UncoverBuildTools/browser-tests/node_modules/playwright');
const output = process.env.MUSIC_QA_OUTPUT || 'D:/UncoverBuildTools/temp/agent-music-20261013';
const base = process.env.MUSIC_QA_BASE || 'http://127.0.0.1:8081/';
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [320, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 871 } }), page = await context.newPage(), requests = [], errors = [];
      page.setDefaultTimeout(35000); page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(() => {
        if (sessionStorage.getItem('music-qa')) return;
        sessionStorage.setItem('music-qa', '1'); localStorage.setItem('profile-invitation-seen', '1');
        localStorage.setItem('user_profile', JSON.stringify({ name: 'MUSIC_QA', age: 30, sex: 'male', height: 175, weight: 75, goal: 'street_mastery', frequency: 2, experience: 'beginner', levels: {}, planStartedAt: new Date().toISOString() }));
        localStorage.setItem('uncover.agent.connection.v1', JSON.stringify({ version: 1, mode: 'personal', provider: 'deepseek', model: 'deepseek-flash', deepseekKey: 'sk-isolated-music-fixture' }));
      });
      await context.route('**/*', route => {
        if (!route.request().url().startsWith('https://api.deepseek.com/')) return route.request().url().startsWith(base) || /^(data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort();
        const body = route.request().postDataJSON(); requests.push(body);
        const step = requests.length;
        const tools = [['read_music_settings', {}], ['open_music', { operationKey: 'open-selected' }], ['read_music_playback', {}]];
        const delta = step <= tools.length ? { tool_calls: [{ index: 0, id: `music-${step}`, type: 'function', function: { name: tools[step - 1][0], arguments: JSON.stringify(tools[step - 1][1]) } }] } : { content: '浏览器不能控制手机音乐软件，请使用 Android 安装包。' };
        return route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: step <= tools.length ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n` });
      });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const settings = async () => {
        await page.getByRole('button', { name: '打开 DeepSeek 聊天', exact: true }).click();
        await page.getByRole('button', { name: '打开服务设置', exact: true }).click();
        await page.getByTestId('music-settings').waitFor();
      };
      const checked = async label => assert.equal(await page.getByRole('radio', { name: label, exact: true }).getAttribute('aria-checked'), 'true');
      await settings(); await checked('默认使用网易云音乐'); await checked('默认播放我喜欢');
      await page.getByRole('radio', { name: '默认使用QQ 音乐', exact: true }).click(); await checked('默认使用QQ 音乐');
      await page.getByRole('radio', { name: '默认播放指定歌单', exact: true }).click();
      await page.getByLabel('默认歌单名称', { exact: true }).fill('夜跑 · 测试歌单');
      await page.getByLabel('默认歌单分享链接', { exact: true }).fill('https://y.qq.com/n/ryqq/playlist/123');
      await page.getByRole('button', { name: '保存默认音乐歌单', exact: true }).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('settings')).music.presets.qq.name === '夜跑 · 测试歌单');
      await page.getByRole('radio', { name: '默认使用网易云音乐', exact: true }).click(); await checked('默认播放我喜欢');
      await page.getByRole('radio', { name: '默认使用QQ 音乐', exact: true }).click(); await checked('默认播放指定歌单');
      assert.equal(await page.getByLabel('默认歌单名称', { exact: true }).inputValue(), '夜跑 · 测试歌单');
      await page.getByTestId('music-provider-status').getByText(/浏览器不能控制/).waitFor();
      assert.equal(await page.getByRole('button', { name: '开启音乐界面控制', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: '开启音乐播放状态读取', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: '开启后台点歌', exact: true }).isDisabled(), true);
      await page.getByTestId('music-settings').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${output}/music-settings-${width}.png` });
      const box = await page.getByTestId('music-settings').boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.reload(); await settings(); await checked('默认使用QQ 音乐'); await checked('默认播放指定歌单');
      assert.equal(await page.getByLabel('默认歌单名称', { exact: true }).inputValue(), '夜跑 · 测试歌单');
      await page.getByRole('button', { name: '关闭服务设置', exact: true }).click();
      await page.getByLabel('聊天输入', { exact: true }).fill('我想听点适合跑步的音乐');
      await page.getByRole('button', { name: '发送聊天消息', exact: true }).click();
      await page.getByText('浏览器不能控制手机音乐软件，请使用 Android 安装包。', { exact: true }).waitFor();
      assert.equal(requests.length, 4);
      const settingsResult = JSON.parse(requests[1].messages.at(-1).content);
      assert.equal(settingsResult.preferences.provider, 'qq'); assert.equal(settingsResult.preferences.presets.qq.name, '夜跑 · 测试歌单');
      assert.equal(JSON.parse(requests[2].messages.at(-1).content).code, 'native_required');
      assert.equal(JSON.parse(requests[3].messages.at(-1).content).code, 'native_required');
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS music presets + two independent libraries + storage/reload + honest browser capabilities + model tool loop ${width}px`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
