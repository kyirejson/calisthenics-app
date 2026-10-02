import type { Profile, TrainingSession } from '../types';
import { localWeightDate, summarizeWeightTrend } from '../data/weightTrend';
import { calculateTargets, normalizeNutritionPreferences, sumNutrients } from './engine';
import { meaningfulTrainingSessions } from './training';
import { photoUsesOnlyLabels } from './vision';
import { emptyNutritionDay, MEAL_SLOTS, normalizeTargetSnapshot } from './state';
import { isValidDateKey, offsetDate, validTimestamp, dateAtNoon } from './validation';
import type { MealSlot, Nutrients, NutritionDayState, NutritionJournal, NutritionTargetSnapshot, NutritionTrainingContext } from './types';

export function createNutritionTargetSnapshot(profile: Profile, journal: NutritionJournal, training: NutritionTrainingContext, now = new Date().toISOString()): NutritionTargetSnapshot {
  const prefs = normalizeNutritionPreferences(journal.preferences);
  const targets = calculateTargets(profile, prefs);
  const bounded = (value: number, max: number) => Number.isFinite(value) && value >= 0 && value <= max ? value : 0;
  const body = { age: bounded(profile.age, 100), sex: profile.sex, height: bounded(profile.height, 300), weight: bounded(profile.weight, 500) };
  const planned = { type: training.type, title: training.title, plannedMinutes: training.plannedMinutes, time: journal.trainingTime };
  const snapshot: NutritionTargetSnapshot = {
    signature: JSON.stringify(['nutrition-target-history-1', body, targets, prefs ? { ...prefs, screeningCompletedAt: Boolean(prefs.screeningCompletedAt) } : null, planned]),
    capturedAt: now, targets, body, objective: prefs?.objective ?? null, pattern: prefs?.pattern ?? null, activity: prefs?.activity ?? null, training: planned,
  };
  const valid = normalizeTargetSnapshot(snapshot);
  if (!valid) throw new Error('目标快照无法保存，请核对营养和训练资料。');
  return valid;
}

/** Only today's observed target is captured; never fabricate targets for old logs. */
export function withDailyTargetSnapshot(current: NutritionJournal, date: string, snapshot: NutritionTargetSnapshot): NutritionJournal {
  const valid = normalizeTargetSnapshot(snapshot);
  if (!isValidDateKey(date) || !valid || localWeightDate(new Date(valid.capturedAt)) !== date) throw new Error('只能保存当天实际生成的目标快照。');
  const day = current.days[date] || emptyNutritionDay();
  if (day.targetHistory.at(-1)?.signature === valid.signature) return current;
  const last = day.targetHistory.at(-1);
  const capturedAt = last && last.capturedAt > valid.capturedAt ? last.capturedAt : valid.capturedAt;
  const history = [...day.targetHistory, { ...valid, capturedAt }];
  const targetHistory = history.length > 64 ? [history[0], ...history.slice(-63)] : history;
  const days = { ...current.days, [date]: { ...day, targetHistory } };
  const retained = Object.fromEntries(Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).slice(-1095));
  return { ...current, days: retained };
}

export function withMealLoggingConfirmation(current: NutritionJournal, date: string, slot: MealSlot | 'day', confirmed: boolean, now = new Date().toISOString()): NutritionJournal {
  if (!isValidDateKey(date) || !validTimestamp(now) || date > localWeightDate(new Date(now))
    || (slot !== 'day' && !MEAL_SLOTS.includes(slot)) || typeof confirmed !== 'boolean') throw new Error('只能确认今天或过去的有效饮食记录。');
  const day = current.days[date] || emptyNutritionDay();
  const confirmedSlots = slot === 'day' ? confirmed ? [...MEAL_SLOTS] : []
    : MEAL_SLOTS.filter(item => item === slot ? confirmed : day.confirmedSlots.includes(item));
  const completedAt = confirmedSlots.length === MEAL_SLOTS.length ? day.completedAt || now : null;
  return { ...current, days: { ...current.days, [date]: { ...day, confirmedSlots, completedAt } } };
}

/** Any log edit invalidates completeness, including edits to another date/slot. */
export function invalidateMealLogging(current: NutritionJournal, date: string, slot: MealSlot): NutritionJournal {
  const day = current.days[date];
  if (!day || (!day.completedAt && !day.confirmedSlots.includes(slot))) return current;
  return { ...current, days: { ...current.days, [date]: { ...day, confirmedSlots: day.confirmedSlots.filter(item => item !== slot), completedAt: null } } };
}

export function latestNutritionTarget(journal: NutritionJournal, date: string): NutritionTargetSnapshot | null { return journal.days[date]?.targetHistory.at(-1) || null; }

export type WeeklyNutritionReview = {
  start: string; end: string;
  days: Array<{ date: string; state: 'missing' | 'partial' | 'complete'; calories: number; hasPhoto: boolean; target: NutritionTargetSnapshot | null }>;
  completeDays: number; comparableDays: number; recordedDays: number; photoDays: number; trainingDays: number; trainingMinutes: number;
  status: 'insufficient' | 'ready' | 'goal_changed' | 'paused';
  average: Nutrients | null; referenceCalories: number | null; referenceProtein: number | null;
  comparisonAverage: Nutrients | null;
  insights: string[];
};

