import type { EquipmentSplit } from '../types';
import { equipmentWeeklyUnits as units, type EquipmentDose, type EquipmentCourse } from './equipmentDosePolicy';

function merge(label: string, doses: EquipmentDose[]): EquipmentCourse {
  const result = new Map<string, EquipmentDose>();
  for (const item of doses) {
    const previous = result.get(item.id);
    if (previous && (previous.range.join() !== item.range.join() || previous.rest !== item.rest || previous.basis !== item.basis || previous.perSide !== item.perSide)) {
      throw new Error('重复周剂量不能合并不同处方：' + item.id);
    }
    result.set(item.id, { ...item, sets: (previous?.sets || 0) + item.sets });
  }
  return { label, doses: [...result.values()] };
}
export function equipmentProgram(split: EquipmentSplit, frequency: number): EquipmentCourse[] {
  const all = units.flatMap(unit => unit.doses);
  if (split === 'ppl') {
    const push = [...units[0].doses, ...units[3].doses], pull = [...units[1].doses, ...units[4].doses], legs = [...units[2].doses, ...units[5].doses];
    if (frequency === 3) return [merge('推力训练', push), merge('拉力训练', pull), merge('下肢训练', legs)];
    if (frequency === 4) return [merge('推力训练', push), merge('拉力训练', pull), merge(units[2].label, units[2].doses), merge(units[5].label, units[5].doses)];
    if (frequency === 5) return [merge(units[0].label, units[0].doses), merge('拉力训练', pull), merge(units[2].label, units[2].doses), merge(units[3].label, units[3].doses), merge(units[5].label, units[5].doses)];
    if (frequency === 6) return units.map(unit => merge(unit.label, unit.doses));
  }
  if (split === 'upper_lower') {
    const upperA = [...units[0].doses, ...units[1].doses], upperB = [...units[3].doses, ...units[4].doses];
    const lowerA = units[2].doses, lowerB = units[5].doses;
    if (frequency === 2) return [merge('上肢训练', [...upperA, ...upperB]), merge('下肢训练', [...lowerA, ...lowerB])];
    if (frequency === 3) return [merge('上肢训练 A', upperA), merge('下肢训练', [...lowerA, ...lowerB]), merge('上肢训练 B', upperB)];
    if (frequency === 4) return [merge('上肢训练 A', upperA), merge('下肢训练 A', lowerA), merge('上肢训练 B', upperB), merge('下肢训练 B', lowerB)];
    const upperAux = (item: EquipmentDose) => item.auxiliary === 'upper';
    const lowerAux = (item: EquipmentDose) => item.auxiliary === 'lower';
    if (frequency === 5 || frequency === 6) return [
      merge('上肢训练 A', upperA.filter(item => !upperAux(item))), merge('下肢训练 A', frequency === 6 ? lowerA.filter(item => !lowerAux(item)) : lowerA),
      merge('上肢训练 B', upperB.filter(item => !upperAux(item))), merge('下肢训练 B', frequency === 6 ? lowerB.filter(item => !lowerAux(item)) : lowerB),
      merge('上肢训练 C', [...upperA, ...upperB].filter(upperAux)),
      ...(frequency === 6 ? [merge('下肢训练 C', [...lowerA, ...lowerB].filter(lowerAux))] : []),
    ];
  }
  if (split === 'bro' && (frequency === 5 || frequency === 6)) {
    const buckets: EquipmentDose[][] = Array.from({ length: frequency }, () => []);
    const groups: Record<string, number> = { chest: 0, back: 1, shoulders: 2, legs: 3, arms: 4 };
    for (const item of all) {
      const group = item.broDay;
      const supplementalLeg = item.auxiliary === 'lower' && item.broDay === 'legs';
      const slot = frequency === 6 && supplementalLeg ? 5 : groups[group];
      buckets[slot].push(item);
    }
    return ['胸部训练', '背部训练', '肩部训练', '腿部训练', '手臂训练', '下肢辅助训练'].slice(0, frequency).map((label, index) => merge(label, buckets[index]));
  }
  return [];
}
