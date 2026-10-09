const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-map.cjs'), 'utf8').split('(async () => {')[0];
const { chromium, prepare } = vm.runInNewContext(prefix + ';({chromium,prepare})', { require, process, console, Buffer, setTimeout, clearTimeout });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const { context, page, errors } = await prepare(browser, 390, 844, false, true);
    await page.evaluate(() => {
      navigator.geolocation.getCurrentPosition = (success, failure, options) => {
        if (options.enableHighAccuracy !== false) throw Error('Expected quick map-only request');
        window.qaApproximateSuccess = success; window.qaApproximateFailure = failure;
        success({ timestamp: Date.now(), coords: { latitude: 39.91, longitude: 116.4, accuracy: 80 } });
      };
    });
    await page.getByRole('button', { name: '检查跑步定位', exact: true }).click();
    await page.getByText('地图已定位 · 大致位置', { exact: true }).waitFor();
    await page.getByText(/浏览器大致位置（仅地图）/).waitFor();
    await page.evaluate(() => window.qaGps.deny());
    await page.getByText(/浏览器错误 1/).waitFor();
    await page.getByText('地图已定位 · 大致位置', { exact: true }).waitFor();
    await page.screenshot({ path: 'D:/UncoverBuildTools/temp/running-browser-qa/browser-approximate-position.png' });
    await page.getByRole('button', { name: '开始跑步', exact: true }).click();
    await page.getByText('正在跑步', { exact: true }).waitFor();
    assert.equal(await page.getByTestId('run-distance').innerText(), '—');
    await page.getByRole('button', { name: '结束并保存跑步', exact: true }).click();
    await page.getByRole('button', { name: '结束并保存', exact: true }).click();
    await page.getByRole('button', { name: '关闭跑步总结', exact: true }).click();
    await page.evaluate(() => {
      window.qaApproximateFailure({ code: 2, message: 'Network location provider unavailable' });
      window.qaGps.advance(121);
    });
    await page.getByText(/浏览器错误 2.*Network location provider unavailable/).waitFor();
    await page.screenshot({ path: 'D:/UncoverBuildTools/temp/running-browser-qa/browser-provider-error.png' });
    assert.deepEqual([...errors], []); await context.close();
    console.log('PASS browser approximate map, provider error detail, no fabricated distance and stopwatch save');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
