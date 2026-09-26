import type { Exercise, Profile, TrainingSession, Workout } from '../types';
import { preferredSessionMinutes, prescribeWorkout, prescribeAddedExercise } from './trainingPrescription';
import { headstandReadiness, usesHeadstandGate } from './sessionRecords';
import { supportExercises } from './supportExercises';
import { coreFinalSteps } from './progressionRoutes';
import { RETIRED_PLAN_ID } from './trainingPlans';

// The original mini-program actions and newer street-skill actions share one catalogue.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rawExercises = require('./legacy/exercises.js') as Exercise[];
// eslint-disable-next-line @typescript-eslint/no-require-imports
const templates = require('./legacy/templates.js') as { workouts: Record<string, Workout> };

export const exercises: Exercise[] = [...rawExercises, ...supportExercises];
export const workouts = templates.workouts;

export const categories = [
  { key: 'all', label: '全部', icon: '◉' },
  { key: 'push', label: '俯卧撑', icon: '↗' },
  { key: 'pull', label: '引体', icon: '↥' },
  { key: 'squat', label: '深蹲', icon: '⌄' },
  { key: 'legRaise', label: '举腿', icon: '⌁' },
  { key: 'bridge', label: '桥', icon: '⌒' },
  { key: 'hspu', label: '倒立撑', icon: '↑' },
  { key: 'support', label: '辅助', icon: '△' },
  { key: 'power', label: '爆发力', icon: 'ϟ' },
  { key: 'skills', label: '街头技巧', icon: '⇧' },
];

const aliases: Record<string, string[]> = {
  push: ['push'],
  pull: ['pull'],
  squat: ['squat'],
  legRaise: ['legRaise', 'leg_raise'],
  bridge: ['bridge'],
  hspu: ['hspu', 'handstand_pushup'],
  auxiliary: ['auxiliary'],
  calf: ['auxiliary', 'calf'],
  hang_grip: ['hang_grip'],
  neck: ['neck'],
  dead_hang: ['hang_grip'],
  trifecta_bridge: ['trifecta'],
  trifecta_lHold: ['trifecta'],
  trifecta_twist: ['trifecta'],
  support: ['auxiliary', 'flag_clutch', 'flag_press', 'hang_grip', 'trifecta', 'neck'],
  power: ['power_push', 'power_pushup', 'power_jump', 'power_pull', 'kip_up', 'front_flip', 'back_flip'],
  skills: ['front_lever', 'planche', 'back_lever', 'muscle_up', 'l_sit', 'human_flag'],
  front_lever: ['front_lever'],
  planche: ['planche'],
  back_lever: ['back_lever'],
  muscle_up: ['muscle_up'],
  l_sit: ['l_sit'],
  human_flag: ['human_flag'],
};

export function categoryMatches(exercise: Exercise, category: string) {
  if (category === 'all') return true;
  return (aliases[category] || [category]).includes(exercise.category);
}

export function categoryLabel(category: string) {
  const match = categories.find((item) => item.key === category);
  return match?.label || category;
}

export function selectExercise(category: string, profile: Profile): Exercise | undefined {
  // New prescriptions use the single-leg floor variant; old IDs remain for history.
  if (category === 'aux_calfBeginner') category = 'aux_singleLegCalf';
  const support = supportExercises.find((exercise) => exercise.id === category);
  if (support) return support;
  if (category === 'dead_hang') {
    return exercises.find((item) => item.id === 'hang_01');
  }
  if (category === 'trifecta_bridge') {
    return exercises.find((item) => item.id === 'trifecta_bridge');
  }
  if (category === 'trifecta_lHold') {
    return exercises.find((item) => item.id === 'trifecta_lHold');
  }
  if (category === 'trifecta_twist') {
    return exercises.find((item) => item.id === 'trifecta_twist');
  }
  if (category === 'calf') {
    const calfEx = exercises.find((item) => item.id === 'aux_singleLegCalf');
    if (calfEx) return calfEx;
  }
  const verifiedLevel = profile.levels[category] || 1;
  const desiredStep = profile.planLevels?.[category] || Math.min(verifiedLevel, coreFinalSteps[category] || verifiedLevel);
  const matches = exercises
    .filter((item) => categoryMatches(item, category))
    .sort((left, right) => (left.step || 999) - (right.step || 999));
  const exact = matches.find((item) => item.step === desiredStep);
  if (exact) return exact;
  const highestStepped = [...matches].reverse().find((item) => typeof item.step === 'number');
  if (highestStepped && desiredStep > (highestStepped.step || 0)) return highestStepped;
  return matches[0];
}

