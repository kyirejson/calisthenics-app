import type { Profile } from '../../types';
import type { PrescribedExercise, TargetUnit } from './trainingPrescription';

type Volume = NonNullable<Profile['trainingVolumes']>[string];
const validValue = (value: unknown, unit: TargetUnit): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && (unit === 'meters' || Number.isInteger(value));

export function normalizeTrainingVolumes(raw: unknown): NonNullable<Profile['trainingVolumes']> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([, entry]) => {
    const value = entry as Volume | null;
    return value && ['reps', 'seconds', 'steps', 'meters'].includes(value.unit) &&
      Array.isArray(value.values) && value.values.length > 0 &&
      value.values.every(number => number === null || validValue(number, value.unit));
  }));
}

export function applyTrainingVolume(item: PrescribedExercise, profile: Pick<Profile, 'trainingVolumes'>): PrescribedExercise {
  const volume = profile.trainingVolumes?.[item.id];
  if (!volume || volume.unit !== item.targetUnit) return item;
  return { ...item, targetSets: volume.values.length, setTargets: volume.values.slice(),
    targetValue: volume.values.find(value => value !== null) ?? item.targetValue,
    repRange: volume.values.every(value => value !== null) ? undefined : item.repRange };
}

/** Only explicit plan edits enter the template; completed results never supply its values. */
export function editedTrainingVolume(item: PrescribedExercise, previous: Volume | undefined, count: number,
  edit?: { index: number; value: number }): Volume {
  const saved = previous?.unit === item.targetUnit ? previous.values : item.setTargets;
  const values = Array.from({ length: count }, (_, index) =>
    saved?.[index] ?? (item.repRange ? null : item.targetValue));
  if (edit && validValue(edit.value, item.targetUnit)) values[edit.index] = edit.value;
  return { unit: item.targetUnit, values };
}
