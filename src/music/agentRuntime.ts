import { changeMusicPreferences, musicProvider, normalizeMusicPreferences } from './preferences';
import type { Settings } from '../types';
import type { MusicCommand, MusicTransport } from './types';
type Context = { requestId: string; executionId?: string; readSettings: () => Settings; updateSettings: (patch: Partial<Settings>) => Promise<void> };
const record = (input: unknown): Record<string, unknown> => {
  if (input === undefined) return {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('音乐工具参数应为对象。');
  return input as Record<string, unknown>;
};
export function createMusicRuntime(transport: MusicTransport, context: Context) {
  return async (name: string, input: unknown, signal?: AbortSignal) => {
    if (signal?.aborted) throw Error('请求已取消。');
    const args = record(input), preferences = normalizeMusicPreferences(context.readSettings().music);
    const provider = musicProvider(args.provider, preferences.provider);
    if (name === 'read_music_settings') {
      const [capabilities, playback] = await Promise.all([
        Promise.all(['netease', 'qq'].map(key => transport.capabilities(key as 'netease' | 'qq'))),
        transport.playback(provider).catch(error => ({ ok: false, code: 'observation_failed', message: error instanceof Error ? error.message : String(error) })),
      ]);
      return { ok: true, preferences, capabilities, playback };
    }
    if (name === 'write_music_settings') {
      const music = changeMusicPreferences(context.readSettings().music, args);
      await context.updateSettings({ music });
      return { ok: true, preferences: music };
    }
    if (name === 'read_music_screen') {
      if (args.offset !== undefined && (!Number.isSafeInteger(args.offset) || Number(args.offset) < 0)) throw Error('控件分页起点应为非负整数。');
      return transport.screen(provider, Number(args.offset || 0));
    }
    if (name === 'read_music_playback') return transport.playback(provider);
    if (!context.requestId || typeof args.operationKey !== 'string' || !args.operationKey.trim()) throw Error('执行音乐操作需要当前请求编号和 operationKey。');
    const fused = name.endsWith('_and_observe');
    const operation = fused ? name.slice(0, -'_and_observe'.length) : name;
    const type = operation === 'open_music' ? 'open' : operation === 'music_ui_action' ? 'ui' : operation === 'control_music' ? 'control' : null;
    if (!type) throw Error('未知音乐工具。');
    // Interface validation only: no keyword rules decide music or the model's workflow.
    for (const key of ['uri', 'query', 'title', 'artist', 'focus', 'snapshotId', 'nodeId', 'action', 'text', 'mediaId']) if (args[key] !== undefined && typeof args[key] !== 'string') throw Error(`${key} 应为文字。`);
    const command = { ...args, type, provider } as MusicCommand;
    const executionId = context.executionId ?? context.requestId;
    const cancel = () => { void transport.cancel(executionId).catch(() => {}); };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      if (signal?.aborted) { cancel(); throw Error('请求已取消。'); }
      const result = await (fused ? transport.executeAndObserve(context.requestId, command, executionId) : transport.execute(context.requestId, command, executionId));
      if (signal?.aborted) throw Error('请求已取消；已执行的音乐操作可通过状态工具核对。');
      return result;
    } finally { signal?.removeEventListener('abort', cancel); }
  };
}
