import { useEffect, useState } from 'react';
import { Alert, AppState, PermissionsAndroid, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { appPalette as c } from '../theme';
import { voiceTransport, type VoiceState } from './transport';

export function VoiceSettings() {
  const [state, setState] = useState<VoiceState | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { let alive = true; const refresh = () => { void voiceTransport.state().then(value => { if (alive) setState(value); }).catch(e => { if (alive) setError(String(e.message)); }); }; refresh(); const stop = voiceTransport.subscribe(refresh); const foreground = AppState.addEventListener('change', value => { if (value === 'active') refresh(); }); return () => { alive = false; stop(); foreground.remove(); }; }, []);
  const enable = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (!state?.enabled && Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) throw Error('未获得麦克风权限，语音监听没有开启。');
        if (Number(Platform.Version) >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      await voiceTransport.enable(!state?.enabled); setState(await voiceTransport.state());
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const consent = () => {
    if (state?.enabled) { void enable(); return; }
    Alert.alert('开启 BLACK 语音唤醒？', '麦克风会持续在本地识别名字，显示监听通知；唤醒后识别的文字交给现有 Agent，回答后可连续对话。待机音频不保存、不上传。锁屏可运行，但会增加耗电。通知中可随时停止。', [{ text: '取消', style: 'cancel' }, { text: '开启', onPress: () => void enable() }]);
  };
  return <View style={s.card}>
    <View style={s.row}><View style={{ flex: 1 }}><Text style={s.title}>BLACK · 语音唤醒</Text><Text style={s.small}>{state?.phase === 'starting' ? '正在准备本地语音' : state?.running ? '监听中' : state?.enabled ? '监听已开启，服务未运行' : '尚未开启'}</Text></View><Switch accessibilityLabel="BLACK 语音唤醒" value={state?.enabled ?? false} disabled={busy || Platform.OS !== 'android'} onValueChange={consent} trackColor={{ false: c.border, true: c.lime }} /></View>
    <Text style={s.small}>喊「BLACK」即可对话，也可直接说话打断回答。语音和文字使用同一个 Agent，支持原有音乐、饮食和训练工具。</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="设置 BLACK 为默认语音助手" disabled={busy || Platform.OS !== 'android'} style={s.button} onPress={() => { void voiceTransport.assistant().catch(e => setError(e.message)); }}><Text style={s.link}>{state?.assistant ? '已选为默认助手' : '设置为默认语音助手'} ›</Text></Pressable>
    <Text style={s.small}>在系统的数字助手设置中选择 Uncover，会替换原默认助手。该入口用于系统恢复监听，停止后是否恢复取决于系统。关闭麦克风、主动停止监听、首次解锁前不能唤醒；不会自动修改系统设置。</Text>
    {error || state?.error ? <Text accessibilityRole="alert" style={s.warning}>{error || state?.message}</Text> : null}
  </View>;
}
const s = StyleSheet.create({ card: { backgroundColor: c.card, borderRadius: 22, padding: 20, gap: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { color: c.text, fontSize: 16, fontWeight: '700' }, small: { color: c.muted, fontSize: 12, lineHeight: 20 }, button: { minHeight: 48, justifyContent: 'center' }, link: { color: c.lime, fontSize: 14 }, warning: { color: c.warning, fontSize: 12, lineHeight: 20 } });
