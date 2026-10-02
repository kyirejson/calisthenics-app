import type { PrescribedExercise } from './trainingPrescription';
import { getEquipmentMovement } from './equipment';
import { equipmentExecution, equipmentLoadBasis, type TrainingMuscle, type TrainingFunction } from './equipmentExecution';
import { trainingRegionMuscle, type TrainingRegion } from './equipmentParticipation';

export type EquipmentDose = { id: string; sets: number; range: [number, number]; rest: number; basis: NonNullable<PrescribedExercise['loadBasis']>; perSide: boolean; broDay: 'chest' | 'back' | 'shoulders' | 'legs' | 'arms'; auxiliary?: 'upper' | 'lower' };
export type EquipmentCourse = { label: string; doses: EquipmentDose[] };
const dose = (key: string, sets: number, range: [number, number] = [8, 12], rest = 150, broDay?: EquipmentDose['broDay']): EquipmentDose => {
  const id = 'equipment_' + key, meta = equipmentExecution(id), group = getEquipmentMovement(id)!.group;
  const auxiliary = group === 'arms' || meta.pattern === 'rotation' ? 'upper'
    : ['calf', 'hipAbduction', 'hipAdduction', 'dorsiflexion', 'core'].includes(meta.pattern) ? 'lower' : undefined;
  if (group === 'core' && !broDay) throw new Error('核心剂量必须指定分化日：' + id);
  return { id, sets, range, rest, basis: equipmentLoadBasis(id), perSide: meta.unilateral, broDay: broDay || group as EquipmentDose['broDay'], auxiliary };
};
// One weekly prescription. Lower frequency merges work; higher frequency redistributes it.
// These are product starting prescriptions for trained lifters, not universal optimal doses.
export const equipmentWeeklyUnits: EquipmentCourse[] = [
  { label: '推力训练 A', doses: [dose('chest_01', 4), dose('chest_03', 3), dose('shoulders_04', 2), dose('shoulders_14', 4, [12, 20], 90), dose('arms_01', 4, [10, 15], 90), dose('shoulders_17', 2, [12, 20], 60)] },
  { label: '拉力训练 A', doses: [dose('back_01', 3), dose('back_15', 4), dose('back_07', 2, [10, 15], 90), dose('shoulders_03', 3, [12, 20], 90), dose('arms_08', 4, [10, 15], 90), dose('back_16', 3, [10, 15], 90), dose('shoulders_15', 2, [12, 20], 60), dose('arms_22', 4, [12, 20], 60)] },
  { label: '下肢训练 A', doses: [dose('legs_15', 4), dose('legs_03', 3, [10, 15], 90), dose('legs_01', 3, [10, 15], 90), dose('legs_05', 3), dose('legs_09', 4, [12, 20], 90), dose('legs_06', 4, [10, 20], 90), dose('core_01', 6, [10, 15], 90, 'chest'), dose('legs_22', 4, [12, 20], 60)] },
  { label: '推力训练 B', doses: [dose('chest_03', 3), dose('chest_07', 4, [12, 15], 90), dose('shoulders_04', 2), dose('shoulders_01', 4, [12, 20], 90), dose('arms_02', 4, [10, 15], 90), dose('shoulders_17', 2, [12, 20], 60)] },
  { label: '拉力训练 B', doses: [dose('back_01', 3), dose('back_08', 4), dose('back_07', 2, [10, 15], 90), dose('shoulders_07', 3, [12, 20], 90), dose('arms_07', 4, [10, 15], 90), dose('arms_09', 4, [10, 15], 90), dose('back_16', 3, [10, 15], 90), dose('shoulders_16', 2, [12, 20], 60), dose('arms_12', 4, [12, 20], 60)] },
  { label: '下肢训练 B', doses: [dose('legs_04', 4, [8, 10], 180), dose('legs_02', 3), dose('legs_03', 2, [10, 15], 90), dose('legs_01', 3, [10, 15], 90), dose('legs_05', 3), dose('legs_20', 4, [12, 20], 90), dose('legs_11', 4, [10, 20], 90), dose('core_07', 2, [10, 15], 60, 'back'), dose('core_13', 2, [8, 12], 60, 'shoulders'), dose('core_06', 4, [10, 15], 90, 'back'), dose('back_10', 2, [10, 15], 90)] },
];

