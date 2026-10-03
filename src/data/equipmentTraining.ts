import type { EquipmentSplit, Profile, Workout } from '../types';
import { getEquipmentMovement } from './equipment';
import { equipmentFocus, equipmentMuscleRegions } from './equipmentLibrary';
import { equipmentGear, type GearKey } from './equipmentTaxonomy';
import type { PrescribedExercise } from './trainingPrescription';
import { equipmentExecution, equipmentLoadBasis, trainingMuscleLabels, type TrainingMuscle, trainingFunctionLabels, type TrainingFunction } from './equipmentExecution';
import { equipmentProgram } from './equipmentProgram';
import { equipmentMuscleTargets, equipmentRegionTargets, equipmentFunctionTargets } from './equipmentDosePolicy';
export { equipmentRegionTargets, equipmentFunctionTargets } from './equipmentDosePolicy';
import { estimateEquipmentSession, type EquipmentEstimate } from './equipmentTimeline';
import { applyCourseOverlay } from '../agent/trainingOverlay';

export const EQUIPMENT_PLAN_ID = 'equipment_training_v2';
export const equipmentSplitLabels: Record<EquipmentSplit, string> = { bro: '传统五分化', ppl: '推 / 拉 / 腿', upper_lower: '上 / 下肢分化' };
// Editorial boundaries for these split identities, not biological minimum training frequencies.
export const equipmentSplitFrequencies: Record<EquipmentSplit, number[]> = { bro: [5, 6], ppl: [3, 4, 5, 6], upper_lower: [2, 3, 4, 5, 6] };
export const equipmentSplitNotes: Record<EquipmentSplit, string> = {
  bro: '5–6 次 · 五部位分日；第六日分担下肢辅助内容',
  ppl: '3–6 次 · 低频合并 A/B，高频拆分同一周内容',
  upper_lower: '2–6 次 · 低频合并上下肢，高频拆分同一周内容',
};
export function equipmentSplitConfig(profile: Pick<Profile, 'equipmentSplit' | 'frequency'>): EquipmentSplit {
  if (profile.equipmentSplit === 'bro' || profile.equipmentSplit === 'ppl' || profile.equipmentSplit === 'upper_lower') return profile.equipmentSplit;
  return profile.frequency === 6 ? 'ppl' : profile.frequency === 5 ? 'bro' : 'upper_lower';
}
export function equipmentFrequency(value: number, split?: EquipmentSplit) {
  const selected = equipmentSplitConfig({ frequency: value, equipmentSplit: split });
  return equipmentSplitFrequencies[selected].includes(value) ? value : equipmentSplitFrequencies[selected][0];
}
export const equipmentOffsets = (frequency: number) => ({ 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 5], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] } as Record<number, number[]>)[frequency] || [0, 2, 4];
export function equipmentTrainingDays(profile: Pick<Profile, 'frequency' | 'equipmentSplit' | 'planStartedAt' | 'equipmentTrainingDays'>): number[] {
  const frequency = equipmentFrequency(profile.frequency, profile.equipmentSplit);
  const valid = [...new Set(profile.equipmentTrainingDays?.filter(day => Number.isInteger(day) && day >= 0 && day <= 6))];
  if (valid.length === frequency) return valid.sort((a, b) => a - b);
  const start = new Date(profile.planStartedAt).getDay();
  return equipmentOffsets(frequency).map(offset => ((Number.isFinite(start) ? start : 1) + offset) % 7).sort((a, b) => a - b);
}
export function equipmentScheduleOffsets(profile: Profile) {
  const first = new Date(profile.planStartedAt).getDay();
  return equipmentTrainingDays(profile).map(day => (day - first + 7) % 7).sort((a, b) => a - b);
}
export function equipmentAvailableGear(profile: Pick<Profile, 'equipmentAvailableGear'>): GearKey[] {
  return profile.equipmentAvailableGear ? equipmentGear.filter(item => profile.equipmentAvailableGear!.includes(item.key)).map(item => item.key) : equipmentGear.map(item => item.key);
}
const allTemplates = Object.fromEntries((Object.keys(equipmentSplitFrequencies) as EquipmentSplit[]).flatMap(split => equipmentSplitFrequencies[split].flatMap(frequency =>
  equipmentProgram(split, frequency).map((course, slot) => [`equipment_v2_${split}_${frequency}_${slot}`, course]))));
export const equipmentWorkouts: Record<string, Omit<Workout, 'estimatedMinutes'>> = Object.fromEntries(Object.entries(allTemplates).map(([id, course]) => [id, {
  id, name: course.label, description: '器械均衡增肌计划', slots: course.doses.map((item, priority) => ({ id: item.id, category: getEquipmentMovement(item.id)!.category, priority })),
}]));
export function equipmentWorkoutId(profile: Profile, slot: number, _date?: Date) {
  return `equipment_v2_${equipmentSplitConfig(profile)}_${equipmentFrequency(profile.frequency, profile.equipmentSplit)}_${slot}`;
}

