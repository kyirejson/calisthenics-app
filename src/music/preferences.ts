export const musicProviders = { netease: '网易云音乐', qq: 'QQ 音乐' } as const;
export type MusicProvider = keyof typeof musicProviders;
export type MusicPreset = { kind: 'favorites' | 'playlist'; name: string; link: string };
export type MusicPreferences = { provider: MusicProvider; presets: Record<MusicProvider, MusicPreset> };
export function normalizeMusicPreferences(raw: unknown): MusicPreferences {
  const value = raw && typeof raw === 'object' ? raw as Partial<MusicPreferences> : {};
  const read = (key: MusicProvider): MusicPreset => {
    const item = value.presets?.[key];
    return { kind: item?.kind === 'playlist' ? 'playlist' : 'favorites', name: typeof item?.name === 'string' ? item.name : '', link: typeof item?.link === 'string' ? item.link : '' };
  };
  return { provider: value.provider === 'qq' ? 'qq' : 'netease', presets: { netease: read('netease'), qq: read('qq') } };
}
export function musicProvider(value: unknown, fallback: MusicProvider): MusicProvider {
  if (value === undefined) return fallback;
  if (value !== 'netease' && value !== 'qq') throw Error('音乐软件应为 netease 或 qq。');
  return value;
}
export function changeMusicPreferences(previous: unknown, input: unknown): MusicPreferences {
  if (!input || typeof input !== 'object') throw Error('音乐预设参数无效。');
  const patch = input as { provider?: unknown; preset?: Partial<MusicPreset> }, current = normalizeMusicPreferences(previous);
  const provider = musicProvider(patch.provider, current.provider);
  if (patch.preset === undefined) return { ...current, provider };
  if (!patch.preset || typeof patch.preset !== 'object' || Array.isArray(patch.preset)) throw Error('默认播放内容应为对象。');
  const { kind, name, link } = patch.preset;
  if (kind !== undefined && kind !== 'favorites' && kind !== 'playlist') throw Error('默认内容应为收藏或歌单。');
  if (name !== undefined && typeof name !== 'string' || link !== undefined && typeof link !== 'string') throw Error('歌单名称和链接应为文字。');
  return { ...current, provider, presets: { ...current.presets, [provider]: { kind: kind ?? current.presets[provider].kind, name: name ?? current.presets[provider].name, link: link ?? current.presets[provider].link } } };
}