export function getWorkout(id: string): Workout | undefined {
  if (id === 'custom_daily') return { id, name: '今日自选训练', description: '仅限今天的自选动作', estimatedMinutes: 0, slots: [] };
  return workouts[id];
}

export type WorkoutContext = { sessions?: readonly TrainingSession[]; date?: Date; addedExerciseIds?: readonly string[] };

// Self-reported preparation and explicit consent, not an automatic medical clearance.
export function canPlanNeckBridges(profile: Profile) {
  return (profile.levels.bridge || 1) >= 6 && profile.neckBridgeConsent === true;
}

export function workoutDisplayTitle(title: string, items: readonly Exercise[]) {
  const preparation = items.some((item) => item.category === 'push')
    && items.some((item) => item.id === 'neck_handResistance' || item.category === 'neck')
    && !items.some((item) => item.category === 'hspu');
  return preparation ? title.replace(/倒立撑?/g, '俯卧撑与颈部准备') : title;
}

export function canAddExercise(exercise: Exercise, profile: Profile, sessions: readonly TrainingSession[] = [], date = new Date()) {
  if (exercise.category === 'neck' && !canPlanNeckBridges(profile)) return false;
  return !(usesHeadstandGate(profile) && exercise.category === 'hspu' && !headstandReadiness(sessions, date).unlocked);
}

