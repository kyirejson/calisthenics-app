import type { PrescribedExercise, SessionEstimate } from './trainingPrescription';
import { getWarmupActions } from './trainingWarmup';
import { equipmentExecution } from './equipmentExecution';

export type TrainingTimelineEvent = { kind: 'general_warmup' | 'ramp_set' | 'work_set' | 'side_switch' | 'rest' | 'transition' | 'cooldown'; seconds: number; exerciseId?: string; setIndex?: number; recoverySeconds?: number; setupSeconds?: number };
export type EquipmentEstimate = SessionEstimate & { rangeMinutes: [number, number]; uncertaintySeconds: number; upperSeconds: number; events: TrainingTimelineEvent[]; modelVersion: 2 };
export function equipmentTransitionSeconds(current: PrescribedExercise, next?: PrescribedExercise) {
  // Recovery and unloaded equipment setup are explicitly concurrent. Ramp sets follow recovery.
  return next ? Math.max(current.restSeconds, equipmentExecution(next.id).setupSeconds) : 0;
}
export function estimateEquipmentSession(items: PrescribedExercise[]): EquipmentEstimate {
  const events: TrainingTimelineEvent[] = [];
  const warmups = items.length ? getWarmupActions(items) : [];
  for (const action of warmups.filter(action => !action.exercise)) events.push({ kind: 'general_warmup', seconds: action.seconds });
  items.forEach((item, index) => {
    const execution = equipmentExecution(item.id);
    const ramp = warmups.find(action => action.exercise?.id === item.id);
    if (ramp) events.push({ kind: 'ramp_set', seconds: ramp.seconds, exerciseId: item.id });
    for (let set = 0; set < item.targetSets; set++) {
      const sides = item.perSide ? 2 : 1;
      const repetitions = item.repRange?.[1] || item.targetValue;
      events.push({ kind: 'work_set', seconds: Math.ceil(repetitions * execution.repSeconds * sides + 12), exerciseId: item.id, setIndex: set });
      if (item.perSide) events.push({ kind: 'side_switch', seconds: execution.sideSwitchSeconds || 15, exerciseId: item.id, setIndex: set });
      if (set < item.targetSets - 1) events.push({ kind: 'rest', seconds: item.restSeconds, exerciseId: item.id, setIndex: set });
    }
    const next = items[index + 1];
    if (next) events.push({ kind: 'transition', seconds: equipmentTransitionSeconds(item, next), recoverySeconds: item.restSeconds, setupSeconds: equipmentExecution(next.id).setupSeconds, exerciseId: item.id });
  });
  if (items.length) events.push({ kind: 'cooldown', seconds: 120 });
  const sum = (...kinds: TrainingTimelineEvent['kind'][]) => events.filter(event => kinds.includes(event.kind)).reduce((total, event) => total + event.seconds, 0);
  const totalSeconds = sum('general_warmup', 'ramp_set', 'work_set', 'side_switch', 'rest', 'transition', 'cooldown');
  // Engineering allowances for tempo/setup variability, not calibrated percentiles.
  // Prescribed recovery is known; user extensions and equipment queues stay additional.
  const uncertaintySeconds = Math.ceil(sum('work_set', 'side_switch') * .2 + sum('general_warmup', 'ramp_set') * .15 + events.filter(event => event.kind === 'transition').length * 10);
  const upperSeconds = totalSeconds + uncertaintySeconds;
  return { warmupSeconds: sum('general_warmup', 'ramp_set'), workSeconds: sum('work_set', 'side_switch'), restSeconds: sum('rest'), transitionsSeconds: sum('transition'), cooldownSeconds: sum('cooldown'), totalSeconds, totalMinutes: Math.ceil(totalSeconds / 60),
    // Descriptive rule-based envelope, not population percentiles or a prescription budget.
    rangeMinutes: [Math.max(0, Math.floor((totalSeconds - uncertaintySeconds) / 60)), Math.ceil(upperSeconds / 60)], uncertaintySeconds, upperSeconds, events, modelVersion: 2 };
}
export function equipmentRecoveryAfterSet(items: PrescribedExercise[], completed: Record<string, boolean[]>, exerciseId: string) {
  const index = items.findIndex(item => item.id === exerciseId);
  const current = items[index];
  if (!current) return { seconds: 0, kind: 'complete' as const };
  if ((completed[current.id] || []).some(done => !done)) return { seconds: current.restSeconds, kind: 'rest' as const };
  const next = items.slice(index + 1).find(item => (completed[item.id] || []).some(done => !done)) || items.find(item => (completed[item.id] || []).some(done => !done));
  return { seconds: equipmentTransitionSeconds(current, next), kind: next ? 'transition' as const : 'complete' as const };
}
