import type { Profile } from '../types';

export type WeightRecord = NonNullable<Profile['weightHistory']>[number];
export type WeightPeriod = 7 | 30 | 90;

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
  const records = cleanWeightRecords(history);
  if (!Number.isFinite(dayNumber(key)) || !Number.isFinite(kg) || kg < 30 || kg > 300) return records.slice(-180);
  return [...records.filter(entry => entry.date !== key), { date: key, kg }].sort((a, b) => a.date.localeCompare(b.date)).slice(-180);
}

/** Keep the last valid measurement for a calendar day; never coerce imported values. */
function cleanWeightRecords(history: Profile['weightHistory']): WeightRecord[] {
  const byDate = new Map<string, WeightRecord>();
  if (!Array.isArray(history)) return [];
  for (const entry of history) {
    if (!entry || typeof entry.date !== 'string' || !Number.isFinite(dayNumber(entry.date))
      || !Number.isFinite(entry.kg) || entry.kg < 30 || entry.kg > 300) continue;
    byDate.set(entry.date, { date: entry.date, kg: entry.kg });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function weightTrendWindow(history: Profile['weightHistory'], days: WeightPeriod, today = new Date()) {
  const endDay = dayNumber(localWeightDate(today));
  const end = localWeightDate(today);
  if (!Number.isFinite(endDay)) return { days, start: '', end, records: [] as WeightRecord[], average: undefined as number | undefined };
  const startDay = endDay - days + 1;
  const start = new Date(startDay * 86400000).toISOString().slice(0, 10);
  const records = cleanWeightRecords(history).filter(entry => { const day = dayNumber(entry.date); return day >= startDay && day <= endDay; });
  const average = records.length ? Number((records.reduce((sum, entry) => sum + entry.kg, 0) / records.length).toFixed(1)) : undefined;
  return { days, start, end, records, average };
}

export function summarizeWeightTrend(history: Profile['weightHistory'], today = new Date()) {
  const currentDay = dayNumber(localWeightDate(today));
  const records = cleanWeightRecords(history);
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
