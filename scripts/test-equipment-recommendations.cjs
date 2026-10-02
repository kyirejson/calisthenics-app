const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { equipmentMovements } = require('../src/data/equipmentMovements.ts');
const { equipmentAdditions } = require('../src/data/equipmentAdditions.ts');
const { equipmentGuides } = require('../src/data/equipmentGuidance.ts');
const { equipmentRecommendations, equipmentRankingExplanation, equipmentFunctionalUses, recommendationTiers } = require('../src/data/equipmentRecommendations.ts');
const { equipmentFocus, equipmentMuscleRegions, filterEquipmentMovements, initialEquipmentFilters } = require('../src/data/equipmentLibrary.ts');
const get = id => equipmentMovements.find(item => item.id === id);

test('all baseline ratings exactly match the 82-row report, not a popularity/difficulty ranking', () => {
  const report = fs.readFileSync(path.join(__dirname, '../docs/equipment-exercise-tier-research-2026-10-01.md'), 'utf8');
  const rows = [...report.matchAll(/^\| (equipment_\w+_\d+) \| [^|]+ \| ([SABC]) \| ([^|]+) \|/gm)];
  assert.equal(rows.length, 82);
  for (const [, id, tier, evidence] of rows) {
    assert.equal(get(id).recommendation.tier, tier, id);
    assert.equal(get(id).recommendation.evidence, evidence.trim().slice(0, 1), id);
  }
  assert.match(equipmentRankingExplanation, /不是难度、晋级条件或科学认证/);
});
test('112 recommendations and teaching entries have no orphan or missing IDs', () => {
  const ids = equipmentMovements.map(item => item.id).sort();
  assert.deepEqual(Object.keys(equipmentRecommendations).sort(), ids);
  assert.deepEqual(Object.keys(equipmentGuides).sort(), ids);
  assert.deepEqual(recommendationTiers.map(tier => equipmentMovements.filter(item => item.recommendation.tier === tier).length), [33, 63, 14, 2]);
  assert.equal(equipmentAdditions.length, 30);
  assert.equal(equipmentMuscleRegions.length, 28);
  for (const item of equipmentMovements) {
    assert.ok(item.guide.setup && item.guide.execution && item.guide.control, item.id);
    assert.equal(item.guide.issues.length, 2);
    assert.ok(item.guide.issues.every(issue => issue.problem && issue.fix));
    assert.ok(item.guide.sources.length, item.id);
    assert.ok(item.recommendation.reason && /^[DRP]$/.test(item.recommendation.evidence));
    for (const source of [...item.guide.sources, ...item.recommendation.sources]) assert.match(source.url, /^https:\/\//);
    assert.doesNotMatch(item.source, /施瓦辛格/);
    assert.equal(item.step, undefined); assert.equal(item.standards, undefined);
  }
  assert.equal(new Set(equipmentMovements.map(item => item.guide.setup + item.guide.execution)).size, 112);
});
test('five mixed entries become ten precise variants matching the original artwork where retained', () => {
  const pairs = [
    ['equipment_legs_02', 'equipment_legs_15', /倒蹬/, /哈克/],
    ['equipment_core_02', 'equipment_core_11', /提膝/, /直腿/],
    ['equipment_arms_04', 'equipment_arms_15', /EZ杠/, /哑铃/],
    ['equipment_arms_08', 'equipment_arms_16', /EZ杠/, /哑铃/],
    ['equipment_arms_09', 'equipment_arms_17', /哑铃/, /绳索/],
  ];
  for (const [oldId, newId, oldName, newName] of pairs) {
    assert.match(get(oldId).name, oldName); assert.match(get(newId).name, newName);
    assert.notEqual(get(oldId).guide.setup, get(newId).guide.setup);
  }
  assert.deepEqual(equipmentFocus.equipment_arms_04.gear, ['barbell']);
  assert.deepEqual(equipmentFocus.equipment_arms_08.gear, ['barbell']);
  assert.deepEqual(equipmentFocus.equipment_arms_09.gear, ['dumbbell']);
  assert.match(get('equipment_arms_12').nameEn, /Flexion/);
  assert.match(get('equipment_arms_22').nameEn, /Extension/);
});
test('grades live in cards; all region, gear and global search results are ordered S to C without a grade filter', () => {
  assert.equal('tier' in initialEquipmentFilters, false);
  assert.deepEqual(filterEquipmentMovements(initialEquipmentFilters).map(item => item.recommendation.tier), ['S', 'S', 'S', 'A', 'A']);
  assert.deepEqual(filterEquipmentMovements({ ...initialEquipmentFilters, gear: 'machine' }).map(item => item.id), ['equipment_chest_19']);
  assert.deepEqual(filterEquipmentMovements({ ...initialEquipmentFilters, query: '腕伸' }).map(item => item.id), ['equipment_arms_22']);
  for (const region of equipmentMuscleRegions) {
    for (const gear of ['all', 'dumbbell', 'barbell', 'machine', 'cable']) {
      const ranks = filterEquipmentMovements({ group: region.group, region: region.key, query: '', gear }).map(item => recommendationTiers.indexOf(item.recommendation.tier));
      assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
    }
  }
  const ranks = filterEquipmentMovements({ ...initialEquipmentFilters, query: ' ' + '器械' }).map(item => recommendationTiers.indexOf(item.recommendation.tier));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
  const screen = fs.readFileSync(path.join(__dirname, '../src/screens/EquipmentProgressScreen.tsx'), 'utf8');
  assert.doesNotMatch(screen, /增肌推荐等级筛选|筛选全部推荐等级|region: 'all'|s\.tiers|s\.rankHeading/);
  assert.match(screen, /EquipmentTierBadge tier=\{item.recommendation.tier\} showPurpose/);
});
test('function-focused entries retain their separate use; no B/C is presented as unsafe or banned', () => {
  assert.equal(get('equipment_core_13').recommendation.tier, 'B');
  assert.match(equipmentFunctionalUses.equipment_core_13, /抗伸展.*A级/);
  assert.equal(get('equipment_back_12').recommendation.tier, 'B');
  assert.match(equipmentFunctionalUses.equipment_back_12, /力量专项/);
  for (const item of equipmentMovements) assert.doesNotMatch(item.targetMuscles, /中缝|外缘|肌峰|安全区间|内侧头精准|短头专属/);
});
test('modern details use independent guidance and removed book import cannot regenerate resources', () => {
  const detail = fs.readFileSync(path.join(__dirname, '../src/screens/EquipmentDetailScreen.tsx'), 'utf8');
  assert.doesNotMatch(detail, /ExerciseDetailedGuide|getEquipmentResource|原书关联资料/);
  assert.match(detail, /EquipmentMovementGuide/);
  assert.match(fs.readFileSync(path.resolve(__dirname, '../src/components/EquipmentMovementGuide.tsx'), 'utf8'), /equipment-modern-guide/);
  assert.equal(fs.existsSync(path.join(__dirname, 'prepare-equipment-resources.cjs')), false);
  assert.doesNotMatch(fs.readFileSync(path.resolve(__dirname, '../src/data/equipmentLibrary.ts'), 'utf8'), /bookAnchor/);
});
