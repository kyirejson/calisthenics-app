const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { explicitTrainingIntent } = require('../src/agent/trainingIntent.mjs');
const { prepareTrainingAdjustment, resolveTrainingDate } = require('../src/agent/trainingActions.ts');
const { baseDailyEditDate, effectiveDailyEdits, effectiveTrainingProfile, normalizeTrainingOverlay, trainingScope, overlayDate } = require('../src/agent/trainingOverlay.ts');
const { getWeekSchedule, getPlanDay } = require('../src/data/trainingPlans.ts');
const { equipmentSessionPlan, EQUIPMENT_PLAN_ID, equipmentReplacementIds } = require('../src/data/equipmentTraining.ts');
const { getEquipmentMovement } = require('../src/data/equipment.ts');
const { assistantTrainingSnapshot } = require('../src/nutrition/assistantTraining.ts');
const { emptyNutritionJournal } = require('../src/nutrition/engine.ts');
const { normalizeAssistantIntent } = require('../src/nutrition/assistantState.ts');
const { offlineFoodIntent, offlineTrainingAnswer } = require('../src/agent/offline.ts');
const { playlistId, musicURLs, normalizeAgentPreferences } = require('../src/agent/music.ts');
const { agentNudge } = require('../src/agent/proactive.ts');
const { subscribeAgentEvents, publishAgentEvent } = require('../src/agent/events.ts');
const { agentWeightContext } = require('../src/agent/weightContext.ts');
const now = new Date(2026, 9, 2, 12), date = overlayDate(now);
const profile = { name: 'QA', age: 30, sex: 'male', height: 175, weight: 75, goal: 'equipment', frequency: 6, equipmentSplit: 'ppl', experience: 'advanced', levels: {}, planStartedAt: now.toISOString(), planId: EQUIPMENT_PLAN_ID };
const apply = (p, intent) => { const draft = prepareTrainingAdjustment(p, [], {}, intent, now); return { draft, profile: effectiveTrainingProfile(p, { trainingOverlays: { equipment: draft.overlay } }) }; };
const items = p => equipmentSessionPlan(getPlanDay(p, now).day.workoutId, p, now).items;
test('definite training commands normalize without confusing group counts with replacement names', () => {
  for (const [text, operation] of [['今天卧推改成4组', 'sets'], ['今天卧推改为4组', 'sets'], ['把今天卧推换成哑铃卧推', 'replace'], ['把今天训练移到明天', 'postpone'], ['今天训练顺延到明天', 'postpone'], ['今天和明天训练交换', 'reschedule'], ['今天训练减载', 'deload'], ['撤销今天训练调整', 'reset']]) {
    const intent = explicitTrainingIntent(text); assert.equal(intent.operation, operation); assert.deepEqual(normalizeAssistantIntent(intent), intent);
  }
  for (const text of ['今天卧推换成哑铃卧推吗？', '如果今天卧推换成哑铃卧推', '我手腕受伤', '昨天卧推做了4组', '今天练什么']) assert.equal(explicitTrainingIntent(text), null);
});
test('invalid dates, past dates and over-four-week adjustments fail before changing a plan', () => {
  assert.throws(() => resolveTrainingDate('2026-02-30', now), /无效/);
  for (const when of ['2026-10-01', '2026-12-01']) assert.throws(() => apply(profile, explicitTrainingIntent(when + '训练减载')), /历史|四周/);
});
test('set changes project into dated cards, snapshot, revision and timeline; another date and original profile stay unchanged', () => {
  const before = items(profile), first = before[0], original = JSON.stringify(profile);
  const changed = apply(profile, explicitTrainingIntent('今天' + first.name + '改为7组'));
  assert.equal(items(changed.profile)[0].targetSets, 7);
  assert.notEqual(equipmentSessionPlan(getPlanDay(profile, now).day.workoutId, profile, now).revision, equipmentSessionPlan(getPlanDay(profile, now).day.workoutId, changed.profile, now).revision);
  assert.equal(assistantTrainingSnapshot(changed.profile, [], {}, now).week.find(day => day.date === date).actions[0].sets, 7);
  assert.equal(JSON.stringify(profile), original);
  const later = new Date(now); later.setDate(later.getDate() + 7);
  assert.deepEqual(equipmentSessionPlan(getPlanDay(profile, later).day.workoutId, profile, later).items, equipmentSessionPlan(getPlanDay(profile, later).day.workoutId, changed.profile, later).items);
  assert.deepEqual(normalizeTrainingOverlay(JSON.parse(JSON.stringify(changed.draft.overlay))), changed.draft.overlay);
});
test('plan settings change invalidates the entire old topic overlay', () => {
  const changed = apply(profile, explicitTrainingIntent('今天训练减载'));
  const next = { ...profile, equipmentPriority: 'chest' };
  assert.equal(effectiveTrainingProfile(next, { trainingOverlays: { equipment: changed.draft.overlay } }).agentTrainingOverlay, undefined);
  assert.notEqual(trainingScope(next), trainingScope(profile));
});
test('deload reduces actual work groups without fabricating historical completions; reset restores the template', () => {
  const changed = apply(profile, explicitTrainingIntent('今天训练减载'));
  assert.deepEqual(items(changed.profile).map(i => i.targetSets), items(profile).map(i => Math.max(1, Math.round(i.targetSets / 2))));
  assert.match(changed.draft.notices.join(), /不再声称/);
  const restored = apply(changed.profile, explicitTrainingIntent('撤销今天训练调整'));
  assert.deepEqual(items(restored.profile), items(profile));
});
test('paired rescheduling transfers both custom courses and can restore both endpoints without duplication', () => {
  const first = items(profile)[0];
  const customized = apply(profile, explicitTrainingIntent('今天' + first.name + '改为7组')).profile;
  const changed = apply(customized, explicitTrainingIntent('今天和明天训练交换'));
  const tomorrow = resolveTrainingDate('明天', now);
  assert.equal(getPlanDay(changed.profile, tomorrow).day.workoutId, getPlanDay(profile, now).day.workoutId);
  assert.equal(equipmentSessionPlan(getPlanDay(changed.profile, tomorrow).day.workoutId, changed.profile, tomorrow).items.find(i => i.id === first.id).targetSets, 7);
  assert.equal(getWeekSchedule(changed.profile, now).filter(d => d.workoutId).length, 6);
  assert.deepEqual(normalizeTrainingOverlay(changed.draft.overlay), changed.draft.overlay);
  const reverted = apply(changed.profile, explicitTrainingIntent('撤销今天训练调整'));
  assert.deepEqual(getWeekSchedule(reverted.profile, now), getWeekSchedule(profile, now));
  assert.deepEqual(items(reverted.profile), items(profile));
});
test('replacement preserves equivalent training targets and rejects an unsupported or duplicate movement', () => {
  const before = items(profile), source = before.find(item => equipmentReplacementIds(item.id, profile).some(id => !before.some(i => i.id === id)));
  assert.ok(source);
  const target = getEquipmentMovement(equipmentReplacementIds(source.id, profile).find(id => !before.some(i => i.id === id)));
  const changed = apply(profile, explicitTrainingIntent('今天' + source.name + '换成' + target.name));
  assert.ok(items(changed.profile).some(i => i.id === target.id));
  assert.throws(() => apply(profile, explicitTrainingIntent('今天' + source.name + '换成不存在动作')), /不能保留|替换动作/);
  assert.throws(() => apply(profile, explicitTrainingIntent('今天' + source.name + '改为0组')), /1–30/);
});

