import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
type Native = { reminderStatus(): Promise<string>; listReminders(): Promise<string>; writeReminder(request: string, raw: string): Promise<string>;
  cancelReminder(id: string): Promise<string>; reminderPermission(kind: string): Promise<void>; clearReminders(): Promise<void> };
const native = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('UncoverDevice') : null;
const unavailable = () => ({ ok: false, native: false, code: 'native_required', notificationsGranted: false, exactAlarmsGranted: false, reminders: [], message: '本地准时提醒需要新版 Android 安装包。' });
export const reminderTransport = {
  status: async () => native ? JSON.parse(await native.reminderStatus()) : unavailable(),
  list: async () => native ? JSON.parse(await native.listReminders()) : unavailable(),
  write: async (request: string, input: Record<string, unknown>) => native ? JSON.parse(await native.writeReminder(request, JSON.stringify(input))) : unavailable(),
  cancel: async (id: string) => native ? JSON.parse(await native.cancelReminder(id)) : unavailable(),
  permission: async (kind: string) => { if (native) await native.reminderPermission(kind); },
  clear: async () => { if (native) await native.clearReminders(); },
};
