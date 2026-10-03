export function validSettingsReturn(value, now = Date.now()) {
  return !!value && value.view === 'connection' && Number.isFinite(value.at) && now >= value.at && now - value.at <= 24 * 3600000;
}
