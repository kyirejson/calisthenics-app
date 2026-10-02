import type { Profile } from '../types';
import { getWeekSchedule } from './trainingPlans';
import { equipmentCoverage, equipmentSessionPlan, equipmentVolumeLedger, equipmentWeeklyTargets } from './equipmentTraining';
import { equipmentMuscleTargets } from './equipmentDosePolicy';
import { equipmentMuscleRegions } from './equipmentLibrary';
import { trainingFunctionLabels, trainingMuscleLabels } from './equipmentExecution';

// Audit the selected plan week once. Future calendar behavior is tested separately.
export function equipmentPlanReview(profile: Profile, date = new Date()) {
  const targets = equipmentWeeklyTargets(profile);
  const courses = getWeekSchedule(profile, date).flatMap(day => day.workoutId ? [equipmentSessionPlan(day.workoutId, profile, day.date)] : []);
  const items = courses.flatMap(course => course.items);
  const ledger = equipmentVolumeLedger(items), coverage = equipmentCoverage(items);
  const deficits = (Object.keys(targets) as Array<keyof typeof targets>).filter(muscle => {
    const rule = equipmentMuscleTargets[muscle], row = ledger[muscle];
    if (!rule || !row || !Number.isFinite(rule.sets) || rule.sets <= 0) return true;
    const credit = rule.kind === 'stabilization' ? row.stabilizing : rule.kind === 'control' ? row.control : row.direct - row.control;
    return !Number.isFinite(credit) || credit < rule.sets;
  });
  const issues = [...new Set([...courses.flatMap(course => course.issues), ...coverage.issues,
    ...deficits.map(muscle => `训练量不足：${trainingMuscleLabels[muscle]}`),
    ...coverage.regionDeficits.map(key => `细分方向不足：${equipmentMuscleRegions.find(region => region.key === key)?.label || key}`),
    ...coverage.functionDeficits.map(key => `动作功能不足：${trainingFunctionLabels[key] || key}`),
  ])];
  return { date, targets, courses, ledger, coverage, deficits, issues, status: issues.length ? 'infeasible' as const : 'feasible' as const };
}
