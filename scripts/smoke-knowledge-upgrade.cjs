// Synthetic old seeds/local edits in a fresh browser context; never modifies user libraries.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
async function main() {
  const { readBundledLibraries } = await import('./lib/knowledge/seed-files.mjs');
  const { reconcileSeed } = await import('../src/knowledge/seedUpgrade.mjs');
  const library = readBundledLibraries(path.resolve(__dirname, '..')).find(
    (item) => item.id === 'nutrition',
  );
  const incoming = library.documents[0],
    oldMarkdown = '# 旧版资料\n隔离的旧种子正文。';
  const old = {
    ...incoming,
    markdown: oldMarkdown,
    sha256: crypto.createHash('sha256').update(oldMarkdown).digest('hex'),
  };
  const local = reconcileSeed(null, { ...library, documents: [old] });
  local.documents[0] = { ...old, markdown: '# 本机个性补充\n用户自己写的内容不能被静默覆盖。' };
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [320, 390])
      for (const choice of ['保留本机', '采用新版']) {
        const context = await browser.newContext({ viewport: { width, height: 844 } }),
          page = await context.newPage(),
          errors = [];
        try {
          page.on('pageerror', (error) => errors.push(error.message));
          await context.addInitScript(async (library) => {
            localStorage.setItem('profile-invitation-seen', '1');
            if (localStorage.getItem('knowledge-update-qa')) return;
            localStorage.setItem('personal-memory/MEMORY.md', '隔离的记忆，不允许知识库覆盖');
            await new Promise((resolve, reject) => {
              const request = indexedDB.open('uncover-knowledge', 2);
              request.onupgradeneeded = () => {
                request.result.createObjectStore('libraries', { keyPath: 'id' });
                request.result.createObjectStore('notes');
              };
              request.onsuccess = () => {
                const db = request.result,
                  tx = db.transaction(['libraries', 'notes'], 'readwrite');
                tx.objectStore('libraries').put({
                  ...library,
                  documents: library.documents.map(({ markdown, ...note }) => ({
                    ...note,
                    markdown: '',
                  })),
                });
                for (const note of library.documents)
                  tx.objectStore('notes').put(note.markdown, library.id + '/' + note.path);
                tx.oncomplete = () => {
                  db.close();
                  localStorage.setItem('knowledge-update-qa', '1');
                  window.__knowledgeUpdateReady = true;
                  resolve();
                };
                tx.onabort = () => reject(tx.error);
              };
              request.onerror = () => reject(request.error);
            });
          }, local);
          await page.goto(process.env.APP_URL || 'http://127.0.0.1:8081/');
          await page.waitForFunction(() => window.__knowledgeUpdateReady === true);
          const open = async () => {
            await page.getByRole('tab', { name: '切换到我的', exact: true }).click();
            await page.getByRole('button', { name: '知识库', exact: true }).click();
            await page
              .getByRole('button', { name: '打开资料库 运动营养与食物知识库', exact: true })
              .click();
          };
          await open();
          await page.getByRole('button', { name: '处理知识库更新冲突', exact: true }).click();
          await page.getByText('用户自己写的内容不能被静默覆盖。', { exact: false }).waitFor();
          const disk = () =>
            page.evaluate(
              (notePath) =>
                new Promise((resolve, reject) => {
                  const request = indexedDB.open('uncover-knowledge', 2);
                  request.onsuccess = () => {
                    const db = request.result,
                      tx = db.transaction(['libraries', 'notes']),
                      metadata = tx.objectStore('libraries').get('nutrition'),
                      note = tx.objectStore('notes').get('nutrition/' + notePath);
                    tx.oncomplete = () => {
                      db.close();
                      resolve({ metadata: metadata.result, markdown: note.result });
                    };
                    tx.onabort = () => reject(tx.error);
                  };
                  request.onerror = () => reject(request.error);
                }),
              incoming.path,
            );
          const before = await disk();
          assert.ok(before.metadata.seed.conflicts[incoming.path]);
          // Throw after metadata.put has been enqueued: the entire transaction must abort.
          await page.evaluate((notePath) => {
            const put = IDBObjectStore.prototype.put;
            IDBObjectStore.prototype.put = function (value, key) {
              if (
                this.name === 'notes' &&
                key === 'nutrition/' + notePath &&
                window.__failKnowledgeWrite
              ) {
                window.__failKnowledgeWrite = false;
                throw new DOMException('synthetic quota failure', 'QuotaExceededError');
              }
              return key === undefined ? put.call(this, value) : put.call(this, value, key);
            };
            window.__failKnowledgeWrite = true;
          }, incoming.path);
          await page.getByRole('button', { name: choice, exact: true }).click();
          await page
            .getByRole('alert')
            .getByText('synthetic quota failure', { exact: false })
            .waitFor();
          assert.ok(
            JSON.stringify(await disk()) === JSON.stringify(before),
            'a failed choice cannot commit metadata alone',
          );
          await page.getByRole('button', { name: choice, exact: true }).click();
          await page
            .getByRole('button', { name: '处理知识库更新冲突', exact: true })
            .waitFor({ state: 'detached' });
          const result = await disk();
          assert.equal(
            result.markdown,
            choice === '保留本机' ? local.documents[0].markdown : incoming.markdown,
          );
          assert.deepEqual(result.metadata.seed.conflicts, {});
          assert.equal(result.metadata.documents.length, library.documents.length);
          await page.reload();
          await open();
          assert.equal(
            await page.getByRole('button', { name: '处理知识库更新冲突', exact: true }).count(),
            0,
          );
          assert.equal((await disk()).markdown, result.markdown);
          assert.equal(
            await page.evaluate(() => localStorage.getItem('personal-memory/MEMORY.md')),
            '隔离的记忆，不允许知识库覆盖',
          );
          assert.deepEqual(errors, []);
          console.log(
            `PASS ${width}px: ${choice}, upgrade, local preservation, atomic failure/retry, reload and MEMORY isolation`,
          );
        } finally {
          await context.close();
        }
      }
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
