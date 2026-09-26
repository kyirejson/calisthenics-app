import type { Profile } from '../types';

type WeightRecord = NonNullable<Profile['weightHistory']>[number];

export function localWeightDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayNumber(key: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return NaN;
  const [year, month, day] = key.split('-').map(Number);
  const stamp = Date.UTC(year, month - 1, day);
  return new Date(stamp).toISOString().slice(0, 10) === key ? Math.floor(stamp / 86400000) : NaN;
}

export function recordWeight(history: Profile['weightHistory'], kg: number, date = new Date()): WeightRecord[] {
  const key = localWeightDate(date);
  return [...(history || []).filter((entry) => entry.date !== key), { date: key, kg }]
    .filter((entry) => Number.isFinite(dayNumber(entry.date)) && Number.isFinite(entry.kg) && entry.kg >= 30 && entry.kg <= 300)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-180);
}

export function summarizeWeightTrend(history: Profile['weightHistory'], today = new Date()) {
  const currentDay = dayNumber(localWeightDate(today));
  const records = history || [];
  const inWindow = (start: number, end: number) => records.filter((entry) => {
    const day = dayNumber(entry.date);
    return Number.isFinite(day) && day >= start && day <= end && Number.isFinite(entry.kg);
  });
  const recent = inWindow(currentDay - 6, currentDay);
  const previous = inWindow(currentDay - 13, currentDay - 7);
  const mean = (items: WeightRecord[]) => items.reduce((sum, item) => sum + item.kg, 0) / items.length;
  const currentAverage = recent.length ? Number(mean(recent).toFixed(1)) : undefined;
  if (recent.length < 4 || previous.length < 4) return { currentAverage, recentCount: recent.length, previousCount: previous.length };
  const previousAverage = Number(mean(previous).toFixed(1));
  const changeKg = Number((mean(recent) - mean(previous)).toFixed(1));
  const changePercent = Number(((mean(recent) - mean(previous)) / mean(previous) * 100).toFixed(1));
  return { currentAverage, previousAverage, changeKg, changePercent, recentCount: recent.length, previousCount: previous.length };
}

export function suggestedPlanningWeight(planningWeight: number, trend: ReturnType<typeof summarizeWeightTrend>) {
  const recentAverage = trend.currentAverage;
  if (!Number.isFinite(planningWeight) || recentAverage === undefined || trend.changePercent === undefined) return null;
  // Large week-to-week swings warrant observation, not a lower calorie budget.
  if (Math.abs(trend.changePercent) > 1 || Math.abs(recentAverage - planningWeight) < 0.2) return null;
  return recentAverage;
}
