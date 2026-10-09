const { test } = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const note = (path, markdown) => ({ path, markdown, title: path, kind: 'reference', sha256: hash(markdown) });
const seed = documents => ({ id: 'training', name: '训练', version: 1, documents });
function memoryAdapter() {
  const map = new Map(); let fail = false, reads = 0;
  return { map, set fail(value) { fail = value; }, get reads() { return reads; }, async resetLegacy() {},
    async readAll() { reads++; return structuredClone([...map.values()]); }, async writeVault(value) { if (fail) throw Error('disk full'); map.set(value.id, structuredClone(value)); } };
}
test('portable fingerprints match SHA-256 for ASCII, Chinese, astral and replacement characters', async () => {
  const { fingerprint } = await import('../src/knowledge/fingerprint.mjs');
  for (const value of ['', 'abc', '身体与营养\n😀', '\ud800', 'x'.repeat(100000)]) assert.equal(fingerprint(value), hash(value));
});
test('app upgrade updates pristine notes, adds new notes, retires pristine removals and keeps personal additions', async () => {
  const { createKnowledgeStore } = await import('../src/knowledge/collection.mjs'), adapter = memoryAdapter();
  const first = seed([note('a.md', '原文'), note('retired.md', '退场')]);
  let store = createKnowledgeStore(adapter, async () => [first]);
  await store.list(); await store.importNotes('training', [{ path: 'personal.md', markdown: '我的笔记' }]);
  store = createKnowledgeStore(adapter, [seed([note('a.md', '修正版'), note('new.md', '新增')])]);
  const result = (await store.list())[0];
  assert.deepEqual(result.documents.map(n => n.path).sort(), ['a.md', 'new.md', 'personal.md']);
  assert.equal(result.documents.find(n => n.path === 'a.md').markdown, '修正版'); assert.deepEqual(result.seed.conflicts, {});
});
test('local edits and deletions survive upgrade with explicit persistable conflict choices', async () => {
  const { createKnowledgeStore } = await import('../src/knowledge/collection.mjs'), adapter = memoryAdapter();
  let store = createKnowledgeStore(adapter, [seed([note('a.md', '原文'), note('b.md', '原文 B')])]);
  await store.list(); const local = adapter.map.get('training'); local.documents[0].markdown = '用户修改'; local.documents.splice(1, 1);
  store = createKnowledgeStore(adapter, [seed([note('a.md', '新版 A'), note('b.md', '新版 B')])]);
  const result = (await store.list())[0];
  assert.equal(result.documents[0].markdown, '用户修改'); assert.equal(result.documents.length, 1);
  assert.equal(result.seed.conflicts['b.md'].reason, 'deleted_locally');
  adapter.fail = true; await assert.rejects(store.resolveConflict('training', 'a.md', 'incoming'), /disk full/); adapter.fail = false;
  assert.equal((await store.list())[0].documents[0].markdown, '用户修改');
  await store.resolveConflict('training', 'a.md', 'local'); await store.resolveConflict('training', 'b.md', 'incoming');
  store = createKnowledgeStore(adapter, [seed([note('a.md', '新版 A'), note('b.md', '新版 B')])]);
  const restored = (await store.list())[0]; assert.deepEqual(restored.seed.conflicts, {});
  assert.equal(restored.documents.find(n => n.path === 'a.md').markdown, '用户修改'); assert.equal(restored.documents.find(n => n.path === 'b.md').markdown, '新版 B');
});
test('legacy seeds upgrade only verifiably unedited Markdown; unknown imported collisions stay protected', async () => {
  const { reconcileSeed } = await import('../src/knowledge/seedUpgrade.mjs');
  const legacy = seed([note('a.md', '旧版'), { ...note('personal.md', '用户内容'), sha256: '' }]);
  const result = reconcileSeed(legacy, seed([note('a.md', '新版'), note('personal.md', '官方内容')]));
  assert.equal(result.documents.find(n => n.path === 'a.md').markdown, '新版');
  assert.equal(result.documents.find(n => n.path === 'personal.md').markdown, '用户内容'); assert.ok(result.seed.conflicts['personal.md']);
});
test('a failed upgrade is retryable and repeated reads reuse immutable indexes but see disk edits', async () => {
  const { createKnowledgeStore } = await import('../src/knowledge/collection.mjs'), { indexVault } = await import('../src/knowledge/vault.mjs');
  const adapter = memoryAdapter(), store = createKnowledgeStore(adapter, [seed([note('a.md', '# 原文')])]);
  adapter.fail = true; await assert.rejects(store.list(), /disk full/); adapter.fail = false;
  const first = (await store.list())[0], indexed = indexVault(first), second = (await store.list())[0];
  assert.equal(first, second); assert.equal(indexed, indexVault(second));
  adapter.map.get('training').documents[0].markdown = '# 外部修改';
  const third = (await store.list())[0]; assert.notEqual(third, second); assert.equal(indexVault(third)[0].headings[0], '外部修改');
});
test('durable Markdown journal recovers interruptions, rolls back reported failures and rejects foreign paths', async () => {
  const { createAtomicVaultWriter, validateVault } = await import('../src/knowledge/atomicVault.mjs');
  const before = seed([note('a.md', '原文')]), after = seed([note('a.md', '新版')]);
  let journal = null, rollback = false, disk = structuredClone(before), fail = false;
  const io = { async readJournal() { return journal; }, async isRollback() { return rollback; }, async prepare(value) { journal = value; rollback = false; },
    async markRollback() { rollback = true; }, async removeJournal() { journal = null; rollback = false; },
    async apply(value) { disk = structuredClone(value); if (fail && !rollback) throw Error('interrupted write'); } };
  const writer = createAtomicVaultWriter(io); fail = true;
  await assert.rejects(writer.write(before, after), /interrupted write/); assert.deepEqual(disk, before); assert.equal(journal, null);
  fail = false; journal = JSON.stringify({ version: 1, before, after }); await writer.recover(); assert.deepEqual(disk, after);
  journal = JSON.stringify({ version: 1, before, after }); rollback = true; await writer.recover(); assert.deepEqual(disk, before);
  for (const path of ['../../private.md', '/private.md', 'image.jpeg', '%2e%2e/private.md']) assert.throws(() => validateVault(seed([note(path, 'x')])));
  await assert.rejects(writer.write(before, { ...after, id: 'other' }), /跨资料库/);
});
