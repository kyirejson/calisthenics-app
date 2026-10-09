export function browserLocationError(error: Pick<GeolocationPositionError, 'code' | 'message'>, source: string) {
  const cause = error.code === 1 ? '位置访问被拒绝' : error.code === 2 ? '定位服务未能提供坐标' : error.code === 3 ? '请求超时，未返回坐标' : '定位请求失败';
  const raw = typeof error.message === 'string' ? error.message.trim().slice(0, 240) : '';
  return `${source}：${cause}（浏览器错误 ${error.code}）${raw ? `；原始原因：${raw}` : ''}。`;
}

export function browserPositionValid(position: GeolocationPosition) {
  const { latitude, longitude, accuracy } = position.coords;
  const age = Date.now() - position.timestamp;
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180 && Number.isFinite(accuracy) && accuracy >= 0 && Number.isFinite(age) && age >= -1000 && age <= 120000;
}
