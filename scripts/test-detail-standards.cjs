// Render the real shared guide for every catalog entry; mock only native UI / asset boundaries.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { jsx: ts.JsxEmit.ReactJSX }, extensions: ['.ts', '.tsx'] });
const nativeElement = tag => ({ children, testID, accessibilityRole, ...props }) => React.createElement(tag, {
  'data-testid': testID, role: accessibilityRole, 'aria-expanded': props['aria-expanded'],
}, children);
const native = {
  View: nativeElement('div'), Text: nativeElement('span'), Image: nativeElement('img'),
  Pressable: nativeElement('button'), ScrollView: nativeElement('div'), SafeAreaView: nativeElement('div'),
  StyleSheet: { create: value => value, hairlineWidth: 1, absoluteFill: {} },
};
const load = Module._load;
const imageExtensions = ['.jpeg', '.jpg', '.png', '.webp'];
const previous = new Map(imageExtensions.map(extension => [extension, require.extensions[extension]]));
let exercises, ExerciseDetailedGuide;
try {
  for (const extension of imageExtensions) require.extensions[extension] = (module, filename) => { module.exports = { uri: 'asset://' + path.basename(filename) }; };
  Module._load = function(name, parent, isMain) {
    if (name === 'react-native') return native;
    if (name === 'react-native-svg') return { __esModule: true, default: nativeElement('svg'), Circle: nativeElement('circle'), G: nativeElement('g'), Line: nativeElement('line'), Path: nativeElement('path'), Text: nativeElement('text') };
    return load.call(this, name, parent, isMain);
  };
  ({ exercises } = require('../src/data/exerciseCatalog.ts'));
  ({ ExerciseDetailedGuide } = require('../src/components/ExerciseResource.tsx'));
} finally {
  Module._load = load;
  for (const [extension, handler] of previous) {
    if (handler) require.extensions[extension] = handler;
    else delete require.extensions[extension];
  }
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[char]);

test('every catalog action shows every nonempty training standard immediately and hides redundant sources', () => {
  assert.ok(exercises.length > 100);
  let checked = 0;
  for (const exercise of exercises) {
    const html = renderToStaticMarkup(React.createElement(ExerciseDetailedGuide, { exercise, selectedTab: 'summary' }));
    assert.doesNotMatch(html, /资料来源|来源：/, exercise.id);
    const entries = Object.entries(exercise.standards || {}).filter(([, value]) => Boolean(value));
    assert.equal(html.includes('data-testid="exercise-training-standards"'), entries.length > 0, exercise.id);
    for (const [name, value] of entries) {
      const marker = 'data-testid="exercise-standard-' + escape(name) + '"';
      const row = html.slice(html.indexOf(marker), html.indexOf('</div>', html.indexOf(marker)));
      assert.ok(row.includes(escape(value)), exercise.id + '/' + name + ' actual value is visible without interaction');
      assert.doesNotMatch(row, /button|aria-expanded|chevron/, exercise.id + '/' + name);
      checked++;
    }
  }
  assert.ok(checked > 100, 'Exercise the full catalog, not just the example push-up');
});
