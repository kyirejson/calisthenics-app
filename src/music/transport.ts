import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { MusicProvider } from './preferences';
import type { MusicTransport, MusicCapability, MusicCommand, MusicResult } from './types';
type NativeMusic = {
  capabilities(provider: string): Promise<string>; screen(provider: string, offset: number): Promise<string>; playback(provider: string): Promise<string>;
  execute(requestId: string, raw: string, executionId: string): Promise<string>; receipts(requestId: string): Promise<string>;
  executeAndObserve(requestId: string, raw: string, executionId: string): Promise<string>;
  cancel(requestId: string): Promise<void>; returnToApp(requestId: string, executionId: string): Promise<void>; consent(value: boolean): Promise<void>; playbackConsent(value: boolean): Promise<void>;
  finishWithoutUi(requestId: string, executionId: string): Promise<void>;
  addListener(name: string, callback: (event: { executionId: string }) => void): { remove(): void };
  backgroundConsent(value: boolean): Promise<void>;
  permission(kind: string): Promise<void>; clear(): Promise<void>;
};
const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeMusic>('UncoverMusic') : null;
const unavailable = (): MusicResult => ({ ok: false, code: 'native_required', status: 'needs_user_action', message: Platform.OS === 'web' ? '浏览器不能控制手机音乐软件，请使用 Android 安装包。' : '当前安装包没有音乐控制模块，请安装新版 Android APK。' });
const fail = async () => { throw Error(unavailable().message); };
export const musicTransport: MusicTransport = native ? {
  capabilities: async provider => JSON.parse(await native.capabilities(provider)) as MusicCapability,
  screen: async (provider, offset) => JSON.parse(await native.screen(provider, offset)),
  playback: async provider => JSON.parse(await native.playback(provider)),
  execute: async (requestId, command: MusicCommand, executionId = requestId) => JSON.parse(await native.execute(requestId, JSON.stringify(command), executionId)),
  executeAndObserve: async (requestId, command: MusicCommand, executionId = requestId) => JSON.parse(await native.executeAndObserve(requestId, JSON.stringify(command), executionId)),
  receipts: async requestId => JSON.parse(await native.receipts(requestId)),
  cancel: requestId => native.cancel(requestId), returnToApp: (requestId, executionId = requestId) => native.returnToApp(requestId, executionId),
  finishWithoutUi: (requestId, executionId = requestId) => native.finishWithoutUi(requestId, executionId),
  onCancelled: (executionId, callback) => { const listener = native.addListener('cancelled', event => { if (event.executionId === executionId) callback(); }); return () => listener.remove(); },
  onStatusChanged: callback => { const listener = native.addListener('statusChanged', callback); return () => listener.remove(); },
  backgroundConsent: value => native.backgroundConsent(value),
  consent: value => native.consent(value), playbackConsent: value => native.playbackConsent(value), permission: kind => native.permission(kind), clear: () => native.clear(),
} : {
  capabilities: async (provider: MusicProvider) => ({ provider, installed: false, searchIntent: false, native: false, accessibilityGranted: false, accessibilityConnected: false, notificationAccess: false, screenConsent: false, playbackConsent: false, message: unavailable().message }),
  screen: async () => unavailable(), playback: async () => unavailable(), execute: async () => unavailable(), executeAndObserve: async () => unavailable(),
  receipts: async () => [], cancel: async () => {}, returnToApp: async () => {}, finishWithoutUi: async () => {}, onCancelled: () => () => {}, onStatusChanged: () => () => {}, clear: async () => {}, consent: fail, backgroundConsent: fail, playbackConsent: fail, permission: fail,
};