// Curated substitutions must retain source regions, functions and prime-mover credit.
const replacementPairs = [
  ['chest_03', 'chest_05', 'chest_08', 'chest_09'], ['chest_01', 'chest_19', 'chest_02', 'chest_14'],
  ['chest_04', 'chest_11', 'chest_16'], ['back_01', 'back_04', 'back_17'], ['back_15', 'back_02', 'back_06', 'back_11', 'back_14'],
  ['back_07', 'back_13'], ['back_08', 'back_02', 'back_06', 'back_11', 'back_14'], ['legs_04', 'legs_21'],
  ['legs_05', 'legs_14'], ['shoulders_01', 'shoulders_14', 'shoulders_02', 'shoulders_09'], ['shoulders_03', 'shoulders_07', 'shoulders_08'],
  ['shoulders_04', 'shoulders_06', 'shoulders_13'], ['legs_02', 'legs_15', 'legs_07', 'legs_08', 'legs_16', 'legs_17', 'legs_18', 'legs_19'],
  ['legs_01', 'legs_10'], ['arms_01', 'arms_04', 'arms_15'], ['arms_02', 'arms_05', 'arms_06'],
  ['arms_08', 'arms_07', 'arms_16', 'arms_18', 'arms_19'], ['arms_09', 'arms_17', 'arms_21'],
  ['core_01', 'core_03', 'core_12'], ['core_13', 'core_04'],
].map(ids => ids.map(id => 'equipment_' + id));
export function equipmentReplacementIds(id: string, profile: Profile): string[] {
  const gear = equipmentAvailableGear(profile), source = equipmentExecution(id);
  return [...new Set([id, ...replacementPairs.filter(pair => pair.includes(id)).flat()])].filter(candidate => {
    const movement = getEquipmentMovement(candidate), meta = equipmentExecution(candidate);
    return movement && movement.riskLevel !== 'high' && meta.pattern === source.pattern && meta.purpose === source.purpose
      && source.direct.every(muscle => meta.direct.includes(muscle)) && source.regions.every(region => meta.regions.includes(region))
      && source.functions.every(fn => meta.functions.includes(fn)) && equipmentFocus[candidate]?.gear.every(key => gear.includes(key));
  });
}

