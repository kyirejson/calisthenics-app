/** Pure announcement policy; measured distance only, no progress UI or timer-only mileage. */
export function kilometreAnnouncement(distanceM: number | null | undefined, elapsedMs: number, lastKm: number, source: 'location' | 'steps' = 'location', partial = false) {
  if (!Number.isFinite(distanceM) || distanceM! < 1000 || !Number.isFinite(elapsedMs) || elapsedMs < 0 || !Number.isSafeInteger(lastKm) || lastKm < 0) return null;
  const km = Math.floor(distanceM! / 1000);
  if (km <= lastKm) return null;
  const seconds = Math.floor(elapsedMs / 1000), minutes = Math.floor(seconds / 60), remainder = seconds % 60;
  const prefix = source === 'steps' ? '计步估算，您已跑了' : partial ? '已记录定位路段' : '您已跑了';
  return { km, text: `${prefix}${km}公里，用时${minutes}${remainder ? `分${remainder}秒` : '分钟'}。` };
}
