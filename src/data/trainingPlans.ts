import type { Goal, Profile } from '../types';

export type PlanDay = {
  /** Recurring plans use weekday 0–6; the seven-day starter defines ordinal days 1–7. */
  day: number;
  type: 'strength' | 'cardio' | 'recovery';
  title: string;
  workoutId?: string;
  tip: string;
};

export type TrainingPlanDefinition = {
  id: string;
  name: string;
  shortName: string;
  badge: string;
  description: string;
  suitableFor: string;
  frequency: number;
  durationWeeks: number;
  goals: Goal[];
  minExperience: 'beginner' | 'intermediate' | 'advanced';
  days: PlanDay[];
};

export type CycleMeta = {
  week: number;
  cycleWeek: number;
  label: string;
  setMultiplier: number;
  rirTarget: number;
  note: string;
  isDeload: boolean;
};

const recovery = (day: number, title = '主动恢复') : PlanDay => ({
  day,
  type: 'recovery',
  title,
  tip: '轻松步行、活动关节、保证睡眠与蛋白质摄入。',
});

export const trainingPlans: TrainingPlanDefinition[] = [
  {
    id: 'foundation_2',
    name: '稳健筑基 · 全身两练',
    shortName: '全身两练',
    badge: '低频',
    description: 'A/B 全身课间隔 72 小时，以最小有效训练量建立长期习惯。',
    suitableFor: '每周只能安排两次、初学者、恢复期或时间紧张的人群',
    frequency: 2,
    durationWeeks: 12,
    goals: ['health', 'fat_loss', 'gain', 'strength'],
    minExperience: 'beginner',
    days: [
      { day: 1, type: 'strength', title: '全身训练 A', workoutId: 'fullA', tip: '优先完成六艺基础动作，保留 2~3 次余力。' },
      { day: 4, type: 'strength', title: '全身训练 B', workoutId: 'fullB', tip: '保持全幅度和稳定节奏，不需要额外赶进度。' },
    ],
  },
  {
    id: 'rebirth_7',
    name: '涅槃起步 · 7 天重启',
    shortName: '7天重启',
    badge: '零基础',
    description: '从启用当天开始 7 天温和破冰；第 8 天恢复，随后自动衔接基础三练。',
    suitableFor: '久坐重启、零基础、较大体重或长时间未训练者',
    frequency: 4,
    durationWeeks: 1,
    goals: ['fat_loss', 'health', 'gain', 'strength'],
    minExperience: 'beginner',
    days: [
      { day: 1, type: 'strength', title: '上肢推与核心轻探', workoutId: 'dailyPush', tip: '全程保留 3~4 次余力，动作慢而稳定。' },
      recovery(2, '关节与肌腱适应'),
      { day: 3, type: 'strength', title: '下肢与拉力轻探', workoutId: 'dailyPull', tip: '先熟悉发力感，不追求力竭。' },
      recovery(4, '神经系统恢复'),
      { day: 5, type: 'strength', title: '基础全身协同', workoutId: 'fullA', tip: '使用当前第一式，完成标准动作。' },
      recovery(6, '软组织恢复'),
      { day: 7, type: 'strength', title: '破冰验收课', workoutId: 'fullB', tip: '轻松完成并记录动作质量。' },
    ],
  },
  {
    id: 'balanced_3',
    name: '基础蜕变 · 全身三练',
    shortName: '全身三练',
    badge: '推荐',
    description: 'A/B 全身课双周轮换，覆盖六艺并留足 48 小时恢复窗口。',
    suitableFor: '绝大多数初中级训练者，以及健康、减脂和稳步增肌目标',
    frequency: 3,
    durationWeeks: 12,
    goals: ['health', 'fat_loss', 'gain', 'strength'],
    minExperience: 'beginner',
    days: [
      { day: 1, type: 'strength', title: '全身训练 A', workoutId: 'fullA', tip: '推、蹲、桥和核心协同。' },
      { day: 3, type: 'strength', title: '全身训练 B', workoutId: 'fullB', tip: '拉、倒立推、蹲和悬垂。' },
      { day: 5, type: 'strength', title: '全身巩固课', workoutId: 'fullComprehensive', tip: '用稳定动作完成本周主要训练量。' },
    ],
  },
  {
    id: 'fatloss_4',
    name: '燃脂重塑 · 力量有氧四练',
    shortName: '燃脂四练',
    badge: '减脂',
    description: '三次力量训练保住肌肉，一次低到中强度有氧提高每周活动量。',
    suitableFor: '体重下降、减脂塑形和改善心肺的人群',
    frequency: 4,
    durationWeeks: 12,
    goals: ['fat_loss', 'health'],
    minExperience: 'beginner',
    days: [
      { day: 1, type: 'strength', title: '全身力量 A', workoutId: 'fullA', tip: '优先保持训练质量与肌肉刺激。' },
      { day: 3, type: 'cardio', title: '轻松跑或快走', tip: '保持可对话强度 25~40 分钟，不用冲刺。' },
      { day: 5, type: 'strength', title: '全身力量 B', workoutId: 'fullB', tip: '稳定完成，避免因热量缺口盲目加量。' },
      { day: 0, type: 'strength', title: '全身循环巩固', workoutId: 'fullComprehensive', tip: '缩短空闲时间，但动作不能变形。' },
    ],
  },
  {
    id: 'strength_4',
    name: '力量进阶 · 上下肢四练',
    shortName: '力量四练',
    badge: '进阶',
    description: '上下肢分化，每条动力链每周刺激两次，按 3:1 周期逐步加量。',
    suitableFor: '已有稳定动作基础、以力量和式阶突破为目标的人群',
    frequency: 4,
    durationWeeks: 16,
    goals: ['strength', 'gain'],
    minExperience: 'intermediate',
    days: [
      { day: 1, type: 'strength', title: '上肢力量 I', workoutId: 'splitUpper', tip: '以动作难度和标准度为第一优先级。' },
      { day: 2, type: 'strength', title: '下肢核心 I', workoutId: 'splitLower', tip: '全幅度控制，建立稳定支撑。' },
      { day: 4, type: 'strength', title: '上肢力量 II', workoutId: 'splitUpper', tip: '重复高质量刺激，避免力竭。' },
      { day: 5, type: 'strength', title: '下肢核心 II', workoutId: 'splitLower', tip: '完成后安排两天充分恢复。' },
    ],
  },
  {
    id: 'muscle_5',
    name: '增肌积累 · PPL 五练',
    shortName: '增肌五练',
    badge: '增肌',
    description: '推、拉、腿加上下肢分化，提高每周有效训练量并周期减载。',
    suitableFor: '恢复和饮食稳定、已有至少三个月训练经验的人群',
    frequency: 5,
    durationWeeks: 16,
    goals: ['gain', 'strength'],
    minExperience: 'intermediate',
    days: [
      { day: 1, type: 'strength', title: '推力专项', workoutId: 'pplPush', tip: '胸、肩、三头与核心。' },
      { day: 2, type: 'strength', title: '拉力专项', workoutId: 'pplPull', tip: '背部、肱二头与握力。' },
      { day: 3, type: 'strength', title: '下肢后链', workoutId: 'pplLegs', tip: '深蹲、桥与举腿。' },
      { day: 5, type: 'strength', title: '上肢容量', workoutId: 'splitUpper', tip: '用中等难度积累高质量次数。' },
      { day: 6, type: 'strength', title: '下肢容量', workoutId: 'splitLower', tip: '完成本周下肢与核心总量。' },
    ],
  },
  {
    id: 'mastery_6',
    name: '登峰造极 · 年度六练',
    shortName: '年度六练',
    badge: '高阶',
    description: '继承小程序 365 天计划：PPL 双循环，并采用三周递增、一周减载。',
    suitableFor: '训练、睡眠和饮食都稳定的高阶训练者',
    frequency: 6,
    durationWeeks: 52,
    goals: ['gain', 'strength'],
    minExperience: 'advanced',
    days: [
      { day: 1, type: 'strength', title: '推力专项 I', workoutId: 'pplPush', tip: '保留目标余力，不以失败次数换训练量。' },
      { day: 2, type: 'strength', title: '拉力专项 I', workoutId: 'pplPull', tip: '肩胛先行，完成全程控制。' },
      { day: 3, type: 'strength', title: '下肢后链 I', workoutId: 'pplLegs', tip: '兼顾膝主导与髋主导动作。' },
      { day: 4, type: 'strength', title: '推力专项 II', workoutId: 'pplPush', tip: '根据恢复状态降低一档动作也可以。' },
      { day: 5, type: 'strength', title: '拉力专项 II', workoutId: 'pplPull', tip: '避免肘腕不适下硬撑。' },
      { day: 6, type: 'strength', title: '下肢后链 II', workoutId: 'pplLegs', tip: '完成后进入深度恢复日。' },
    ],
  },
];

