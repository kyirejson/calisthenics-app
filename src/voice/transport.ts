import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { AGENT_NAME } from '../agent/identity.mjs';
import type { VoiceEvent, VoicePhase } from './protocol';
export type { VoiceEvent } from './protocol';
export type VoiceState = { enabled: boolean; running: boolean; phase: VoicePhase; assistant: boolean; microphone: boolean; message: string; name: string; error?: string; legacyVoiceData?: boolean };
type NativeVoice = {
  state(): Promise<string>; enable(value: boolean): Promise<void>; assistant(): Promise<void>;
  reply(requestId: string, text: string): Promise<void>; active(requestId: string): Promise<boolean>;
  cancel(requestId: string | null): Promise<void>; dialogue(): Promise<string>;
  standby(requestId: string): Promise<boolean>;
  clear(): Promise<void>; addListener(name: string, callback: (event: VoiceEvent) => void): { remove(): void };
  forgetLegacyVoiceData(): Promise<void>;
  decisionActive(id: string): Promise<boolean>; decide(id: string, action: string, error: string | null): Promise<void>;
};
const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeVoice>('UncoverVoice') : null;
const fail = async () => { throw Error(`${AGENT_NAME} 语音对话需要新版 Android 安装包；浏览器不提供锁屏常驻监听。`); };
export const voiceTransport = native ? {
  state: async (): Promise<VoiceState> => JSON.parse(await native.state()),
  enable: (value: boolean) => native.enable(value), assistant: () => native.assistant(),
  reply: (requestId: string, text: string) => native.reply(requestId, text), active: (requestId: string) => native.active(requestId), clear: () => native.clear(),
  cancel: (requestId?: string) => native.cancel(requestId ?? null), dialogue: async (): Promise<VoiceEvent> => JSON.parse(await native.dialogue()),
  standby: (requestId: string) => native.standby(requestId),
  forgetLegacyVoiceData: () => native.forgetLegacyVoiceData(),
  decisionActive: (id: string) => native.decisionActive(id), decide: (id: string, action: string, error?: string) => native.decide(id, action, error ?? null),
  subscribeEvents: (callback: (event: VoiceEvent) => void) => { const listener = native.addListener('dialogue', callback); return () => listener.remove(); },
  subscribe: (callback: () => void) => { const listener = native.addListener('status', callback); return () => listener.remove(); },
} : {
  state: async (): Promise<VoiceState> => ({ enabled: false, running: false, phase: 'unavailable', assistant: false, microphone: false, name: AGENT_NAME, message: '语音对话需要新版 Android 安装包。' }),
  forgetLegacyVoiceData: fail, decisionActive: async (_id: string) => false, decide: async (_id: string, _action: string, _error?: string) => {},
  enable: fail, assistant: fail, reply: async () => {}, active: async () => false, clear: async () => {}, subscribe: () => () => {},
  cancel: async (_requestId?: string) => {}, dialogue: async (): Promise<VoiceEvent> => ({ kind: 'status', sequence: 0, phase: 'unavailable' }), subscribeEvents: (_callback: (event: VoiceEvent) => void) => () => {},
  standby: async (_requestId: string) => false,
};
