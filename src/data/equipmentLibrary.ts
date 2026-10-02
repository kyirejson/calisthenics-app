import { equipmentMovements } from './equipmentMovements';
import { equipmentAdditions } from './equipmentAdditions';
import { recommendationTiers } from './equipmentRecommendations';
import { equipmentGear, type GearKey } from './equipmentTaxonomy';
export { equipmentGear } from './equipmentTaxonomy';
export type { GearKey } from './equipmentTaxonomy';
import type { EquipmentGroup, EquipmentMovement } from './equipment';

export type MuscleZone = 'chestUpper' | 'chestMiddle' | 'chestLower' | 'shoulderFront' | 'shoulderSide' | 'shoulderRear' | 'rotator' | 'lats' | 'upperBack' | 'erectors' | 'quads' | 'hamstrings' | 'glutes' | 'adductors' | 'gastrocnemius' | 'soleus' | 'abs' | 'obliques' | 'deepCore' | 'biceps' | 'triceps' | 'brachialis' | 'forearms' | 'serratus' | 'traps' | 'abductors' | 'tibialis';
export type MuscleRegion = { key: string; group: EquipmentGroup; label: string; description: string; zones: MuscleZone[]; view: 'front' | 'back' };
// Regions are browsing emphases, not claims that an exercise isolates one muscle.
export const equipmentMuscleRegions: MuscleRegion[] = [
  { key: 'chest_upper', group: 'chest', label: '上胸', description: '胸大肌 · 锁骨部', zones: ['chestUpper'], view: 'front' },
  { key: 'chest_middle', group: 'chest', label: '中胸', description: '胸大肌 · 胸肋部', zones: ['chestMiddle'], view: 'front' },
  { key: 'chest_lower', group: 'chest', label: '下胸', description: '胸大肌 · 下部侧重', zones: ['chestLower'], view: 'front' },
  { key: 'shoulders_front', group: 'shoulders', label: '前束', description: '三角肌 · 前束', zones: ['shoulderFront'], view: 'front' },
  { key: 'shoulders_side', group: 'shoulders', label: '中束', description: '三角肌 · 中束', zones: ['shoulderSide'], view: 'front' },
  { key: 'shoulders_rear', group: 'shoulders', label: '后束', description: '三角肌 · 后束', zones: ['shoulderRear'], view: 'back' },
  { key: 'shoulders_rotator', group: 'shoulders', label: '肩袖', description: '肩袖内外旋 · 多肌协同', zones: ['rotator'], view: 'back' },
  { key: 'shoulders_scapular', group: 'shoulders', label: '肩胛控制', description: '前锯肌等 · 肩胛运动协同', zones: ['serratus'], view: 'front' },
  { key: 'back_lats', group: 'back', label: '背阔肌', description: '背阔肌 · 肩关节拉力', zones: ['lats'], view: 'back' },
  { key: 'back_upper', group: 'back', label: '上背肌群', description: '斜方肌 · 菱形肌', zones: ['upperBack'], view: 'back' },
  { key: 'back_erectors', group: 'back', label: '竖脊肌', description: '竖脊肌 · 后链协同', zones: ['erectors'], view: 'back' },
  { key: 'back_traps', group: 'back', label: '上斜方肌', description: '上斜方肌 · 肩胛上提', zones: ['traps'], view: 'back' },
  { key: 'legs_quads', group: 'legs', label: '股四头肌', description: '大腿前侧 · 股四头肌', zones: ['quads'], view: 'front' },
  { key: 'legs_hamstrings', group: 'legs', label: '腘绳肌', description: '大腿后侧 · 腘绳肌群', zones: ['hamstrings'], view: 'back' },
  { key: 'legs_glutes', group: 'legs', label: '臀肌', description: '臀大肌 · 髋伸展', zones: ['glutes'], view: 'back' },
  { key: 'legs_abductors', group: 'legs', label: '髋外展肌群', description: '臀中 / 小肌等 · 髋外展', zones: ['abductors'], view: 'back' },
  { key: 'legs_adductors', group: 'legs', label: '内收肌群', description: '大腿内侧 · 内收肌群', zones: ['adductors'], view: 'front' },
  { key: 'legs_gastrocnemius', group: 'legs', label: '腓肠肌', description: '小腿 · 腓肠肌侧重', zones: ['gastrocnemius'], view: 'back' },
  { key: 'legs_soleus', group: 'legs', label: '比目鱼肌', description: '小腿 · 比目鱼肌侧重', zones: ['soleus'], view: 'back' },
  { key: 'legs_tibialis', group: 'legs', label: '胫骨前肌', description: '小腿前侧 · 踝背屈', zones: ['tibialis'], view: 'front' },
  { key: 'core_abs', group: 'core', label: '腹直肌', description: '腹直肌 · 多肌协同', zones: ['abs'], view: 'front' },
  { key: 'core_obliques', group: 'core', label: '腹斜肌', description: '腹内斜肌 · 腹外斜肌', zones: ['obliques'], view: 'front' },
  { key: 'core_stability', group: 'core', label: '核心稳定', description: '腹横肌等 · 多肌协同', zones: ['deepCore'], view: 'front' },
  { key: 'arms_biceps', group: 'arms', label: '肱二头肌', description: '上臂前侧 · 肱二头肌', zones: ['biceps'], view: 'front' },
  { key: 'arms_triceps', group: 'arms', label: '肱三头肌', description: '上臂后侧 · 肱三头肌', zones: ['triceps'], view: 'back' },
  { key: 'arms_brachialis', group: 'arms', label: '肱肌', description: '肱肌 · 肘屈曲协同', zones: ['brachialis'], view: 'front' },
  { key: 'arms_forearms', group: 'arms', label: '前臂 / 腕屈', description: '前臂屈肌群 · 握持协同', zones: ['forearms'], view: 'front' },
  { key: 'arms_wrist_extensors', group: 'arms', label: '腕伸肌群', description: '前臂伸肌群 · 腕伸', zones: ['forearms'], view: 'back' },
];
export type EquipmentFocus = { regions: string[]; gear: GearKey[] };
// Explicit ID mappings: no guessing from marketing prose in legacy targetMuscles.
const focus: Record<string, EquipmentFocus> = {};
function assign(group: EquipmentGroup, rows: Array<[string[], GearKey[]]>) {
  rows.forEach(([regions, gear], index) => { focus[`equipment_${group}_${String(index + 1).padStart(2, '0')}`] = { regions: regions.map(region => `${group}_${region}`), gear }; });
}
assign('chest', [
  [['upper'], ['dumbbell']], [['upper'], ['smith']], [['middle'], ['machine']], [['middle'], ['machine']],
  [['middle'], ['dumbbell']], [['lower'], ['bodyweight']], [['lower'], ['cable']], [['middle'], ['barbell']],
  [['middle'], ['smith']], [['upper'], ['cable']], [['middle'], ['cable']], [['lower'], ['dumbbell']],
  [['lower'], ['machine']], [['upper'], ['barbell']], [['middle'], ['accessory']], [['middle'], ['dumbbell']],
  [['lower'], ['barbell']], [['middle'], ['dumbbell']],
]);
assign('shoulders', [
  [['side'], ['cable']], [['side'], ['dumbbell']], [['rear'], ['machine']], [['front', 'side'], ['machine']],
  [['rear', 'rotator'], ['cable']], [['front', 'side'], ['dumbbell']], [['rear'], ['cable']], [['rear'], ['dumbbell']],
  [['side'], ['dumbbell']], [['front'], ['barbell']], [['front', 'side'], ['dumbbell']], [['side'], ['cable']], [['front'], ['smith']],
]);
assign('back', [
  [['lats'], ['machine']], [['upper'], ['machine']], [['lats'], ['cable']], [['lats'], ['bodyweight']],
  [['lats', 'upper'], ['barbell']], [['lats', 'upper'], ['cable']], [['lats'], ['cable']], [['upper'], ['machine']],
  [['lats', 'upper'], ['smith']], [['erectors'], ['accessory']], [['lats', 'upper'], ['dumbbell']], [['erectors'], ['barbell']], [['lats'], ['cable']],
]);
assign('legs', [
  [['hamstrings'], ['machine']], [['quads', 'glutes'], ['machine']], [['quads'], ['machine']], [['hamstrings', 'glutes'], ['barbell']],
  [['glutes'], ['machine']], [['gastrocnemius'], ['machine']], [['quads', 'glutes'], ['barbell']], [['quads', 'glutes'], ['dumbbell']],
  [['adductors'], ['machine']], [['hamstrings'], ['machine']], [['soleus'], ['machine']], [['quads', 'glutes'], ['barbell']],
  [['quads', 'glutes'], ['dumbbell']], [['glutes'], ['machine']],
]);
assign('core', [
  [['abs'], ['cable']], [['abs'], ['bodyweight']], [['abs'], ['machine']], [['abs', 'stability'], ['accessory']],
  [['abs'], ['accessory']], [['obliques'], ['cable']], [['obliques', 'stability'], ['cable']], [['obliques'], ['accessory']],
  [['abs', 'obliques', 'stability'], ['accessory']], [['obliques'], ['accessory']],
]);
assign('arms', [
  [['triceps'], ['cable']], [['triceps'], ['cable']], [['triceps'], ['bodyweight']], [['triceps'], ['barbell']],
  [['triceps'], ['cable']], [['triceps'], ['dumbbell']], [['biceps'], ['dumbbell']], [['biceps', 'brachialis'], ['barbell']],
  [['brachialis', 'forearms'], ['dumbbell']], [['biceps', 'brachialis'], ['barbell']], [['biceps'], ['dumbbell']],
  [['forearms'], ['dumbbell']], [['biceps'], ['dumbbell']], [['biceps'], ['bodyweight']],
]);
export const equipmentFocus: Readonly<Record<string, EquipmentFocus>> = focus;
for (const item of equipmentAdditions) focus[item.id] = { regions: item.regions, gear: item.gear };
export type EquipmentLibraryFilters = { group: EquipmentGroup; region: string; gear: GearKey | 'all'; query: string };
export const initialEquipmentFilters: EquipmentLibraryFilters = { group: 'chest', region: 'chest_upper', gear: 'all', query: '' };
export function getEquipmentRegions(group: EquipmentGroup) { return equipmentMuscleRegions.filter(region => region.group === group); }
export function getInitialEquipmentRegion(group: EquipmentGroup) { return getEquipmentRegions(group)[0].key; }
export function getEquipmentMuscleLabel(id: string) {
  const regions = equipmentFocus[id]?.regions || [];
  const matches = regions.map(key => equipmentMuscleRegions.find(region => region.key === key)).filter((item): item is MuscleRegion => Boolean(item));
  if (matches[0]?.group === 'chest' || matches.length === 1) return matches[0]?.description || '';
  if (matches[0]?.group === 'shoulders' && matches.every(item => ['shoulders_front', 'shoulders_side', 'shoulders_rear'].includes(item.key))) return '三角肌 · ' + matches.map(item => item.label).join(' / ');
  return matches.map(item => item.label).join(' / ');
}
export function filterEquipmentMovements(filters: EquipmentLibraryFilters): EquipmentMovement[] {
  const needle = filters.query.trim().toLocaleLowerCase();
  const groupKeywords: Record<EquipmentGroup, string> = { chest: '胸部', shoulders: '肩部', back: '背部', legs: '腿部 下肢', core: '核心 腹部', arms: '手臂 上肢' };
  const result = equipmentMovements.filter(movement => {
    const tags = equipmentFocus[movement.id];
    if (filters.gear !== 'all' && !tags?.gear.includes(filters.gear)) return false;
    if (needle) {
      const gearLabels = tags?.gear.map(key => equipmentGear.find(item => item.key === key)?.label).join(' ') || '';
      const regions = tags?.regions.map(key => equipmentMuscleRegions.find(region => region.key === key)).filter(Boolean) || [];
      return [movement.name, movement.nameEn, movement.categoryLabel, groupKeywords[movement.group], movement.targetMuscles,
        ...(movement.equipment || []), gearLabels, ...regions.flatMap(region => [region?.label, region?.description])]
        .some(value => value?.toLocaleLowerCase().includes(needle));
    }
    return movement.group === filters.group && tags?.regions.includes(filters.region);
  });
  // Recommendation priority within the same browsing target; stable ties are not an absolute ranking.
  const upperOrder = ['equipment_chest_01', 'equipment_chest_02', 'equipment_chest_19', 'equipment_chest_14', 'equipment_chest_10'];
  result.sort((a, b) => recommendationTiers.indexOf(a.recommendation.tier) - recommendationTiers.indexOf(b.recommendation.tier)
    || (!needle && filters.region === 'chest_upper' ? (upperOrder.indexOf(a.id) < 0 ? 999 : upperOrder.indexOf(a.id)) - (upperOrder.indexOf(b.id) < 0 ? 999 : upperOrder.indexOf(b.id)) : 0));
  return result;
}
