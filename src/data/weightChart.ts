import type { WeightRecord, weightTrendWindow } from './weightTrend';

type WeightWindow = ReturnType<typeof weightTrendWindow>;
export type WeightPoint = WeightRecord & { x: number; y: number };
const stamp = (date: string) => Date.parse(date + 'T00:00:00.000Z') / 86400000;
const coordinate = (value: number) => Math.round(value * 100) / 100;
export function shortWeightDate(date: string) { return Number(date.slice(5, 7)) + '/' + Number(date.slice(8, 10)); }

/** Straight segments link measured dates only; horizontal spacing represents calendar time. */
export function buildWeightChart(window: WeightWindow, width: number, height = 180) {
  const canvasWidth = Number.isFinite(width) ? Math.max(200, width) : 300;
  const canvasHeight = Number.isFinite(height) ? Math.max(120, height) : 180;
  const left = 40, right = canvasWidth - 8, top = 12, bottom = canvasHeight - 28;
  if (!window.records.length) return { width: canvasWidth, height: canvasHeight, left, right, top, bottom,
    points: [] as WeightPoint[], line: '', area: '', ticks: [] as { kg: number; y: number; label: string }[], dates: [] as { date: string; x: number }[] };
  const values = window.records.map(record => record.kg);
  const min = Math.min(...values), max = Math.max(...values), padding = Math.max(.4, (max - min) * .2);
  const stepBase = Math.max(.1, (max - min + padding * 2) / 3);
  const magnitude = 10 ** Math.floor(Math.log10(stepBase));
  const factor = stepBase / magnitude;
  const step = (factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10) * magnitude;
  const lower = Math.floor(Math.max(0, min - padding) / step) * step;
  const upper = Math.ceil((max + padding) / step) * step;
  const start = stamp(window.start), end = stamp(window.end);
  const x = (date: string) => coordinate(left + (stamp(date) - start) / Math.max(1, end - start) * (right - left));
  const y = (kg: number) => coordinate(bottom - (kg - lower) / (upper - lower) * (bottom - top));
  const points = window.records.map(record => ({ ...record, x: x(record.date), y: y(record.kg) }));
  const line = points.length > 1 ? points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ') : '';
  const area = line ? `${line} L${points.at(-1)!.x},${bottom} L${points[0].x},${bottom} Z` : '';
  const ticks = Array.from({ length: Math.round((upper - lower) / step) + 1 }, (_, index) => {
    const kg = coordinate(lower + step * index);
    return { kg, y: y(kg), label: step < 1 ? kg.toFixed(1) : String(kg) };
  });
  const middle = new Date(Math.round((start + end) / 2) * 86400000).toISOString().slice(0, 10);
  return { width: canvasWidth, height: canvasHeight, left, right, top, bottom, points, line, area, ticks,
    dates: [window.start, middle, window.end].map(date => ({ date, x: x(date) })) };
}
