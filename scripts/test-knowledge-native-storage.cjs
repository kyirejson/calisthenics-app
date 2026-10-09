const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const file = path.resolve(__dirname, '../src/knowledge/storage.ts');
const localRequire = require('node:module').createRequire(file);
const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function harness(initial = {}, seeds = [], before = () => {}) {
  const files = new Map(Object.entries(initial)), directories = new Set(['documents']);
  for (const name of files.keys()) { const parts = name.split('/'); parts.pop(); while (parts.length) { directories.add(parts.join('/')); parts.pop(); } }
  const location = parts => path.posix.join(...parts.map(part => typeof part === 'string' ? part : part.uri));
  class Directory {
    constructor(...parts) { this.uri = location(parts); }
    get exists() { return directories.has(this.uri); }
    create() { const parts = this.uri.split('/'); for (let i = 1; i <= parts.length; i++) directories.add(parts.slice(0, i).join('/')); }
    delete() { for (const name of files.keys()) if (name.startsWith(this.uri + '/')) files.delete(name); directories.delete(this.uri); }
  }
  class File {
    constructor(...parts) { this.uri = location(parts); }
    get exists() { return files.has(this.uri); }
    create() { before('create', this.uri, files); if (!directories.has(path.posix.dirname(this.uri))) throw Error('parent directory missing'); if (this.exists) throw Error('file exists'); files.set(this.uri, ''); }
    write(value) { before('write', this.uri, files); files.set(this.uri, value); }
    textSync() { if (!this.exists) throw Error('missing file'); return files.get(this.uri); }
    async text() { return this.textSync(); }
    delete() { before('delete', this.uri, files); files.delete(this.uri); }
    move(target) { before('move', this.uri, files); if (target.exists) throw Error('target exists'); files.set(target.uri, this.textSync()); files.delete(this.uri); this.uri = target.uri; }
  }
  const exports = {};
  vm.runInNewContext(source, { exports, require: id => id === 'expo-file-system' ? { Directory, File, Paths: { document: 'documents' } }
    : id === './private/bundle' ? { __esModule: true, default: seeds } : localRequire(id), console }, { filename: file });
  return { files, store: exports };
}
test('native vault creates an empty library and persists independent Markdown without touching MEMORY.md', async () => {
  const h = harness({ 'documents/MEMORY.md': '个人记忆' });
  const library = await h.store.createKnowledgeLibrary('营养');
  assert.ok(h.files.has('documents/knowledge/libraries/' + library.id + '/library.json'));
  await h.store.importKnowledgeNotes(library.id, [{ path: 'folder/note.md', markdown: '# 正文\n真实文字' }]);
  const restart = harness(Object.fromEntries(h.files));
  assert.equal((await restart.store.loadKnowledgeLibraries())[0].documents[0].markdown, '# 正文\n真实文字');
  assert.equal(h.files.get('documents/MEMORY.md'), '个人记忆'); assert.equal([...h.files.keys()].some(file => file.endsWith('transaction.json')), false);
});
test('native write failure rolls back, and a simulated process interruption recovers a torn catalogue', async () => {
  const installed = harness(), library = await installed.store.createKnowledgeLibrary('训练');
  await installed.store.importKnowledgeNotes(library.id, [{ path: 'a.md', markdown: '原文' }]);
  const initial = Object.fromEntries(installed.files); let failed = false;
  const h = harness(initial, [], (kind, file) => { if (!failed && kind === 'write' && file.endsWith('/library.json')) { failed = true; throw Error('disk full'); } });
  await assert.rejects(h.store.importKnowledgeNotes(library.id, [{ path: 'b.md', markdown: '新增' }]), /disk full/);
  assert.equal((await h.store.loadKnowledgeLibraries())[0].documents.length, 1);
  let powerLost = false, interrupted;
  const powered = harness(initial, [], (kind, file, disk) => {
    if (powerLost) throw Error('powered off');
    if (kind === 'write' && file.endsWith('/libraries.json')) {
      disk.set(file, '{torn'); interrupted = Object.fromEntries(disk); powerLost = true; throw Error('powered off');
    }
  });
  await assert.rejects(powered.store.importKnowledgeNotes(library.id, [{ path: 'b.md', markdown: '新增' }]));
  const restarted = harness(interrupted);
  const recovered = (await restarted.store.loadKnowledgeLibraries())[0];
  assert.equal(recovered.documents.find(note => note.path === 'b.md').markdown, '新增');
  assert.equal([...restarted.files.keys()].some(file => file.endsWith('transaction.json')), false);
});
