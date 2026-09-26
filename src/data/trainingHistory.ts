import type { SessionExercise, TrainingSession } from '../types';

// 训练历史 / 进步曲线的数据派生层：全部指标从现有 TrainingSession 派生，零额外录入。
// 口径遵循原著（第一册第十一章）：曲线的主语是动作，刻度是"次数 / 保持秒数 / 等级"。

export function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export type ExerciseUnitKind = 'dynamic' | 'hold';

export function completedSetValues(exercise: SessionExercise): number[] {
  return exercise.sets
    .filter((set) => set.completed)
    .map((set) => set.reps)
    .filter((value) => Number.isFinite(value) && value > 0);
}

export function sessionExerciseBest(exercise: SessionExercise): number {
  const values = completedSetValues(exercise);
  return values.length ? Math.max(...values) : 0;
}

// 当日总量口径：曲线的主语是"今天一共完成多少"，跨组求和（次数或保持秒数同口径）。
export function sessionExerciseTotal(exercise: SessionExercise): number {
  return completedSetValues(exercise).reduce((sum, value) => sum + value, 0);
}

export type CurvePoint = { t: number; value: number; dayKey: string; sessionId: string | null };

// 每日折线：X 轴按天，Y = 当日该动作的完成总量（跨组、跨会话求和；次数与保持秒数同口径）。
// 当日未训练 → 维持前值；首次记录之前 → 0（用户口径："维持有的数据，没有的记录 0"）。
// 返回已压缩的点列：仅在数值变化处 + 区间首尾打点，长区间也保持少量线段。
export type Granularity = 'day' | 'week' | 'month';

