const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
test('public app source cannot import excluded server code or Node-only implementations', () => {
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  for (const file of walk(path.join(root, 'src')).filter(f => /\.(?:mjs|ts|tsx)$/.test(f))) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      assert.ok(!specifier.startsWith('node:'), path.relative(root, file) + ': Node dependency');
      if (specifier.startsWith('.')) {
        const target = path.resolve(path.dirname(file), specifier);
        assert.ok(!target.startsWith(path.join(root, 'server') + path.sep), path.relative(root, file) + ': excluded server dependency');
      }
    }
    if (file.includes(path.join('agent', 'core') + path.sep)) assert.doesNotMatch(source, /\bBuffer\b|\bprocess\./, 'shared core must run in Hermes');
  }
});
test('server compatibility exports use the same implementation and error identity as the public client', async () => {
  for (const name of ['validation', 'food-import', 'knowledge', 'harness-v2', 'assistant-intents', 'agent-router']) {
    const server = await import('../server/' + name + '.mjs'), shared = await import('../src/agent/core/' + name + '.mjs');
    for (const key of Object.keys(shared)) assert.equal(server[key], shared[key], name + ': duplicated ' + key);
  }
  const shared = await import('../src/agent/core/validation.mjs'), server = await import('../server/validation.mjs');
  assert.throws(() => shared.validateAdviceRequest(null), server.ServiceError);
  assert.equal(typeof server.validatePhotoRequest, 'function');
  assert.equal(shared.validatePhotoRequest, undefined, 'Node image parsing stays on the server');
  assert.equal((await import('../src/agent/core/food-import.mjs')).createBarcodeLookup, undefined, 'Node barcode streaming stays on the server');
});
