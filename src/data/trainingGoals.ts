import type { Goal } from '../types';

export const trainingGoals: Array<{ key: Goal; label: string; icon: string; description: string }> = [
  { key: 'weight_loss', label: '减肥控重', icon: '↘', description: '以可持续减重为主；每周 2–3 次全身力量保肌，其余训练日做低冲击有氧。' },
  { key: 'street_mastery', label: '囚徒健身 · 六艺十式', icon: '六', description: '按原书选择每周 2、3 或 6 练，循序练习六艺；动作达标后才晋级。' },
];

const retiredGoalLabels: Record<Exclude<Goal, 'weight_loss' | 'street_mastery'>, string> = {
  fat_loss: '减脂塑形', gain: '增肌积累', strength: '力量进阶',
};

export function trainingGoalLabel(goal: Goal) {
  return trainingGoals.find((item) => item.key === goal)?.label || retiredGoalLabels[goal as keyof typeof retiredGoalLabels];
}