// 多系列进步曲线：每个系列 = 用户当前阶的动作，按日构建状态序列（当日未训练维持前值，
// 首次记录前为 0），再按日/周/月粒度取样压缩。
export function buildSeriesCurve(
  sessions: TrainingSession[],
  exerciseId: string,
  granularity: Granularity,
  rangeDays: number | null,
  now = new Date(),
) {
  const totalByDay = new Map<string, number>();
  let firstDataDay: string | null = null;
  for (const session of sessions) {
    const exercise = session.exercises.find((item) => item.exerciseId === exerciseId);
    if (!exercise) continue;
    const value = sessionExerciseTotal(exercise);
    if (value <= 0) continue;
    const key = localDayKey(new Date(session.startedAt));
    // 一天可以有多条训练记录：当日总量 = 各条记录之和
    totalByDay.set(key, (totalByDay.get(key) || 0) + value);
    if (!firstDataDay || key < firstDataDay) firstDataDay = key;
  }
  const hasData = totalByDay.size > 0;

  // 终点取"今天中午"：现在还没到中午时，今天也要在曲线上（当日未训练 = 维持前值）
  const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime();
  // 窗口锚定真实数据：上限由粒度决定（日 31 / 周 365 / 月全程），下限保证各粒度
  // 都能铺满自己的取样周期（≥4 个周期），不从首条数据回看到一年前的空图。
  const floorByGranularity: Record<Granularity, number> = { day: 21, week: 56, month: 120 };
  let windowDays = 7;
  if (firstDataDay) {
    const ageDays = Math.max(0, (endTime - new Date(firstDataDay).getTime()) / 86400000);
    windowDays = Math.min(rangeDays ?? Infinity, Math.max(floorByGranularity[granularity], ageDays + 14));
  }
  const startTime = endTime - windowDays * 86400000;
  const start = new Date(startTime);
  start.setHours(12, 0, 0, 0);

  // 逐日状态序列（未压缩）
  const daily: Array<{ t: number; value: number }> = [];
  const cursor = new Date(start);
  let lastValue = 0;
  let guard = 0;
  while (cursor.getTime() <= endTime && guard < 800) {
    guard += 1;
    const key = localDayKey(cursor);
    if (totalByDay.has(key)) lastValue = totalByDay.get(key)!;
    daily.push({ t: cursor.getTime(), value: hasData ? lastValue : 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  // 粒度取样：日=逐日；周/月=取每个周期最后一天的状态
  let sampled: Array<{ t: number; value: number }> = daily;
  if (granularity !== 'day') {
    const bucketKey = (date: Date) =>
      granularity === 'week' ? localDayKey(weekMonday(date)) : `${date.getFullYear()}-${date.getMonth()}`;
    const buckets = new Map<string, { t: number; value: number }>();
    for (const entry of daily) {
      const key = bucketKey(new Date(entry.t));
      buckets.set(key, entry); // 逐日递增，后写覆盖 = 周期末状态
    }
    sampled = [...buckets.values()].sort((a, b) => a.t - b.t);
    if (sampled.length === 0) sampled = daily.slice(-1);
  }

  // 压缩：保留起点、终点与每个"平台段"的末点（下一个值不同的点），
  // 这样折线才能呈现"长期持平 → 末端跳变"的真实形状；绝不能把平台中间点删成匀速斜线。
  const points: Array<{ t: number; value: number }> = [];
  sampled.forEach((entry, index) => {
    const next = sampled[index + 1];
    const isStart = index === 0;
    const isEnd = index === sampled.length - 1;
    const plateauEnds = next && next.value !== entry.value;
    if (isStart || isEnd || plateauEnds) points.push({ t: entry.t, value: entry.value });
  });
  // 补齐区间起点：周/月粒度的首个取样点是"周期末"状态，回填要用范围起点的真实
  // 状态（daily[0]），否则只有一个月数据时会把整条曲线画成全程高位。
  if (points.length && points[0].t > startTime) points.unshift({ t: start.getTime(), value: daily[0].value });

  const best = points.reduce<{ t: number; value: number } | null>(
    (acc, point) => (!acc || point.value > acc.value ? point : acc),
    null,
  );
  const latest = points.length ? points[points.length - 1].value : null;
  return { points, best, latest, hasData };
}

function weekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export type DayGroup = { key: string; date: Date; sessions: TrainingSession[] };

// 训练历史按"天"合并：一天一条，点开查看当天全部训练。
export function groupHistoryByDay(sessions: TrainingSession[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const session of sessions) {
    const started = new Date(session.startedAt);
    const key = localDayKey(started);
    let group = groups.get(key);
    if (!group) {
      const atNoon = new Date(started.getFullYear(), started.getMonth(), started.getDate(), 12);
      group = { key, date: atNoon, sessions: [] };
      groups.set(key, group);
    }
    group.sessions.push(session);
  }
  const list = [...groups.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const group of list) group.sessions.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  return list;
}

// 周 streak：连续每周至少 1 次训练（含部分完成）；本周尚未练不立即断签（原著弹性："别受一周七天人为概念的限制"）。
export function computeWeekStreak(sessions: TrainingSession[], now = new Date()): number {
  const activeWeeks = new Set<string>();
  for (const session of sessions) activeWeeks.add(localDayKey(weekMonday(new Date(session.startedAt))));
  let streak = 0;
  const cursor = weekMonday(now);
  for (let i = 0; i < 260; i++) {
    const key = localDayKey(cursor);
    if (activeWeeks.has(key)) {
      streak += 1;
    } else if (i === 0) {
      // 本周还没练：宽限，不计数也不中断
    } else {
      break;
    }
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

export type MonthStats = { count: number; minutes: number; prevCount: number; deltaPercent: number | null };

export function computeMonthStats(sessions: TrainingSession[], now = new Date()): MonthStats {
  const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;
  const currentKey = monthKey(now);
  const previousKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  let count = 0;
  let minutes = 0;
  let prevCount = 0;
  for (const session of sessions) {
    const key = monthKey(new Date(session.startedAt));
    if (key === currentKey) {
      count += 1;
      minutes += session.durationSeconds / 60;
    } else if (key === previousKey) {
      prevCount += 1;
    }
  }
  const deltaPercent = prevCount > 0 ? Math.round(((count - prevCount) / prevCount) * 100) : null;
  return { count, minutes: Math.round(minutes), prevCount, deltaPercent };
}

export type CalendarCell = { key: string; day: number; state: 'complete' | 'partial' | null; inMonth: boolean; isToday: boolean } | null;

export function buildMonthGrid(year: number, month: number, sessions: TrainingSession[], now = new Date()): CalendarCell[] {
  const byDay = new Map<string, 'complete' | 'partial'>();
  for (const session of sessions) {
    const key = localDayKey(new Date(session.startedAt));
    const previous = byDay.get(key);
    byDay.set(key, previous === 'complete' || session.completion !== 'partial' ? 'complete' : 'partial');
  }
  const todayKey = localDayKey(now);
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 周一为 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = localDayKey(new Date(year, month, day, 12));
    cells.push({ key, day, state: byDay.get(key) || null, inMonth: true, isToday: key === localDayKey(now) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export type SessionComparisonRow = {
  exercise: SessionExercise;
  best: number;
  prevBest: number | null;
  delta: number | null;
  unit: 'reps' | 'seconds' | 'steps' | 'meters';
};

// 会话详情的"与上次同动作逐组对比"：取同动作历史最佳（上次出现该动作的会话）。
export function compareWithPrevious(session: TrainingSession, sessions: TrainingSession[]): SessionComparisonRow[] {
  const at = new Date(session.startedAt).getTime();
  const earlier = sessions
    .filter((item) => item.id !== session.id && new Date(item.startedAt).getTime() < at)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return session.exercises.map((exercise) => {
    let prevBest: number | null = null;
    for (const previous of earlier) {
      const match = previous.exercises.find((item) => item.exerciseId === exercise.exerciseId);
      if (match) {
        prevBest = sessionExerciseBest(match);
        break;
      }
    }
    const best = sessionExerciseBest(exercise);
    const delta = prevBest != null && best > 0 ? best - prevBest : null;
    const unit = exercise.sets.find((set) => set.unit)?.unit || 'reps';
    return { exercise, best, prevBest, delta, unit };
  });
}

export function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}