test('postponement rests today and rotates every occupied course, customization and addition until the next free day', () => {
  const { dailyWorkoutKey, trainingDateKey } = require('../src/data/sessionRecords.ts');
  const first = items(profile)[0], tomorrow = resolveTrainingDate('明天', now);
  const customized = apply(profile, explicitTrainingIntent('今天' + first.name + '改为7组')).profile;
  const source = getPlanDay(profile, now).day.workoutId, second = getPlanDay(profile, tomorrow).day.workoutId;
  const edits = {
    [dailyWorkoutKey(trainingDateKey(now), source)]: { date: trainingDateKey(now), workoutId: source, exerciseIds: ['today-extra'] },
    [dailyWorkoutKey(trainingDateKey(tomorrow), second)]: { date: trainingDateKey(tomorrow), workoutId: second, exerciseIds: ['tomorrow-extra'] },
  };
  const raw = JSON.stringify(edits), draft = prepareTrainingAdjustment(customized, [], edits, explicitTrainingIntent('今天训练移到明天'), now);
  const view = effectiveTrainingProfile(profile, { trainingOverlays: { equipment: normalizeTrainingOverlay(JSON.parse(JSON.stringify(draft.overlay))) } });
  assert.equal(getPlanDay(view, now).day.workoutId, undefined);
  assert.match(getPlanDay(view, now).day.title, /休息/);
  assert.equal(getPlanDay(view, tomorrow).day.workoutId, source);
  assert.equal(equipmentSessionPlan(source, view, tomorrow).items.find(i => i.id === first.id).targetSets, 7);
  assert.equal(getWeekSchedule(view, now).filter(d => d.workoutId).length, 6);
  const destinations = Object.keys(draft.overlay.days).sort();
  assert.equal(new Set(destinations.map(d => draft.overlay.days[d].sourceDate)).size, destinations.length);
  const third = resolveTrainingDate('后天', now), projected = effectiveDailyEdits(edits, view);
  assert.deepEqual(projected[dailyWorkoutKey(trainingDateKey(tomorrow), source)].exerciseIds, ['today-extra']);
  assert.deepEqual(projected[dailyWorkoutKey(trainingDateKey(third), second)].exerciseIds, ['tomorrow-extra']);
  assert.equal(baseDailyEditDate(view, trainingDateKey(third)), trainingDateKey(tomorrow));
  assert.equal(JSON.stringify(edits), raw);
  const restore = apply(view, explicitTrainingIntent('撤销明天训练调整')).profile;
  assert.deepEqual(getWeekSchedule(restore, now), getWeekSchedule(profile, now));
  assert.deepEqual(effectiveDailyEdits(edits, restore), edits);
  assert.match(draft.notices.join(), /不交换、不删除/);
});
test('postponement cannot cross actual sessions or previous adjustments, go backwards, or load broken ownership', () => {
  const completed = { id: 'real', trainingDate: overlayDate(resolveTrainingDate('后天', now)), startedAt: now.toISOString(), exercises: [{ sets: [{ completed: true }] }] };
  assert.throws(() => prepareTrainingAdjustment(profile, [completed], {}, explicitTrainingIntent('今天训练移到明天'), now), /顺延链路/);
  assert.throws(() => apply(profile, explicitTrainingIntent('明天训练移到今天')), /推迟/);
  const changed = apply(profile, explicitTrainingIntent('今天训练移到明天'));
  assert.throws(() => apply(changed.profile, explicitTrainingIntent('明天和后天训练交换')), /顺延链路/);
  const broken = JSON.parse(JSON.stringify(changed.draft.overlay)); delete broken.days[date];
  assert.equal(normalizeTrainingOverlay(broken), null);
  const duplicate = JSON.parse(JSON.stringify(changed.draft.overlay)); duplicate.days[date].sourceDate = duplicate.days[overlayDate(resolveTrainingDate('明天', now))].sourceDate;
  assert.equal(normalizeTrainingOverlay(duplicate), null);
  assert.throws(() => prepareTrainingAdjustment(changed.profile, [completed], {}, explicitTrainingIntent('撤销今天训练调整'), now), /单边撤销/);
});

