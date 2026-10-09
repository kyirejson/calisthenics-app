const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const library = id => ({ version: 1, id, name: id, documents: [{ path: 'note.md', markdown: '# 标题\n正文', sha256: '' }] });
const decode = source => JSON.parse(source.split('export default ')[1].trim().replace(/;$/, ''));

test('public seed generator stores approved text once and keeps extra libraries private', async () => {
  const { buildSeedModules } = await import('./lib/knowledge/bundle-writer.mjs');
  const result = buildSeedModules([library('nutrition'), library('prisoner'), library('personal-extra')]);
  assert.deepEqual(decode(result.publicModule).map(item => item.id), ['nutrition', 'prisoner']);
  assert.ok(result.privateModule.includes("from '../referenceBundle'"));
  assert.ok(result.privateModule.includes('personal-extra'));
  assert.ok(!result.privateModule.includes('"id":"nutrition"'));
  assert.ok(!result.privateModule.includes('"id":"prisoner"'));
  assert.match(buildSeedModules([library('nutrition'), library('prisoner')]).privateModule, /export \{ default \}/);
  assert.deepEqual(decode(buildSeedModules([]).publicModule), []);
});

test('bundle generator rejects invalid collections and duplicates before generating outputs', async () => {
  const { buildSeedModules } = await import('./lib/knowledge/bundle-writer.mjs');
  for (const value of [null, [library('../bad')], [library('a'), library('a')], [{ ...library('a'), version: 2 }],
    [{ ...library('a'), documents: [library('a').documents[0], library('a').documents[0]] }]]) assert.throws(() => buildSeedModules(value));
});

test('current bundled libraries retain every original Markdown hash and local bundle only links public text', () => {
  const root = path.resolve(__dirname, '..'), seeds = decode(fs.readFileSync(path.join(root, 'src/knowledge/referenceBundle.ts'), 'utf8'));
  assert.deepEqual(seeds.map(item => item.id).sort(), ['nutrition', 'prisoner']);
  for (const seed of seeds) {
    assert.ok(seed.documents.length > 0);
    const manifest = path.join(root, 'knowledge/libraries', seed.id, 'library.json');
    if (fs.existsSync(manifest)) assert.equal(seed.documents.length, JSON.parse(fs.readFileSync(manifest, 'utf8')).documents.length);
  }
  for (const seed of seeds) for (const note of seed.documents) {
    assert.equal(crypto.createHash('sha256').update(note.markdown).digest('hex'), note.sha256, seed.id + '/' + note.path);
  }
  const local = fs.readFileSync(path.join(root, 'src/knowledge/private/bundle.ts'), 'utf8');
  assert.ok(local.includes('../referenceBundle'));
  assert.ok(!local.includes('"id":"nutrition"') && !local.includes('"id":"prisoner"'));
});
