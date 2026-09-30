import type { PerformancePoint } from './trainingHistory';

export type ProgressMetric = 'best' | 'total';
export type ProgressRange = 30 | 90 | 'all';
export type ChartCoordinate = { x: number; y: number };
export const progressMotion = { stairsMs: 640, curveMs: 780, curveDelayMs: 140 };

export function visibleProgressPoints(points: PerformancePoint[], range: ProgressRange, now = new Date()): PerformancePoint[] {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const start = new Date(end);
  if (range !== 'all') start.setDate(start.getDate() - range + 1);
  return points.filter(point => Number.isFinite(point.t) && point.t <= end.getTime()
    && (range === 'all' || point.t >= start.getTime()));
}

/** Bounded LTTB preserves endpoints and extrema. Full data stays available for inspection. */
export function sampleProgressPoints(points: PerformancePoint[], metric: ProgressMetric, threshold = 100): PerformancePoint[] {
  const limit = Math.max(4, Number.isFinite(threshold) ? Math.floor(threshold) : 100);
  if (points.length <= limit) return points;
  const coreLimit = limit - 2;
  const sampled = [points[0]];
  const size = coreLimit > 2 ? (points.length - 2) / (coreLimit - 2) : 0;
  let selected = 0;
  for (let bucket = 0; bucket < coreLimit - 2; bucket++) {
    const averageStart = Math.floor((bucket + 1) * size) + 1;
    const averageEnd = Math.min(points.length, Math.floor((bucket + 2) * size) + 1);
    const average = points.slice(averageStart, averageEnd);
    const avgX = average.reduce((sum, point) => sum + point.t, 0) / Math.max(1, average.length);
    const avgY = average.reduce((sum, point) => sum + point[metric], 0) / Math.max(1, average.length);
    const start = Math.floor(bucket * size) + 1;
    const end = Math.min(points.length - 1, Math.floor((bucket + 1) * size) + 1);
    const anchor = points[selected];
    let maxArea = -1, next = start;
    for (let index = start; index < end; index++) {
      const point = points[index];
      const area = Math.abs((anchor.t - avgX) * (point[metric] - anchor[metric]) - (anchor.t - point.t) * (avgY - anchor[metric]));
      if (area > maxArea) { maxArea = area; next = index; }
    }
    selected = next;
    sampled.push(points[selected]);
  }
  sampled.push(points[points.length - 1]);
  let minimum = points[0], maximum = points[0];
  for (const point of points) {
    if (point[metric] < minimum[metric]) minimum = point;
    if (point[metric] > maximum[metric]) maximum = point;
  }
  return [...new Set([...sampled, minimum, maximum])].sort((a, b) => a.t - b.t);
}

/** Monotone cubic interpolation: no fake peak/valley between two observations. */
export function monotoneProgressPath(points: ChartCoordinate[]): string {
  if (!points.length) return '';
  const start = 'M ' + points[0].x.toFixed(3) + ' ' + points[0].y.toFixed(3);
  if (points.length === 1) return start;
  const slopes = points.slice(1).map((point, i) => (point.y - points[i].y) / Math.max(0.0001, point.x - points[i].x));
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === points.length - 1) return slopes[slopes.length - 1];
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  });
  slopes.forEach((slope, i) => {
    if (slope === 0) { tangents[i] = 0; tangents[i + 1] = 0; return; }
    const length = Math.hypot(tangents[i] / slope, tangents[i + 1] / slope);
    if (length > 3) { tangents[i] *= 3 / length; tangents[i + 1] *= 3 / length; }
  });
  return points.slice(1).reduce((path, point, i) => {
    const previous = points[i];
    const third = (point.x - previous.x) / 3;
    const clamp = (y: number) => Math.max(Math.min(previous.y, point.y), Math.min(Math.max(previous.y, point.y), y));
    return path + ' C ' + (previous.x + third).toFixed(3) + ' ' + clamp(previous.y + tangents[i] * third).toFixed(3)
      + ' ' + (point.x - third).toFixed(3) + ' ' + clamp(point.y - tangents[i + 1] * third).toFixed(3)
      + ' ' + point.x.toFixed(3) + ' ' + point.y.toFixed(3);
  }, start);
}

export function progressGeometry(points: PerformancePoint[], metric: ProgressMetric, benchmark: number | null, width: number, height: number) {
  const highest = Math.max(1, benchmark || 0, ...points.map(point => point[metric]));
  const wantedStep = highest * 1.12 / 3;
  const magnitude = 10 ** Math.floor(Math.log10(wantedStep));
  const factor = [1, 2, 2.5, 5, 10].find(value => value * magnitude >= wantedStep) || 10;
  const step = factor * magnitude;
  const maximum = Math.ceil(highest * 1.12 / step) * step;
  const y = (value: number) => height - value / maximum * height;
  const first = points[0]?.t || 0, last = points.at(-1)?.t || first;
  const inset = Math.min(12, width / 4);
  const x = (time: number) => first === last ? width / 2 : inset + (time - first) / (last - first) * (width - inset * 2);
  const coordinate = (point: PerformancePoint) => ({ x: x(point.t), y: y(point[metric]) });
  const sampled = sampleProgressPoints(points, metric);
  const coordinates = sampled.map(coordinate);
  const path = monotoneProgressPath(coordinates);
  const fill = coordinates.length > 1 ? path + ' L ' + coordinates.at(-1)!.x + ' ' + height + ' L ' + coordinates[0].x + ' ' + height + ' Z' : '';
  const ticks = Array.from({ length: Math.round(maximum / step) + 1 }, (_, i) => ({ value: Number((i * step).toFixed(4)), y: y(i * step) }));
  return { maximum, ticks, coordinate, path, fill, sampled, benchmarkY: benchmark === null ? null : y(benchmark) };
}

export function progressNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}