test('dock snaps within safe bounds and normalized anchors survive preference reload', () => {
  const { dockBounds, dockPoint, snapDock } = require('../src/agent/floatingDock.ts');
  for (const [w, h] of [[320, 668], [390, 900], [900, 390], [1280, 900]]) {
    const bounds = dockBounds(w, h, 30, 20), anchor = snapDock(-100, 99999, bounds), point = dockPoint(anchor, bounds);
    assert.equal(anchor.edge, 'left'); assert.equal(point.y, bounds.bottom); assert.ok(point.y + 48 < h - 100);
    assert.equal(snapDock(99999, -100, bounds).edge, 'right');
    assert.deepEqual(normalizeAgentPreferences(JSON.parse(JSON.stringify({ dockAnchor: anchor }))).dockAnchor, anchor);
  }
  assert.equal(normalizeAgentPreferences({ dockAnchor: { edge: 'evil', ratio: 2 } }).dockAnchor, undefined);
});
test('return-to-settings marker holds only a bounded route and rejects corrupt or expired timestamps', () => {
  const { validSettingsReturn } = require('../src/agent/settingsResumeCore.mjs');
  assert.equal(validSettingsReturn({ view: 'connection', at: now.getTime() }, now.getTime() + 1000), true);
  for (const value of [null, {}, { view: 'chat', at: now.getTime() }, { view: 'connection', at: 'bad' }, { view: 'connection', at: now.getTime() + 1000 }, { view: 'connection', at: now.getTime() - 86400001 }]) assert.equal(validSettingsReturn(value, now.getTime()), false);
});
test('offline parses explicit multi-food Chinese units without guessing cooked states, missing quantities or conditional facts', () => {
  const result = offlineFoodIntent('早餐吃了100克熟米饭、两个水煮鸡蛋，帮我记录');
  assert.equal(result.items.length, 2); assert.equal(result.items[1].quantity, 2); assert.equal(result.items[1].unit, 'piece');
  assert.equal(offlineFoodIntent('我今天吃了半斤牛肉和米饭一碗').items[0].quantity, 250);
  assert.equal(offlineFoodIntent('吃了半斤牛肉和米饭一碗').items[0].state, 'unknown');
  assert.equal(offlineFoodIntent('吃了米饭、鸡蛋').items[1].quantity, null);
  for (const text of ['如果吃了两个鸡蛋', '昨天吃了100克米饭和鸡蛋', '吃了三个不存在的菜', '吃了米饭，', '吃了零个鸡蛋']) assert.equal(offlineFoodIntent(text), null);
  const { suggestedMealSlot } = require('../src/agent/mealSuggestion.ts');
  for (const [hour, expected] of [[8, 'breakfast'], [12, 'lunch'], [16, 'snack'], [19, 'dinner'], [23, 'snack']]) assert.equal(suggestedMealSlot(new Date(2026, 9, 3, hour)), expected);
});
test('actual completed dated sessions block rewriting an already executed course', () => {
  const session = { id: 'real', trainingDate: date, startedAt: now.toISOString(), exercises: [{ sets: [{ completed: true, reps: 10 }] }] };
  assert.throws(() => prepareTrainingAdjustment(profile, [session], {}, explicitTrainingIntent('今天训练减载'), now), /实际训练/);
});

