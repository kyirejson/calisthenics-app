// No manual Locate click: isolated GPS fixtures automatically follow the page.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const prefix = fs.readFileSync(require.resolve('./smoke-running-map.cjs'), 'utf8').split('(async () => {')[0];
const { chromium, prepare, emit } = vm.runInNewContext(prefix + ';({chromium,prepare,emit})', { require, process, console });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const fixture = await prepare(browser), { page, context, errors } = fixture;
    try {
      await page.getByText(/定位就绪/).waitFor(); assert.equal(await page.evaluate(() => window.qaGps.count()), 1);
      const tile = await page.getByTestId('run-map-tile').first().locator('img').getAttribute('src');
      await emit(page, 1000, 30); await page.waitForFunction(previous => {
        const image = document.querySelector('[data-testid="run-map-tile"] img'); return image && image.getAttribute('src') !== previous;
      }, tile);
      assert.equal(await page.getByTestId('run-duration').innerText(), '00:00'); assert.equal(await page.evaluate(() => localStorage.getItem('sessions')), '[]');
      await page.getByRole('tab', { name: '切换到饮食', exact: true }).click(); await page.waitForFunction(() => window.qaGps.count() === 0);
      await page.getByRole('tab', { name: '切换到跑步', exact: true }).click(); await page.waitForFunction(() => window.qaGps.count() === 1);
      await page.getByRole('button', { name: '选择室内跑', exact: true }).click(); await page.waitForFunction(() => window.qaGps.count() === 0);
      await page.getByRole('button', { name: '选择户外跑', exact: true }).click(); await page.waitForFunction(() => window.qaGps.count() === 1);
      assert.equal(errors.length, 0); console.log('PASS auto outdoor location, live map following without Locate click, no timer/history, stop on exit/indoor, single resubscription on return');
    } finally { await context.close(); }
    const denied = await prepare(browser, 390, 844, true);
    try {
      await denied.page.getByText(/访问被拒绝.*浏览器错误 1/).waitFor();
      await denied.page.waitForTimeout(2200); assert.equal(await denied.page.evaluate(() => window.qaGps.count()), 1, 'No retry/permission loop');
      assert.equal(await denied.page.getByRole('button', { name: '开始跑步', exact: true }).isEnabled(), true);
      console.log('PASS automatic request reports actual denial without looping or preventing start');
    } finally { await denied.context.close(); }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
