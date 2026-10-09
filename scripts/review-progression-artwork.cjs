// Read-only visual audit: render existing assets in a contact sheet, never edit them.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const inventory = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'audit-progression-artwork.cjs'), '--json', ...args.filter(arg => arg.startsWith('--group=') || arg.startsWith('--ids='))], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }));
const figures = args.find(arg => arg.startsWith('--figures='))?.slice(10).split(',');
const rawSources = args.includes('--raw');
const subjectFraming = args.includes('--subject');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const { getSubjectFrame, fitSubjectFrame } = require('../src/utils/exerciseFraming.ts');
if (figures) inventory.rows = figures.map(name => {
  const directories = ['assets/original-images', 'assets/recovery-original-images', process.env.ORIGINAL_BOOK_IMAGES].filter(Boolean);
  const source = directories.map(directory => path.resolve(root, directory, name)).find(filename => fs.existsSync(filename));
  return { id: name, name: source ? '原始图片' : '未打包 / 缺失', source, point: '' };
});
if (rawSources) inventory.rows = fs.readdirSync(path.join(root, 'assets/raw-sources')).map(name => ({ id: name, name: '未加工来源', source: 'assets/raw-sources/' + name, point: '' }));
const output = process.env.ARTWORK_SCREENSHOT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-artwork-audit-'));
fs.mkdirSync(output, { recursive: true });
const escape = text => String(text ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route('http://artwork.local/**', async route => {
      const index = Number(new URL(route.request().url()).pathname.slice(1));
      const filename = inventory.rows[index]?.source;
      if (!filename) return route.fulfill({ status: 404, body: '' });
      await route.fulfill({ body: fs.readFileSync(path.resolve(root, filename)), contentType: filename.endsWith('.png') ? 'image/png' : 'image/jpeg' });
    });
    for (let start = 0; start < inventory.rows.length; start += 20) {
      const slice = inventory.rows.slice(start, start + 20);
      const html = '<!doctype html><meta charset="utf-8"><style>body{background:#111;color:#eee;font:14px Arial;margin:12px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}article{background:#23262b;padding:8px;border-radius:8px}.photo{width:100%;height:180px;position:relative;overflow:hidden;background:#171c22}img{width:100%;height:100%;object-fit:contain}h3{margin:4px 0;font-size:15px}p{margin:4px 0;font-size:11px;color:#b5c3cb}</style><main>'
        + slice.map((row, index) => '<article><div class="photo"><img src="http://artwork.local/' + (start + index) + '"></div><h3>' + escape(row.id + ' · ' + row.name) + '</h3><p>' + escape(row.point) + '</p><p>' + escape(row.source) + '</p></article>').join('') + '</main>';
      await page.setContent(html);
      await page.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode().catch(() => undefined))));
      if (subjectFraming) {
        const placements = await page.locator('.photo').evaluateAll((boxes, frames) => boxes.map((box, i) => ({ frame: frames[i], width: box.clientWidth, height: box.clientHeight })), slice.map(row => getSubjectFrame(path.basename(row.source || '')) || null));
        const fits = placements.map(item => item.frame ? fitSubjectFrame(item.frame, item.width, item.height) : null);
        await page.locator('img').evaluateAll((images, fits) => images.forEach((img, i) => {
          const fit = fits[i]; if (!fit) return;
          Object.assign(img.style, { position: 'absolute', width: fit.width + 'px', height: fit.height + 'px', left: fit.left + 'px', top: fit.top + 'px' });
        }), fits);
      }
      const filename = path.join(output, 'artwork-' + String(start / 20 + 1).padStart(2, '0') + '.png');
      await page.screenshot({ path: filename, fullPage: true });
      console.log(filename);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