export function getWorkoutExercises(id: string, profile: Profile, setMultiplier = 1, dupDay?: import('./trainingPlans').DupDay, cycleWeek = 1, context: WorkoutContext = {}) {
  if (id === 'custom_daily') return (context.addedExerciseIds || []).flatMap((exerciseId) => {
    const exercise = exercises.find((item) => item.id === exerciseId);
    return exercise && canAddExercise(exercise, profile, context.sessions, context.date) ? [prescribeAddedExercise(exercise, profile)] : [];
  });
  if (!workouts[id]) return [];
  const prisoner = profile.goal === 'street_mastery' && id.startsWith('prisoner');
  if (prisoner && profile.planId === RETIRED_PLAN_ID) return [];
  if (!prisoner && !(profile.goal === 'weight_loss' && !id.startsWith('prisoner'))) return [];
  const workout = workouts[id];
  const minutes = preferredSessionMinutes(profile);
  const isSupermax = prisoner && profile.experience === 'supermax';
  const isElite = prisoner && profile.experience === 'elite';
  const isVeterano = prisoner && profile.frequency === 6 && !isElite && !isSupermax;
  const isGoodOlIron = prisoner && (profile.experience === 'intermediate' || profile.frequency === 3);
  const maxExercises = isVeterano
    ? ({ 20: 1, 30: 2, 45: 3, 60: 4, 75: 5 } as Record<number, number>)[minutes]
    : ({ 20: 2, 30: 3, 45: 4, 60: 5, 75: 6 } as Record<number, number>)[minutes];
  const rotateShort = minutes === 20 && cycleWeek % 2 === 0;
  const patterns: Record<string, string[]> = {
    fullA: rotateShort
      ? ['push', 'legRaise', 'squat', 'pull', 'bridge', 'auxiliary']
      : ['squat', 'push', 'pull', 'bridge', 'legRaise', 'auxiliary'],
    fullB: rotateShort
      ? ['squat', 'pull', 'bridge', 'push', 'legRaise', 'auxiliary']
      : ['pull', 'bridge', 'squat', 'push', 'legRaise', 'auxiliary'],
    fullComprehensive: ['squat', 'push', 'pull', 'legRaise', 'bridge', 'auxiliary'],
    // 阶段 I 初试身手 (2练): A=推+腹, B=拉+腿
    // 阶段 II 渐入佳境 (3练): A=推+腹, B=拉+腿, C=倒立+桥 (纯正六艺闭环)
    // 阶段 III 炉火纯青 (6练 一日一艺): C=拉, E=桥, F=倒立, D=举腿, B=深蹲, A=推
    // 阶段 IV 闭关修炼 (6练 双循环大课):
    // B/D: 拉+蹲+握力, A/E: 推+腹+小腿, C/F: 倒立+桥+颈部
    // 阶段 V 登峰造极 (6练 超级耐力):
    // B/D: 拉+蹲, A/E: 推+腹, C/F: 倒立+桥
    prisonerA: isElite ? ['push', 'legRaise', 'calf'] : isVeterano ? ['push'] : ['push', 'legRaise'],
    prisonerB: isElite ? ['pull', 'squat', 'hang_grip'] : isVeterano ? ['squat'] : ['pull', 'squat'],
    prisonerC: isElite ? ['hspu', 'bridge', 'neck'] : isVeterano ? ['pull'] : ['hspu', 'bridge'],
    prisonerD: isElite ? ['pull', 'squat', 'hang_grip'] : isVeterano ? ['legRaise'] : ['pull', 'squat'],
    prisonerE: isElite ? ['push', 'legRaise', 'calf'] : isVeterano ? ['bridge'] : ['push', 'legRaise'],
    prisonerF: isElite ? ['hspu', 'bridge', 'neck'] : isVeterano ? ['hspu'] : ['hspu', 'bridge'],
    // 恢复课动作槽位映射
    prisoner_recovery_phase1: ['recovery_shortBridge', 'recovery_bentHold', 'recovery_easyTwist'],
    prisoner_recovery_trifecta: ['dead_hang', 'trifecta_bridge', 'trifecta_lHold', 'trifecta_twist'],
    prisoner_recovery_elite: ['dead_hang', 'trifecta_bridge', 'trifecta_lHold', 'trifecta_twist'],
  };
  const headstandLocked = usesHeadstandGate(profile) && !headstandReadiness(context.sessions || [], context.date).unlocked;
  const neckPreparation = canPlanNeckBridges(profile) ? ['neck_01', 'neck_03'] : ['neck_handResistance'];
  const replacingInversion = headstandLocked && (patterns[workout.id] || []).includes('hspu');
  const unfilteredCategories = [...new Set((patterns[workout.id] || [])
    .filter((category) => !prisoner || category !== 'bridge' || profile.frequency === 6 || profile.frequency === 3)
    .flatMap((category) => category === 'hspu' && headstandLocked ? ['push', ...neckPreparation]
      : category === 'neck' ? neckPreparation : [category]))];
  const selectedCategories = prisoner ? unfilteredCategories : unfilteredCategories.slice(0, maxExercises);
  const templateSlots = new Map(workout.slots.map((slot) => [slot.category, slot]));
  const highBmi = profile.weight / ((profile.height / 100) ** 2) >= 30;
  const plannedExercise = (category: string) => {
    if (category === 'neck_01' || category === 'neck_03') return exercises.find((item) => item.id === category);
    if (category === 'hspu' && usesHeadstandGate(profile) && (profile.levels.hspu || 1) === 1) return exercises.find((item) => item.id === 'hspu_01');
    const chosen = selectExercise(category, profile);
    if (prisoner && chosen && chosen.riskLevel === 'high' && (chosen.step || 0) > (profile.levels[category] || 1)) {
      return exercises.filter((exercise) => categoryMatches(exercise, category)
        && (exercise.step || 0) <= (profile.levels[category] || 1)
        && exercise.riskLevel !== 'high')
        .sort((left, right) => (right.step || 0) - (left.step || 0))[0] || chosen;
    }
    if (!highBmi || !chosen || chosen.riskLevel !== 'high') return chosen;
    // A user-selected high-risk variant stays available in the action library,
    // but the automatic high-BMI courses use a lower-risk form to protect joints.
    return exercises.filter((exercise) => categoryMatches(exercise, category)
      && (exercise.step || 0) <= (chosen.step || 0)
      && exercise.riskLevel !== 'high')
      .sort((left, right) => (right.step || 0) - (left.step || 0))[0] || chosen;
  };
  const selected = selectedCategories.map((category) => ({ category, exercise: plannedExercise(category) }))
    .filter((item): item is { category: string; exercise: Exercise } => !!item.exercise);
  const slots = selected.map(({ category, exercise }) => ({
    ...(templateSlots.get(category) || { id: category, category, priority: 1 }),
    priority: prisoner ? 1 : (templateSlots.get(category)?.priority || 1),
    exercise,
  }));
  if (prisoner) {
    if (workout.id === 'prisoner_recovery_phase1') {
      slots.forEach((slot) => {
        slot.prescription = { sets: slot.exercise.defaultPrescription?.sets || 2, restSeconds: slot.exercise.defaultPrescription?.restSeconds || 45 };
      });
    } else if (workout.id === 'prisoner_recovery_trifecta') {
      slots.forEach((slot) => {
        if (slot.category === 'dead_hang') {
          slot.prescription = { sets: 2, restSeconds: 60 };
        } else {
          slot.prescription = { sets: 2, restSeconds: 45 };
        }
      });
    } else if (workout.id === 'prisoner_recovery_elite') {
      slots.forEach((slot) => {
        if (slot.category === 'dead_hang') {
          slot.prescription = { sets: 2, restSeconds: 60 };
        } else {
          slot.prescription = { sets: 2, restSeconds: 60 };
        }
      });
    } else if (isSupermax) {
      slots.forEach((slot) => { slot.prescription = { sets: 10, restSeconds: 45 }; });
    } else if (isElite) {
      slots.forEach((slot) => {
        if (slot.category === 'calf') {
          slot.prescription = { sets: 2, restSeconds: 60 };
        } else if (slot.category === 'hang_grip') {
          slot.prescription = { sets: 3, restSeconds: 90 };
        } else {
          slot.prescription = { sets: 4, restSeconds: 120 };
        }
      });
    } else if (isGoodOlIron) {
      slots.forEach((slot) => { slot.prescription = { sets: 2, restSeconds: 120 }; });
    } else {
      slots.forEach((slot) => { slot.prescription = { sets: 3, restSeconds: 120 }; });
    }
  }
  const resolved = { ...workout, slots };
  const effectiveMultiplier = Number.isFinite(setMultiplier) && setMultiplier > 0 ? setMultiplier : 1;
  const items = prescribeWorkout(resolved, profile, workout.id === 'prisoner_recovery_phase1' || isGoodOlIron ? 1 : effectiveMultiplier, dupDay);
  // Preparatory work never inherits endurance-stage volume or cycle multipliers.
  for (const item of items) {
    if (neckPreparation.includes(item.id)) {
      item.targetSets = 1;
      item.targetValue = item.id === 'neck_handResistance' ? 10 : 3;
      item.restSeconds = 120;
      item.priority = 4;
    }
    if (replacingInversion && item.category === 'push') {
      item.targetSets = isGoodOlIron ? 2 : 3;
      item.restSeconds = Math.max(120, profile.trainingRestSeconds || 120);
    }
  }
  // Neck work follows the normal bridge work; never precedes the main exercises.
  items.sort((a, b) => (neckPreparation.indexOf(a.id) + 1) - (neckPreparation.indexOf(b.id) + 1));
  for (const exerciseId of context.addedExerciseIds || []) {
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (exercise && !items.some((item) => item.id === exerciseId) && canAddExercise(exercise, profile, context.sessions, context.date)) items.push(prescribeAddedExercise(exercise, profile));
  }
  return items;
}