test('replacing a replacement retains its original custom set prescription', () => {
  const before = items(profile), source = before.find(i => equipmentReplacementIds(i.id, profile).filter(id => !before.some(item => item.id === id)).length >= 2);
  assert.ok(source);
  const targetIds = equipmentReplacementIds(source.id, profile).filter(id => !before.some(item => item.id === id));
  const first = getEquipmentMovement(targetIds[0]);
  let changed = apply(profile, explicitTrainingIntent('今天' + source.name + '改为7组')).profile;
  changed = apply(changed, explicitTrainingIntent('今天' + source.name + '换成' + first.name)).profile;
  const secondId = equipmentReplacementIds(first.id, changed).find(id => id !== source.id && !items(changed).some(i => i.id === id));
  assert.ok(secondId);
  changed = apply(changed, explicitTrainingIntent('今天' + first.name + '换成' + getEquipmentMovement(secondId).name)).profile;
  assert.equal(items(changed).find(i => i.id === secondId).targetSets, 7);
});

test('rescheduling projects manual additions to the other date and undo restores without mutating the originals', () => {
  const { dailyWorkoutKey, trainingDateKey } = require('../src/data/sessionRecords.ts');
  const workout = getPlanDay(profile, now).day.workoutId;
  const tomorrow = resolveTrainingDate('明天', now), sourceKey = dailyWorkoutKey(trainingDateKey(now), workout), targetKey = dailyWorkoutKey(trainingDateKey(tomorrow), workout);
  const edits = { [sourceKey]: { date: trainingDateKey(now), workoutId: workout, exerciseIds: ['extra-qa'] } }, original = JSON.stringify(edits);
  const draft = prepareTrainingAdjustment(profile, [], edits, explicitTrainingIntent('把今天训练移到明天'), now);
  const projected = effectiveTrainingProfile(profile, { trainingOverlays: { equipment: draft.overlay } });
  const moved = effectiveDailyEdits(edits, projected);
  assert.equal(moved[sourceKey], undefined); assert.deepEqual(moved[targetKey].exerciseIds, ['extra-qa']);
  assert.equal(baseDailyEditDate(projected, trainingDateKey(tomorrow)), trainingDateKey(now));
  assert.equal(JSON.stringify(edits), original);
  const restored = apply(projected, explicitTrainingIntent('撤销今天训练调整')).profile;
  assert.deepEqual(effectiveDailyEdits(edits, restored), edits);
});