export function getTrainingPlan(id?: string) {
  return trainingPlans.find((plan) => plan.id === id) || trainingPlans.find((plan) => plan.id === 'balanced_3')!;
}

export function recommendPlanId(profile: Pick<Profile, 'goal' | 'experience' | 'frequency'>) {
  if (profile.frequency <= 2) return 'foundation_2';
  if (profile.experience === 'beginner') {
    if ((profile.goal === 'fat_loss' || profile.goal === 'health') && profile.frequency >= 4) return 'fatloss_4';
    return profile.frequency >= 4 ? 'rebirth_7' : 'balanced_3';
  }
  if (profile.goal === 'fat_loss' || profile.goal === 'health') return profile.frequency >= 4 ? 'fatloss_4' : 'balanced_3';
  if (profile.goal === 'gain') return profile.experience === 'advanced' && profile.frequency >= 6 ? 'mastery_6' : profile.frequency >= 5 ? 'muscle_5' : profile.frequency >= 4 ? 'strength_4' : 'balanced_3';
  if (profile.goal === 'strength') return profile.experience === 'advanced' && profile.frequency >= 6 ? 'mastery_6' : profile.frequency >= 5 ? 'muscle_5' : profile.frequency >= 4 ? 'strength_4' : 'balanced_3';
  return 'balanced_3';
}

