const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { test } = require('node:test');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { equipmentMovements } = require('../src/data/equipmentMovements.ts');
const { equipmentFocus, equipmentGear, equipmentMuscleRegions, filterEquipmentMovements, getEquipmentMuscleLabel, getEquipmentRegions, initialEquipmentFilters } = require('../src/data/equipmentLibrary.ts');
const groups = ['chest', 'shoulders', 'back', 'legs', 'core', 'arms'];
test('all 112 movements have explicit valid muscle and equipment tags with no orphan IDs', () => {
  assert.deepEqual(Object.keys(equipmentFocus).sort(), equipmentMovements.map(item => item.id).sort());
  assert.equal(new Set(equipmentMuscleRegions.map(item => item.key)).size, equipmentMuscleRegions.length);
  for (const movement of equipmentMovements) {
    const focus = equipmentFocus[movement.id];
    assert.ok(focus.regions.length && focus.gear.length, movement.id);
    assert.equal(new Set(focus.regions).size, focus.regions.length);
    for (const key of focus.regions) assert.equal(equipmentMuscleRegions.find(item => item.key === key)?.group, movement.group);
    for (const key of focus.gear) assert.ok(equipmentGear.some(item => item.key === key));
    assert.ok(getEquipmentMuscleLabel(movement.id));
  }
});
test('real muscle filters cover every catalogue entry without an All pseudo-region', () => {
  assert.deepEqual(groups.map(group => equipmentMovements.filter(item => item.group === group).length), [20, 17, 17, 22, 14, 22]);
  assert.deepEqual([...new Set(equipmentMuscleRegions.flatMap(region => filterEquipmentMovements({ group: region.group, region: region.key, query: '', gear: 'all' }).map(item => item.id)))].sort(), equipmentMovements.map(item => item.id).sort());
  for (const region of equipmentMuscleRegions) {
    const matches = filterEquipmentMovements({ group: region.group, region: region.key, query: '', gear: 'all' });
    assert.ok(matches.length, region.key);
    assert.equal(new Set(matches.map(item => item.id)).size, matches.length);
    assert.ok(matches.every(item => item.group === region.group));
    assert.ok(region.zones.length);
  }
});
test('upper chest view adds the incline machine; decline, flat and floor presses stay out', () => {
  assert.deepEqual(filterEquipmentMovements(initialEquipmentFilters).map(item => item.id), ['equipment_chest_01', 'equipment_chest_02', 'equipment_chest_19', 'equipment_chest_14', 'equipment_chest_10']);
  assert.deepEqual(getEquipmentRegions('chest').map(item => item.label), ['上胸', '中胸', '下胸']);
  assert.ok(!equipmentMuscleRegions.some(item => /内胸|中缝|外缘|腹直肌上段|腹直肌下段/.test(item.label)));
});
test('muscle AND equipment filters intersect; Smith presses are not mislabeled free barbells', () => {
  assert.deepEqual(filterEquipmentMovements({ ...initialEquipmentFilters, gear: 'dumbbell' }).map(item => item.id), ['equipment_chest_01']);
  assert.deepEqual(filterEquipmentMovements({ ...initialEquipmentFilters, gear: 'smith' }).map(item => item.id), ['equipment_chest_02']);
  assert.deepEqual(filterEquipmentMovements({ ...initialEquipmentFilters, gear: 'barbell' }).map(item => item.id), ['equipment_chest_14']);
  assert.equal(filterEquipmentMovements({ ...initialEquipmentFilters, gear: 'bodyweight' }).length, 0);
});
test('search is global and includes real gear aliases and region names, while respecting gear restriction', () => {
  assert.ok(filterEquipmentMovements({ ...initialEquipmentFilters, query: '帕洛夫' }).some(item => item.id === 'equipment_core_07'));
  assert.ok(filterEquipmentMovements({ ...initialEquipmentFilters, query: 'cable' }).length > 0);
  assert.ok(filterEquipmentMovements({ ...initialEquipmentFilters, query: '绳索' }).every(item => equipmentFocus[item.id].gear.includes('cable') || item.name.includes('绳索')));
  assert.ok(filterEquipmentMovements({ ...initialEquipmentFilters, query: '肱肌' }).some(item => item.id === 'equipment_arms_09'));
  const coreMatches = filterEquipmentMovements({ ...initialEquipmentFilters, query: '核心' });
  assert.equal(coreMatches.filter(item => item.group === 'core').length, 14);
  assert.equal(new Set(coreMatches.map(item => item.id)).size, coreMatches.length);
  assert.equal(filterEquipmentMovements({ ...initialEquipmentFilters, gear: 'smith', query: '哑铃' }).length, 0);
  assert.equal(filterEquipmentMovements({ ...initialEquipmentFilters, query: '  ' }).length, 5);
  assert.equal(filterEquipmentMovements({ ...initialEquipmentFilters, query: '不存在的动作xyz' }).length, 0);
});
test('compound movements can match multiple meaningful groups without unsupported isolation claims', () => {
  assert.ok(equipmentFocus.equipment_legs_07.regions.includes('legs_quads'));
  assert.ok(equipmentFocus.equipment_legs_07.regions.includes('legs_glutes'));
  assert.ok(!equipmentFocus.equipment_legs_12.regions.includes('legs_hamstrings'));
  assert.ok(equipmentFocus.equipment_core_07.regions.includes('core_stability'));
  assert.ok(equipmentFocus.equipment_arms_09.regions.includes('arms_brachialis'));
});
