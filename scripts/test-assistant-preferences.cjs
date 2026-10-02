const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { explicitPreferenceIntent, normalizePreferencePatch, screeningStatement } = require('../src/nutrition/preferenceIntent.mjs');
const { normalizeAssistantIntent, normalizeAssistantState } = require('../src/nutrition/assistantState.ts');
const { withAssistantPreferences } = require('../src/nutrition/assistantPreferences.ts');
const { emptyNutritionJournal, defaultNutritionPreferences, calculateTargets } = require('../src/nutrition/engine.ts');
const { withRememberedFact, withoutRememberedFact } = require('../src/nutrition/assistantMemory.ts');
const profile = { age: 30, height: 175, weight: 75, sex: 'male', nutritionGoal: 'maintain', dietPattern: 'balanced_cn', weightHistory: [] };
test('explicit preferences use a shared grounded tool, with no model calories', () => {
  const intent = explicitPreferenceIntent('营养目标设为增肌，饮食模式设为均衡，我对花生过敏');
  assert.deepEqual(intent, { type: 'set_preferences', patch: { objective: 'muscle_gain', pattern: 'balanced', allergens: ['peanut'] } });
  assert.deepEqual(normalizeAssistantIntent(intent), intent);
  for (const bad of [{ calories: 2300 }, { objective: 'invalid' }, { allergens: ['invalid'] }, { riskFlags: [] }, { noListedRisks: false }, { noListedRisks: true, riskFlags: ['pregnancy'] }]) assert.equal(normalizePreferencePatch(bad), null);
});
test('questions, negation, history and third-party statements never mutate preferences', () => {
  for (const input of ['营养目标设为增肌可以吗？', '不要把营养目标设为增肌', '如果饮食改为生酮', '朋友的营养目标是增肌', '我以前对牛奶过敏', '我对牛奶不过敏', '我对牛奶并非过敏', '我没有牛奶过敏', '我对牛奶可能过敏', '我没有糖尿病', '我以前有糖尿病']) assert.equal(explicitPreferenceIntent(input), null, input);
});
test('partial updates preserve existing fields, source separation and records', () => {
  let journal = emptyNutritionJournal();
  journal.preferences = { ...defaultNutritionPreferences(profile), allergens: ['peanut'], screeningCompletedAt: '2026-10-01T00:00:00.000Z', activity: 'active' }; journal.manualAllergens = ['peanut'];
  journal = withRememberedFact(journal, { id: 'milk-fact', kind: 'allergy', text: '牛奶', createdAt: '2026-10-01T00:00:00.000Z' });
  const next = withAssistantPreferences(journal, profile, { objective: 'muscle_gain', allergens: ['egg'] });
  assert.equal(next.preferences.activity, 'active'); assert.equal(next.preferences.pattern, 'balanced');
  assert.deepEqual(next.preferences.allergens.sort(), ['egg', 'milk', 'peanut']);
  assert.deepEqual(next.manualAllergens.sort(), ['egg', 'peanut']);
  const forgotten = withoutRememberedFact(next, 'milk-fact');
  assert.deepEqual(forgotten.preferences.allergens.sort(), ['egg', 'peanut']);
  assert.deepEqual(next.entries, journal.entries); assert.deepEqual(next.days, journal.days);
});
test('health confirmation is explicit, not inferred from a goal or allergy', () => {
  const journal = withAssistantPreferences(emptyNutritionJournal(), profile, { objective: 'muscle_gain' });
  assert.equal(journal.preferences.screeningCompletedAt, null); assert.equal(calculateTargets(profile, journal.preferences).status, 'needs_setup');
  const checked = withAssistantPreferences(journal, profile, explicitPreferenceIntent(screeningStatement).patch);
  assert.equal(calculateTargets(profile, checked.preferences).status, 'ready');
  const clinical = withAssistantPreferences(checked, profile, explicitPreferenceIntent('我有糖尿病').patch);
  assert.equal(calculateTargets(profile, clinical.preferences).status, 'blocked');
  assert.deepEqual(clinical.preferences.riskFlags, ['medical_condition']);
});
test('unsupported patterns are recorded honestly and do not bypass menu gates', () => {
  const journal = withAssistantPreferences(emptyNutritionJournal(), profile, { pattern: 'keto', noListedRisks: true });
  assert.equal(journal.preferences.pattern, 'keto'); assert.equal(calculateTargets(profile, journal.preferences).status, 'unsupported');
});
test('only explicit allergy deletion removes exclusions and memory provenance remains protected', () => {
  let journal = withAssistantPreferences(emptyNutritionJournal(), profile, { allergens: ['peanut', 'milk'] });
  const intent = explicitPreferenceIntent('删除花生过敏原记录');
  assert.deepEqual(intent, { type: 'set_preferences', patch: { removeAllergens: ['peanut'] } });
  journal = withAssistantPreferences(journal, profile, intent.patch);
  assert.deepEqual(journal.preferences.allergens, ['milk']);
  journal = withRememberedFact(journal, { id: 'milk', kind: 'allergy', text: '牛奶', createdAt: '2026-10-01T00:00:00.000Z' });
  assert.throws(() => withAssistantPreferences(journal, profile, { removeAllergens: ['milk'] }), /助手记忆/);
  assert.deepEqual(journal.preferences.allergens, ['milk']);
});
test('receipts survive restart and obsolete settings implementation is gone', () => {
  const assistant = normalizeAssistantState({ version: 1, facts: [], conversations: [], receipts: { 'set_preferences-one': { kind: 'set_preferences', payload: '{}', createdAt: '2026-10-02T00:00:00.000Z' } } });
  assert.ok(assistant.receipts['set_preferences-one']);
  const screen = fs.readFileSync(path.join(__dirname, '../src/screens/NutritionScreen.tsx'), 'utf8');
  assert.doesNotMatch(screen, /showSetup|showTargetHistory|查看当日目标记录|NutritionSetupModal|targetChangeLabel/);
  assert.equal(fs.existsSync(path.join(__dirname, '../src/components/nutrition/NutritionSetupModal.tsx')), false);
});
