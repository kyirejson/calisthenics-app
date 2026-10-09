const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { test } = require('node:test');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const { equipmentMovements } = require('../src/data/equipmentMovements.ts');
const { recommendPlanId, getPlanDay, getWeekSchedule } = require('../src/domain/training/trainingPlans.ts');
const { EQUIPMENT_PLAN_ID } = require('../src/domain/training/equipment/equipmentTraining.ts');
const { generatePersonalPlan } = require('../src/domain/training/personalPlan.ts');
const profile = { goal: 'equipment', planId: EQUIPMENT_PLAN_ID, planStartedAt: '2026-09-30T00:00:00.000Z', experience: 'intermediate', frequency: 3, levels: { push: 5 }, nutritionGoal: 'maintain', dietPattern: 'balanced_cn' };

test('equipment catalogue has 112 unique entries without invented progression levels or doses', () => {
  assert.equal(equipmentMovements.length, 112); assert.equal(new Set(equipmentMovements.map(m => m.id)).size, 112);
  assert.deepEqual(['chest', 'shoulders', 'back', 'legs', 'core', 'arms'].map(group => equipmentMovements.filter(m => m.group === group).length), [20, 17, 17, 22, 14, 22]);
  for (const m of equipmentMovements) { assert.ok(m.targetMuscles && m.nameEn); assert.equal(m.step, undefined); assert.equal(m.standards, undefined); assert.equal(m.defaultPrescription, undefined); }
  for (const m of equipmentMovements) { assert.equal(m.imageMatch, undefined); assert.equal(m.imageNote, undefined); }
});
test('equipment uses its own plan, not the weight-loss plan generator', async () => {
  assert.equal(recommendPlanId(profile), EQUIPMENT_PLAN_ID);
  const current = getPlanDay(profile, new Date(2026, 8, 30));
  assert.equal(current.plan.frequency, 3); assert.equal(current.day.workoutId, 'equipment_v2_upper_lower_3_0'); assert.equal(current.day.title, '上肢训练 A');
  assert.equal(getWeekSchedule(profile, new Date(2026, 8, 30)).filter(day => day.workoutId).length, 3);
  await assert.rejects(generatePersonalPlan(profile, () => { throw Error('must not save'); }, () => {}), /暂无训练计划/);
});
test('retired book resources and import paths stay removed without changing the modern catalogue', () => {
  for (const file of ['src/data/private/equipmentResources.ts', 'src/data/private/equipmentImageMap.ts',
    'scripts/prepare-equipment-resources.cjs', 'docs/arnold-movement-image-matching-report.md', 'server/private/arnold-index.json']) {
    assert.equal(fs.existsSync(path.resolve(__dirname, '..', file)), false, file);
  }
  assert.equal(fs.existsSync(path.resolve(__dirname, '../assets/equipment-images')), false);
  for (const movement of equipmentMovements) assert.equal(movement.bookAnchor, undefined, movement.id);
  const original = fs.readFileSync(path.resolve(__dirname, '../src/data/originalResources.ts'), 'utf8');
  assert.doesNotMatch(original, /equipmentResources|private\/equipment/);
  assert.match(original, /recoveryOriginalTexts\[exerciseId\] \|\| originalTexts\[exerciseId\]/);
  assert.doesNotMatch(fs.readFileSync(path.resolve(__dirname, 'prepare-public-resources.cjs'), 'utf8'), /equipmentResources|EquipmentResource/);
  assert.equal(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')).scripts['prepare:equipment'], undefined);
});

test('all 112 movements have unique full-size demo/thumbnail pairs with explicit generated provenance', () => {
  const crypto = require('node:crypto');
  const directory = path.resolve(__dirname, '../assets/equipment-demos');
  const provenance = JSON.parse(fs.readFileSync(path.join(directory, 'provenance.json'), 'utf8'));
  assert.equal(provenance.entries.length, 112);
  assert.deepEqual(provenance.entries.map(item => item.id).sort(), equipmentMovements.map(item => item.id).sort());
  const hashes = new Set();
  for (const entry of provenance.entries) {
    const movement = equipmentMovements.find(item => item.id === entry.id);
    assert.ok(movement, entry.id);
    assert.ok(entry?.variant, movement.id);
    assert.match(entry.provenance, /AI-generated.*not a photograph/);
    assert.ok(entry.width >= 1000 && entry.height >= 750, movement.id + ' full-size clarity');
    assert.ok(Math.abs(entry.width / entry.height - 4 / 3) < .02, movement.id + ' aspect ratio');
    for (const suffix of ['.jpg', '-thumb.jpg']) {
      const bytes = fs.readFileSync(path.join(directory, movement.id + suffix));
      assert.equal(bytes.readUInt16BE(0), 0xffd8);
      assert.ok(bytes.length > 10000, movement.id + suffix);
      if (suffix === '.jpg') hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));
    }
  }
  assert.equal(hashes.size, 112, 'no image reused for a different exercise');
  const map = fs.readFileSync(path.resolve(__dirname, '../src/data/equipmentArtwork.ts'), 'utf8');
  assert.equal((map.match(/source: require\(/g) || []).length, 112);
  assert.doesNotMatch(map, /arnold_image|https?:\/\//);
});