export type DoseCredit = 'hypertrophy' | 'control' | 'stabilization';
export type DoseRequirement = { sets: number; kind: DoseCredit };
// Editorial starting doses for experienced balanced hypertrophy; not per-muscle scientific optima.
// Main muscles get a multi-exercise allocation; smaller auxiliaries have their own direct minimum.
export const equipmentMuscleTargets: Record<TrainingMuscle, DoseRequirement> = {
  chest: { sets: 14, kind: 'hypertrophy' }, lats: { sets: 10, kind: 'hypertrophy' }, upperBack: { sets: 8, kind: 'hypertrophy' },
  quads: { sets: 12, kind: 'hypertrophy' }, hamstrings: { sets: 10, kind: 'hypertrophy' }, glutes: { sets: 8, kind: 'hypertrophy' },
  calves: { sets: 8, kind: 'hypertrophy' }, frontDelts: { sets: 4, kind: 'hypertrophy' }, sideDelts: { sets: 8, kind: 'hypertrophy' }, rearDelts: { sets: 6, kind: 'hypertrophy' },
  biceps: { sets: 8, kind: 'hypertrophy' }, triceps: { sets: 8, kind: 'hypertrophy' }, core: { sets: 10, kind: 'hypertrophy' },
  rotator: { sets: 4, kind: 'control' }, scapular: { sets: 4, kind: 'control' }, erectors: { sets: 2, kind: 'stabilization' },
  traps: { sets: 6, kind: 'hypertrophy' }, abductors: { sets: 4, kind: 'hypertrophy' }, adductors: { sets: 4, kind: 'hypertrophy' },
  gastrocnemius: { sets: 4, kind: 'hypertrophy' }, soleus: { sets: 4, kind: 'hypertrophy' }, tibialis: { sets: 4, kind: 'hypertrophy' },
  abs: { sets: 6, kind: 'hypertrophy' }, obliques: { sets: 4, kind: 'hypertrophy' }, coreStability: { sets: 4, kind: 'control' },
  brachialis: { sets: 4, kind: 'hypertrophy' }, forearms: { sets: 4, kind: 'hypertrophy' }, wristExtensors: { sets: 4, kind: 'hypertrophy' },
};
export const equipmentRegionTargets: Record<TrainingRegion, DoseRequirement> = Object.fromEntries(
  Object.entries(trainingRegionMuscle).map(([region, muscle]) => [region, { ...equipmentMuscleTargets[muscle] }])
) as Record<TrainingRegion, DoseRequirement>;
// Regional chest allocations are overlapping emphasis doses, not independent muscles.
equipmentRegionTargets.chest_upper = { sets: 4, kind: 'hypertrophy' };
equipmentRegionTargets.chest_middle = { sets: 6, kind: 'hypertrophy' };
equipmentRegionTargets.chest_lower = { sets: 4, kind: 'hypertrophy' };
export const equipmentFunctionTargets: Record<TrainingFunction, number> = {
  horizontalPush: 6, inclinePush: 4, lowerChest: 4, verticalPull: 6, horizontalPull: 8, kneeDominant: 7, kneeExtension: 5,
  hipHinge: 4, hipExtension: 6, kneeFlexion: 6, shoulderPress: 4, shoulderAbduction: 8, rearShoulder: 6,
  externalRotation: 2, internalRotation: 2, scapularProtraction: 4, shoulderElevation: 6, hipAbduction: 4, hipAdduction: 4,
  straightKneeCalf: 4, bentKneeCalf: 4, dorsiflexion: 4, supinatedCurl: 8, neutralCurl: 4, overheadExtension: 4, elbowExtension: 4,
  wristFlexion: 4, wristExtension: 4, trunkFlexion: 6, trunkRotation: 4, antiRotation: 2, antiExtension: 2, spinalBracing: 2,
};
export const equipmentDoseEvidence = {
  volume: 'https://pubmed.ncbi.nlm.nih.gov/41343037/',
  guidance: 'https://pubmed.ncbi.nlm.nih.gov/41843416/',
  calfParticipation: 'https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2023.1272106/full',
};
