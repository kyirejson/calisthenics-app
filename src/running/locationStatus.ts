import { usablePoint, type RunSnapshot } from './model';

/** Display coordinates and mileage quality are independent of the stopwatch. */
export function mapPosition(snapshot: RunSnapshot) {
  const point = snapshot.mapPosition === undefined ? snapshot.preview : snapshot.mapPosition;
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 || !Number.isFinite(point.accuracy) || point.accuracy < 0) return null;
  const age = point.ageMs ?? Infinity;
  return age >= 0 && age <= (point.cached ? 120000 : 60000) ? point : null;
}

/** Report observations, never infer permission denial or indoor use from absent fixes. */
export function locationStatus(snapshot: RunSnapshot, requested = false, waitMs = 0) {
  const d = snapshot.location, active = snapshot.phase === 'running';
  const result = (title: string, detail = '', settings = false, good = false) => ({ title, detail, settings, good });
  const timing = active ? '计时继续，暂未测得距离。' : '可先开始计时，定位就绪后记录里程。';
  if (snapshot.mode === 'indoor' && snapshot.phase !== 'idle') return result('室内跑 · 无需 GPS', '结束时可填写跑步机距离；未填写则只保存用时。');
  if (d?.systemEnabled === false) return result('系统定位已关闭', timing, true);
  const display = mapPosition(snapshot);
  if (snapshot.locationError && !display) return result('定位暂不可用', snapshot.locationError);
  const gpsReady = usablePoint(snapshot.preview) && (snapshot.preview?.ageMs ?? Infinity) <= 15000;
  if (gpsReady) return result(active ? '定位正常 · 记录中' : `定位就绪 · ±${Math.round(snapshot.preview!.accuracy)} m`, '', false, true);
  if (display && (display.cached || display.provider === 'network' || display.provider === 'fused' || display.provider === 'browser-preview')) {
    const source = display.cached ? '缓存位置' : display.provider === 'network' ? '网络定位' : display.provider === 'browser-preview' ? '浏览器大致位置（仅地图）' : '融合定位';
    return result(display.cached ? '地图显示最近位置' : '地图已定位 · 大致位置', `${source} · 估计误差约 ${Math.round(display.accuracy)} 米。${snapshot.locationError || timing}`);
  }
  if (d && !d.permission) return result('精确位置未开启', `可在定位设置中开启。${timing}`, true);
  if (d?.requestError) return result('定位请求失败', `${d.requestError} ${timing}`);
  if (d && !d.providerAvailable && !d.auxiliaryProviders?.length) return result('设备未提供卫星定位服务', timing);
  if (d && !d.enabled && !d.auxiliaryProviders?.length) return result('卫星定位未开启', timing, true);
  if (d?.providerErrors?.gps) return result('卫星定位请求异常', d.providerErrors.gps);
  if (snapshot.error) return result('定位或记录需要检查', snapshot.error);
  if (snapshot.preview) {
    const age = snapshot.preview.ageMs ?? 16000;
    if (age > 15000) return result('位置已过期', `已有位置未及时更新。${timing}`);
    return result('已定位，精度不足', `系统已返回坐标，估计误差约 ${Math.round(snapshot.preview.accuracy)} 米。${timing}`);
  }
  if (d?.rejection === 'stale') return result('系统只返回了过期位置', '定位请求已发出，但系统返回的坐标超过 15 秒，未采用。');
  if (d?.rejection === 'invalid') return result('系统返回的位置无效', '已收到定位回调，但坐标或精度数据无效，未采用。');
  if (!requested && !d?.listening && !active) return result('点击启用定位', '不定位也可以开始计时。');
  if (d && !d.listening) return result('定位请求已停止', timing);
  const waited = Math.floor((d?.waitMs ?? waitMs) / 1000);
  return result(waited >= 30 ? '尚未收到位置坐标' : '定位请求已启动', `等待坐标 ${waited} 秒。${timing}`);
}
