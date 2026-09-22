import type { Exercise, Profile, Workout } from '../types';

// These CommonJS data files are copied from the WeChat mini-program so the
// mobile app and the original product share the same 188-exercise catalogue.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rawExercises = require('./legacy/exercises.js') as Exercise[];
// eslint-disable-next-line @typescript-eslint/no-require-imports
const templates = require('./legacy/templates.js') as { workouts: Record<string, Workout> };

export const exercises: Exercise[] = rawExercises;
export const workouts = templates.workouts;

export const categories = [
  { key: 'all', label: '全部', icon: '◉' },
  { key: 'push', label: '俯卧撑', icon: '↗' },
  { key: 'pull', label: '引体', icon: '↥' },
  { key: 'squat', label: '深蹲', icon: '⌄' },
  { key: 'legRaise', label: '举腿', icon: '⌁' },
  { key: 'bridge', label: '桥', icon: '⌒' },
  { key: 'hspu', label: '倒立撑', icon: '↑' },
  { key: 'power', label: '爆发力', icon: 'ϟ' },
];

const aliases: Record<string, string[]> = {
  push: ['push'],
  pull: ['pull'],
  squat: ['squat'],
  legRaise: ['legRaise', 'leg_raise'],
  bridge: ['bridge'],
  hspu: ['hspu', 'handstand_pushup'],
  auxiliary: ['hang_grip', 'trifecta', 'neck'],
  power: ['power_push', 'power_pushup', 'power_jump', 'power_pull', 'kip_up', 'front_flip', 'back_flip'],
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
  const desiredStep = profile.levels[category] || 1;
  const matches = exercises.filter((item) => categoryMatches(item, category));
  return matches.find((item) => item.step === desiredStep) || matches[0];
}

export function getWorkout(id: string): Workout {
  return workouts[id] || workouts.fullA || Object.values(workouts)[0];
}

export function getWorkoutExercises(id: string, profile: Profile) {
  const workout = getWorkout(id);
  return workout.slots
    .map((slot) => {
      const exercise = selectExercise(slot.category, profile);
      if (!exercise) return null;
      const sets = slot.prescription?.sets || exercise.defaultPrescription?.sets || 3;
      return {
        ...exercise,
        targetSets: sets,
        restSeconds: slot.prescription?.restSeconds || exercise.defaultPrescription?.restSeconds || 60,
      };
    })
    .filter(Boolean) as Array<Exercise & { targetSets: number; restSeconds: number }>;
}

export const weekdayPlans: Record<number, Record<number, string>> = {
  1: { 6: 'fullComprehensive' },
  2: { 1: 'fullA', 4: 'fullB' },
  3: { 1: 'fullA', 3: 'fullB', 5: 'fullA' },
  4: { 1: 'splitUpper', 2: 'splitLower', 4: 'splitUpper', 5: 'splitLower' },
  5: { 1: 'pplPush', 2: 'pplPull', 3: 'pplLegs', 4: 'splitUpper', 5: 'splitLower' },
  6: { 1: 'pplPush', 2: 'pplPull', 3: 'pplLegs', 4: 'pplPush', 5: 'pplPull', 6: 'pplLegs' },
};

export function todayWorkoutId(frequency: number, date = new Date()) {
  const jsDay = date.getDay();
  return weekdayPlans[frequency]?.[jsDay] || null;
}
