import { categoryMatches, exercises } from './catalog';
import type { Exercise, Profile, TrainingSession } from '../types';

export type SeriesGroup = '六艺基础' | '关节与支援' | '爆发六功';
export type SeriesDefinition = { key: string; label: string; icon: string; group: SeriesGroup };

export const progressionSeries: SeriesDefinition[] = [
  { key: 'push', label: '俯卧撑', icon: '↗', group: '六艺基础' },
  { key: 'pull', label: '引体向上', icon: '↥', group: '六艺基础' },
  { key: 'squat', label: '深蹲', icon: '⌄', group: '六艺基础' },
  { key: 'legRaise', label: '举腿', icon: '⌁', group: '六艺基础' },
  { key: 'bridge', label: '桥', icon: '⌒', group: '六艺基础' },
  { key: 'hspu', label: '倒立撑', icon: '↑', group: '六艺基础' },
  { key: 'flag_clutch', label: '抓旗', icon: '⚑', group: '关节与支援' },
  { key: 'flag_press', label: '扬旗', icon: '⚐', group: '关节与支援' },
  { key: 'hang_grip', label: '悬挂握力', icon: '◇', group: '关节与支援' },
  { key: 'trifecta', label: '关节三诀', icon: '△', group: '关节与支援' },
  { key: 'neck', label: '颈部力量', icon: '◉', group: '关节与支援' },
  { key: 'power_push', label: '爆发俯卧撑', icon: 'ϟ', group: '爆发六功' },
  { key: 'power_jump', label: '爆发跳跃', icon: 'ϟ', group: '爆发六功' },
  { key: 'kip_up', label: '功夫打挺', icon: 'ϟ', group: '爆发六功' },
  { key: 'front_flip', label: '前空翻', icon: 'ϟ', group: '爆发六功' },
  { key: 'back_flip', label: '后空翻', icon: 'ϟ', group: '爆发六功' },
  { key: 'power_pull', label: '暴力上杠', icon: 'ϟ', group: '爆发六功' },
];

export type MasteryCriteria = {
  sets: number;
  value: number;
  unit: 'reps' | 'seconds' | 'steps' | 'meters';
  display: string;
  manual: boolean;
};

export type ProgressionStatus = {
  series: SeriesDefinition;
  current: Exercise;
  next?: Exercise;
  criteria: MasteryCriteria;
  qualifiedSessions: number;
  requiredSessions: number;
  eligible: boolean;
  complete: boolean;
  level: number;
  totalLevels: number;
};

export function getSeriesExercises(seriesKey: string) {
  return exercises
    .filter((exercise) => categoryMatches(exercise, seriesKey))
    .sort((a, b) => (a.step || 999) - (b.step || 999));
}

export function parseMasteryCriteria(exercise: Exercise): MasteryCriteria {
  const display = exercise.standards?.upgrade || '完成当前处方上限';
  const requiresConfirmation = /每侧|每向|往返|负重|公斤|kg/i.test(display);
  const setRep = display.match(/(\d+)\s*组\s*[×xX]\s*(\d+)\s*(次|步)/);
  if (setRep) return { sets: Number(setRep[1]), value: Number(setRep[2]), unit: setRep[3] === '步' ? 'steps' : 'reps', display, manual: requiresConfirmation };
  const continuous = display.match(/连续\s*(\d+)\s*次/);
  if (continuous) return { sets: 1, value: Number(continuous[1]), unit: 'reps', display, manual: requiresConfirmation };
  const duration = display.match(/(\d+)\s*(分钟|分|秒)/);
  if (duration) return { sets: 1, value: Number(duration[1]) * (duration[2].startsWith('分') ? 60 : 1), unit: 'seconds', display, manual: requiresConfirmation };
  const steps = display.match(/(\d+)\s*级台阶/);
  if (steps) return { sets: 1, value: Number(steps[1]), unit: 'steps', display, manual: true };
  const meters = display.match(/(\d+)\s*米/);
  if (meters) return { sets: 1, value: Number(meters[1]), unit: 'meters', display, manual: true };
  const fallback = exercise.defaultPrescription?.repRange?.[1] || 10;
  return { sets: exercise.defaultPrescription?.sets || 2, value: fallback, unit: 'reps', display, manual: true };
}

function sessionQualifies(session: TrainingSession, exercise: Exercise, criteria: MasteryCriteria) {
  if (session.quality !== 'solid' || session.completion === 'partial') return false;
  if (session.workoutId !== `single_${exercise.id}` || session.exercises.length !== 1) return false;
  const logged = session.exercises.find((item) => item.exerciseId === exercise.id);
  if (!logged) return false;
  if (criteria.manual && !logged.constraintsConfirmed) return false;
  const completed = logged.sets.filter((set) => set.completed && (set.unit || criteria.unit) === criteria.unit);
  return completed.length >= criteria.sets && completed.slice(0, criteria.sets).every((set) => set.reps >= criteria.value);
}

export function getProgressionStatus(seriesKey: string, profile: Profile, sessions: TrainingSession[]): ProgressionStatus | null {
  const series = progressionSeries.find((item) => item.key === seriesKey);
  const seriesExercises = getSeriesExercises(seriesKey);
  if (!series || !seriesExercises.length) return null;
  const storedLevel = Math.max(1, profile.levels[seriesKey] || 1);
  const complete = storedLevel > seriesExercises.length;
  const level = Math.min(storedLevel, seriesExercises.length);
  const current = seriesExercises[level - 1];
  const criteria = parseMasteryCriteria(current);
  const recent = sessions
    .filter((session) => session.kind !== 'running' && session.workoutId === `single_${current.id}` && session.exercises.length === 1)
    .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime())
    .slice(0, 3);
  let qualifiedSessions = 0;
  for (const session of recent) {
    if (!sessionQualifies(session, current, criteria)) break;
    qualifiedSessions += 1;
  }
  return {
    series, current, next: seriesExercises[level], criteria,
    qualifiedSessions, requiredSessions: 2,
    eligible: !complete && qualifiedSessions >= 2,
    complete,
    level, totalLevels: seriesExercises.length,
  };
}

export function getAllProgressionStatuses(profile: Profile, sessions: TrainingSession[]) {
  return progressionSeries.map((series) => getProgressionStatus(series.key, profile, sessions)).filter(Boolean) as ProgressionStatus[];
}
