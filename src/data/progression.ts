import { categoryMatches, exercises } from './catalog';
import { coreFinalSteps } from './progressionRoutes';
import type { Exercise, Profile, TrainingSession } from '../types';

export type SeriesGroup = '六艺基础' | '关节与支援' | '爆发六功' | '街头技巧';
export type SeriesDefinition = { key: string; label: string; icon: string; group: SeriesGroup };

export const progressionGroups: Array<{ key: SeriesGroup; icon: string; description: string }> = [
  { key: '六艺基础', icon: '↗', description: '推、拉、蹲与核心的基础路线' },
  { key: '关节与支援', icon: '◇', description: '握力、颈部与辅助练习' },
  { key: '爆发六功', icon: 'ϟ', description: '跳跃、上杠与动态技巧' },
  { key: '街头技巧', icon: '⊶', description: '水平、俯撑与旗帜' },
];

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
  { key: 'front_lever', label: '前水平', icon: '⊶', group: '街头技巧' },
  { key: 'planche', label: '俯撑', icon: '⊷', group: '街头技巧' },
  { key: 'back_lever', label: '后水平', icon: '⊸', group: '街头技巧' },
  { key: 'muscle_up', label: '双力臂', icon: '⇧', group: '街头技巧' },
  { key: 'l_sit', label: 'L支撑', icon: '∟', group: '街头技巧' },
  { key: 'human_flag', label: '人体旗帜', icon: '⚑', group: '街头技巧' },
];

export type MasteryCriteria = {
  sets: number;
  value: number;
  unit: 'reps' | 'seconds' | 'steps' | 'meters';
  display: string;
  manual: boolean;
  confirmationHint?: string;
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

export function getFinalFormProgress(statuses: ProgressionStatus[]) {
  const total = statuses.length;
  const unlocked = statuses.filter((status) => status.complete).length;
  return { unlocked, total, percent: total ? Math.round(unlocked / total * 100) : 0 };
}

export function applyProgressionUnlock(profile: Profile, status: ProgressionStatus): Profile {
  const key = status.series.key;
  const nextLevel = status.level + 1;
  const chosenLevel = profile.planLevels?.[key];
  return {
    ...profile,
    levels: { ...profile.levels, [key]: nextLevel },
    // An explicit choice at another step belongs to the user. A choice that
    // still matches the verified step can follow the newly unlocked route.
    planLevels: status.next && chosenLevel === status.level
      ? { ...profile.planLevels, [key]: nextLevel }
      : profile.planLevels,
  };
}

export function getSeriesExercises(seriesKey: string) {
  return exercises
    .filter((exercise) => categoryMatches(exercise, seriesKey))
    .sort((a, b) => (a.step || 999) - (b.step || 999));
}

export function parseMasteryCriteria(exercise: Exercise): MasteryCriteria {
  const display = exercise.standards?.upgrade || '完成当前处方上限';
  const fullContext = [display, exercise.name, exercise.purpose, ...(exercise.keyPoints || [])].join(' ');
  const unilateral = /每侧|左右|双侧|单侧|单臂|单手|单腿|单脚|一只手|一条腿/i.test(fullContext);
  const requiresConfirmation = unilateral || /每向|往返|负重|公斤|kg/i.test(fullContext) || exercise.riskLevel === 'high';
  const confirmationHint = unilateral && !/每侧|左右|双侧/i.test(display)
    ? '请确认左右两侧均按要求完成。'
    : undefined;
  const setRep = display.match(/(\d+)\s*组\s*[×xX]\s*(\d+)\s*(次|步)/);
  if (setRep) return { sets: Number(setRep[1]), value: Number(setRep[2]), unit: setRep[3] === '步' ? 'steps' : 'reps', display, manual: requiresConfirmation, confirmationHint };
  const setHold = display.match(/(\d+)\s*组\s*[×xX]\s*(\d+)\s*(分钟|分|秒)/);
  if (setHold) return { sets: Number(setHold[1]), value: Number(setHold[2]) * (setHold[3].startsWith('分') ? 60 : 1), unit: 'seconds', display, manual: requiresConfirmation, confirmationHint };
  const continuous = display.match(/连续\s*(\d+)\s*次/);
  if (continuous) return { sets: 1, value: Number(continuous[1]), unit: 'reps', display, manual: requiresConfirmation, confirmationHint };
  const duration = display.match(/(\d+)\s*(分钟|分|秒)/);
  if (duration) return { sets: 1, value: Number(duration[1]) * (duration[2].startsWith('分') ? 60 : 1), unit: 'seconds', display, manual: requiresConfirmation, confirmationHint };
  const steps = display.match(/(\d+)\s*级台阶/);
  if (steps) return { sets: 1, value: Number(steps[1]), unit: 'steps', display, manual: true };
  const meters = display.match(/(\d+)\s*米/);
  if (meters) return { sets: 1, value: Number(meters[1]), unit: 'meters', display, manual: true };
  if (exercise.isHold) {
    const initial = exercise.standards?.beginner?.match(/(\d+)\s*(分钟|分|秒)/);
    return { sets: exercise.defaultPrescription?.sets || 2, value: initial ? Number(initial[1]) * (initial[2].startsWith('分') ? 60 : 1) : 10, unit: 'seconds', display, manual: true };
  }
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
  const finalStep = coreFinalSteps[seriesKey];
  const terminalIndex = finalStep ? seriesExercises.findIndex((exercise) => exercise.step === finalStep) + 1 : seriesExercises.length;
  const totalLevels = terminalIndex > 0 ? terminalIndex : seriesExercises.length;
  const storedLevel = Math.max(1, profile.levels[seriesKey] || 1);
  const complete = storedLevel > totalLevels;
  const level = Math.min(storedLevel, totalLevels);
  const current = seriesExercises[level - 1];
  const criteria = parseMasteryCriteria(current);
  const recent = sessions
    .filter((session) => session.kind !== 'running' && session.workoutId === `single_${current.id}` && session.exercises.length === 1)
    .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime());
  let qualifiedSessions = 0;
  let lastCountedAt = Number.POSITIVE_INFINITY;
  for (const session of recent) {
    if (!sessionQualifies(session, current, criteria)) break;
    const completedAt = new Date(session.completedAt).getTime();
    if (!Number.isFinite(completedAt)) break;
    if (qualifiedSessions === 0 || lastCountedAt - completedAt >= 24 * 60 * 60 * 1000) {
      qualifiedSessions += 1;
      lastCountedAt = completedAt;
    }
    if (qualifiedSessions >= 2) break;
  }
  return {
    series, current, next: level < totalLevels ? seriesExercises[level] : undefined, criteria,
    qualifiedSessions, requiredSessions: 2,
    eligible: !complete && qualifiedSessions >= 2,
    complete,
    level, totalLevels,
  };
}

export function getAllProgressionStatuses(profile: Profile, sessions: TrainingSession[]) {
  return progressionSeries.map((series) => getProgressionStatus(series.key, profile, sessions)).filter(Boolean) as ProgressionStatus[];
}
