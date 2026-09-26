import type { Exercise } from '../types';

export type WarmupAction = { id: string; title: string; dose: string; seconds: number; detail: string; exercise?: Exercise };
const bookExercises = require('./legacy/exercises.js') as Exercise[];

export function getWarmupActions(items: Exercise[]): WarmupAction[] {
  const actions: WarmupAction[] = [
    { id: 'raise', title: '原地踏步', dose: '60 秒', seconds: 60, detail: '轻松踏步、摆臂，逐渐暖起来，不冲刺。' },
    { id: 'mobilize', title: '肩腕与髋踝活动', dose: '60 秒', seconds: 60, detail: '手腕小幅转动、肩部绕环、髋与踝关节活动，各约 15 秒，只在舒适范围内进行。' },
  ];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.category) || !['push', 'pull', 'squat', 'legRaise', 'bridge', 'hspu'].includes(item.category)) continue;
    seen.add(item.category);
    if (item.category === 'hspu') {
      const wallPush = bookExercises.find((exercise) => exercise.id === 'push_01');
      actions.push({ id: 'hspu-prep', title: '墙壁俯卧撑', exercise: wallPush, dose: '2 组 × 5 次 · 组间休息 30 秒', seconds: 120, detail: '轻量推起与回落，检查肩腕活动是否舒适；热身不做头颈承重倒立。' });
      continue;
    }
    const candidates = bookExercises.filter((exercise) => exercise.category === item.category && exercise.step && exercise.step <= Math.max(1, (item.step || 1) - 1)).sort((a, b) => (a.step || 0) - (b.step || 0));
    const easier = candidates[0] || item;
    const next = candidates.length > 1 ? candidates[Math.min(1, candidates.length - 1)] : easier;
    const early = (item.step || 1) <= 2;
    actions.push({ id: `${item.category}-warm-1`, title: easier.name, exercise: easier, dose: `热身第 1 组 · ${early ? 5 : 10} 次`, seconds: early ? 45 : 75, detail: '用轻松幅度和速度完成，不接近力竭；做完休息约 30 秒。' });
    actions.push({ id: `${item.category}-warm-2`, title: next.name, exercise: next, dose: `热身第 2 组 · ${early ? 5 : 8} 次`, seconds: early ? 45 : 75, detail: '确认活动范围与呼吸稳定；觉得费力就减少次数。热身组不计入正式训练或解锁次数。' });
  }
  return actions;
}

export function warmupDuration(items: Exercise[]) {
  return getWarmupActions(items).reduce((sum, action) => sum + action.seconds, 0);
}
