import type { DailyWorkoutEdits, Goal, Profile, Settings } from '../types';
import { normalizeDietPattern, normalizeNutritionGoal } from '../nutrition/legacyProfile';
import { progressionSeries } from '../data/progression';
import { PERSONAL_PLAN_ID, RETIRED_PLAN_ID, recommendPlanId } from '../data/trainingPlans';
import { preferredSessionMinutes } from '../data/trainingPrescription';
import { equipmentAvailableGear, equipmentFrequency, equipmentSplitConfig, equipmentTrainingDays, normalizeEquipmentOverrides } from '../data/equipmentTraining';
import { normalizeBodyMetrics } from '../nutrition/profileBody';
import { normalizeRunningGoal } from '../data/runGoals';
import { captureTrainingTopic } from '../data/trainingTopicProfiles';
import { exercises } from '../data/catalog';

export const defaultSettings: Settings = { vibration: true, restSeconds: 120 };
const exerciseIds = new Set(exercises.map(exercise => exercise.id));

export function normalizeSettings(raw: Partial<Settings> & Record<string, unknown>): Settings {
  const restSeconds = Number(raw.restSeconds);
  const runningGoal = normalizeRunningGoal(raw.runningGoal);
  return {
    vibration: raw.vibration !== false,
    restSeconds: Number.isFinite(restSeconds) ? Math.max(15, Math.min(300, Math.round(restSeconds))) : defaultSettings.restSeconds,
    ...(runningGoal ? { runningGoal } : {}),
  };
}

