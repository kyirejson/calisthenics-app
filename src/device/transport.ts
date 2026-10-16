import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { PhoneResult, PhoneStatus, PhoneTransport } from './types';
type NativePhone = {
  status(): Promise<string>; findApps(query: string, offset: number): Promise<string>;
  screen(request: string, execution: string, offset: number, expected: string | null, visualText: boolean): Promise<string>;
  executeAndObserve(request: string, execution: string, raw: string): Promise<string>;
  receipts(request: string): Promise<string>; cancel(execution: string): Promise<void>; finish(execution: string): Promise<void>;
  consent(enabled: boolean): Promise<void>; permission(): Promise<void>; clear(): Promise<void>;
  addListener(name: string, callback: (event: { executionId: string }) => void): { remove(): void };
};
const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativePhone>('UncoverDevice') : null;
const unavailable = (): PhoneResult => ({ ok: false, code: 'native_required', message: Platform.OS === 'web' ? '浏览器预览不能操作手机，请使用新版 Android APK。' : '当前安装包未包含通用手机控制，请安装新版 Android APK。' });
const fail = async () => { throw Error(unavailable().message); };
export const phoneTransport: PhoneTransport = native ? {
  status: async () => JSON.parse(await native.status()), findApps: async (query, offset) => JSON.parse(await native.findApps(query, offset)),
  screen: async (request, execution, offset, expected, visualText = false) => JSON.parse(await native.screen(request, execution, offset, expected ?? null, visualText)),
  executeAndObserve: async (request, execution, command) => JSON.parse(await native.executeAndObserve(request, execution, JSON.stringify(command))),
  receipts: async request => JSON.parse(await native.receipts(request)), cancel: execution => native.cancel(execution), finish: execution => native.finish(execution),
  onCancelled: (execution, callback) => { const listener = native.addListener('cancelled', event => { if (event.executionId === execution) callback(); }); return () => listener.remove(); },
  onStatusChanged: callback => { const listener = native.addListener('statusChanged', callback); return () => listener.remove(); },
  consent: enabled => native.consent(enabled), permission: () => native.permission(), clear: () => native.clear(),
} : {
  status: async (): Promise<PhoneStatus> => ({ ...unavailable(), native: false, enabled: false, accessibilityGranted: false, connected: false, locked: false, mode: 'foreground' }),
  findApps: async () => unavailable(), screen: async () => unavailable(), executeAndObserve: async () => unavailable(),
  receipts: async () => [], cancel: async () => {}, finish: async () => {}, onCancelled: () => () => {}, onStatusChanged: () => () => {}, consent: fail, permission: fail, clear: async () => {},
};
