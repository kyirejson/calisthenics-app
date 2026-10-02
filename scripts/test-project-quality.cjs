const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('release and pull request gates discover all regression suites and reject unused TypeScript', () => {
  const config = JSON.parse(read('tsconfig.json'));
  assert.equal(config.compilerOptions.noUnusedLocals, true);
  assert.equal(config.compilerOptions.noUnusedParameters, true);
  assert.equal(JSON.parse(read('package.json')).scripts.test, 'node scripts/test-all.cjs');
  const runner = read('scripts/test-all.cjs');
  assert.match(runner, /readdirSync/); assert.match(runner, /--check/);
  for (const file of ['ci.yml', 'android-apk.yml', 'content-update.yml']) {
    const workflow = read('.github/workflows/' + file);
    assert.match(workflow, /npm run typecheck/); assert.match(workflow, /npm test/);
    assert.doesNotMatch(workflow, /npm run test:/);
  }
});

test('removed APIs have no production writer, while legacy records remain readable', () => {
  assert.equal(fs.existsSync(path.join(root, 'src/components/MiniChart.tsx')), false);
  assert.doesNotMatch(read('src/components/ui.tsx'), /export (?:function (?:Header|Pill|SectionTitle)|const commonStyles)/);
  assert.doesNotMatch(read('src/store/AppStore.tsx'), /saveFavoriteMeal|deleteFavoriteMeal|setNutritionTrainingTime/);
  assert.doesNotMatch(read('src/nutrition/journal.ts'), /export function (?:withFavoriteMeal|withoutFavoriteMeal)/);
  assert.doesNotMatch(read('src/nutrition/timeline.ts'), /export function withNutritionTrainingTime/);
  assert.match(read('src/nutrition/engine.ts'), /savedMeals/);
  assert.match(read('src/nutrition/engine.ts'), /trainingTime/);
});

test('update-block hook acquires an editor lease and releases exactly that lease on cleanup', () => {
  const effects = [], tokens = new Set();
  const blockUpdates = () => {
    const token = Symbol(); tokens.add(token);
    return () => tokens.delete(token);
  };
  const react = { createContext: () => ({}), useContext: () => ({ blockUpdates }),
    useLayoutEffect: fn => effects.push(fn), useEffect: () => {} };
  const deps = { react, 'react-native': { Platform: { OS: 'web' }, StyleSheet: { create: x => x } },
    'expo-updates': {}, '../services/updateChecker': {}, '../services/updatePolicy': {}, './ui': {}, '../theme': { colors: {} } };
  const output = ts.transpileModule(read('src/components/AppUpdates.tsx'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: id => id === 'react/jsx-runtime' ? {} : deps[id] ?? (() => { throw Error(id); })() });
  exports.useUpdateBlock(true); exports.useUpdateBlock(true); exports.useUpdateBlock(false);
  const cleanup = effects.map(effect => effect());
  assert.equal(tokens.size, 2);
  cleanup[0](); assert.equal(tokens.size, 1);
  cleanup[1](); assert.equal(tokens.size, 0);
  assert.equal(cleanup[2], undefined);
  for (const file of ['EquipmentPlanEditor', 'TodayScreen', 'ProfileScreen', 'ProgressScreen']) {
    assert.match(read('src/screens/' + file + '.tsx'), /useUpdateBlock\(/);
  }
  assert.match(read('src/components/AppUpdates.tsx'), /updateBlocks\.current\.size === 0/);
});

test('knowledge diagnostics distinguish missing, invalid and complete indexes without exposing content', async t => {
  const { loadPrisonerKnowledge, bookIndexPath } = await import('../server/prisoner-knowledge.mjs');
  const { loadAssistantBooks } = await import('../server/book-knowledge.mjs');
  const { createNutritionServer } = await import('../server/index.mjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-quality-'));
  const files = [];
  const write = (name, value) => { const file = path.join(directory, name); fs.writeFileSync(file, JSON.stringify(value)); files.push(file); return file; };
  t.after(() => { files.forEach(file => fs.unlinkSync(file)); fs.rmdirSync(directory); });
  const chunk = prefix => ({ id: prefix + '-' + 'a'.repeat(24), title: 'Test book', text: 'synthetic fixture only', path: 'fixture.md', lineStart: 1, lineEnd: 2 });
  const missing = path.join(directory, 'missing.json');
  assert.deepEqual(loadPrisonerKnowledge(missing).status, { available: false, chunks: 0, reason: 'missing' });
  const invalid = write('invalid.json', { version: 1, chunks: [null, chunk('cc')] });
  assert.equal(loadPrisonerKnowledge(invalid).status.reason, 'invalid');
  const duplicate = write('duplicate.json', { version: 1, chunks: [chunk('cc'), chunk('cc')] });
  assert.equal(loadPrisonerKnowledge(duplicate).count, 0);
  const prisoner = write('prisoner-index.json', { version: 1, chunks: [chunk('cc')] });
  const options = { apiKey: 'offline-test-only', knowledgeIndex: prisoner };
  assert.equal(loadAssistantBooks(options).ready, true);
  const previous = process.env.NUTRITION_KNOWLEDGE_DIR;
  try { process.env.NUTRITION_KNOWLEDGE_DIR = directory; assert.equal(bookIndexPath('prisoner-index.json'), prisoner); }
  finally { if (previous === undefined) delete process.env.NUTRITION_KNOWLEDGE_DIR; else process.env.NUTRITION_KNOWLEDGE_DIR = previous; }
  assert.throws(() => createNutritionServer({ ...options, knowledgeIndex: missing, requireBooks: true }), /知识库/);
  for (const [index, readiness] of [[prisoner, 'ready'], [missing, 'degraded']]) {
    const server = createNutritionServer({ ...options, knowledgeIndex: index });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const health = await (await fetch('http://127.0.0.1:' + server.address().port + '/health')).json();
      assert.equal(health.readiness, readiness);
      assert.equal(health.knowledge.prisoner.available, readiness === 'ready');
      assert.deepEqual(Object.keys(health.knowledge), ['prisoner']);
      const serialized = JSON.stringify(health);
      assert.equal(serialized.includes('synthetic fixture'), false);
      assert.equal(serialized.includes(directory), false);
      assert.equal(serialized.includes('offline-test-only'), false);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  }
});