test('dated street additions appear in both the assistant snapshot and adjustment matching', () => {
  const { exercises, canAddExercise, getWorkoutExercises } = require('../src/data/catalog.ts');
  const { trainingDateKey, dailyWorkoutKey } = require('../src/data/sessionRecords.ts');
  const p = { ...profile, goal: 'street_mastery', frequency: 3, planId: undefined, levels: {} };
  const plan = getPlanDay(p, now), workoutId = plan.day.workoutId;
  assert.ok(workoutId);
  const before = getWorkoutExercises(workoutId, p, plan.cycle.setMultiplier, plan.cycle.dupDay, plan.cycle.week, { date: now });
  const extra = exercises.find(e => canAddExercise(e, p, [], now) && !before.some(i => i.id === e.id));
  assert.ok(extra);
  const edits = { [dailyWorkoutKey(trainingDateKey(now), workoutId)]: { exerciseIds: [extra.id] } };
  assert.ok(assistantTrainingSnapshot(p, [], edits, now).week.find(day => day.date === date).actions.some(i => i.id === extra.id));
  const draft = prepareTrainingAdjustment(p, [], edits, explicitTrainingIntent('今天' + extra.name + '改为7组'), now);
  assert.equal(draft.overlay.courses[date + ':' + workoutId].sets[extra.id], 7);
});

