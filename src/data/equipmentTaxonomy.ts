export type EquipmentGroup = 'chest' | 'shoulders' | 'back' | 'legs' | 'core' | 'arms';
export const equipmentGroups: Array<{ key: EquipmentGroup; label: string }> = [
  { key: 'chest', label: '胸部' }, { key: 'shoulders', label: '肩部' }, { key: 'back', label: '背部' },
  { key: 'legs', label: '腿部' }, { key: 'core', label: '核心' }, { key: 'arms', label: '手臂' },
];
export const equipmentGear = [
  { key: 'dumbbell', label: '哑铃' }, { key: 'barbell', label: '杠铃' }, { key: 'smith', label: '史密斯' },
  { key: 'machine', label: '固定器械' }, { key: 'cable', label: '绳索' }, { key: 'bodyweight', label: '自重器材' }, { key: 'accessory', label: '辅助器材' },
] as const;
export type GearKey = typeof equipmentGear[number]['key'];
