import { useEffect, useState } from 'react';
import { Alert, AppState, PermissionsAndroid, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { appPalette as c } from '../theme';
import { loadConnection } from '../integrations/credentials';
import { voiceTransport, type VoiceState } from './transport';

export function VoiceSettings() {
  const [state, setState] = useState<VoiceState | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const refresh = () => { void voiceTransport.state().then(value => { if (alive) setState(value); }).catch(e => { if (alive) setError(e.message); }); };
    refresh(); const stop = voiceTransport.subscribe(refresh);
    const foreground = AppState.addEventListener('change', value => { if (value === 'active') refresh(); });
    return () => { alive = false; stop(); foreground.remove(); };
  }, []);
  const enable = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (!state?.enabled && Platform.OS === 'android') {
        if (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) !== PermissionsAndroid.RESULTS.GRANTED) throw Error('未获得麦克风权限。');
        if (Number(Platform.Version) >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        await loadConnection();
      }
      await voiceTransport.enable(!state?.enabled); setState(await voiceTransport.state());
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const consent = () => {
    if (state?.enabled) { void enable(); return; }
    Alert.alert('开启 BLACK 语音对话？', '待机在本地监听 BLACK；唤醒后识别文字交给现有 Agent。使用内置中文声音，无需登记声纹，也不识别机主身份。会显示麦克风通知并增加耗电，可随时停止。', [{ text: '取消', style: 'cancel' }, { text: '开启', onPress: () => void enable() }]);
  };
  return <View style={s.card}>
    <View style={s.row}><View style={{ flex: 1 }}><Text style={s.title}>BLACK · 语音对话</Text><Text style={s.small}>{state?.phase === 'starting' ? '正在准备内置语音' : state?.running ? '监听中' : state?.enabled ? '服务未运行，请查看提示' : '尚未开启'}</Text></View>
      <Switch accessibilityLabel="BLACK 语音唤醒" value={state?.enabled ?? false} disabled={busy || Platform.OS !== 'android'} onValueChange={consent} trackColor={{ false: c.border, true: c.lime }} /></View>
    <Text style={s.small}>喊 BLACK 后可以连续交流，回答时也能说话。语音与文字共用 Agent、上下文和原有工具，不使用手机系统 TTS。</Text>
    <Pressable accessibilityRole="button" disabled={busy || Platform.OS !== 'android'} style={s.button} onPress={() => void voiceTransport.assistant().catch(e => setError(e.message))}><Text style={s.link}>{state?.assistant ? '已选为默认助手' : '设置默认语音助手（可选）'} ›</Text></Pressable>
    <Text style={s.small}>锁屏和后台运行受系统权限与省电策略影响；强行停止后需重新打开。通知中可停止监听。</Text>
    {state?.legacyVoiceData ? <Pressable accessibilityRole="button" style={s.button} onPress={() => Alert.alert('删除旧版声纹资料？', '仅删除旧版保存在本机的声音特征及对应密钥，不影响聊天、训练和饮食。新语音功能不再使用这些资料。', [{ text: '取消' }, { text: '删除', style: 'destructive', onPress: () => void voiceTransport.forgetLegacyVoiceData().then(async () => setState(await voiceTransport.state())).catch(e => setError(e.message)) }])}><Text style={s.small}>清理旧版声纹资料</Text></Pressable> : null}
    {error || state?.error ? <Text accessibilityRole="alert" style={s.warning}>{error || state?.message}</Text> : null}
  </View>;
}
const s = StyleSheet.create({
  card: { gap: 14, padding: 18, borderWidth: 1, borderColor: c.border, borderRadius: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { color: c.text, fontSize: 17, fontWeight: '700' },
  small: { color: c.muted, fontSize: 13, lineHeight: 21 }, button: { paddingVertical: 10 }, link: { color: c.lime, fontSize: 14 },
  warning: { color: '#e6ba74', fontSize: 13, lineHeight: 21 },
});
