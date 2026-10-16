import { useEffect, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { appPalette as c } from '../theme';
import { confirmAction } from '../utils/confirm';
import { phoneTransport } from './transport';
import type { PhoneStatus } from './types';

export function PhoneSettings() {
  const [state, setState] = useState<PhoneStatus | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    const refresh = () => { void phoneTransport.status().then(value => { if (mounted) setState(value); }).catch(error => { if (mounted) setError(error.message); }); };
    refresh(); const stop = phoneTransport.onStatusChanged(refresh);
    const foreground = AppState.addEventListener('change', value => { if (value === 'active') refresh(); });
    return () => { mounted = false; stop(); foreground.remove(); };
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); setState(await phoneTransport.status()); } catch (error) { setError(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); }
  };
  const toggle = () => {
    if (state?.enabled) { void run(() => phoneTransport.consent(false)); return; }
    confirmAction('允许 MAX 操作手机？', '此授权不限音乐：MAX 可按你的请求打开已安装应用、读取当前界面、点击、输入、滚动和切换应用，包括你明确要求的微信发送。必要的界面文字会发送给你配置的模型 API，用于理解和完成任务。会操作真实主屏幕，不是隐形后台模式；不在待机中持续读屏，不读取密码，登录、身份验证和系统授权需本人完成。可随时从本设置或任务通知停止。', () => void run(async () => {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      await phoneTransport.consent(true);
      if (!state?.accessibilityGranted || !state?.connected) await phoneTransport.permission();
    }), { confirmLabel: '同意并开启' });
  };
  return <View style={s.card}>
    <View style={s.row}><View style={s.copy}><Text style={s.heading}>MAX · 手机控制</Text>
      <Text style={s.note}>{!state?.native ? '仅新版 Android 安装包支持' : !state.enabled ? '尚未开启' : state.connected ? '已启用 · 通用主屏幕操作' : '等待系统无障碍连接'}</Text></View>
      <Switch accessibilityLabel="MAX 通用手机控制" value={state?.enabled ?? false} disabled={busy || !state?.native} onValueChange={toggle} trackColor={{ false: c.border, true: c.lime }} /></View>
    <Text style={s.note}>不限于指定的三款应用。由 MAX 理解任务，自主选择应用和操作步骤；界面控制使用手机真实主屏幕。</Text>
    {state?.enabled && !state.connected ? <Pressable accessibilityRole="button" accessibilityLabel="开启 MAX 手机无障碍控制" disabled={busy} onPress={() => void run(() => phoneTransport.permission())} style={s.button}><Text style={s.link}>前往系统开启「MAX 手机与音乐控制」 ›</Text></Pressable> : null}
    {state?.enabled ? <Text style={s.note}>请本人先解锁并完成目标应用登录。操作期间可以从系统通知停止；音乐的后台点歌设置独立保留。</Text> : null}
    {state?.native ? <Pressable accessibilityRole="button" accessibilityLabel="清理手机操作回执" disabled={busy} style={s.button} onPress={() => confirmAction('关闭控制并清理操作回执？', '会停止当前手机操作并撤销 App 内的通用授权，不删除聊天、微信消息、训练记录或音乐设置。', () => void run(() => phoneTransport.clear()), { destructive: true, confirmLabel: '关闭并清理' })}><Text style={s.note}>关闭并清理手机操作回执</Text></Pressable> : null}
    <Text style={s.note}>控件不足时可由 MAX 按需调用本机截图识字，只发送识别文字与坐标，不保存或上传截图。</Text>
    {error || state?.ok === false && state.native ? <Text accessibilityRole="alert" style={s.error}>{error || state?.message}</Text> : null}
  </View>;
}
const s = StyleSheet.create({
  card: { padding: 20, borderRadius: 22, backgroundColor: c.card, gap: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, copy: { flex: 1, gap: 4 },
  heading: { color: c.text, fontSize: 18, fontWeight: '800' }, note: { color: c.muted, fontSize: 12, lineHeight: 20 }, button: { minHeight: 44, justifyContent: 'center' },
  link: { color: c.lime, fontSize: 13 }, error: { color: c.warning, fontSize: 12, lineHeight: 20 },
});