export function normalizeProfile(raw: Partial<Profile> & Record<string, unknown>): Profile {
  const legacyGoal: unknown = raw.goal;
  const goal: Profile['goal'] = legacyGoal === 'health' ? 'street_mastery'
    : legacyGoal === 'gain' || legacyGoal === 'strength' || legacyGoal === 'street_mastery' || legacyGoal === 'weight_loss' || legacyGoal === 'equipment'
      ? legacyGoal : 'fat_loss';
  const storedFrequency = Math.max(goal === 'equipment' ? 1 : 2, Math.min(6, Number(raw.frequency) || 3));
  const equipmentFrequencyStored = goal === 'equipment' ? storedFrequency : Number(raw.topicPlans?.equipment?.frequency) || (raw.equipmentTrainingDays?.length || 4);
  const equipmentSplit = equipmentSplitConfig({ frequency: equipmentFrequencyStored, equipmentSplit: raw.equipmentSplit });
  const frequency = goal === 'equipment' ? equipmentFrequency(storedFrequency, equipmentSplit) : goal === 'street_mastery' && ![2, 3, 6].includes(storedFrequency) ? 3 : storedFrequency;
  const experience: Profile['experience'] = raw.experience === 'intermediate' || raw.experience === 'advanced' || raw.experience === 'elite' || raw.experience === 'supermax'
    ? raw.experience
    : raw.experience === 'beginner'
      ? 'beginner'
      : frequency <= 2 ? 'beginner' : frequency <= 3 ? 'intermediate' : 'advanced';
  const routeKeys = new Set(progressionSeries.map(series => series.key));
  const levels = Object.fromEntries(Object.entries(raw.levels || {}).filter(([key]) => routeKeys.has(key))) as Record<string, number>;
  progressionSeries.forEach((series) => { if (!levels[series.key]) levels[series.key] = 1; });
  const planLevels = Object.fromEntries(Object.entries(raw.planLevels || {}).filter(([key]) => routeKeys.has(key))) as Record<string, number>;
  // Existing installs had no separate training variant; offer the common squat
  // starting point without changing verified progression levels.
  if (!raw.planLevels && (levels.squat || 1) === 1) planLevels.squat = 5;
  if (!raw.planLevels && (levels.pull || 1) > 2) planLevels.pull = 2;
  const restOptions = goal === 'street_mastery' ? [120, 180, 240, 300] : [90, 120, 150, 180, 240];
  const trainingRestSeconds = restOptions.includes(Number(raw.trainingRestSeconds)) ? Number(raw.trainingRestSeconds) : goal === 'street_mastery' ? 180 : 120;
  const storedPlanStart = typeof raw.planStartedAt === 'string' ? raw.planStartedAt : '';
  const planId = goal === 'street_mastery' && raw.planId === RETIRED_PLAN_ID ? RETIRED_PLAN_ID : recommendPlanId({ goal });
  const migratingLegacyPlan = (goal === 'weight_loss' && raw.planId !== PERSONAL_PLAN_ID) || (goal === 'equipment' && raw.planId !== planId);
  const planStartedAt = !migratingLegacyPlan && storedPlanStart && !Number.isNaN(Date.parse(storedPlanStart)) ? storedPlanStart : new Date().toISOString();
  const weightHistory = Array.isArray(raw.weightHistory)
    ? raw.weightHistory.filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry?.date) && Number.isFinite(entry?.kg) && entry.kg >= 30 && entry.kg <= 300).slice(-180)
    : [];
  const base: Omit<Profile, 'planId'> = {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : '训练者',
    ...normalizeBodyMetrics(raw),
    weightHistory,
    goal,
    nutritionGoal: normalizeNutritionGoal(raw.nutritionGoal || legacyGoal),
    dietPattern: normalizeDietPattern(raw.dietPattern),
    frequency,
    sessionMinutes: goal === 'equipment' ? undefined : preferredSessionMinutes(raw),
    levels,
    planLevels,
    trainingRestSeconds,
    neckBridgeConsent: raw.neckBridgeConsent === true && (levels.bridge || 1) >= 6,
    experience,
    equipmentSplit,
    equipmentTrainingDays: equipmentTrainingDays({ frequency: equipmentFrequencyStored, equipmentSplit, planStartedAt: goal === 'equipment' ? planStartedAt : raw.topicPlans?.equipment?.planStartedAt || planStartedAt, equipmentTrainingDays: Array.isArray(raw.equipmentTrainingDays) ? raw.equipmentTrainingDays : undefined }),
    equipmentAvailableGear: equipmentAvailableGear({ equipmentAvailableGear: Array.isArray(raw.equipmentAvailableGear) ? raw.equipmentAvailableGear : undefined }),
    equipmentPriority: ['chest', 'shoulders', 'back', 'legs', 'core', 'arms'].includes(String(raw.equipmentPriority)) ? raw.equipmentPriority as Profile['equipmentPriority'] : 'balanced',
    equipmentMovementOverrides: normalizeEquipmentOverrides(raw.equipmentMovementOverrides),
    planStartedAt,
  };
  const normalized: Profile = { ...base, planId };
  const topicPlans: NonNullable<Profile['topicPlans']> = {};
  const goals: Goal[] = ['weight_loss', 'fat_loss', 'gain', 'strength', 'street_mastery', 'equipment'];
  if (raw.topicPlans && typeof raw.topicPlans === 'object' && !Array.isArray(raw.topicPlans)) {
    for (const topic of goals) {
      const config = raw.topicPlans[topic];
      if (topic !== goal && config && typeof config === 'object' && !Array.isArray(config)) {
        topicPlans[topic] = captureTrainingTopic(normalizeProfile({ ...normalized, ...config, goal: topic, topicPlans: undefined }));
      }
    }
  }
  return { ...normalized, topicPlans: { ...topicPlans, [goal]: captureTrainingTopic(normalized) } };
}

export function normalizeDailyEdits(input: unknown): DailyWorkoutEdits {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('日程文件结构无法识别。');
  return Object.fromEntries(Object.entries(input).flatMap(([key, edit]) => {
    if (!edit || typeof edit !== 'object' || typeof edit.date !== 'string' || typeof edit.workoutId !== 'string'
      || !Array.isArray(edit.exerciseIds) || !edit.exerciseIds.every((id: unknown) => typeof id === 'string')) {
      throw new Error('日程记录存在无法安全加载的条目。');
    }
    const retainedIds = [...new Set<string>(edit.exerciseIds.filter((id: string) => exerciseIds.has(id)))];
    return retainedIds.length ? [[key, { date: edit.date, workoutId: edit.workoutId, exerciseIds: retainedIds }]] : [];
  }));
}
