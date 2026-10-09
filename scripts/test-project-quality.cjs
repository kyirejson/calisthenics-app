const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
  for (const file of ['EquipmentPlanEditor', 'ProfileScreen']) {
    assert.match(read('src/screens/' + file + '.tsx'), /useUpdateBlock\(/);
  }
  assert.match(read('src/features/progression/useProgressionBrowser.ts'), /useUpdateBlock\(/);
  assert.match(read('src/features/today/useTodayTraining.ts'), /useUpdateBlock\(/);
  assert.match(read('src/components/AppUpdates.tsx'), /updateBlocks\.current\.size === 0/);
});
