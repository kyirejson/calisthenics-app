import type { Profile } from '../types';
import { preferredSessionMinutes } from './trainingPrescription';
import { trainingGoalLabel } from './trainingGoals';

export const PERSONAL_PLAN_ID = 'personal_v1';
export const PRISONER_PLAN_ID = 'prisoner_six_arts_v1';
export const RETIRED_PLAN_ID = 'retired_no_plan';

export type PlanDay = {
  day: number;
  type: 'strength' | 'cardio' | 'recovery';
  title: string;
  workoutId?: string;
  targetMinutes?: number;
  tip: string;
};

export type TrainingPlanDefinition = {
  id: string;
  name: string;
  shortName: string;
  frequency: number;
};

export type DupDay = 'volume';

export type CycleMeta = {
  week: number;
  cycleWeek: number;
  label: string;
  setMultiplier: number;
  rirTarget: number;
  note: string;
  isDeload: boolean;
  dupDay: DupDay;
};

const recovery = (day: number): PlanDay => ({
  day,
  type: 'recovery',
  title: '主动恢复',
  tip: '轻松步行、活动关节；若有持续疼痛，请暂停相关动作。',
});

function prisonerRecoveryDay(profile: Profile, dayOfWeek: number): PlanDay {
  const frequency = [2, 3, 6].includes(profile.frequency) ? profile.frequency : 3;

  if (frequency === 6) {
    if (profile.experience === 'supermax') {
      // 阶段 V：登峰造极 (Supermax) · 周日恢复日
      return {
        day: dayOfWeek,
        type: 'recovery',
        title: '登峰造极 · 组织冲刷与平躺排空',
        workoutId: 'prisoner_recovery_elite',
        tip: '【登峰造极 · 恢复日】经历每周数百组大容量耐力洗礼后，周日进行死悬垂牵引与三诀拉伸，冲刷体内代谢堆积。下午可平躺抬高双腿静养，完成超量恢复。',
      };
    }
    if (profile.experience === 'elite') {
      // 阶段 IV：闭关修炼 (Solitary Confinement) · 周日恢复日
      return {
        day: dayOfWeek,
        type: 'recovery',
        title: '闭关修炼 · 轻量恢复',
        workoutId: 'prisoner_recovery_elite',
        tip: '恢复动作只在舒适范围完成，按图解保持主动支撑，不进行被动牵引或力竭悬吊。感到疲劳时可完全休息，关节疼痛时跳过相关动作。',
      };
    }
    // 阶段 III：炉火纯青 (Veterano) · 周日恢复日
    return {
      day: dayOfWeek,
      type: 'recovery',
      title: '炉火纯青 · 关节三诀与弹性恢复',
      workoutId: 'prisoner_recovery_trifecta',
      tip: '轻松恢复，不把关节保持式做成力量测试。握力练习按对应阶数图解完成，肩部主动稳定；疲劳时可完全休息，无需补偿加练。',
    };
  }

  if (frequency === 3) {
    // 阶段 II：渐入佳境 (Good Ol\' Iron) · 周二、周四、周六为关节三诀，周日为纯静养
    if (dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 6) {
      return {
        day: dayOfWeek,
        type: 'recovery',
        title: '渐入佳境 · 关节活动与轻量抓握',
        workoutId: 'prisoner_recovery_trifecta',
        tip: '这是参考第二册编排的恢复课，不是第一册周计划原表。按列表的具体时长轻松完成；水平悬吊需脚跟支撑，不是双脚离地死悬垂。保持式做不到时可改选低阶或休息。',
      };
    }
    // 周日：完全静养
    return {
      day: dayOfWeek,
      type: 'recovery',
      title: '渐入佳境 · 24小时神经系统彻底充电',
      tip: '【原著全休周日】彻底远离一切悬挂与核心支撑。充足睡眠、营养补给与心理减压，让中枢神经系统在进入新一周前充满能量。',
    };
  }

  // 阶段 I：初试身手 (Fresh Blood) · 周一/五训练，周二/四恢复课，周三/六/日纯静养
  if (dayOfWeek === 2 || dayOfWeek === 4) {
    return {
      day: dayOfWeek,
      type: 'recovery',
      title: '初试身手 · 主动恢复与关节三诀',
      workoutId: 'prisoner_recovery_phase1',
      tip: '应用恢复课（参考第二册三诀初阶）：短桥 2×10 秒、屈膝辅助支撑 4×5 秒、舒适扭转每侧 2×10 秒。只做轻松版本；不做头颈承重、全桥或完整直角支撑，不适时直接休息。',
    };
  }
  // 周三、周六、周日：完全静养
  return {
    day: dayOfWeek,
    type: 'recovery',
    title: '初试身手 · 牢房漫步与完全静养',
    tip: '【原著静养日】新手与大体重者软组织重塑慢于肌肉。今日彻底休息，可进行 15~20 分钟轻松步行，严禁任何形式的额外抗阻加练。',
  };
}

