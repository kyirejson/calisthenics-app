const { readFeature } = require('./lib/project-features.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const { buildTrainingDay, buildSetDistribution } = require('../src/domain/training/dayTraining.ts');
const now = new Date(2026, 9, 8, 23);
const exercise = (id, count, unit = 'reps', value = 12) => ({ exerciseId: id, name: id, sets: Array.from({ length: count }, () => ({ reps: value, unit, completed: true })) });
const record = (id, date, exercises, durationSeconds = 900) => ({ id, kind: 'strength', trainingDate: date, workoutId: 'test', workoutName: 'Test', startedAt: new Date(2026, 9, 7, 12).toISOString(), completedAt: new Date(2026, 9, 7, 13).toISOString(), durationSeconds, exercises });

test('historical cards aggregate the selected training day, not the current day', () => {
  const summary = buildTrainingDay([record('old', '2026-10-7', [exercise('squat_05', 4)]), record('today', '2026-10-8', [exercise('push_05', 3)])], now, '2026-10-07');
  assert.equal(summary.date, '2026-10-07'); assert.equal(summary.setCount, 4); assert.equal(summary.records.length, 1); assert.equal(summary.totals.reps, 48);
});
test('donut segments reflect set counts only, never mixed reps and seconds', () => {
  const summary = buildTrainingDay([record('a', '2026-10-8', [exercise('squat', 4), exercise('push', 3, 'reps', 10), exercise('pull', 2, 'reps', 6), exercise('grip', 1, 'seconds', 40)])], now);
  const segments = buildSetDistribution(summary.exercises);
  assert.equal(summary.setCount, 10); assert.deepEqual(segments.map(item => item.sweep), [144, 108, 72, 36]); assert.deepEqual(segments.map(item => item.start), [0, 144, 252, 324]);
  assert.deepEqual(summary.totals, { reps: 90, seconds: 40, steps: 0, meters: 0 });
});
test('empty and single-action distributions have no NaN, phantom slices or target percentage', () => {
  assert.deepEqual(buildSetDistribution([]), []);
  const summary = buildTrainingDay([record('a', '2026-10-8', [exercise('squat', 1)])], now);
  assert.equal(buildSetDistribution(summary.exercises)[0].sweep, 360);
});
test('history card recalculates repeats, partial records and deletion, keeps missing time explicit', () => {
  const a = record('a', '2026-10-8', [exercise('squat', 4)]), b = record('b', '2026-10-8', [exercise('squat', 2)], 0);
  assert.equal(buildTrainingDay([a, b], now).setCount, 6); assert.equal(buildTrainingDay([a, b], now).unmeasuredCount, 1);
  assert.equal(buildTrainingDay([b], now).setCount, 2); assert.equal(buildTrainingDay([b], now).durationSeconds, 0);
});
test('history chart is in list items, not the data header, and old duplicated summaries are gone', () => {
  const screen = readFeature('history');
  const ts = require('typescript');
  const ast = ts.createSourceFile('history.tsx', screen, ts.ScriptTarget.Latest, true);
  let header;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'header') header = node.initializer?.getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(header, 'inspect the actual header initializer, independent of formatting');
  assert.ok(!header.includes('TrainingDaySummary')); assert.ok(screen.indexOf('<TrainingDaySummary') > screen.indexOf('renderItem='));
  assert.ok(!screen.includes('TodayTrainingSummary')); assert.ok(!screen.includes('sessionSummary(')); assert.ok(!screen.includes('runSummaryText('));
  assert.ok(!fs.existsSync(require('node:path').join(__dirname, '../src/components/TodayTrainingSummary.tsx')));
});

test('history uses one initially closed day and renders charts only when explicitly expanded', () => {
  const screen = readFeature('history');
  const card = fs.readFileSync(require.resolve('../src/components/TrainingDaySummary.tsx'), 'utf8');
  assert.ok(screen.includes('const [expandedDay, setExpandedDay] = useState<string | null>(null)'));
  assert.match(screen, /setExpandedDay\(dayExpanded \? null : day.key\);\s*setDetailsDay\(null\);\s*setExpandedSession\(null\)/);
  assert.ok(!screen.includes('selectDate(savedDay.key)'));
  assert.ok(card.includes('{expanded ? <View testID='));
});

test('pruned data cards, labels and unused statistics are removed without removing charts or calendar', () => {
  const screen = readFeature('history');
  const progress = fs.readFileSync(require.resolve('../src/components/UnifiedProgressCard.tsx'), 'utf8');
  const history = fs.readFileSync(require.resolve('../src/domain/training/trainingHistory.ts'), 'utf8');
  assert.ok(!fs.existsSync(require('node:path').join(__dirname, '../src/components/ProgressEvidenceCard.tsx')));
  for (const symbol of ['ProgressEvidenceCard', 'computeMonthStats', 'computeWeekStreak', 'computeReviewedTrainingStreak']) {
    assert.ok(!screen.includes(symbol)); assert.ok(!history.includes(symbol));
  }
  assert.ok(!screen.includes('记录保存在本机 · 删除后图表同步重算'));
  assert.ok(!progress.includes('○ 当前选择')); assert.ok(!progress.includes('styles.legend'));
  assert.ok(screen.includes('<UnifiedProgressCard')); assert.ok(screen.includes('training-calendar-month'));
  assert.ok(screen.includes('<TrainingDaySummary')); assert.ok(screen.includes('deleteSession(session.id)'));
});

test('history and progress bottom bars are removed while action details and calendar access remain', () => {
  const card = fs.readFileSync(require.resolve('../src/components/TrainingDaySummary.tsx'), 'utf8');
  const progress = fs.readFileSync(require.resolve('../src/components/UnifiedProgressCard.tsx'), 'utf8');
  const screen = readFeature('history');
  for (const text of ['✓ 已记录', '查看明细', 's.footer', 'onToggleDetails', 'detailsExpanded', 'legacyRunCount']) assert.ok(!card.includes(text));
  for (const text of ['styles.inspection', 'onSelectRecord', '查看上一条成绩', '查看下一条成绩', 'styles.emptyFoot']) assert.ok(!progress.includes(text));
  assert.ok(card.includes('<ActionSets item={item}'));
  assert.ok(progress.includes('onKeyDown')); assert.ok(progress.includes('gestures.panHandlers'));
  assert.ok(screen.includes('onPress={() => selectDate(cell.key, true)}'));
  assert.ok(screen.includes('dayExpanded && detailsDay === day.key'));
});
