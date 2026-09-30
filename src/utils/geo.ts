// GPS 跑步记录的共享地理计算：距离、时长、配速格式化。

export type GeoPoint = { latitude: number; longitude: number };

// 两点间地表距离（米），球面 haversine 公式。
export function haversine(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// 秒 → mm:ss（跑步单次记录不超过小时级，超一小时进位到分即可读）
export function formatRunClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// 秒/公里 → 6'12″
export function formatPace(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return `--′--″`;
  return `${Math.floor(secondsPerKm / 60)}′${String(Math.floor(secondsPerKm % 60)).padStart(2, '0')}″`;
}

// 轨迹入库前的瘦身：等距抽样最多保留 max 个点（首尾必留），坐标圆整到 6 位小数（约 0.1 米）。
export function downsampleTrack(points: GeoPoint[], max: number): GeoPoint[] {
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  if (points.length <= max) return points.map((p) => ({ latitude: round(p.latitude), longitude: round(p.longitude) }));
  const step = (points.length - 1) / (max - 1);
  const out: GeoPoint[] = [];
  for (let i = 0; i < max; i++) {
    const point = points[Math.round(i * step)];
    out.push({ latitude: round(point.latitude), longitude: round(point.longitude) });
  }
  return out;
}
