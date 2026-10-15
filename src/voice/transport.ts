import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
export type VoiceState = { enabled: boolean; running: boolean; phase: string; assistant: boolean; microphone: boolean; message: string; name: string; error?: string; ownerRegistered: boolean; enrolling: boolean; enrollmentProgress: number; enrollmentStage: string };
export type VoiceEvent = { kind: 'status' | 'transcript' | 'interrupt' | 'speech' | 'playback_error'; sequence: number; phase: string;
  requestId?: string; segmentId?: string; text?: string; spokenEnd?: number; speechStart?: number; speechEnd?: number; error?: string };
type NativeVoice = {
  state(): Promise<string>; enable(value: boolean): Promise<void>; assistant(): Promise<void>;
  reply(requestId: string, text: string): Promise<void>; active(requestId: string): Promise<boolean>;
  cancel(requestId: string | null): Promise<void>; dialogue(): Promise<string>;
  clear(): Promise<void>; addListener(name: string, callback: (event: VoiceEvent) => void): { remove(): void };
  enrollOwner(): Promise<void>; cancelEnrollment(): Promise<void>; forgetOwner(): Promise<void>;
  decisionActive(id: string): Promise<boolean>; decide(id: string, action: string, error: string | null): Promise<void>;
};
const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeVoice>('UncoverVoice') : null;
const fail = async () => { throw Error('语音唤醒需要新版 Android 安装包；浏览器不提供锁屏常驻监听。'); };
export const voiceTransport = native ? {
  state: async (): Promise<VoiceState> => JSON.parse(await native.state()),
  enable: (value: boolean) => native.enable(value), assistant: () => native.assistant(),
  reply: (requestId: string, text: string) => native.reply(requestId, text), active: (requestId: string) => native.active(requestId), clear: () => native.clear(),
  cancel: (requestId?: string) => native.cancel(requestId ?? null), dialogue: async (): Promise<VoiceEvent> => JSON.parse(await native.dialogue()),
  enrollOwner: () => native.enrollOwner(), cancelEnrollment: () => native.cancelEnrollment(), forgetOwner: () => native.forgetOwner(),
  decisionActive: (id: string) => native.decisionActive(id), decide: (id: string, action: string, error?: string) => native.decide(id, action, error ?? null),
  subscribeEvents: (callback: (event: VoiceEvent) => void) => { const listener = native.addListener('dialogue', callback); return () => listener.remove(); },
  subscribe: (callback: () => void) => { const listener = native.addListener('status', callback); return () => listener.remove(); },
} : {
  state: async (): Promise<VoiceState> => ({ enabled: false, running: false, phase: 'unavailable', assistant: false, microphone: false, name: 'BLACK', message: '语音唤醒需要新版 Android 安装包。', ownerRegistered: false, enrolling: false, enrollmentProgress: 0, enrollmentStage: 'voice_1' }),
  enrollOwner: fail, cancelEnrollment: fail, forgetOwner: fail, decisionActive: async (_id: string) => false, decide: async (_id: string, _action: string, _error?: string) => {},
  enable: fail, assistant: fail, reply: async () => {}, active: async () => false, clear: async () => {}, subscribe: () => () => {},
  cancel: async (_requestId?: string) => {}, dialogue: async (): Promise<VoiceEvent> => ({ kind: 'status', sequence: 0, phase: 'unavailable' }), subscribeEvents: (_callback: (event: VoiceEvent) => void) => () => {},
};