export function normalizeEquipmentOverrides(raw: unknown): NonNullable<Profile['equipmentMovementOverrides']> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).flatMap(([id, entries]) => {
    const course = allTemplates[id];
    if (!course || !entries || typeof entries !== 'object' || Array.isArray(entries)) return [];
    return [[id, Object.fromEntries(Object.entries(entries).flatMap(([from, to]) =>
      course.doses.some(dose => dose.id === from) && typeof to === 'string' && !!getEquipmentMovement(to) ? [[from, to]] : []))]];
  }));
}
export function equipmentWeeklyTargets(_profile: Profile): Record<TrainingMuscle, number> {
  return Object.fromEntries(Object.entries(equipmentMuscleTargets).map(([key, rule]) => [key, rule.sets])) as Record<TrainingMuscle, number>;
}
export type EquipmentVolumeLedger = Record<TrainingMuscle, { direct: number; indirect: number; stabilizing: number; control: number; estimated: number }>;
const validSets = (sets: number) => Number.isInteger(sets) && sets > 0;
export function equipmentVolumeLedger(items: Array<Pick<PrescribedExercise, 'id' | 'targetSets'>>): EquipmentVolumeLedger {
  const ledger = Object.fromEntries(Object.keys(trainingMuscleLabels).map(muscle => [muscle, { direct: 0, indirect: 0, stabilizing: 0, control: 0, estimated: 0 }])) as EquipmentVolumeLedger;
  for (const item of items) {
    if (!validSets(item.targetSets)) continue;
    const meta = equipmentExecution(item.id);
    for (const muscle of meta.direct) if (ledger[muscle]) { ledger[muscle].direct += item.targetSets; if (meta.purpose === 'control') ledger[muscle].control += item.targetSets; }
    for (const muscle of meta.indirect) if (ledger[muscle]) ledger[muscle].indirect += item.targetSets;
    for (const muscle of meta.stabilizing) if (ledger[muscle]) ledger[muscle].stabilizing += item.targetSets;
  }
  // Approximate accounting only; stabilization/control never becomes hypertrophy credit.
  for (const muscle of Object.keys(ledger) as TrainingMuscle[]) ledger[muscle].estimated = ledger[muscle].direct - ledger[muscle].control + ledger[muscle].indirect * .5;
  return ledger;
}
export function equipmentCoverage(items: Array<Pick<PrescribedExercise, 'id' | 'targetSets'>>) {
  const regions: Record<string, number> = Object.fromEntries(equipmentMuscleRegions.map(region => [region.key, 0]));
  const functions = Object.fromEntries(Object.keys(trainingFunctionLabels).map(fn => [fn, 0])) as Record<TrainingFunction, number>;
  const regionTargets: Record<string, { sets: number; kind: string }> = equipmentRegionTargets;
  const issues: string[] = [];
  for (const region of equipmentMuscleRegions) {
    const rule = regionTargets[region.key];
    if (!rule || !validSets(rule.sets) || !['hypertrophy', 'control', 'stabilization'].includes(rule.kind)) issues.push('缺少有效细分剂量规则：' + region.key);
  }
  for (const key of Object.keys(equipmentRegionTargets)) if (!(key in regions)) issues.push('细分规则未注册：' + key);
  for (const muscle of Object.keys(trainingMuscleLabels) as TrainingMuscle[]) {
    const rule = equipmentMuscleTargets[muscle];
    if (!rule || !validSets(rule.sets) || !['hypertrophy', 'control', 'stabilization'].includes(rule.kind)) issues.push('缺少有效肌群剂量规则：' + muscle);
  }
  for (const fn of Object.keys(functions) as TrainingFunction[]) if (!validSets(equipmentFunctionTargets[fn])) issues.push('缺少有效功能剂量规则：' + fn);
  for (const item of items) {
    if (!validSets(item.targetSets)) { issues.push('工作组数必须是正整数：' + item.id); continue; }
    const meta = equipmentExecution(item.id);
    if (!getEquipmentMovement(item.id) || meta.pattern === 'other' || !meta.direct.length || !meta.regions.length) issues.push('动作训练参与信息不完整：' + item.id);
    for (const muscle of [...meta.direct, ...meta.indirect, ...meta.stabilizing]) if (!(muscle in trainingMuscleLabels)) issues.push('未知肌群：' + muscle);
    for (const region of meta.regions) {
      if (!(region in regions) || !regionTargets[region]) issues.push('未知训练方向：' + region);
      else {
        const kind = regionTargets[region].kind;
        // Growth cannot be credited with control work, or vice versa.
        if (kind === 'stabilization' || (kind === 'control') === (meta.purpose === 'control')) regions[region] += item.targetSets;
      }
    }
    for (const fn of meta.functions) {
      if (!(fn in functions) || !validSets(equipmentFunctionTargets[fn])) issues.push('未知动作功能：' + fn);
      else functions[fn] += item.targetSets;
    }
  }
  const regionDeficits = [...new Set([...Object.keys(regions), ...Object.keys(regionTargets)])].filter(key =>
    !regionTargets[key] || !validSets(regionTargets[key].sets) || !Number.isFinite(regions[key]) || regions[key] < regionTargets[key].sets);
  const functionDeficits = (Object.keys(functions) as TrainingFunction[]).filter(key =>
    !validSets(equipmentFunctionTargets[key]) || !Number.isFinite(functions[key]) || functions[key] < equipmentFunctionTargets[key]);
  return { regions, functions, regionDeficits, functionDeficits, issues: [...new Set(issues)] };
}
export type EquipmentSessionPlan = {
  schemaVersion: 4; revision: string; workoutId: string; title: string; split: EquipmentSplit;
  status: 'feasible' | 'infeasible'; issues: string[]; notice: string;
  items: PrescribedExercise[]; estimate: EquipmentEstimate; weeklyTargets: Record<TrainingMuscle, number>; volume: EquipmentVolumeLedger;
};
export function equipmentSessionPlan(id: string, profile: Profile, _date?: Date): EquipmentSessionPlan {
  const template = allTemplates[id], issues: string[] = [], used = new Set<string>();
  if (!template) issues.push('此课程已停用，请使用新版器械计划');
  const activeIds = Array.from({ length: equipmentFrequency(profile.frequency, profile.equipmentSplit) }, (_, slot) => equipmentWorkoutId(profile, slot));
  if (template && !activeIds.includes(id)) issues.push('课程不属于当前分化与频率');
  // Reserve deliberate overrides and available defaults before choosing equipment fallbacks.
  const reserved = new Set((template?.doses || []).map(dose =>
    profile.equipmentMovementOverrides?.[id]?.[dose.id] || (equipmentReplacementIds(dose.id, profile).includes(dose.id) ? dose.id : undefined)).filter(Boolean));
  let items: PrescribedExercise[] = (template?.doses || []).flatMap((dose, priority) => {
    if (!validSets(dose.sets) || !Array.isArray(dose.range) || dose.range.length !== 2 || !dose.range.every(validSets)
      || dose.range[1] < dose.range[0] || !Number.isFinite(dose.rest) || dose.rest < 0) {
      issues.push('动作处方剂量无效：' + dose.id);
      return [];
    }
    const candidates = equipmentReplacementIds(dose.id, profile);
    let chosen = profile.equipmentMovementOverrides?.[id]?.[dose.id];
    if (chosen && template.doses.some(other => other.id !== dose.id && (profile.equipmentMovementOverrides?.[id]?.[other.id] || other.id) === chosen)) {
      issues.push('替换与本课另一动作冲突，请恢复默认或选择其他动作');
      chosen = undefined;
    }
    if (chosen && !candidates.includes(chosen)) { issues.push('替换不能保留训练目标或缺少器材：' + getEquipmentMovement(dose.id)?.name); return []; }
    const replacement = chosen || (candidates.includes(dose.id) ? dose.id : candidates.find(candidate => !used.has(candidate) && !reserved.has(candidate)));
    if (!replacement) { issues.push('缺少等效动作或必要器材：' + getEquipmentMovement(dose.id)?.name); return []; }
    if (used.has(replacement)) { issues.push('替换与本课另一动作冲突，请恢复默认或选择其他动作'); return []; }
    used.add(replacement);
    const movement = getEquipmentMovement(replacement)!, meta = equipmentExecution(replacement);
    const basis = equipmentLoadBasis(replacement);
    return [{ ...movement, targetSets: dose.sets, targetValue: dose.range[0], targetUnit: 'reps' as const, repRange: dose.range,
      restSeconds: dose.rest, loadBasis: basis, perSide: meta.unilateral, priority, equipmentSourceId: dose.id,
      defaultPrescription: { ...movement.defaultPrescription, rirTarget: meta.purpose === 'control' ? 3 : 2 } }];
  });
  items = applyCourseOverlay(items, profile, id, _date || new Date(), replacement => {
    const movement = getEquipmentMovement(replacement); if (!movement) return undefined;
    return { ...movement, loadBasis: equipmentLoadBasis(replacement), perSide: equipmentExecution(replacement).unilateral };
  });
  items.sort((a, b) => Number(equipmentExecution(b.id).compound) - Number(equipmentExecution(a.id).compound));
  if (profile.equipmentPriority && profile.equipmentPriority !== 'balanced') items.sort((a, b) => Number(getEquipmentMovement(b.id)?.group === profile.equipmentPriority) - Number(getEquipmentMovement(a.id)?.group === profile.equipmentPriority));
  issues.push(...equipmentCoverage(items).issues);
  const revision = JSON.stringify([4, id, items.map(item => [item.id, item.targetSets, item.repRange, item.restSeconds, item.perSide, item.loadBasis, item.defaultPrescription?.rirTarget])]);
  return { schemaVersion: 4, revision, workoutId: id, title: template?.label || '器械训练', split: equipmentSplitConfig(profile), status: issues.length ? 'infeasible' : 'feasible', issues,
    notice: issues[0] || '整周均衡增肌计划 · 预计用时仅供参考', items, estimate: estimateEquipmentSession(items), weeklyTargets: equipmentWeeklyTargets(profile), volume: equipmentVolumeLedger(items) };
}
export function equipmentWorkoutItems(id: string, profile: Profile, date?: Date) { return equipmentSessionPlan(id, profile, date).items; }