export function getCycleMeta(profile: Pick<Profile, 'planStartedAt'>, date = new Date()): CycleMeta {
  const startDay = localDayNumber(new Date(profile.planStartedAt || date.toISOString()));
  const nowDay = localDayNumber(date);
  const week = Math.max(1, Math.floor((nowDay - startDay) / 7) + 1);
  const cycleWeek = ((week - 1) % 4) + 1;
  const configs: Record<number, Omit<CycleMeta, 'week' | 'cycleWeek'>> = {
    1: { label: '适应周', setMultiplier: 0.9, rirTarget: 3, note: '建立动作轨迹，保留 3 次余力。', isDeload: false },
    2: { label: '积累周', setMultiplier: 1, rirTarget: 2, note: '完成计划训练量，保留 2 次余力。', isDeload: false },
    3: { label: '强化周', setMultiplier: 1.2, rirTarget: 1, note: '小幅增加组数，仍不追求动作失败。', isDeload: false },
    4: { label: '减载周', setMultiplier: 0.6, rirTarget: 4, note: '组数下降约 40%，让肌腱和神经恢复。', isDeload: true },
  };
  return { week, cycleWeek, ...configs[cycleWeek] };
}

export function getPlanDay(profile: Profile, date = new Date()) {
  const selectedPlan = getTrainingPlan(profile.planId);
  const cycle = getCycleMeta(profile, date);
  if (selectedPlan.id === 'rebirth_7') {
    const start = new Date(profile.planStartedAt || date.toISOString());
    const elapsedDays = localDayNumber(date) - localDayNumber(start);
    if (elapsedDays < 0) {
      return { plan: selectedPlan, day: recovery(date.getDay(), '计划尚未开始'), cycle, phase: 'starter' as const };
    }
    if (elapsedDays < 7) {
      const starterDay = selectedPlan.days[elapsedDays];
      return { plan: selectedPlan, day: { ...starterDay, day: date.getDay() }, cycle, phase: 'starter' as const, dayNumber: elapsedDays + 1 };
    }

    // The starter is a one-time course. Its first follow-on day is recovery after the day-7 assessment.
    const continuationPlan = getTrainingPlan('balanced_3');
    const continuationStart = new Date(start);
    continuationStart.setDate(continuationStart.getDate() + 7);
    const continuationCycle = getCycleMeta({ planStartedAt: continuationStart.toISOString() }, date);
    const continuationDay = (elapsedDays - 7) % 7;
    const day = continuationDay === 0
      ? recovery(date.getDay(), elapsedDays === 7 ? '重启后恢复日' : '主动恢复')
      : resolveScheduledDay(continuationPlan, continuationDay, date, continuationCycle);
    return { plan: continuationPlan, day, cycle: continuationCycle, phase: 'continuation' as const, dayNumber: elapsedDays + 1 };
  }
  return { plan: selectedPlan, day: resolveScheduledDay(selectedPlan, date.getDay(), date, cycle), cycle, phase: 'regular' as const };
}

function resolveScheduledDay(plan: TrainingPlanDefinition, scheduleDay: number, date: Date, cycle: CycleMeta): PlanDay {
  const scheduled = plan.days.find((item) => item.day === scheduleDay);
  if (!scheduled) return recovery(date.getDay());
  const day = plan.id === 'balanced_3' && scheduleDay === 5
    ? { ...scheduled, workoutId: cycle.week % 2 === 0 ? 'fullB' : 'fullComprehensive' }
    : scheduled;
  return { ...day, day: date.getDay() };
}

function localDayNumber(date: Date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

export function getWeekSchedule(profile: Profile, anchor = new Date()) {
  const plan = getTrainingPlan(profile.planId);
  const first = new Date(anchor);
  if (plan.id !== 'rebirth_7') {
    const jsDay = first.getDay();
    first.setDate(first.getDate() - (jsDay === 0 ? 6 : jsDay - 1));
  }
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return { date, ...getPlanDay(profile, date).day };
  });
}
