import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { emptyRun, type RunSnapshot, type RunMode, type RunOptions } from './model';
import { browserRunning } from './webRecorder';

type AndroidRunning = { insets: () => Promise<string>; snapshot: (after: number) => Promise<string>; preview: () => Promise<void>; stopPreview: () => Promise<void>; start: (id: string, mode: RunMode) => Promise<void>; pause: () => Promise<void>; resume: () => Promise<void>; finish: (distance: number) => Promise<void>; acknowledge: (id: string) => Promise<void>; clear: () => Promise<void> };
const native = Platform.OS === 'android' ? requireOptionalNativeModule<AndroidRunning>('UncoverRunning') : null;
export const runningSupported = Platform.OS === 'web' || !!native;
export const runningInsets = async (): Promise<{ top: number; bottom: number }> => native?.insets ? JSON.parse(await native.insets()) : { top: 0, bottom: 0 };
export async function keepRunScreenOn(enabled: boolean) {
  const module = native as (AndroidRunning & { keepScreenOn?: (value: boolean) => Promise<void> }) | null;
  if (module?.keepScreenOn) await module.keepScreenOn(enabled);
}
export async function configureRunOptions(value: RunOptions) {
  if (!native) { await browserRunning.configure(value); return; }
  const module = native as AndroidRunning & { configure?: (raw: string) => Promise<void> };
  if (!module.configure) throw Error('当前安装包不支持这些跑步设置，请安装新版 APK。');
  await module.configure(JSON.stringify(value));
}
export const runningTransport = native ? {
  ...native,
  snapshot: async (after: number): Promise<RunSnapshot> => ({ ...emptyRun(), ...JSON.parse(await native.snapshot(after)) }),
  preview: () => native.preview(), stopPreview: () => native.stopPreview(), start: (id: string, mode: RunMode = 'outdoor') => native.start(id, mode), pause: () => native.pause(),
  resume: () => native.resume(), finish: (distance?: number) => native.finish(distance ?? -1), acknowledge: (id: string) => native.acknowledge(id), clear: () => native.clear(),
} : browserRunning;
