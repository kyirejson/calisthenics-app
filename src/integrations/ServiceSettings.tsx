import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { appPalette as c } from '../theme';
import { AppGlyph } from '../components/AppGlyph';
import { currentConnection, loadConnection, saveConnection } from './credentials';
import { connectionSummary, resetConnection, setModelConnectionVerified, subscribeConnection } from './connectionRuntime.mjs';
import { createDeepseekClient } from './deepseekClient.mjs';
import { confirmAction } from '../utils/confirm';
import { MusicSettings } from '../music/MusicSettings';
import { VoiceSettings } from '../voice/VoiceSettings';
import { PhoneSettings } from '../device/PhoneSettings';
import { ReminderSettings } from '../reminders/ReminderSettings';

export function ServiceSettings({ onClose }: { onClose: () => void }) {
  const [summary, setSummary] = useState(connectionSummary), [key, setKey] = useState('');
  const [model, setModel] = useState(connectionSummary().model);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [editing, setEditing] = useState(false);
  const [visible, setVisible] = useState(false), [message, setMessage] = useState('');
  const mounted = useRef(true), locked = useRef(false), request = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeConnection(() => {
      if (!mounted.current) return;
      const next = connectionSummary(); setSummary(next); setModel(next.model);
      if (!next.hasDeepseek) { setKey(''); setVisible(false); request.current?.abort(); }
    });
    void loadConnection().then(() => { if (mounted.current) { const next = connectionSummary(); setSummary(next); setModel(next.model); setReady(true); } })
      .catch(e => { if (mounted.current) setMessage(e instanceof Error ? e.message : '密钥读取失败。'); });
    return () => { mounted.current = false; request.current?.abort(); unsubscribe(); };
  }, []);
  const connect = async () => {
    if (!ready || locked.current) return;
    locked.current = true; setBusy(true); setMessage('');
    try {
      await saveConnection({ ...currentConnection(), model: model.trim(), deepseekKey: key.trim() || currentConnection().deepseekKey });
      if (!mounted.current) return;
      setKey(''); setVisible(false);
      const tested = currentConnection(); setModelConnectionVerified(tested, false);
      const controller = new AbortController(); request.current = controller;
      await createDeepseekClient({ config: tested }).testConnection(controller.signal);
      if (controller.signal.aborted || !setModelConnectionVerified(tested, true)) throw Error('配置已变化，请重新验证。');
      if (mounted.current) { setEditing(false); setMessage(''); }
    } catch (e) { if (mounted.current) setMessage(e instanceof Error ? e.message : '连接失败，请重试。'); }
    finally { request.current = null; locked.current = false; if (mounted.current) setBusy(false); }
  };
  const clearKey = () => confirmAction('清除本机 API Key？', '账户密钥须到 DeepSeek 平台撤销。', () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); request.current?.abort();
    void resetConnection().then(() => { if (mounted.current) { setEditing(false); setMessage('本机 API Key 已清除。'); } })
      .catch(e => { if (mounted.current) setMessage(e instanceof Error ? e.message : '清除失败。'); })
      .finally(() => { locked.current = false; if (mounted.current) setBusy(false); });
  }, { destructive: true, confirmLabel: '清除' });
  const expanded = editing || !summary.hasDeepseek;
  const content = <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}><Text style={s.title}>服务设置</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭服务设置" onPress={onClose} style={s.close}><Text style={s.text}>×</Text></Pressable></View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Pressable accessibilityRole="button" accessibilityLabel="修改 DeepSeek 连接" disabled={busy} onPress={() => setEditing(v => !v)} style={s.row}>
            <AppGlyph name="flash" size={24} /><View style={s.flex}><Text style={s.label}>DeepSeek</Text><Text style={s.small}>个人 API Key ({summary.model})</Text></View><Text style={s.status}>{summary.modelVerified ? '已连接' : summary.hasDeepseek ? '已保存' : '未连接'}</Text>
          </Pressable>
          {expanded ? <>
            <TextInput accessibilityLabel="DeepSeek 模型 ID" value={model} onChangeText={setModel} editable={!busy && ready} autoCapitalize="none" autoCorrect={false} placeholder="deepseek-flash" placeholderTextColor={c.muted} style={[s.input, { flex: 0 }]} />
            <Text style={s.small}>可填写账户支持的模型 ID；更换模型会重新验证，不自动替换你的选择。</Text>
            <View style={s.row}><TextInput accessibilityLabel="个人 DeepSeek 密钥" value={key} onChangeText={setKey} editable={!busy && ready} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="off" placeholder="粘贴 API Key" placeholderTextColor={c.muted} style={s.input} /><Pressable accessibilityRole="button" accessibilityLabel={visible ? '隐藏密钥' : '显示密钥'} onPress={() => setVisible(v => !v)} style={s.close}><AppGlyph name="eye" /></Pressable></View>
            <Pressable accessibilityRole="button" accessibilityLabel="保存并连接" disabled={busy || !ready} onPress={() => void connect()} style={[s.primary, (busy || !ready) && { opacity: .5 }]}><Text style={s.primaryText}>{busy ? '连接中…' : '保存并连接'}</Text></Pressable>
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://platform.deepseek.com/api_keys').catch(() => setMessage('无法打开官方平台。'))}><Text style={s.status}>获取 API Key ↗</Text></Pressable>
          </> : null}
          {message ? <Text accessibilityRole="alert" style={s.notice}>{message}</Text> : null}
        </View>
        <MusicSettings />
        <PhoneSettings />
        <VoiceSettings />
        <ReminderSettings />
        <Pressable accessibilityRole="button" accessibilityLabel="清除 API Key" disabled={!ready || busy || !summary.hasDeepseek} onPress={clearKey} style={s.clear}><Text style={s.danger}>清除 API Key</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>;
  return content;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background }, header: { paddingTop: 44, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: c.text, fontSize: 24, fontWeight: '800' },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 22, paddingBottom: 50, gap: 22 }, card: { padding: 20, borderRadius: 22, backgroundColor: c.card, gap: 18 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1 },
  label: { color: c.text, fontSize: 16, fontWeight: '700' }, text: { color: c.text, fontSize: 24 }, small: { color: c.muted, fontSize: 12, lineHeight: 20 }, status: { color: c.lime, fontSize: 13 },
  close: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, input: { flex: 1, minHeight: 54, paddingHorizontal: 12, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 14 },
  primary: { minHeight: 54, borderRadius: 16, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: c.onLime, fontSize: 16, fontWeight: '700' }, notice: { color: c.warning, fontSize: 12, lineHeight: 20 }, clear: { minHeight: 48, justifyContent: 'center' }, danger: { color: c.danger, fontSize: 14 },
});
