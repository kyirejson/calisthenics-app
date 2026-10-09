const { readFeature } = require('./lib/project-features.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { features } = require('./lib/project-features.cjs');
const { runtimeSpecifiers, applicationGraph, runtimeCycles } = require('./lib/module-graph.cjs');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('module analysis distinguishes real cycles from type imports and detects a real cycle', () => {
  const source =
    "import type { A } from './types'; import { type B } from './types2'; export type { C } from './types3'; " +
    "export { type D } from './types4'; import Foo, { type E } from './live'; import './init'; " +
    "export { thing } from './export'; import('./lazy'); require('./legacy'); import {} from './empty';";
  assert.deepEqual(runtimeSpecifiers(source, 'fixture.ts'), [
    './live',
    './init',
    './export',
    './lazy',
    './legacy',
    './empty',
  ]);
  assert.deepEqual(runtimeSpecifiers(source, 'fixture.ts', { eagerOnly: true }), [
    './live',
    './init',
    './export',
    './legacy',
    './empty',
  ]);
  assert.deepEqual(
    runtimeCycles(
      new Map([
        ['a', ['b']],
        ['b', ['a']],
      ]),
    ),
    [['a', 'b', 'a']],
  );
});

test('web, Android and iOS runtime graphs are acyclic and never import Node build/test tools', () => {
  for (const platform of ['web', 'android', 'ios']) {
    const graph = applicationGraph(root, platform);
    assert.deepEqual(
      runtimeCycles(graph).map((cycle) => cycle.map((file) => path.relative(root, file))),
      [],
      platform,
    );
    for (const file of graph.keys())
      assert.ok(!/^(scripts|server)[\\/]/.test(path.relative(root, file)), file);
    assert.ok([...graph.keys()].some((file) => file.endsWith('TodayTrainingScreen.tsx')));
    assert.ok(
      [...graph.keys()].some((file) => file.endsWith('photoStorage.ts')),
      'historical photo compatibility remains reachable',
    );
  }
});

test('removed food capture UI, transport, helpers and old smoke tests cannot return silently', () => {
  const obsolete = [
    'src/components/nutrition/IntakeEditor.tsx',
    'src/components/nutrition/PhotoIntakeEditor.tsx',
    'src/components/nutrition/PhotoFoodEditor.tsx',
    'src/components/nutrition/FoodImportModal.tsx',
    'src/components/nutrition/FoodCaptureCamera.tsx',
    'src/components/nutrition/foodPhoto.ts',
    'src/components/nutrition/NutritionLoopCards.tsx',
    'src/nutrition/capture',
    'src/nutrition/captureClient.ts',
    'src/nutrition/captureServings.ts',
    'src/nutrition/ingredientCapture.ts',
    'src/nutrition/mealSlot.ts',
    'src/nutrition/servings.ts',
    'src/nutrition/sourceURL.mjs',
    'scripts/smoke-food-import.cjs',
    'scripts/smoke-ingredient-camera.cjs',
    'scripts/smoke-smart-food-camera.cjs',
    'scripts/smoke-unified-food-camera.cjs',
  ];
  // Empty local directories are harmless; only source files are forbidden.
  for (const file of obsolete) {
    const target = path.join(root, file);
    assert.ok(
      !fs.existsSync(target) ||
        (fs.statSync(target).isDirectory() && fs.readdirSync(target).length === 0),
      file,
    );
  }
  assert.ok(fs.existsSync(path.join(root, 'src/nutrition/vision.ts')));
  assert.ok(fs.existsSync(path.join(root, 'src/nutrition/photoMetadata.ts')));
});

test('Today pager owns navigation only and training owns its plan editing/update lease', () => {
  const pager = read('src/screens/TodayScreen.tsx'),
    training = readFeature('today');
  assert.match(pager, /<TodayTrainingScreen/);
  assert.doesNotMatch(pager, /generatePersonalPlan|patchProfile|TrainingStagePicker|onNutrition/);
  assert.match(training, /useUpdateBlock\(/);
  assert.match(training, /generatePersonalPlan/);
  assert.doesNotMatch(training, /useRunRecorder|NutritionScreen|scrollTarget/);
});

test('TypeScript test registration has one implementation instead of per-suite copies', () => {
  for (const file of fs
    .readdirSync(path.join(root, 'scripts'))
    .filter((file) => file.endsWith('.cjs'))) {
    assert.doesNotMatch(read('scripts/' + file), /require\.extensions\[['"]\.tsx?['"]\]\s*=/, file);
  }
  assert.match(read('scripts/lib/register-typescript.cjs'), /transpileModule/);
});

test('knowledge seed modules are reachable only through lazy imports on every platform', () => {
  for (const platform of ['web', 'android', 'ios']) {
    const eager = applicationGraph(root, platform, { eagerOnly: true });
    const full = applicationGraph(root, platform);
    const seeded = (file) => /knowledge[\\/](referenceBundle|private[\\/]bundle)\.ts$/.test(file);
    assert.equal(
      [...eager.keys()].some(seeded),
      false,
      platform + ': startup must not evaluate seed literals',
    );
    assert.equal(
      [...full.keys()].filter((file) => /knowledge[\\/]referenceBundle\.ts$/.test(file)).length,
      1,
      platform + ': one authoritative public seed',
    );
  }
});

test('static data does not depend on domain algorithms and pure domains do not depend on UI or I/O', () => {
  const files = (directory) =>
    fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory()
        ? files(target)
        : /\.(tsx?|mjs|js)$/.test(entry.name)
          ? [target]
          : [];
    });
  for (const file of files(path.join(root, 'src/data'))) {
    const imports = runtimeSpecifiers(fs.readFileSync(file, 'utf8'), file);
    assert.ok(
      !imports.some((specifier) => /(^|\/)domain(\/|$)/.test(specifier)),
      path.relative(root, file),
    );
  }
  for (const file of files(path.join(root, 'src/domain'))) {
    const imports = runtimeSpecifiers(fs.readFileSync(file, 'utf8'), file);
    assert.ok(
      !imports.some((specifier) =>
        /^(react|expo|@react-native|node:)|(^|\/)(store|screens|components|integrations|features)(\/|$)/.test(
          specifier,
        ),
      ),
      path.relative(root, file),
    );
  }
  for (const name of [
    'trainingPlans',
    'progression',
    'trainingPrescription',
    'sessionRecords',
    'weightChart',
    'weightTrend',
    'equipmentTraining',
    'equipmentProgram',
  ]) {
    assert.equal(
      fs.existsSync(path.join(root, 'src/data/' + name + '.ts')),
      false,
      'no obsolete facade: ' + name,
    );
  }
});

test('React only binds the stable repository; every subscriber explicitly selects fields', () => {
  const binding = read('src/store/AppStore.tsx');
  assert.match(binding, /createAppRepository/);
  assert.match(binding, /useSyncExternalStore/);
  assert.doesNotMatch(
    binding,
    /normalizeTrainingSessions|normalizeNutritionJournal|multiSet|multiRemove/,
  );
  const graph = applicationGraph(root);
  for (const file of graph.keys()) {
    const ast = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'useAppStore'
      ) {
        assert.equal(
          node.arguments.length,
          1,
          path.relative(root, file) + ': full-store subscriptions are forbidden',
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
});

test('feature controllers contain no JSX and relocation never rewrites non-import string operations', () => {
  for (const file of Object.values(features)
    .flat()
    .filter((file) => /\/use[^/]+\.ts$/.test(file))) {
    const source = read(file),
      ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      assert.ok(!ts.isJsxElement(node) && !ts.isJsxSelfClosingElement(node), file);
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ['split', 'replace', 'endsWith'].includes(node.expression.name.text)
      ) {
        for (const argument of node.arguments)
          if (ts.isStringLiteral(argument))
            assert.ok(
              !argument.text.startsWith('../../'),
              file + ': misplaced module path in a string operation',
            );
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
});

test('feature styles have consumers instead of leaving retired view styles behind', () => {
  for (const [feature, files] of Object.entries(features)) {
    const stylesheet = files.find((file) => /\/styles\.ts$/.test(file));
    if (!stylesheet) continue;
    const keys = [],
      used = new Set();
    let dynamic = false;
    for (const file of files) {
      const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
      const visit = (node) => {
        if (
          file === stylesheet &&
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.getText(ast) === 'StyleSheet' &&
          node.expression.name.text === 'create'
        ) {
          for (const property of node.arguments[0].properties)
            if (property.name) keys.push(property.name.getText(ast));
        }
        if (
          ts.isPropertyAccessExpression(node) &&
          ['s', 'styles'].includes(node.expression.getText(ast))
        )
          used.add(node.name.text);
        if (
          ts.isElementAccessExpression(node) &&
          ['s', 'styles'].includes(node.expression.getText(ast))
        ) {
          if (ts.isStringLiteral(node.argumentExpression)) used.add(node.argumentExpression.text);
          else dynamic = true;
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    // A dynamic style table cannot be safely treated as dead by a static property scan.
    if (!dynamic)
      assert.deepEqual(
        keys.filter((key) => !used.has(key)),
        [],
        feature,
      );
  }
});

test('the retired server index is absent and build/check consume the live Markdown collection', () => {
  for (const file of [
    'scripts/build-prisoner-knowledge.mjs',
    'scripts/check-book-knowledge.mjs',
    'scripts/lib/knowledge/book-knowledge.mjs',
    'scripts/lib/knowledge/prisoner-knowledge.mjs',
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), false, file);
  }
  const commands = JSON.parse(read('package.json')).scripts;
  assert.equal(commands['knowledge:build'], 'node scripts/build-knowledge-vault.mjs');
  assert.equal(commands['knowledge:check'], 'node scripts/check-knowledge-vault.mjs');
  assert.match(read('scripts/lib/knowledge/seed-files.mjs'), /knowledge\/libraries/);
});
