import { useEffect, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { appPalette as c } from '../theme';
import { reminderTransport } from './transport';
export function ReminderSettings() {
  const [state, setState] = useState<{ native: boolean; notificationsGranted: boolean; exactAlarmsGranted: boolean } | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const refresh = () => { void reminderTransport.status().then(value => { if (alive) setState(value); }).catch(e => { if (alive) setError(e.message); }); };
    refresh(); const sub = AppState.addEventListener('change', phase => { if (phase === 'active') refresh(); });
    return () => { alive = false; sub.remove(); };
  }, []);
  const allow = async (kind: string) => {
    setBusy(true); setError('');
    try {
      if (kind === 'notifications' && Platform.OS === 'android' && Number(Platform.Version) >= 33 && !await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      const current = await reminderTransport.status();
      if (kind === 'exact' ? !current.exactAlarmsGranted : !current.notificationsGranted) await reminderTransport.permission(kind);
      setState(await reminderTransport.status());
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return <View style={s.card}><Text style={s.title}>事项提醒</Text>
    <Text style={s.note}>告诉 MAX 时间和要做的事，到点收到通知。关闭或划掉 App 后仍可提醒。</Text>
    {[['notifications', '提醒通知', state?.notificationsGranted], ['exact', '准时提醒', state?.exactAlarmsGranted]].map(([kind, label, granted]) => <Pressable key={String(kind)} accessibilityRole="button" disabled={busy || !state?.native || Boolean(granted)} onPress={() => void allow(String(kind))} style={s.row}><Text style={s.text}>{label}</Text><Text style={s.link}>{granted ? '已授权' : '开启'}</Text></Pressable>)}
    <Text style={s.note}>{state?.native === false ? '浏览器预览不支持本地提醒。' : '授权一次持续使用；系统强行停止或清除数据后，需重新打开 App。'}</Text>
    {error ? <Text style={s.note}>{error}</Text> : null}
  </View>;
}
const s = StyleSheet.create({ card: { padding: 20, borderRadius: 22, backgroundColor: c.card, gap: 12 }, title: { color: c.text, fontSize: 18, fontWeight: '800' }, note: { color: c.muted, fontSize: 12, lineHeight: 20 }, row: { minHeight: 46, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, text: { color: c.text, fontSize: 14 }, link: { color: c.lime, fontSize: 13 } });
