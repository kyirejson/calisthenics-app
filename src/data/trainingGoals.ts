import type { Goal } from '../types';

export const trainingGoals: Array<{ key: Goal; label: string; icon: 'chart' | 'shield' | 'dumbbell' }> = [
  { key: 'weight_loss', label: '减肥控重', icon: 'chart' },
  { key: 'street_mastery', label: '街头健身', icon: 'shield' },
  { key: 'equipment', label: '器械训练', icon: 'dumbbell' },
];

const retiredGoalLabels: Record<Exclude<Goal, 'weight_loss' | 'street_mastery' | 'equipment'>, string> = {
  fat_loss: '减脂塑形', gain: '增肌积累', strength: '力量进阶',
};

export function trainingGoalLabel(goal: Goal) {
  return trainingGoals.find((item) => item.key === goal)?.label || retiredGoalLabels[goal as keyof typeof retiredGoalLabels];
}
