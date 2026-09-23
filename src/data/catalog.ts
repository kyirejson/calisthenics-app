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
  { key: 'support', label: '辅助', icon: '△' },
  { key: 'power', label: '爆发力', icon: 'ϟ' },
];

const aliases: Record<string, string[]> = {
  push: ['push'],
  pull: ['pull'],
  squat: ['squat'],
  legRaise: ['legRaise', 'leg_raise'],
  bridge: ['bridge'],
  hspu: ['hspu', 'handstand_pushup'],
  auxiliary: ['auxiliary'],
  support: ['auxiliary', 'flag_clutch', 'flag_press', 'hang_grip', 'trifecta', 'neck'],
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
  const matches = exercises
    .filter((item) => categoryMatches(item, category))
    .sort((left, right) => (left.step || 999) - (right.step || 999));
  const exact = matches.find((item) => item.step === desiredStep);
  if (exact) return exact;
  const highestStepped = [...matches].reverse().find((item) => typeof item.step === 'number');
  if (highestStepped && desiredStep > (highestStepped.step || 0)) return highestStepped;
  return matches[0];
}

export function getWorkout(id: string): Workout {
  return workouts[id] || workouts.fullA || Object.values(workouts)[0];
}

export function getWorkoutExercises(id: string, profile: Profile, setMultiplier = 1) {
  const workout = getWorkout(id);
  const normalizedMultiplier = Number.isFinite(setMultiplier) && setMultiplier > 0 ? setMultiplier : 1;
  return workout.slots
    .map((slot) => {
      const exercise = selectExercise(slot.category, profile);
      if (!exercise) return null;
      const baseSets = slot.prescription?.sets || exercise.defaultPrescription?.sets || 3;
      const sets = Math.max(1, Math.round(baseSets * normalizedMultiplier));
      return {
        ...exercise,
        targetSets: sets,
        restSeconds: slot.prescription?.restSeconds || exercise.defaultPrescription?.restSeconds || 60,
      };
    })
    .filter(Boolean) as Array<Exercise & { targetSets: number; restSeconds: number }>;
}
