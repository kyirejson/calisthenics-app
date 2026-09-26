import type { Exercise, Profile, Workout } from '../types';
import type { DupDay } from './trainingPlans';
import { warmupDuration } from './trainingWarmup';

export type TargetUnit = 'reps' | 'seconds' | 'steps' | 'meters';
export type PrescribedExercise = Exercise & {
  targetSets: number;
  targetValue: number;
  targetUnit: TargetUnit;
  restSeconds: number;
  priority?: number;
};
type ResolvedWorkout = Omit<Workout, 'slots'> & { slots: Array<Workout['slots'][number] & { exercise?: Exercise }> };

export type SessionEstimate = {
  warmupSeconds: number;
  workSeconds: number;
  restSeconds: number;
  transitionsSeconds: number;
  cooldownSeconds: number;
  totalSeconds: number;
  totalMinutes: number;
};

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

const skillCategories = new Set(['front_lever', 'planche', 'back_lever', 'muscle_up', 'l_sit', 'human_flag']);
export const isSkillCategory = (category: string) => skillCategories.has(category);

export function preferredSessionMinutes(profile: Pick<Profile, 'sessionMinutes'>) {
  const value = Number(profile.sessionMinutes);
  return [20, 30, 45, 60, 75].includes(value) ? value : 45;
}

function baseTarget(exercise: Exercise): { unit: TargetUnit; value: number } {
  if (exercise.id === 'neck_handResistance' || exercise.category === 'neck') return { unit: 'reps', value: exercise.defaultPrescription?.repRange?.[0] || 3 };
  const enriched = exercise as Exercise & { isHold?: boolean; defaultPrescription?: NonNullable<Exercise['defaultPrescription']> & { holdRange?: number[] } };
  const standards = Object.values(exercise.standards || {}).join(' ');
  if (enriched.isHold || enriched.defaultPrescription?.holdRange?.length) {
    return { unit: 'seconds', value: enriched.defaultPrescription?.holdRange?.[0] || readValue(exercise.standards?.beginner, '秒') || 15 };
  }
  if (standards.includes('米')) return { unit: 'meters', value: readValue(exercise.standards?.beginner, '米') || 8 };
  if (standards.includes('步')) return { unit: 'steps', value: exercise.defaultPrescription?.repRange?.[0] || 8 };
  return { unit: 'reps', value: exercise.defaultPrescription?.repRange?.[0] || 8 };
}

