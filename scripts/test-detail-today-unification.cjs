const { readFeature } = require('./lib/project-features.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('every exercise detail shares one reading canvas and fixed accessible actions', () => {
  const canvas = read('src/components/MovementDetail.tsx');
  assert.ok(canvas.indexOf('</ScrollView>') < canvas.indexOf('testID="movement-detail-footer"'));
  assert.ok(canvas.includes('aria-expanded={open === item.id}'));
  assert.ok(canvas.includes('aria-selected={selected === tab.id}'));
  for (const file of ['src/screens/ExerciseDetailScreen.tsx', 'src/screens/EquipmentDetailScreen.tsx']) {
    const screen = read(file);
    assert.ok(screen.includes('<MovementDetail'));
    assert.ok(screen.includes('<DetailAction'));
    assert.ok(!/ScrollView|styles\.metrics|styles\.guideCard|styles\.bottomBar/.test(screen));
  }
});

test('shared guides preserve real technique, corrections, standards and independent sources', () => {
  const bodyweight = read('src/components/ExerciseResource.tsx');
  for (const field of ['exercise.keyPoints', 'exercise.commonIssues', 'exercise.standards', 'resource.markdown']) assert.ok(bodyweight.includes(field));
  assert.ok(bodyweight.includes('getOriginalResource(exercise.id)'));
  assert.ok(bodyweight.includes('resource.kind ==='));
  assert.ok(bodyweight.includes('<DetailSteps'));
  assert.ok(bodyweight.includes('<DetailDisclosures'));
  const equipment = read('src/components/EquipmentMovementGuide.tsx');
  for (const field of ['exercise.guide.setup', 'exercise.guide.execution', 'exercise.guide.control', 'exercise.guide.issues']) assert.ok(equipment.includes(field));
  const screen = read('src/screens/EquipmentDetailScreen.tsx');
  assert.ok(screen.includes('exercise.guide.sources.map'));
  assert.ok(screen.includes('exercise.recommendation.sources.map'));
  assert.ok(!/ExerciseDetailedGuide|originalResources|按升级标准训练/.test(screen));
  const bodyScreen = read('src/screens/ExerciseDetailScreen.tsx');
  assert.ok(bodyScreen.includes("guideTab === 'summary'"));
  assert.ok(bodyScreen.includes('levels: { ...current.levels'));
  assert.ok(bodyScreen.includes('planLevels: { ...(current.planLevels'));
  assert.ok(bodyScreen.includes("confirmAction('高风险动作'"));
  assert.ok(bodyScreen.includes('onStart(exercise.id)'));
});

test('all Today goals reuse dates, typography, numbered prescription cards and start controls', () => {
  for (const file of ['src/screens/TodayTrainingScreen.tsx', 'src/screens/EquipmentTodayScreen.tsx']) {
    const screen = read(file);
    assert.ok(screen.includes('...todayTrainingStyles'));
    assert.ok(screen.includes('<TodayTrainingTask'));
    const sections = ['today-date-rail', 'today-schedule-controls', 'today-course-card', 'today-workout-list', 'today-start-dock'].map(id => screen.indexOf(`testID="${id}"`));
    sections.forEach((position, index) => { assert.ok(position > 0); if (index) assert.ok(position > sections[index - 1]); });
  }
  const equipment = read('src/screens/EquipmentTodayScreen.tsx');
  assert.ok(equipment.includes('items.map((item, index)'));
  assert.ok(equipment.indexOf('</ScrollView>') < equipment.indexOf('testID="today-start-dock"'));
  assert.ok(!/EquipmentTierBadge|ProgressBar|s\.summary|s\.actionTitle|s\.chevron/.test(equipment));
  assert.ok(equipment.includes('onStart(day.workoutId, 1, items[0].defaultPrescription?.rirTarget, plan)'));
  assert.ok(equipment.includes("unavailable ? openSettings()"));
  const task = read('src/components/TodayTrainingTask.tsx');
  for (const field of ['exercise.repRange.join', 'exercise.targetUnit', 'exercise.perSide', 'exercise.restSeconds', 'exercise.loadBasis']) assert.ok(task.includes(field));
  assert.ok(!task.includes('exercise.targetSets >'));
  assert.ok(!task.includes('completed:'));
});

test('all bodyweight detail pages remove risk banners and redundant sources, and show standards directly', () => {
  const screen = read('src/screens/ExerciseDetailScreen.tsx');
  assert.doesNotMatch(screen, /riskLabel|styles\.risk|warningBackground|风险动作<\/Text>/);
  // Only the repeated UI banner is removed; selecting high-risk exercises still requires confirmation.
  assert.ok(screen.includes("confirmAction('高风险动作'"));
  const guide = read('src/components/ExerciseResource.tsx');
  const summary = guide.slice(guide.indexOf("{tab === 'summary' ?"), guide.indexOf('\n    </View> : <View>', guide.indexOf("{tab === 'summary' ?")));
  assert.doesNotMatch(summary, /资料来源|来源：|exercise\.source/);
  assert.ok(summary.includes('testID="exercise-training-standards"'));
  const standards = summary.slice(summary.indexOf('{standards.length'));
  assert.ok(standards.includes('standards.map(([name, value])'));
  assert.ok(standards.includes('<Text style={d.body}>{value}</Text>'));
  assert.doesNotMatch(standards, /DetailDisclosures|Pressable|initialOpen/);
  assert.ok(guide.includes('<SourceMarkdown markdown={resource.markdown} />'));
});

test('nutrition has no obsolete rationale section and Today uses the draggable host dock', () => {
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'src/nutrition/knowledge.ts')));
  assert.ok(!/计算与知识依据|NUTRITION_KNOWLEDGE|OBJECTIVE_EXPLANATIONS|knowledgeToggle/.test(read('src/screens/NutritionScreen.tsx')));
  const today = read('src/screens/TodayScreen.tsx');
  assert.ok(!/TodayChatFrame|todayChatButton|useOpenAgentChat/.test(today));
  assert.ok(today.includes("useHideAgentDock(selectedPage === 2 && run.snapshot.phase !== 'idle')"));
  const host = read('src/integrations/AgentChatHost.tsx');
  for (const marker of ['setPointerCapture', 'onPanResponderMove', 'onPanResponderRelease', 'lostpointercapture', 'keydown']) assert.ok(host.includes(marker));
  assert.ok(!host.includes('<Pressable'));
  assert.ok(readFeature('chat').includes("animationType={Platform.OS === 'web' ? 'none' : 'slide'}"));
});
