const { readFeature } = require('./lib/project-features.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('progression browsing selection belongs to the app shell above detail routes', () => {
  const app = fs.readFileSync(require.resolve('../App.tsx'), 'utf8');
  const screen = readFeature('progression');
  assert.ok(app.includes('viewPreferences={progressView} onViewPreferences={updateProgressView}'));
  assert.ok(app.includes('setProgressView(previous => ({ ...previous, ...patch }))'));
  assert.ok(screen.includes('group: activeGroup, series: activeSeries } = viewPreferences'));
  assert.ok(!screen.includes("const [activeSeries, setActiveSeries] = useState('push')"));
  assert.ok(!screen.includes("useState<SeriesGroup>('六艺基础')"));
});

test('progression restores captured position once without scrolling on every render', () => {
  const screen = readFeature('progression');
  assert.ok(screen.includes('useRef(viewPreferences.scrollOffset)'));
  assert.ok(screen.includes('if (!scrollRestored.current)'));
  assert.ok(screen.includes('scrollTo({ y: initialScroll.current, animated: false })'));
  assert.ok(screen.includes('scrollOffset: Math.max(0, y)'));
});
