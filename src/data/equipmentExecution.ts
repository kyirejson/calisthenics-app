import { equipmentFocus } from './equipmentLibrary';
import { equipmentTrainingRegions, trainingRegionMuscle } from './equipmentParticipation';

export const trainingMuscleLabels = {
  chest: '胸大肌', lats: '背阔肌', upperBack: '上背', quads: '股四头', hamstrings: '腘绳肌', glutes: '臀大肌',
  calves: '小腿跖屈', frontDelts: '肩前束', sideDelts: '肩中束', rearDelts: '肩后束', biceps: '肱二头', triceps: '肱三头', core: '躯干训练',
  rotator: '肩袖', scapular: '肩胛控制', erectors: '竖脊肌稳定', traps: '上斜方肌', abductors: '髋外展', adductors: '髋内收',
  gastrocnemius: '腓肠肌侧重', soleus: '比目鱼肌侧重', tibialis: '胫骨前肌', abs: '腹直肌', obliques: '腹斜肌', coreStability: '核心稳定',
  brachialis: '肱肌', forearms: '腕屈肌群', wristExtensors: '腕伸肌群',
} as const;
export type TrainingMuscle = keyof typeof trainingMuscleLabels;
export type MovementPattern = 'push' | 'pull' | 'knee' | 'hinge' | 'legCurl' | 'calf' | 'press' | 'sideRaise' | 'rearRaise' | 'curl' | 'extension' | 'core' | 'fly' | 'rotation' | 'scapular' | 'shrug' | 'hipAbduction' | 'hipAdduction' | 'dorsiflexion' | 'wristFlexion' | 'wristExtension' | 'other';
export const trainingFunctionLabels = {
  horizontalPush: '水平推胸', inclinePush: '上斜推胸', lowerChest: '下部胸肌侧重', verticalPull: '垂直拉', horizontalPull: '水平拉',
  kneeDominant: '膝主导复合', kneeExtension: '伸膝', hipHinge: '髋铰链', hipExtension: '髋伸展', kneeFlexion: '屈膝',
  shoulderPress: '肩推', shoulderAbduction: '肩外展', rearShoulder: '肩后束', externalRotation: '肩外旋', internalRotation: '肩内旋', scapularProtraction: '肩胛前伸',
  shoulderElevation: '肩胛上提', hipAbduction: '髋外展', hipAdduction: '髋内收', straightKneeCalf: '直膝提踵', bentKneeCalf: '屈膝提踵', dorsiflexion: '踝背屈',
  supinatedCurl: '旋后肘屈', neutralCurl: '中立／反握肘屈', overheadExtension: '过顶肘伸', elbowExtension: '体侧肘伸', wristFlexion: '腕屈', wristExtension: '腕伸',
  trunkFlexion: '躯干屈曲', trunkRotation: '躯干旋转', antiRotation: '抗旋转', antiExtension: '抗伸展', spinalBracing: '脊柱伸肌稳定',
} as const;
export type TrainingFunction = keyof typeof trainingFunctionLabels;
export type EquipmentExecution = {
  pattern: MovementPattern; muscle?: TrainingMuscle; direct: TrainingMuscle[]; indirect: TrainingMuscle[]; stabilizing: TrainingMuscle[];
  functions: TrainingFunction[]; regions: string[]; purpose: 'hypertrophy' | 'control';
  unilateral: boolean; compound: boolean; setupSeconds: number; repSeconds: number; sideSwitchSeconds: number; rampSeconds: number;
};
const mechanics: Record<string, { pattern: MovementPattern; functions: TrainingFunction[] }> = {};
function assign(pattern: MovementPattern, functions: TrainingFunction[], ids: string[]) {
  ids.forEach(id => { mechanics['equipment_' + id] = { pattern, functions }; });
}
assign('push', ['inclinePush'], ['chest_01', 'chest_02', 'chest_14', 'chest_19']);
assign('push', ['horizontalPush'], ['chest_03', 'chest_05', 'chest_08', 'chest_09', 'chest_15', 'chest_18', 'chest_20']);
assign('push', ['lowerChest'], ['chest_06', 'chest_12', 'chest_13', 'chest_17']);
assign('fly', [], ['chest_04', 'chest_10', 'chest_11', 'chest_16']);
assign('fly', ['lowerChest'], ['chest_07']);
assign('pull', ['verticalPull'], ['back_01', 'back_04', 'back_17']);
assign('pull', ['horizontalPull'], ['back_02', 'back_03', 'back_05', 'back_06', 'back_08', 'back_09', 'back_11', 'back_14', 'back_15']);
assign('pull', [], ['back_07', 'back_13']);
assign('hinge', ['spinalBracing'], ['back_10']);
assign('hinge', ['hipHinge', 'spinalBracing'], ['back_12', 'legs_04', 'legs_21']);
assign('hinge', ['hipExtension'], ['legs_05', 'legs_14']);
assign('shrug', ['shoulderElevation'], ['back_16']);
assign('press', ['shoulderPress'], ['shoulders_04', 'shoulders_06', 'shoulders_10', 'shoulders_11', 'shoulders_13']);
assign('sideRaise', ['shoulderAbduction'], ['shoulders_01', 'shoulders_02', 'shoulders_09', 'shoulders_12', 'shoulders_14']);
assign('rearRaise', ['rearShoulder'], ['shoulders_03', 'shoulders_05', 'shoulders_07', 'shoulders_08']);
assign('rotation', ['externalRotation'], ['shoulders_15']);
assign('rotation', ['internalRotation'], ['shoulders_16']);
assign('scapular', ['scapularProtraction'], ['shoulders_17']);
assign('knee', ['kneeDominant'], ['legs_02', 'legs_07', 'legs_08', 'legs_12', 'legs_13', 'legs_15', 'legs_16', 'legs_17', 'legs_18', 'legs_19']);
assign('extension', ['kneeExtension'], ['legs_03']);
assign('legCurl', ['kneeFlexion'], ['legs_01', 'legs_10']);
assign('calf', ['straightKneeCalf'], ['legs_06']);
assign('calf', ['bentKneeCalf'], ['legs_11']);
assign('hipAdduction', ['hipAdduction'], ['legs_09']);
assign('hipAbduction', ['hipAbduction'], ['legs_20']);
assign('dorsiflexion', ['dorsiflexion'], ['legs_22']);
assign('extension', ['overheadExtension'], ['arms_01', 'arms_04', 'arms_15']);
assign('extension', ['elbowExtension'], ['arms_02', 'arms_03', 'arms_05', 'arms_06', 'arms_20']);
assign('curl', ['supinatedCurl'], ['arms_07', 'arms_08', 'arms_10', 'arms_11', 'arms_13', 'arms_16', 'arms_18', 'arms_19']);
assign('pull', ['verticalPull'], ['arms_14']);
assign('curl', ['neutralCurl'], ['arms_09', 'arms_17', 'arms_21']);
assign('wristFlexion', ['wristFlexion'], ['arms_12']);
assign('wristExtension', ['wristExtension'], ['arms_22']);
assign('core', ['trunkFlexion'], ['core_01', 'core_02', 'core_03', 'core_05', 'core_11', 'core_12']);
assign('core', ['antiExtension'], ['core_04', 'core_09', 'core_13']);
assign('core', ['antiRotation'], ['core_07', 'core_14']);
assign('core', ['trunkRotation'], ['core_06', 'core_10']);
assign('core', [], ['core_08']);
const unilateral = new Set(['shoulders_01', 'shoulders_09', 'shoulders_15', 'shoulders_16', 'back_03', 'back_11', 'legs_08', 'legs_13', 'legs_14', 'legs_18', 'legs_19', 'legs_21', 'core_06', 'core_07', 'core_13', 'core_14', 'chest_20', 'arms_05', 'arms_13'].map(id => 'equipment_' + id));
export function equipmentLoadBasis(id: string): 'machine' | 'total' | 'per_hand' | 'bodyweight' {
  const gear = equipmentFocus[id]?.gear || [];
  return gear.includes('dumbbell') ? 'per_hand' : gear.includes('barbell') || gear.includes('smith') ? 'total'
    : gear.includes('bodyweight') || gear.includes('accessory') ? 'bodyweight' : 'machine';
}
export function equipmentExecution(id: string): EquipmentExecution {
  const tags = equipmentFocus[id];
  const trainingRegions = equipmentTrainingRegions[id] || [];
  const { pattern = 'other', functions = [] } = mechanics[id] || {};
  let direct: TrainingMuscle[] = [...new Set(trainingRegions.map(region => trainingRegionMuscle[region]))];
  const indirect: TrainingMuscle[] = [], stabilizing: TrainingMuscle[] = [];
  // Browsing emphases are not equivalent to prime-mover set credit.
  if (pattern === 'knee') { direct = ['quads']; indirect.push('glutes', 'adductors'); stabilizing.push('erectors', 'coreStability'); }
  if (pattern === 'press') { direct = ['frontDelts']; indirect.push('sideDelts', 'triceps'); }
  if (pattern === 'push') indirect.push('frontDelts', 'triceps');
  if (pattern === 'pull' && functions.includes('horizontalPull')) {
    direct = [trainingRegions.includes('back_upper') ? 'upperBack' : 'lats'];
    indirect.push('biceps', 'rearDelts');
    if (direct[0] !== 'lats') indirect.push('lats');
  }
  if (functions.includes('verticalPull')) { direct = ['lats']; indirect.push('biceps'); }
  if (id === 'equipment_arms_14') { direct = ['biceps']; indirect.push('lats'); }
  if (pattern === 'curl' && functions.includes('supinatedCurl')) { direct = ['biceps']; indirect.push('brachialis'); }
  if (functions.includes('neutralCurl')) { direct = ['brachialis']; indirect.push('biceps', 'forearms'); }
  if (id === 'equipment_shoulders_05') { direct = ['rearDelts']; indirect.push('rotator'); }
  if (pattern === 'hinge' && functions.includes('hipHinge')) { direct = ['hamstrings', 'glutes']; stabilizing.push('erectors', 'coreStability'); }
  // Neutral-spine Roman-chair work is posterior-chain/erector stabilization, not isolated dynamic spinal extension.
  if (id === 'equipment_back_10') { direct = ['glutes', 'hamstrings']; stabilizing.push('erectors'); }
  if (pattern === 'calf') direct.push('calves');
  if (id.startsWith('equipment_core_')) direct.push('core');
  if (id === 'equipment_core_04' || id === 'equipment_core_09') { direct = ['core', 'coreStability']; stabilizing.push('abs', 'obliques'); }
  const purpose = ['rotation', 'scapular'].includes(pattern) || functions.includes('antiExtension') || functions.includes('antiRotation') ? 'control' : 'hypertrophy';
  const regions = trainingRegions.filter(region => direct.includes(trainingRegionMuscle[region]) || (region === 'back_erectors' && stabilizing.includes('erectors')));
  const compound = ['push', 'pull', 'knee', 'hinge', 'press'].includes(pattern) && !['equipment_back_07', 'equipment_back_13'].includes(id);
  const heavySetup = tags?.gear.some(gear => gear === 'barbell' || gear === 'smith');
  return { pattern, muscle: direct[0], direct: [...new Set(direct)], indirect: [...new Set(indirect)], stabilizing: [...new Set(stabilizing)], functions, regions, purpose,
    unilateral: unilateral.has(id), compound, setupSeconds: heavySetup ? 90 : tags?.gear.includes('cable') ? 60 : 45,
    repSeconds: 3, sideSwitchSeconds: unilateral.has(id) ? 15 : 0, rampSeconds: compound ? heavySetup ? 180 : 120 : 45 };
}
