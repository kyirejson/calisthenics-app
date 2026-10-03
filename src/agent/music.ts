export function playlistId(value: string): string | null {
  const trimmed = value.trim(); if (/^[1-9]\d{0,18}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || !['music.163.com', 'y.music.163.com'].includes(url.hostname) || url.username || url.password) return null;
    const route = new URL(url.hash.startsWith('#/') ? 'https://music.163.com' + url.hash.slice(1) : url.href);
    const id = route.pathname.includes('playlist') ? route.searchParams.get('id') : null;
    return id && /^[1-9]\d{0,18}$/.test(id) ? id : null;
  } catch { return null; }
}
export function musicURLs(id: string) {
  if (!/^[1-9]\d{0,18}$/.test(id)) throw Error('歌单编号无效。');
  // Candidate deep link, not a verified cross-version playback API. canOpenURL
  // detects an OS handler, not its identity or successful playlist loading.
  return { native: `orpheus://playlist/${id}`, web: `https://music.163.com/#/playlist?id=${id}` };
}
export function isMusicCommand(text: string) { return /^(?:请|帮我|请帮我)?(?:打开|播放)(?:我的)?(?:训练|网易云)?歌单[。！!]?$/u.test(text.trim()); }
export type AgentPreferences = { proactive: boolean; musicPlaylist: string | null; dismissed: string[]; dockAnchor?: { edge: 'left' | 'right'; ratio: number } };
export function normalizeAgentPreferences(raw: unknown): AgentPreferences {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const anchor = input.dockAnchor as Record<string, unknown> | undefined;
  const validAnchor = anchor && ['left', 'right'].includes(String(anchor.edge)) && typeof anchor.ratio === 'number' && Number.isFinite(anchor.ratio) && anchor.ratio >= 0 && anchor.ratio <= 1;
  return { ...(validAnchor ? { dockAnchor: { edge: anchor.edge as 'left' | 'right', ratio: anchor.ratio as number } } : {}), proactive: input.proactive === true, musicPlaylist: typeof input.musicPlaylist === 'string' ? playlistId(input.musicPlaylist) : null,
    dismissed: Array.isArray(input.dismissed) ? [...new Set(input.dismissed.filter((v): v is string => typeof v === 'string' && /^[a-zA-Z0-9_:-]{1,120}$/.test(v)))].slice(-300) : [] };
}
