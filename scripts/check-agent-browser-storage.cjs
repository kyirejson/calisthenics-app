// Optional real-browser check, with a preinstalled Playwright module; installs nothing.
// node scripts/check-agent-browser-storage.cjs <absolute-path-to-playwright> [browser-channel]
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');

async function main() {
  if (!process.argv[2]) throw Error('Pass the absolute path of an existing Playwright module.');
  const { chromium } = require(process.argv[2]);
  const allowed = new Map(['journalPersistence.mjs', 'journalStore.mjs', 'promptJournal.mjs', 'requestShape.mjs']
    .map(name => ['/' + name, path.resolve(__dirname, '../src/agent', name)]));
  const server = http.createServer((request, response) => {
    if (request.url === '/') { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<!doctype html><title>MAX journal storage check</title>'); return; }
    const filename = allowed.get(request.url);
    if (!filename) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': 'text/javascript' }); fs.createReadStream(filename).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { channel: process.argv[3] } : {}) });
    const page = await browser.newPage(); await page.goto('http://127.0.0.1:' + server.address().port);
    const first = await page.evaluate(async () => {
      const { createIndexedJournalStorage } = await import('/journalPersistence.mjs');
      const { createPromptJournal } = await import('/promptJournal.mjs');
      const meta = { getItem: async key => localStorage.getItem(key), setItem: async (key, value) => localStorage.setItem(key, value),
        removeItem: async key => localStorage.removeItem(key), getAllKeys: async () => Object.keys(localStorage) };
      const journal = createPromptJournal(createIndexedJournalStorage(meta, indexedDB));
      const text = '中文资料😀'.repeat(500000), bound = await journal.bind('browser', { content: '全文资料', attachments: [{ name: 'large.md', kind: 'md', text }] });
      await bound.acquire(); await bound.prepare({ system: 'fixed fixture', tools: [], memory: '', context: { responseMode: 'text' } });
      const calls = ['a', 'b'].map(id => ({ id, type: 'function', function: { name: 'fixture', arguments: '{ "order": 1 }' } }));
      await bound.model({ role: 'assistant', content: '先检查', reasoning_content: 'fixture reasoning', tool_calls: calls });
      for (const call of calls) { await bound.started(call.id); await bound.result(call.id, { ok: true }); }
      await bound.model('完整回答'); await bound.finish('完整回答'); await bound.close();
      const ref = journal.uiTurns()[0].attachments[0];
      localStorage.setItem('fixture.expected', JSON.stringify({ ref, chars: text.length, messages: journal.messages() }));
      localStorage.setItem('running.records', 'keep');
      return { chars: text.length, bytes: new Blob([text]).size, messageCount: journal.messages().length };
    });
    assert.ok(first.bytes > 6 * 1024 * 1024); await page.reload();
    const second = await page.evaluate(async () => {
      const { createIndexedJournalStorage } = await import('/journalPersistence.mjs');
      const { createPromptJournal } = await import('/promptJournal.mjs');
      const meta = { getItem: async key => localStorage.getItem(key), setItem: async (key, value) => localStorage.setItem(key, value),
        removeItem: async key => localStorage.removeItem(key), getAllKeys: async () => Object.keys(localStorage) };
      const persistence = createIndexedJournalStorage(meta, indexedDB), journal = createPromptJournal(persistence);
      await journal.load(); const expected = JSON.parse(localStorage.getItem('fixture.expected'));
      const identical = JSON.stringify(journal.messages()) === JSON.stringify(expected.messages);
      const bound = await journal.bind('read', { content: '读资料' });
      const artifact = await bound.readArtifact({ artifactId: expected.ref.artifactId, full: true });
      const complete = artifact.text === '中文资料😀'.repeat(500000);
      const restoredReply = journal.uiTurns().find(turn => turn.id === 'browser:assistant').content;
      await journal.clear(); const remaining = (await persistence.getAllKeys()).filter(key => key.startsWith('uncover.agent.journal.v2'));
      return { identical, complete, restoredReply, remaining: remaining.length, unrelated: localStorage.getItem('running.records') };
    });
    assert.deepEqual(second, { identical: true, complete: true, restoredReply: '完整回答', remaining: 0, unrelated: 'keep' });
    console.log(JSON.stringify({ ok: true, ...first, ...second }));
  } finally {
    await browser?.close(); await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
