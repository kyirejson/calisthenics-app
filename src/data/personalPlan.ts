import { getWorkoutExercises } from './catalog';
import { estimateStrengthSession, preferredSessionMinutes } from './trainingPrescription';
import { getPlanDay, getWeekSchedule, recommendPlanId } from './trainingPlans';
import type { ExperienceLevel, Profile, TrainingSession } from '../types';

export type PlanGenerationStep = { progress: number; label: string };
export type PersonalPlanSummary = { strengthDays: number; cardioDays: number; longestMinutes: number; underTargetDays: number; overBudgetDays: number };

export function buildPlanDraft(profile: Profile, frequency: number, sessionMinutes: number, experience: ExperienceLevel, trainingRestSeconds: number, baseline: { push: boolean; pull: boolean; squat: boolean }): Profile {
  const planLevels = { ...profile.planLevels };
  (['push', 'pull', 'squat'] as const).forEach((key) => {
    const previous = (planLevels[key] || (key === 'squat' ? 5 : profile.levels[key]) || 1) >= 5;
    if (baseline[key] !== previous) planLevels[key] = baseline[key] ? 5 : 1;
  });
  return { ...profile, frequency, sessionMinutes, experience, trainingRestSeconds, planLevels };
}

const presentStep = (onStep: (step: PlanGenerationStep) => void, progress: number, label: string) => {
  onStep({ progress, label });
  return new Promise<void>((resolve) => setTimeout(resolve, 90));
};

export async function generatePersonalPlan(profile: Profile, save: (profile: Profile) => Promise<void>, onStep: (step: PlanGenerationStep) => void, sessions: TrainingSession[] = []) {
  if (profile.goal !== 'weight_loss' && profile.goal !== 'street_mastery') throw new Error('当前目标暂无训练计划');
  if (profile.goal === 'street_mastery' && ![2, 3, 6].includes(profile.frequency)) throw new Error('囚徒健身每周可选 2、3 或 6 练');
  const isPrisoner = profile.goal === 'street_mastery';
  const stageName = profile.experience === 'supermax'
    ? '登峰造极'
    : profile.experience === 'elite'
    ? '闭关修炼'
    : profile.experience === 'advanced' || profile.frequency === 6
    ? '炉火纯青'
    : profile.experience === 'intermediate' || profile.frequency === 3
    ? '渐入佳境'
    : '初试身手';
  await presentStep(onStep, 15, isPrisoner ? `确认进阶阶段（${stageName}）` : '确认目标与训练基础');
  const next = {
    ...profile,
    sessionMinutes: preferredSessionMinutes(profile),
    planId: recommendPlanId(profile),
    planStartedAt: new Date().toISOString(),
  };
  await presentStep(onStep, 40, isPrisoner ? '编排六艺分化与关节恢复窗口' : '安排每周课程与恢复日');
  const schedule = getWeekSchedule(next);
  await presentStep(onStep, 75, isPrisoner ? '核定动作变式、慢速节奏与组间休息' : '计算动作组数、次数和休息时间');
  const estimates = schedule.filter((day) => day.type === 'strength' && day.workoutId).map((day) => {
    const cycle = getPlanDay(next, day.date).cycle;
    const exercises = getWorkoutExercises(day.workoutId!, next, cycle.setMultiplier, cycle.dupDay, cycle.week, { sessions });
    return estimateStrengthSession(exercises, next.sessionMinutes, next.goal === 'street_mastery').totalMinutes;
  });
  const summary: PersonalPlanSummary = {
    strengthDays: estimates.length,
    cardioDays: schedule.filter((day) => day.type === 'cardio').length,
    longestMinutes: Math.max(0, ...estimates),
    underTargetDays: next.goal === 'street_mastery' ? 0 : estimates.filter((minutes) => minutes < next.sessionMinutes - 10).length,
    overBudgetDays: next.goal === 'street_mastery' ? 0 : estimates.filter((minutes) => minutes > next.sessionMinutes).length,
  };
  await presentStep(onStep, 90, isPrisoner ? '保存囚徒专属计划到本机' : '保存专属计划到本机');
  await save(next);
  onStep({ progress: 100, label: isPrisoner ? `《${stageName}》专属计划已生成` : '专属计划已生成' });
  return summary;
}
