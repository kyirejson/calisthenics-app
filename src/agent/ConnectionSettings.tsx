import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { appPalette as c } from '../theme';
import { currentAgentConnection, loadAgentConnection, saveAgentConnection } from './credentials';
import { connectionSummary, GLM_MODELS, PERSONAL_MODELS, subscribeConnection } from './connectionRuntime.mjs';
import { createPersonalTransport } from './personalTransport.mjs';
import { clearConnectionReturn, markConnectionReturn } from './settingsResume';

/** Secret inputs never read stored keys back into the UI, journal or chat. */
export function ConnectionSettings() {
  const [summary, setSummary] = useState(() => connectionSummary(currentAgentConnection().mode));
  const [mode, setMode] = useState<'personal' | 'gateway'>(summary.mode), [model, setModel] = useState(summary.model);
  const [provider, setProvider] = useState<'deepseek' | 'glm'>(summary.provider);
  const [deepseek, setDeepseek] = useState(''), [tavily, setTavily] = useState(''), [glmKey, setGlmKey] = useState('');
  const [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [message, setMessage] = useState('');
  const mounted = useRef(true), pending = useRef<AbortController | null>(null), locked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const refresh = () => { const next = connectionSummary(currentAgentConnection().mode); if (mounted.current) setSummary(next); };
    const unsubscribe = subscribeConnection(refresh);
    void loadAgentConnection().then(() => {
      if (!mounted.current) return;
      const next = connectionSummary(currentAgentConnection().mode); setSummary(next); setMode(next.mode); setModel(next.model); setProvider(next.provider); setReady(true);
    }).catch(() => { if (mounted.current) setMessage('无法读取系统安全存储，请安装包含 SecureStore 的新安装包。'); });
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') pending.current?.abort(); });
    return () => { mounted.current = false; pending.current?.abort(); sub.remove(); unsubscribe(); };
  }, []);
  const run = async (task: () => Promise<string>) => {
    if (locked.current || !ready) return;
    locked.current = true; setBusy(true); setMessage('');
    try { const result = await task(); if (mounted.current) setMessage(result); }
    catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : '连接操作失败，请重试。'); }
    finally { pending.current = null; locked.current = false; if (mounted.current) setBusy(false); }
  };
  const persist = async () => {
    const old = currentAgentConnection();
    await saveAgentConnection({ ...old, mode, model, provider, deepseekKey: deepseek.trim() || old.deepseekKey, tavilyKey: tavily.trim() || old.tavilyKey, glmKey: glmKey.trim() || old.glmKey });
    if (mounted.current) { setDeepseek(''); setTavily(''); setGlmKey(''); }
  };
  const save = () => void run(async () => {
    await persist();
    return '设置已保存，尚未测试连接。留空保留原密钥；联网请求使用你自己的账户额度。';
  });
  const saveAndVerify = () => void run(async () => {
    await persist();
    pending.current = new AbortController();
    try { return '设置已保存。' + await createPersonalTransport({ config: currentAgentConnection() }).testConnection('model', pending.current.signal); }
    catch (error) { throw Error('设置已保存，但连接验证未通过：' + (error instanceof Error ? error.message : '请重试。')); }
  });
  const test = (kind: 'model' | 'search') => void run(async () => {
    pending.current = new AbortController();
    return createPersonalTransport({ config: currentAgentConnection() }).testConnection(kind, pending.current.signal);
  });
  const open = (url: string) => void (async () => {
    try { await markConnectionReturn(); await Linking.openURL(url); }
    catch { await clearConnectionReturn().catch(() => undefined); if (mounted.current) setMessage('无法打开官方平台或保留返回位置，请用浏览器访问。'); }
  })();
  const button = (title: string, action: () => void, enabled = true) => <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={busy || !ready || !enabled} onPress={action} style={[s.button, (busy || !ready || !enabled) && s.disabled]}><Text style={s.lime}>{title}</Text></Pressable>;
  return <View style={s.root} testID="agent-connection-settings">
    <Text style={s.title}>连接设置</Text>
    <Text style={s.text}>使用自己的 API Key，无需 Render。文字、图片及相关档案会发送给你选择的模型服务；搜索接口只接收检索词，不接收完整档案。</Text>
    <View style={s.row}>{(['personal', 'gateway'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value, disabled: busy }} disabled={busy} onPress={() => setMode(value)} style={[s.button, mode === value && s.selected]}><Text style={s.text}>{value === 'personal' ? '个人密钥直连' : '自托管开发网关'}</Text></Pressable>)}</View>
    {mode === 'gateway' ? <Text style={s.small}>网关由构建配置指定，必须由你信任和维护。个人密钥不会发送到该网关；手机默认直连，不自动回退旧服务。</Text> : <>
      <Text style={s.label}>服务商</Text>
      <View style={s.row}>{(['deepseek', 'glm'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={value === 'glm' ? '智谱聊天与搜索' : 'DeepSeek 与 Tavily'} accessibilityState={{ checked: provider === value }} disabled={busy} onPress={() => { setProvider(value); setModel((value === 'glm' ? GLM_MODELS : PERSONAL_MODELS)[0]); }} style={[s.button, provider === value && s.selected]}><Text style={s.text}>{value === 'glm' ? '智谱 · 一个 Key 聊天＋搜索' : 'DeepSeek ＋ Tavily'}</Text></Pressable>)}</View>
      <Text style={s.label}>模型</Text>
      <View style={s.row}>{(provider === 'glm' ? GLM_MODELS : PERSONAL_MODELS).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={value} accessibilityState={{ checked: model === value }} disabled={busy} onPress={() => setModel(value)} style={[s.button, model === value && s.selected]}><Text style={s.text}>{value}</Text></Pressable>)}</View>
      {provider === 'glm' ? <>
        <Text style={s.label}>智谱 {summary.hasGlm ? '· 已保存（非测试结果）' : '· 未配置'}</Text>
        <TextInput accessibilityLabel="个人智谱密钥" value={glmKey} onChangeText={setGlmKey} placeholder="粘贴完整 API Key；留空保留" placeholderTextColor={c.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="none" autoComplete="off" maxLength={501} editable={!busy && ready} style={s.input} />
        <Text style={s.small}>同一密钥分别调用智谱聊天和搜索 API，两者均按平台规则计费，可能需要单独开通搜索服务。当前接入的是文字模型，不声称具备图片识别能力。</Text>
      </> : <>
      <Text style={s.label}>DeepSeek {summary.hasDeepseek ? '· 已保存（非测试结果）' : '· 未配置'}</Text>
      <TextInput accessibilityLabel="个人 DeepSeek 密钥" value={deepseek} onChangeText={setDeepseek} placeholder="粘贴新密钥；留空保留已存密钥" placeholderTextColor={c.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="none" autoComplete="off" maxLength={503} editable={!busy && ready} style={s.input} />
      <Text style={s.label}>Tavily · 可选 {summary.hasTavily ? '· 已保存' : '· 未配置'}</Text>
      <TextInput accessibilityLabel="个人 Tavily 密钥" value={tavily} onChangeText={setTavily} placeholder="联网搜索、菜品配方检索所需" placeholderTextColor={c.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="none" autoComplete="off" maxLength={505} editable={!busy && ready} style={s.input} />
      </>}
      <Text style={s.small}>{Platform.OS === 'web' ? '浏览器仅在当前页面内存中保留密钥，刷新即失效，不写 localStorage。浏览器跨域限制可能阻止直连。' : '密钥保存在系统安全存储，不进入聊天、普通档案或导出备份。旧安装包需要更新原生模块。'}</Text>
    </>}
    {mode === 'personal' ? <><Text style={s.small}>“保存并验证”会发送一次最小文字测试请求，可能产生模型费用；不发送个人档案，不自动测试搜索或照片。只想保存密钥可选择“仅保存”。</Text>{button('保存并验证连接', saveAndVerify)}</> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="保存连接设置" disabled={busy || !ready} onPress={save} style={[s.button, (busy || !ready) && s.disabled]}><Text style={s.lime}>{mode === 'personal' ? '仅保存，不验证' : '保存连接设置'}</Text></Pressable>
    {mode === 'personal' ? <>
      <Text style={s.small}>单独重新验证也会产生一次请求，可能消耗额度。请先保存更改后的设置。</Text>
      <View style={s.row}>{button(provider === 'glm' ? '测试智谱连接' : '测试 DeepSeek 连接', () => test('model'), summary.provider === provider && (provider === 'glm' ? summary.hasGlm : summary.hasDeepseek) && summary.mode === 'personal')}{button(provider === 'glm' ? '测试智谱搜索' : '测试 Tavily 搜索', () => test('search'), summary.provider === provider && (provider === 'glm' ? summary.hasGlm : summary.hasTavily) && summary.mode === 'personal')}</View>
    </> : null}
    {message ? <Text accessibilityRole="alert" style={s.notice}>{message}</Text> : null}
    <Text style={s.label}>如何创建自己的 API Key</Text>
    <Text style={s.text}>1. 打开官方平台，注册并登录自己的账户。{"\n"}2. 在 API Keys 页面创建密钥，按平台要求开通额度。{"\n"}3. 返回本页粘贴，点击“保存并验证”。不要发到聊天；泄露后应在官方平台撤销。点官方入口后返回 App 会恢复连接设置，返回标记有效一天；未保存的密钥不会持久化。</Text>
    <View style={s.row}>{provider === 'glm' ? button('打开智谱开放平台', () => open('https://bigmodel.cn/')) : <>{button('打开 DeepSeek 密钥平台', () => open('https://platform.deepseek.com/api_keys'))}{button('打开 Tavily 平台', () => open('https://app.tavily.com/'))}</>}</View>
    {button('删除本机全部 API 密钥', () => void run(async () => {
      await saveAgentConnection({ ...currentAgentConnection(), deepseekKey: '', tavilyKey: '', glmKey: '' });
      if (mounted.current) { setDeepseek(''); setTavily(''); setGlmKey(''); }
      return '本机密钥已清除；要撤销账户密钥，请到官方平台操作。';
    }), summary.hasDeepseek || summary.hasTavily || summary.hasGlm)}
  </View>;
}
const s = StyleSheet.create({
  root: { gap: 14 }, title: { color: c.text, fontSize: 21, fontWeight: '800' }, text: { color: c.text, fontSize: 13, lineHeight: 22 }, small: { color: c.muted, fontSize: 12, lineHeight: 20 }, label: { color: c.text, fontWeight: '700', fontSize: 14 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10 }, selected: { borderColor: c.lime, backgroundColor: c.card }, lime: { color: c.lime, fontSize: 12, fontWeight: '700' }, disabled: { opacity: .4 }, input: { color: c.text, backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, minHeight: 48 }, notice: { color: c.warning, fontSize: 12, lineHeight: 21 },
});
