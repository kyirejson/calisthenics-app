// Read-only diagnostic in an isolated Chrome context, not the user's IAB tab.
// No coordinate values, personal storage or spoofed positions are printed.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'D:/UncoverBuildTools/browser-tests/node_modules/playwright');
(async () => {
  const browserLabel = process.env.BROWSER_LABEL || 'isolated Chrome, not in-app browser';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const context = await browser.newContext({ permissions: ['geolocation'] });
    const page = await context.newPage();
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:8081/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const diagnostics = await page.evaluate(async () => {
      const permission = await navigator.permissions.query({ name: 'geolocation' }).then(result => result.state).catch(() => 'unknown');
      const request = high => new Promise(resolve => {
        const started = performance.now();
        navigator.geolocation.getCurrentPosition(position => resolve({ highAccuracy: high, received: true, accuracy: position.coords.accuracy, ageMs: Date.now() - position.timestamp, elapsedMs: Math.round(performance.now() - started) }),
          error => resolve({ highAccuracy: high, received: false, code: error.code, message: error.message, elapsedMs: Math.round(performance.now() - started) }),
          { enableHighAccuracy: high, maximumAge: high ? 0 : 60000, timeout: 15000 });
      });
      return { secure: isSecureContext, permission, results: await Promise.all([request(false), request(true)]) };
    });
    console.log(JSON.stringify({ browser: browserLabel, ...diagnostics }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