test('compressed private knowledge round-trips and rejects invalid or oversized input', async t => {
  const { gzipSync } = require('node:zlib');
  const { loadPrisonerKnowledge } = await import('../server/prisoner-knowledge.mjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uncover-compressed-kb-'));
  const file = path.join(directory, 'prisoner-index.json.gz.b64');
  t.after(() => { fs.unlinkSync(file); fs.rmdirSync(directory); });
  const index = { version: 1, chunks: [{ id: 'cc-' + 'c'.repeat(24), title: '囚徒健身 · 俯卧撑', text: '俯卧撑控制下降，保持身体稳定。', path: 'fixture.md', lineStart: 1, lineEnd: 2 }] };
  fs.writeFileSync(file, gzipSync(JSON.stringify(index)).toString('base64'));
  assert.equal(loadPrisonerKnowledge(file).count, 1);
  assert.equal(loadPrisonerKnowledge(file).retrieve('俯卧撑')[0].id, index.chunks[0].id);
  const previous = process.env.NUTRITION_PRISONER_INDEX;
  try { process.env.NUTRITION_PRISONER_INDEX = file; assert.equal(loadPrisonerKnowledge().count, 1); }
  finally { if (previous === undefined) delete process.env.NUTRITION_PRISONER_INDEX; else process.env.NUTRITION_PRISONER_INDEX = previous; }
  fs.writeFileSync(file, 'not base64!');
  assert.equal(loadPrisonerKnowledge(file).status.reason, 'invalid');
  fs.writeFileSync(file, Buffer.from('not gzip').toString('base64'));
  assert.equal(loadPrisonerKnowledge(file).status.available, false);
  fs.writeFileSync(file, gzipSync(Buffer.alloc(8 * 1024 * 1024 + 1)).toString('base64'));
  assert.equal(loadPrisonerKnowledge(file).status.available, false);
  fs.writeFileSync(file, gzipSync(JSON.stringify({ ...index, chunks: [{ ...index.chunks[0], id: 'arnold-' + 'c'.repeat(24) }] })).toString('base64'));
  assert.equal(loadPrisonerKnowledge(file).status.reason, 'invalid');
});