export function equipmentProgressionSuggestion(item: PrescribedExercise, sessions: import('../types').TrainingSession[]) {
  // Machine/cable markings are not comparable across unknown physical devices.
  if (!['total', 'per_hand'].includes(item.loadBasis || '')) return '';
  const candidates = sessions.flatMap(session => {
    const exercise = session.exercises.find(row => row.exerciseId === item.id && row.targetSnapshot?.loadBasis === item.loadBasis);
    const at = new Date(session.completedAt || session.startedAt).getTime();
    return exercise && Number.isFinite(at) && at <= Date.now() ? [{ exercise, session, at }] : [];
  }).sort((a, b) => b.at - a.at).slice(0, 2);
  if (candidates.length < 2 || candidates[0].at - candidates[1].at < 86400000 || candidates.some(row => row.session.quality !== 'solid' || row.session.completion !== 'complete')) return '';
  const previous = candidates.map(row => row.exercise);
  const logs = previous.flatMap(exercise => exercise.sets);
  const first = logs[0]?.loadKg;
  if (first === undefined || first <= 0 || previous.some(exercise => exercise.sets.length < item.targetSets) || logs.some(set => !set.completed || set.loadKg !== first || set.reps < (item.repRange?.[1] || item.targetValue) || set.rir === undefined || set.rir < 2)) return '';
  return '连续两次达标：可自愿尝试最小加重，保持动作与余力；不自动改重量';
}

export const equipmentLoadLabel = (basis?: PrescribedExercise['loadBasis']) => basis === 'per_hand' ? '每只哑铃' : basis === 'total' ? '含杆总重' : basis === 'bodyweight' ? '自重' : '器械标记重';