const retiredDay = (day: number): PlanDay => ({
  day,
  type: 'recovery',
  title: '暂无训练计划',
  tip: '这个目标的旧训练计划已移除，原训练记录保留。可在今日页主动启用减肥控重计划。',
});

export function recommendPlanId(profile: Pick<Profile, 'goal'>) {
  return profile.goal === 'weight_loss' ? PERSONAL_PLAN_ID : profile.goal === 'street_mastery' ? PRISONER_PLAN_ID : RETIRED_PLAN_ID;
}

export function prisonerGoalDate(profile: Pick<Profile, 'planStartedAt'>) {
  const target = new Date(profile.planStartedAt);
  target.setDate(target.getDate() + 364);
  return target;
}

function localDayNumber(date: Date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

export function plannedCardioMinutes(profile: Pick<Profile, 'sessionMinutes'>) {
  return Math.min(60, preferredSessionMinutes(profile) - 8);
}

export function weightLossWeekSummary(profile: Profile) {
  const days = getWeekSchedule(profile);
  return {
    strengthDays: days.filter((day) => day.type === 'strength').length,
    cardioDays: days.filter((day) => day.type === 'cardio').length,
    plannedCardioMinutes: days.reduce((sum, day) => sum + (day.type === 'cardio' ? day.targetMinutes || 0 : 0), 0),
  };
}

export function getCycleMeta(profile: Pick<Profile, 'planStartedAt' | 'goal'> & Partial<Pick<Profile, 'experience' | 'frequency'>>, date = new Date()): CycleMeta {
  const startDay = localDayNumber(new Date(profile.planStartedAt || date.toISOString()));
  const nowDay = localDayNumber(date);
  const week = Math.max(1, Math.floor((nowDay - startDay) / 7) + 1);
  const cycleWeek = ((week - 1) % 4) + 1;
  if (profile.goal === 'street_mastery') {
    if (profile.experience !== 'elite' && profile.experience !== 'supermax' && profile.frequency === 3) {
      return { week, cycleWeek, label: `渐入佳境 · 第${week}周`, setMultiplier: 1, rirTarget: 2,
        note: '不设固定减量周。保持每艺两个正式组；按实际表现增加次数，疲劳或动作质量下降时主动减少训练或休息。', isDeload: false, dupDay: 'volume' };
    }
    const deload = cycleWeek === 4;
    const horizon = 365;
    const elapsed = Math.max(0, nowDay - startDay);
    const blockPhase = cycleWeek === 1
      ? '基准建立'
      : cycleWeek === 2
      ? '容量积累'
      : cycleWeek === 3
      ? '强度突破'
      : '主动减载';
    const stageName = profile.experience === 'supermax'
      ? '登峰造极'
      : profile.experience === 'elite'
      ? '闭关修炼'
      : profile.experience === 'advanced' || profile.frequency === 6
      ? '炉火纯青'
      : profile.experience === 'intermediate' || profile.frequency === 3
      ? '渐入佳境'
      : '初试身手';
    return {
      week, cycleWeek, label: `${stageName} · 第${cycleWeek}周 · ${blockPhase}`,
      setMultiplier: deload ? 0.65 : cycleWeek === 1 ? 0.9 : 1,
      rirTarget: deload ? 4 : cycleWeek === 1 ? 3 : 2,
      note: deload
        ? '【第4周减载周】总组数打 6 折，RIR 放大到 4；不做极限冲击，重点做原著关节三诀，让高负荷肌腱结缔组织彻底超量恢复。'
        : cycleWeek === 1
        ? '【第1周基准周】先抓 2-1-2-1 慢速节奏与动作锁死，保留 3 次余力 (RIR 3)，严禁借力晃动。'
        : cycleWeek === 2
        ? '【第2周容量周】保持动作质量，稳步推进正式锻炼组，专注慢速离心控制与顶峰收缩。'
        : '【第3周强度周】尝试更紧绷的向心发力与更长离心拉长停顿，保留 1~2 次余力，向高阶动作迈进。',
      isDeload: deload, dupDay: 'volume',
    };
  }
  if (profile.goal !== 'weight_loss') {
    return { week, cycleWeek, label: '暂无训练计划', setMultiplier: 1, rirTarget: 3, note: '该目标的旧计划已移除。', isDeload: false, dupDay: 'volume' };
  }
  const pacing = [
    { label: '建立节奏', setMultiplier: 0.9, rirTarget: 3, note: '先练稳定动作，不用力竭换取更多热量消耗。' },
    { label: '稳定积累', setMultiplier: 1, rirTarget: 2, note: '维持动作质量和规律活动，保留约 2 次余力。' },
    { label: '巩固训练', setMultiplier: 1, rirTarget: 2, note: '尽量维持力量表现；疲劳时可减少一组，不补偿性加练。' },
    { label: '恢复回顾', setMultiplier: 0.9, rirTarget: 3, note: '查看睡眠、饥饿与训练感受；疲劳时主动减量。' },
  ][cycleWeek - 1];
  return {
    week, cycleWeek, label: `减重保肌 · ${pacing.label}`,
    setMultiplier: pacing.setMultiplier, rirTarget: pacing.rirTarget,
    note: pacing.note, isDeload: false, dupDay: 'volume',
  };
}

function prisonerTrainingDays(profile: Profile): PlanDay[] {
  const frequency = [2, 3, 6].includes(profile.frequency) ? profile.frequency : 3;

  if (frequency === 6 && profile.experience === 'supermax') {
    // 阶段 V：登峰造极 (Supermax) · 原著 Image00732 超大容量耐力循环 (周一至六大容量轰炸，周日休息)
    // 周一/四：引体向上 + 深蹲 (10~50组，每组10次)
    // 周二/五：俯卧撑 + 举腿 (10~50组，每组10次)
    // 周三/六：倒立撑 + 桥 (10~50组，每组10次)
    const strengthIds = ['prisonerB', 'prisonerA', 'prisonerC', 'prisonerD', 'prisonerE', 'prisonerF'];
    const titles = [
      '登峰造极 · 引体向上与深蹲',
      '登峰造极 · 俯卧撑与举腿',
      '登峰造极 · 倒立撑与桥',
      '登峰造极 · 引体向上与深蹲',
      '登峰造极 · 俯卧撑与举腿',
      '登峰造极 · 倒立撑与桥',
    ];
    const tips = [
      '【登峰造极 · 周一】引体向上 + 深蹲（各 10~50 组，每组 10 次）。组间仅喘几口气极短休息，连续推进，打造超人体能。',
      '【登峰造极 · 周二】俯卧撑 + 举腿（各 10~50 组，每组 10 次）。高密度推力与核心耐力大课，两艺交替推进，突破意志极限。',
      '【登峰造极 · 周三】倒立撑 + 桥（各 10~50 组，每组 10 次）。肩推与脊柱后链耐力大课，控制呼吸与身体张力。',
      '【登峰造极 · 周四】引体向上 + 深蹲（各 10~50 组，每组 10 次）。本周第二轮拉腿耐力冲刺，挑战总组数新纪录。',
      '【登峰造极 · 周五】俯卧撑 + 举腿（各 10~50 组，每组 10 次）。胸壁与前链核心的耐力意志考验，保持呼吸节奏。',
      '【登峰造极 · 周六】倒立撑 + 桥（各 10~50 组，每组 10 次）。本周最后一节超级耐力大课，完成后明日彻底休息。',
    ];
    return strengthIds.map((id, index) => ({
      day: 0,
      type: 'strength',
      title: titles[index],
      workoutId: id,
      tip: tips[index],
    }));
  }

  if (frequency === 6 && profile.experience === 'elite') {
    // 阶段 IV：闭关修炼 (Solitary Confinement) · 3天分化 × 双循环 (周一至六高密度大课，周日休息)
    // 轮次一：周一拉腿握 (B)、周二推腹腿 (A)、周三倒桥颈 (C)
    // 轮次二：周四拉腿握 (D)、周五推腹腿 (E)、周六倒桥颈 (F)
    const strengthIds = ['prisonerB', 'prisonerA', 'prisonerC', 'prisonerD', 'prisonerE', 'prisonerF'];
    const titles = [
      '闭关修炼 · 拉力与下肢 (握力)',
      '闭关修炼 · 推力与腹部 (小腿)',
      '闭关修炼 · 垂直推与后链 (颈部)',
      '闭关修炼 · 拉力与下肢 (握力)',
      '闭关修炼 · 推力与腹部 (小腿)',
      '闭关修炼 · 垂直推与后链 (颈部)',
    ];
    const tips = [
      '【闭关修炼 · 轮次一】引体向上 + 深蹲 + 悬挂抓握。垂直拉力与下肢大肌群深度轰炸，末尾悬挂锻造铁钳握力。',
      '俯卧撑与举腿为主课；末尾为平地单腿提踵，每组左右各 10 次，合计 20 次。扶稳支撑，慢起慢落。',
      '倒立未解锁时改为当前阶数俯卧撑与轻量手阻抬头，保留桥练习。已掌握标准桥且确认适宜性后，才以正、反颈桥预备式替代手阻练习；颈部每周最多两次。',
      '【闭关修炼 · 轮次二】引体向上 + 深蹲 + 悬挂抓握。背与腿的第二次超量刺激，保持动作标准，保留 2 次余力。',
      '本周第二次推力与腹部训练，末尾为平地单腿提踵。两侧均完成后再记录一组；先维持动作质量，不用力竭凑次数。',
      '倒立门槛与前半周相同。颈部轻等长每向短时练习，有不适时跳过；明日以恢复为主。',
    ];
    return strengthIds.map((id, index) => ({
      day: 0,
      type: 'strength',
      title: titles[index],
      workoutId: id,
      tip: tips[index],
    }));
  }

  if (frequency === 6) {
    // 阶段 III：炉火纯青 (Veterano) · 原著 Image00730 一日一艺 (周一至周六微课，周日休息)
    // 原著明确顺序：周一引体、周二桥、周三倒立撑、周四举腿、周五深蹲、周六俯卧撑
    const strengthIds = ['prisonerC', 'prisonerE', 'prisonerF', 'prisonerD', 'prisonerB', 'prisonerA'];
    const titles = [
      '炉火纯青 · 引体向上',
      '炉火纯青 · 桥',
      '炉火纯青 · 倒立撑',
      '炉火纯青 · 举腿',
      '炉火纯青 · 深蹲',
      '炉火纯青 · 俯卧撑',
    ];
    const tips = [
      '【原著炉火纯青 · 周一】专注垂直拉力。充分热身后全力以赴完成 2~3 个锻炼组。每日仅需六七分钟，心无旁骛，动作锁死。',
      '【原著炉火纯青 · 周二】专注脊柱后链反弓。由轻量短桥起步，强化竖脊肌与臀大肌；2~3 组高质完成即刻收工，拉伸前链。',
      '垂直推力训练日。倒立未解锁时练当前阶数俯卧撑与轻量颈部准备；不得提前安排靠墙顶立。沿用的 200 次门槛不是原书标准或颈部安全评估。',
      '【原著炉火纯青 · 周四】专注前链核心。悬垂举腿双腿紧绷，骨盆后倾带动下腹卷曲；手腕在悬挂中自然解压。',
      '【原著炉火纯青 · 周五】专注单腿/双腿下肢。下沉至底端停顿 1 秒，髋膝同向对齐；单侧动作专注平衡与神经募集。',
      '【原著炉火纯青 · 周六】专注水平推力。执行 2-1-2-1 慢速节奏，底部停顿消除惯性；2~3 个全力组完成本周六艺闭环。',
    ];
    return strengthIds.map((id, index) => ({
      day: 0,
      type: 'strength',
      title: titles[index],
      workoutId: id,
      tip: tips[index],
    }));
  }

  if (frequency === 3) {
    // 阶段 II：渐入佳境 (Good Ol' Iron) · 原著 Image00729 六艺合璧 (周一推腹、周三拉蹲、周五倒桥，周末双休)
    const strengthIds = ['prisonerA', 'prisonerB', 'prisonerC'];
    const titles = [
      '渐入佳境 · 俯卧撑与举腿',
      '渐入佳境 · 引体向上与深蹲',
      '渐入佳境 · 倒立撑与桥',
    ];
    const tips = [
      '【原著渐入佳境 · 周一】俯卧撑 2 组 + 举腿 2 组。水平推力结合前链屈髋核心，充分热身后全力以赴完成 2 个高质量锻炼组。',
      '【原著渐入佳境 · 周三】引体向上 2 组 + 深蹲 2 组。垂直拉力配合单/双腿深蹲，各做 2 个高质量锻炼组，组间充分休息。',
      '周五原书槽位为倒立撑与桥。倒立未解锁时，应用改为俯卧撑 2 组、桥 2 组与轻量颈部准备 1 组；不安排靠墙顶立。颈桥需另行满足标准桥基础与适宜性要求。',
    ];
    return strengthIds.map((id, index) => ({
      day: 0,
      type: 'strength',
      title: titles[index],
      workoutId: id,
      tip: tips[index],
    }));
  }

  // 阶段 I：初试身手 (Fresh Blood) · 原著 Image00728 筑基四艺 (每周 2 练，周一推腹、周五拉蹲)
  const strengthIds = ['prisonerA', 'prisonerB'];
  const titles = [
    '初试身手 · 俯卧撑与举腿',
    '初试身手 · 引体向上与深蹲',
  ];
  const tips = [
    '【原著初试身手 · 周一】俯卧撑 2~3 组 + 举腿 2~3 组。严格执行 2-1-2-1 慢速控制，保留 2~3 次余力。新手期打牢胸壁与屈髋软组织基础，严禁练桥和倒立撑。',
    '【原著初试身手 · 周五】引体向上 2~3 组 + 深蹲 2~3 组。背部垂直拉力与下肢力量筑基，组间充分休息（2~3 分钟）。等四艺皆达到第 6 式方可移步下一计划。',
  ];
  return strengthIds.map((id, index) => ({
    day: 0,
    type: 'strength',
    title: titles[index],
    workoutId: id,
    tip: tips[index],
  }));
}

function weightLossTrainingDays(profile: Profile): PlanDay[] {
  const strength = (title: string, workoutId: string, tip: string): PlanDay => ({ day: 0, type: 'strength', title, workoutId, tip });
  const cardioMinutes = plannedCardioMinutes(profile);
  const bmi = profile.weight / ((profile.height / 100) ** 2);
  const lowImpact = bmi >= 30 || profile.age >= 55 || profile.experience === 'beginner';
  const activity = lowImpact ? '快走或舒适配速骑行' : '快走、骑行或轻松慢跑';
  const cardio = (): PlanDay => ({
    day: 0, type: 'cardio', title: lowImpact ? '低冲击有氧' : '可交谈强度有氧', targetMinutes: cardioMinutes,
    tip: `热身与整理共 8 分钟，中间${activity} ${cardioMinutes} 分钟；以能正常交谈为准。无需冲刺，也不要把估算运动热量全数吃回。`,
  });
  const preserveA = strength('全身保肌 A', 'fullA', `先完成推与下肢主项，保留 2–3 次余力；${bmi >= 30 ? '高 BMI 时自动避开高风险动作。' : '疼痛时降阶。'}`);
  const preserveB = strength('全身保肌 B', 'fullB', '先完成拉与后链主项，组间充分休息；动作变形就减量。');
  const preserveC = strength('全身保肌 C', 'fullComprehensive', '补足本周推、拉、腿与核心刺激，不用力竭追求出汗。');
  const days = profile.frequency;
  if (days <= 2) return [preserveA, preserveB];
  if (days === 3) return [preserveA, cardio(), preserveB];
  if (days === 4) return [preserveA, cardio(), preserveB, cardio()];
  if (days === 5) return profile.experience === 'beginner'
    ? [preserveA, cardio(), preserveB, cardio(), cardio()]
    : [preserveA, cardio(), preserveB, cardio(), preserveC];
  return profile.experience === 'beginner'
    ? [preserveA, cardio(), preserveB, cardio(), cardio(), cardio()]
    : [preserveA, cardio(), preserveB, cardio(), preserveC, cardio()];
}

export function getPlanDay(profile: Profile, date = new Date()) {
  const dayOfWeek = date.getDay();
  if ((profile.goal !== 'weight_loss' && profile.goal !== 'street_mastery') || profile.planId === RETIRED_PLAN_ID) {
    const plan: TrainingPlanDefinition = { id: RETIRED_PLAN_ID, name: '暂无训练计划', shortName: '暂无训练计划', frequency: 0 };
    return { plan, day: retiredDay(dayOfWeek), cycle: getCycleMeta(profile, date), phase: 'regular' as const };
  }
  const prisonerFrequency = [2, 3, 6].includes(profile.frequency) ? profile.frequency : 3;

  if (profile.goal === 'street_mastery') {
    const prisonerDays = prisonerTrainingDays(profile);
    let slot = -1;
    if (prisonerFrequency === 2) {
      if (dayOfWeek === 1) slot = 0; // Monday: push + legRaise
      else if (dayOfWeek === 5) slot = 1; // Friday: pull + squat
    } else if (prisonerFrequency === 3) {
      if (dayOfWeek === 1) slot = 0; // Monday: push + legRaise
      else if (dayOfWeek === 3) slot = 1; // Wednesday: pull + squat
      else if (dayOfWeek === 5) slot = 2; // Friday: hspu + bridge
    } else if (prisonerFrequency === 6) {
      if (dayOfWeek >= 1 && dayOfWeek <= 6) slot = dayOfWeek - 1; // Mon(1)=0 ... Sat(6)=5
    }
    const day = slot >= 0 && slot < prisonerDays.length
      ? { ...prisonerDays[slot], day: dayOfWeek }
      : prisonerRecoveryDay(profile, dayOfWeek);
    const cycle = getCycleMeta(profile, date);
    const frequency = prisonerFrequency;
    const shortName = `${trainingGoalLabel(profile.goal)} · ${frequency}练`;
    const plan: TrainingPlanDefinition = { id: recommendPlanId(profile), name: shortName, shortName, frequency };
    return { plan, day, cycle, phase: 'regular' as const };
  }

  const start = new Date(profile.planStartedAt);
  const elapsedDays = localDayNumber(date) - localDayNumber(start);
  const scheduleDay = ((elapsedDays % 7) + 7) % 7;
  const slotsByFrequency: Record<number, number[]> = {
    2: [0, 3],
    3: [0, 2, 4], 4: [0, 1, 3, 5],
    5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5],
  };
  const slot = (slotsByFrequency[profile.frequency] || slotsByFrequency[3]).indexOf(scheduleDay);
  const day = elapsedDays < 0 || slot < 0 ? recovery(dayOfWeek) : { ...weightLossTrainingDays(profile)[slot], day: dayOfWeek };
  const cycle = getCycleMeta(profile, date);
  const frequency = profile.frequency;
  const shortName = `${trainingGoalLabel(profile.goal)} · ${frequency}练`;
  const plan: TrainingPlanDefinition = { id: recommendPlanId(profile), name: shortName, shortName, frequency };
  return { plan, day, cycle, phase: 'regular' as const };
}

export function getWeekSchedule(profile: Profile, anchor = new Date()) {
  if (profile.goal === 'street_mastery') {
    const first = new Date(anchor);
    const dayOfWeek = anchor.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    first.setDate(first.getDate() - diffToMonday);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);
      return { date, ...getPlanDay(profile, date).day };
    });
  }
  const first = new Date(anchor);
  const elapsedDays = localDayNumber(anchor) - localDayNumber(new Date(profile.planStartedAt));
  first.setDate(first.getDate() - (((elapsedDays % 7) + 7) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return { date, ...getPlanDay(profile, date).day };
  });
}