test('weight context uses calendar days, ignores invalid/future measurements and matches server schema', async () => {
  const history = Array.from({ length: 14 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - i); return { date: overlayDate(d), kg: i < 7 ? 75.2 : 75 }; });
  const p = { ...profile, weightHistory: [...history, history[0], { date: '2026-02-30', kg: 75 }, { date: '2026-10-03', kg: 100 }, { date, kg: NaN }] };
  const result = agentWeightContext(p, now);
  assert.equal(result.recentCount, 7); assert.equal(result.previousCount, 7); assert.equal(result.comparison, 'stable');
  const midnight = new Date(now); midnight.setHours(0, 1); assert.deepEqual(agentWeightContext(p, midnight), result);
  const { validateAdviceRequest } = await import('../server/validation.mjs');
  assert.deepEqual(validateAdviceRequest({ question: '体重趋势如何', context: { weightTrend: result } }).context.weightTrend, result);
  for (const patch of [{ recentCount: 8 }, { previousMean: null }, { comparison: 'changed' }])
    assert.throws(() => validateAdviceRequest({ question: '体重趋势如何', context: { weightTrend: { ...result, ...patch } } }));
  assert.equal(agentWeightContext({ ...profile, weightHistory: history.slice(0, 4) }, now).comparison, 'insufficient');
});
test('offline food rules require exact local names, preserve explicit amounts and never reinterpret complex dishes', () => {
  const intent = offlineFoodIntent('早餐吃了100克熟米饭');
  assert.equal(intent?.items[0].quantity, 100); assert.equal(intent.slot, 'breakfast');
  for (const text of ['明天吃了米饭', '没吃米饭', '吃了宫保鸡丁加饭加肉', '应该吃了100克米饭吗？', '吃了十十个鸡蛋']) assert.equal(offlineFoodIntent(text), null, text);
});
test('offline training queries return only actual supplied plans, not a completion claim', () => {
  const snapshot = assistantTrainingSnapshot(profile, [], {}, now);
  assert.match(offlineTrainingAnswer('今天练什么', snapshot), /本机课表/);
  assert.match(offlineTrainingAnswer('本周训练安排', snapshot), /本机周课表/);
  assert.equal(offlineTrainingAnswer('帮我完成今天全部训练', snapshot), null);
});
test('playlist URLs are allowlisted and never contain an autoplay guarantee or arbitrary destination', () => {
  assert.equal(playlistId('https://music.163.com/#/playlist?id=12345'), '12345');
  assert.equal(playlistId('12345'), '12345');
  for (const url of ['https://evil.test/playlist?id=1', 'http://music.163.com/playlist?id=1', 'orpheus://song/1', '0', 'https://user@music.163.com/playlist?id=1']) assert.equal(playlistId(url), null);
  assert.equal(musicURLs('123').native, 'orpheus://playlist/123'); assert.throws(() => musicURLs('123/play'));
  assert.equal(normalizeAgentPreferences(null).proactive, false);
});
test('event subscribers unsubscribe and cannot throw into a successful business write', () => {
  let count = 0; const end = subscribeAgentEvents(() => { count++; }), bad = subscribeAgentEvents(() => { throw Error('observer'); });
  const event = { kind: 'intake_saved', id: 'test', at: now.getTime() };
  assert.doesNotThrow(() => publishAgentEvent(event)); assert.equal(count, 1); end(); bad(); publishAgentEvent(event); assert.equal(count, 1);
});
test('proactive check-in is opt-in, uses actual sets and deduplicates through persisted dismissal', () => {
  const journal = emptyNutritionJournal(), session = { id: 'workout-1', workoutId: 'test', workoutName: 'QA', kind: 'strength', startedAt: new Date(now.getTime() - 90 * 60000).toISOString(), completedAt: new Date(now.getTime() - 60 * 60000).toISOString(), durationSeconds: 1800, totalReps: 10, exercises: [{ exerciseId: 'push_05', name: '俯卧撑', category: 'push', sets: [{ completed: true, reps: 10, unit: 'reps' }] }] };
  assert.equal(agentNudge(profile, journal, [session], now), null);
  journal.assistant.agentPreferences = { proactive: true, musicPlaylist: null, dismissed: [] };
  const nudge = agentNudge(profile, journal, [session], now); assert.equal(nudge?.id, 'training:workout-1'); assert.doesNotMatch(nudge.question, /30g|黄金窗口/);
  assert.equal(agentNudge(profile, journal, [{ ...session, exercises: [] }], now), null);
  journal.assistant.agentPreferences.dismissed = [nudge.id]; assert.equal(agentNudge(profile, journal, [session], now), null);
});
test('weight check-in requires enough unique real days and never announces a diagnosed plateau', () => {
  const journal = emptyNutritionJournal(); journal.assistant.agentPreferences = { proactive: true, musicPlaylist: null, dismissed: [] };
  const weights = Array.from({ length: 14 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - i); return { date: overlayDate(d), kg: 75 }; });
  const nudge = agentNudge({ ...profile, weightHistory: weights }, journal, [], now); assert.ok(nudge?.id.startsWith('weight:')); assert.match(nudge.question, /不直接判定/);
  assert.equal(agentNudge({ ...profile, weightHistory: weights.slice(0, 4) }, journal, [], now), null);
});
test('lightweight specialists route current intent ahead of ambient page text', async () => {
  const { routeAgent } = await import('../server/agent-router.mjs');
  assert.equal(routeAgent({ question: '早餐我没吃', harness: { scene: '训练中' } }), 'nutrition');
  assert.equal(routeAgent({ question: '本周训练安排' }), 'training');
  assert.equal(routeAgent({ question: '记得我的喜好吗' }), 'memory');
});
test('server rejects model-created training instructions not grounded in the current command', async () => {
  const { validateAssistantIntent } = await import('../server/assistant-intents.mjs');
  const question = '今天卧推改为4组', intent = explicitTrainingIntent(question);
  assert.deepEqual(validateAssistantIntent(intent, { assistantMode: true, question }), intent);
  assert.equal(validateAssistantIntent({ ...intent, sets: 20 }, { assistantMode: true, question }), null);
  assert.equal(validateAssistantIntent(intent, { assistantMode: true, question: '我肩有点不舒服' }), null);
});
