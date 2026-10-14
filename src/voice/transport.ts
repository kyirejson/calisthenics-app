import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
export type VoiceState = { enabled: boolean; running: boolean; phase: string; assistant: boolean; microphone: boolean; message: string; name: string; error?: string };
type NativeVoice = {
  state(): Promise<string>; enable(value: boolean): Promise<void>; assistant(): Promise<void>;
  reply(requestId: string, text: string): Promise<void>; active(requestId: string): Promise<boolean>;
  clear(): Promise<void>; addListener(name: string, callback: () => void): { remove(): void };
};
const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeVoice>('UncoverVoice') : null;
const fail = async () => { throw Error('语音唤醒需要新版 Android 安装包；浏览器不提供锁屏常驻监听。'); };
export const voiceTransport = native ? {
  state: async (): Promise<VoiceState> => JSON.parse(await native.state()),
  enable: (value: boolean) => native.enable(value), assistant: () => native.assistant(),
  reply: (requestId: string, text: string) => native.reply(requestId, text), active: (requestId: string) => native.active(requestId), clear: () => native.clear(),
  subscribe: (callback: () => void) => { const listener = native.addListener('status', callback); return () => listener.remove(); },
} : {
  state: async (): Promise<VoiceState> => ({ enabled: false, running: false, phase: 'unavailable', assistant: false, microphone: false, name: 'BLACK', message: '语音唤醒需要新版 Android 安装包。' }),
  enable: fail, assistant: fail, reply: async () => {}, active: async () => false, clear: async () => {}, subscribe: () => () => {},
};
