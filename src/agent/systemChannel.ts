import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
type SystemModule = { consumeSystemCommand(): Promise<string | null>; requestAssistantShortcut(): Promise<boolean> };
function nativeModule(): SystemModule | null { return Platform.OS === 'web' ? null : requireOptionalNativeModule<SystemModule>('UncoverCopilot'); }
export async function consumeSystemCommand() {
  const value = await nativeModule()?.consumeSystemCommand();
  return typeof value === 'string' ? value.slice(0, 1000) : null;
}
export async function requestAssistantShortcut() {
  const bridge = nativeModule();
  if (!bridge) throw Error('此安装包未包含系统入口模块，请安装重新构建的版本。');
  if (Platform.OS !== 'android') throw Error('iPhone 请在系统“快捷指令”中添加“Uncover → 询问个人助手”。');
  const accepted = await bridge.requestAssistantShortcut();
  return accepted ? '已向系统申请添加桌面入口，请完成系统确认。' : '当前桌面不支持固定快捷入口，可直接打开 App 的全局 AI 按钮。';
}
export async function releaseWakeMicrophone() {
  if (Platform.OS !== 'android') return;
  await requireOptionalNativeModule<{ stopWake(): Promise<void> }>('UncoverCopilot')?.stopWake();
}
