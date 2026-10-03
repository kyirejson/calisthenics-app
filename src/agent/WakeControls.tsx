import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { appPalette as c } from '../theme';
type WakeStatus = { available: boolean; running: boolean; overlay: boolean; error: string };
type WakeBridge = { wakeStatus(): Promise<WakeStatus>; startWake(key: string): Promise<void>; stopWake(): Promise<void>; requestOverlayPermission(): Promise<void> };
export function WakeControls() {
  const [status, setStatus] = useState<WakeStatus | null>(null), [key, setKey] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const bridge = Platform.OS === 'android' ? requireOptionalNativeModule<WakeBridge>('UncoverCopilot') : null;
  useEffect(() => {
    let alive = true;
    const refresh = () => { if (bridge) void bridge.wakeStatus().then(value => { if (alive) setStatus(value); }).catch(() => { if (alive) setError('无法读取唤醒状态。'); }); };
    refresh(); const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const timer = setInterval(refresh, 3000);
    return () => { alive = false; sub.remove(); clearInterval(timer); };
  }, [bridge]);
  if (Platform.OS !== 'android') return null;
  const run = async (task: () => Promise<void>) => { if (busy) return; setBusy(true); setError(''); try { await task(); if (bridge) setStatus(await bridge.wakeStatus()); } catch { setError('未能启用：请核对模型、AccessKey、麦克风和悬浮窗权限。'); } finally { setBusy(false); } };
  return <View style={{ gap: 8 }}>
    <Text style={{ color: c.text, fontWeight: '800' }}>Android 离线唤醒</Text>
    <Text style={{ color: c.muted, lineHeight: 19 }}>需要授权的 Android 中文唤醒词和语言模型。仅在前台主动开启，附常驻通知。识别后释放麦克风，点悬浮入口打开助手；不自动发消息，进程结束不自动重启。</Text>
    {!bridge || !status?.available ? <Text style={{ color: c.muted }}>此安装包尚未包含唤醒模型，当前可使用长按语音和桌面入口。</Text> : <>
      <TextInput accessibilityLabel="Picovoice AccessKey" secureTextEntry value={key} onChangeText={setKey} placeholder="仅用于本次本机唤醒，不保存到记忆" placeholderTextColor={c.muted} style={{ color: c.text, borderColor: c.border, borderWidth: 1, padding: 12, borderRadius: 12 }} autoCorrect={false} autoCapitalize="none" />
      {!status.overlay ? <Pressable accessibilityRole="button" accessibilityLabel="授权助手悬浮窗" disabled={busy} onPress={() => void run(() => bridge.requestOverlayPermission())} style={{ padding: 12 }}><Text style={{ color: c.lime }}>打开系统悬浮窗授权</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={status.running ? '停止离线唤醒' : '开启离线唤醒'} disabled={busy || !status.running && (!key.trim() || !status.overlay)} onPress={() => void run(async () => {
        if (status.running) { await bridge.stopWake(); return; }
        const { ExpoSpeechRecognitionModule } = await import('expo-speech-recognition');
        if (!(await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync()).granted) throw Error('Microphone denied');
        await bridge.startWake(key.trim()); setKey('');
      })} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border }}><Text style={{ color: c.lime }}>{status.running ? '停止监听' : '开启本次监听'}</Text></Pressable>
    </>}
    {error || status?.error ? <Text accessibilityRole="alert" style={{ color: c.warning }}>{error || status?.error}</Text> : null}
  </View>;
}