function mixedPurpose(day: NutritionDayState): boolean {
  return new Set(day.targetHistory.map(item => `${item.objective}:${item.pattern}:${item.targets.status}`)).size > 1;
}

export function summarizeNutritionWeek(journal: NutritionJournal, profile: Profile, sessions: TrainingSession[], end = localWeightDate(new Date())): WeeklyNutritionReview {
  const dates = Array.from({ length: 7 }, (_, i) => offsetDate(end, i - 6));
  const items = dates.map(date => {
    const entries = journal.entries.filter(entry => entry.date === date);
    const complete = Boolean(journal.days[date]?.completedAt);
    return { date, state: complete ? 'complete' as const : entries.length ? 'partial' as const : 'missing' as const,
      calories: sumNutrients(entries.map(entry => entry.nutrients)).calories,
      hasPhoto: entries.some(entry => entry.source === 'photo_estimate' && !photoUsesOnlyLabels(entry.photoEstimate)), target: latestNutritionTarget(journal, date) };
  });
  const complete = items.filter(day => day.state === 'complete');
  const comparable = complete.filter(day => day.target?.targets.status === 'ready');
  const purposes = new Set(comparable.map(day => `${day.target!.objective}:${day.target!.pattern}`));
  const currentPurpose = journal.preferences ? `${journal.preferences.objective}:${journal.preferences.pattern}` : '';
  const goalChanged = purposes.size > 1 || [...purposes].some(purpose => purpose !== currentPurpose)
    || comparable.some(day => mixedPurpose(journal.days[day.date]));
  const current = calculateTargets(profile, journal.preferences);
  const status = current.status !== 'ready' ? 'paused' : goalChanged ? 'goal_changed' : comparable.length < 4 ? 'insufficient' : 'ready';
  const average = complete.length ? Object.fromEntries(Object.entries(sumNutrients(journal.entries.filter(entry => complete.some(day => day.date === entry.date)).map(entry => entry.nutrients)))
    .map(([key, value]) => [key, Math.round(value / complete.length * 10) / 10])) as Nutrients : null;
  // Comparison averages must use the SAME set of complete days with observed targets.
  const comparedEntries = journal.entries.filter(entry => comparable.some(day => day.date === entry.date));
  const compared = comparable.length ? sumNutrients(comparedEntries.map(entry => entry.nutrients)) : null;
  const comparisonAverage = compared ? Object.fromEntries(Object.entries(compared).map(([key, value]) => [key, Math.round(value / comparable.length * 10) / 10])) as Nutrients : null;
  const referenceCalories = status === 'ready' ? Math.round(comparable.reduce((sum, day) => sum + day.target!.targets.calories, 0) / comparable.length) : null;
  const referenceProtein = status === 'ready' ? Math.round(comparable.reduce((sum, day) => sum + day.target!.targets.protein, 0) / comparable.length) : null;
  const insights: string[] = [];
  if (status === 'paused') insights.push('自动目标暂停，复盘只展示记录，不据此调整热量。请在营养助手中核对健康情况与饮食偏好。');
  else if (status === 'goal_changed') insights.push('本周存在不同目标或饮食方式，不混算达标率，也不据此改低或改高能量目标。');
  else if (status === 'insufficient') insights.push(`有 ${complete.length} 天明确记完，${comparable.length} 天同时保存了目标。至少积累 4 天可比较记录，再讨论摄入趋势；漏记不算少吃。`);
  else {
    const ratio = compared!.calories / comparable.length / referenceCalories!;
    insights.push(ratio < 0.85 ? '完整记录的平均能量低于当日参考，先核对份量、饮料和用油是否漏记，并观察饥饿感与训练表现；不强制一餐补齐。'
      : ratio > 1.15 ? '完整记录的平均能量高于当日参考，先核对份量与标签；下一餐正常吃，不用不吃饭或额外运动补偿。'
      : '完整记录的能量与参考相近，继续观察趋势，不因单日体重波动追着改餐。');
    if (compared!.protein / comparable.length < referenceProtein! * 0.85) insights.push('完整记录的蛋白质低于参考。优先在常规餐次选择适合自己的蛋白质食物，而不是集中补剂。');
  }
  const weightTrend = summarizeWeightTrend(profile.weightHistory, dateAtNoon(end));
  if (weightTrend.changePercent !== undefined && Math.abs(weightTrend.changePercent) > 1) insights.push('两周均重变化较大，先核对称重条件与身体感受，不自动调整能量；持续不适或非预期变化请咨询专业人员。');
  if (items.some(day => day.hasPhoto)) insights.push('本周含照片估算，油量、份量和隐藏配料仍有误差。');
  const training = dates.flatMap(date => meaningfulTrainingSessions(sessions, date));
  return {
    start: dates[0], end, days: items, completeDays: complete.length, comparableDays: comparable.length,
    recordedDays: items.filter(day => day.state !== 'missing').length, photoDays: items.filter(day => day.hasPhoto).length,
    trainingDays: dates.filter(date => meaningfulTrainingSessions(sessions, date).length).length,
    trainingMinutes: Math.round(training.reduce((sum, session) => sum + Math.max(0, Number.isFinite(session.durationSeconds) ? session.durationSeconds : 0), 0) / 60),
    status, average, comparisonAverage, referenceCalories, referenceProtein, insights,
  };
}