function readValue(text: string | undefined, suffix: string) {
  const match = text?.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${suffix}`));
  return match ? Number(match[1]) : 0;
}

function practicalTarget(exercise: Exercise, base: number, unit: TargetUnit) {
  if (exercise.id === 'aux_calfBeginner' || exercise.id === 'aux_singleLegCalf') return 20;
  if (exercise.id === 'aux_neckNeutral' || exercise.id === 'recovery_bentHold') return 5;
  if (exercise.id === 'recovery_shortBridge' || exercise.id === 'recovery_easyTwist') return 10;
  // Legacy book standards are mastery tests, not a safe first-session dose.
  if (unit === 'seconds') {
    if (exercise.category === 'hang_grip') return clamp(base, 10, 60);
    if (exercise.category === 'trifecta') return clamp(base, 5, 30);
    return clamp(Math.min(base, exercise.category === 'hspu' ? 10 : 20), 3, 30);
  }
  if (unit === 'meters') return base;
  if (unit === 'steps') return Math.min(base, 12);
  if (exercise.id === 'aux_calfRaise' || exercise.category === 'calf') {
    // CC2 Chapter 11: High endurance (30~50 reps) for calves
    return Math.max(base, 30);
  }
  return Math.min(base, exercise.step && exercise.step <= 2 ? 12 : 10);
}

function workTime(item: PrescribedExercise) {
  if (item.targetUnit === 'seconds') {
    const sides = item.id === 'aux_neckNeutral' ? 4 : item.id === 'recovery_easyTwist' ? 2 : 1;
    return clamp(item.targetValue * sides + 12, 20, 600);
  }
  if (item.targetUnit === 'meters') return clamp(item.targetValue * 2, 20, 600);
  const tempo = item.defaultPrescription?.tempoDescription || '';
  const phases = [...tempo.matchAll(/(\d+(?:\.\d+)?)\s*秒/g)].map((match) => Number(match[1]));
  const secondsPerRep = phases.length >= 2 ? clamp(phases.reduce((sum, seconds) => sum + seconds, 0), 2, 12) : 3;
  const directions = item.id === 'neck_03' || item.id === 'neck_04' ? 3 : 1;
  return clamp(item.targetValue * secondsPerRep * directions + 12, 25, 600);
}

export function estimateStrengthSession(items: PrescribedExercise[], sessionMinutes = 45, prisoner = false): SessionEstimate {
  const isMicroSession = prisoner && items.length === 1;
  const cooldownByMinutes: Record<number, number> = prisoner
    ? { 20: 3, 30: 4, 45: 5, 60: 7, 75: 9 }
    : { 20: 2, 30: 3, 45: 4, 60: 5, 75: 5 };
  const warmupSeconds = warmupDuration(items);
  const cooldownSeconds = isMicroSession ? 90 : (cooldownByMinutes[sessionMinutes] || 4) * 60;
  const workSeconds = items.reduce((sum, item) => sum + item.targetSets * workTime(item), 0);
  const restSeconds = items.reduce((sum, item) => sum + Math.max(0, item.targetSets - 1) * item.restSeconds, 0);
  const transitionsSeconds = Math.max(0, items.length - 1) * 60;
  const totalSeconds = warmupSeconds + workSeconds + restSeconds + transitionsSeconds + cooldownSeconds;
  return { warmupSeconds, workSeconds, restSeconds, transitionsSeconds, cooldownSeconds, totalSeconds, totalMinutes: Math.ceil(totalSeconds / 60) };
}

function targetSets(main: boolean, minutes: number, setMultiplier: number): number {
  const longSession = minutes >= 45;
  const sets = main && longSession ? 3 : 2;
  return clamp(Math.round(sets * setMultiplier), setMultiplier < 0.8 ? 1 : 2, 4);
}

function targetRest(profile: Profile, isHold: boolean): number {
  const preference = profile.trainingRestSeconds || (profile.goal === 'street_mastery' ? 180 : 120);
  const minimum = isHold ? 120 : 90;
  return clamp(Math.max(preference, minimum), 90, 300);
}

export function prescribeWorkout(
  workout: ResolvedWorkout,
  profile: Profile,
  setMultiplier = 1,
  _dupDay: DupDay = 'volume',
): PrescribedExercise[] {
  const availableMinutes = preferredSessionMinutes(profile);
  const seen = new Set<string>();
  const items = workout.slots.flatMap((slot) => {
    const exercise = slot.exercise;
    if (!exercise || seen.has(exercise.id)) return [];
    seen.add(exercise.id);
    const target = baseTarget(exercise);
    const main = slot.priority === 1;
    const enriched = exercise as Exercise & { isHold?: boolean };
    const isHold = !!enriched.isHold || target.unit === 'seconds';

    const skill = isSkillCategory(exercise.category);
    const prisoner = profile.goal === 'street_mastery' && workout.id.startsWith('prisoner');
    const isSupermax = prisoner && profile.experience === 'supermax';
    const sets = isSupermax
      ? 10
      : prisoner
      ? Math.max(1, Math.round((slot.prescription?.sets || 2) * setMultiplier))
      : skill
      ? clamp(Math.round((profile.experience === 'advanced' && availableMinutes >= 75 ? 3 : 2) * setMultiplier), setMultiplier < 0.8 ? 1 : 2, 3)
      : targetSets(main, availableMinutes, setMultiplier);
    const restSeconds = isSupermax
      ? 45
      : prisoner && slot.prescription?.restSeconds
      ? slot.prescription.restSeconds
      : Math.max(targetRest(profile, isHold), skill ? 150 : 0);
    const practical = isSupermax && target.unit === 'reps'
      ? 10
      : isSupermax && exercise.id === 'hang_01' ? 30
      : practicalTarget(exercise, target.value, target.unit);
    const targetValue = practical;

    return [{ ...exercise, targetSets: sets, restSeconds, targetUnit: target.unit, targetValue, priority: slot.priority }];
  });
  // Keep demanding movements before accessories, but preserve flow for recovery sessions.
  if (!workout.id.startsWith('prisoner_recovery')) {
    items.sort((a, b) => {
      const score = (item: PrescribedExercise) =>
        (isSkillCategory(item.category) ? -20 : 0) + (item.priority || 3) * 10 - Math.min(item.step || 1, 8) + (item.category === 'auxiliary' ? 20 : 0);
      return score(a) - score(b);
    });
  }
  const budget = availableMinutes * 60;
  const fitted = [...items];
  const prisoner = profile.goal === 'street_mastery' && workout.id.startsWith('prisoner');
  const minMovements = prisoner && profile.frequency === 6 ? 1 : 2;
  if (!prisoner) {
    while (estimateStrengthSession(fitted, availableMinutes, prisoner).totalSeconds > budget && fitted.some((item) => (item.priority || 1) > 1 && item.targetSets > 1)) {
      const item = fitted.filter((candidate) => (candidate.priority || 1) > 1).reduce((best, current) => current.targetSets > best.targetSets ? current : best);
      item.targetSets -= 1;
    }
    while (estimateStrengthSession(fitted, availableMinutes, prisoner).totalSeconds > budget && fitted.some((item) => (item.priority || 1) > 1)) {
      const optional = fitted.map((item, index) => ({ index, priority: item.priority || 1 })).sort((a, b) => b.priority - a.priority)[0];
      fitted.splice(optional.index, 1);
    }
    while (estimateStrengthSession(fitted, availableMinutes, prisoner).totalSeconds > budget && fitted.some((item) => item.targetSets > 2)) {
      const item = fitted.reduce((best, current) => current.targetSets > best.targetSets ? current : best);
      item.targetSets -= 1;
    }
    while (estimateStrengthSession(fitted, availableMinutes, prisoner).totalSeconds > budget && fitted.length > minMovements) {
      const optional = fitted.map((item, index) => ({ index, priority: item.priority || 1 })).sort((a, b) => b.priority - a.priority)[0];
      fitted.splice(optional.index, 1);
    }
  }
  return fitted;
}

export function prescribeAddedExercise(exercise: Exercise, profile: Profile): PrescribedExercise {
  const target = baseTarget(exercise);
  if (exercise.category === 'neck' || exercise.id === 'neck_handResistance') return { ...exercise, targetSets: 1,
    targetUnit: 'reps', targetValue: exercise.id === 'neck_handResistance' ? 10 : 3, restSeconds: 120, priority: 4 };
  return { ...exercise, targetSets: Math.max(1, Math.min(3, exercise.defaultPrescription?.sets || 2)), targetUnit: target.unit,
    targetValue: practicalTarget(exercise, target.value, target.unit), restSeconds: Math.max(90, profile.trainingRestSeconds || 120), priority: 3 };
}
