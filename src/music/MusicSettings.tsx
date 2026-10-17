import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppRepository, useAppStore } from '../store/AppStore';
import { appPalette as c } from '../theme';
import { confirmAction } from '../utils/confirm';
import { musicProviders, normalizeMusicPreferences, type MusicProvider } from './preferences';
import { musicTransport } from './transport';
import type { MusicCapability } from './types';

export function MusicSettings() {
  const repository = useAppRepository();
  const { settings, updateSettings, ready } = useAppStore(state => ({ settings: state.settings, updateSettings: state.updateSettings, ready: state.ready }));
  const preferences = useMemo(() => normalizeMusicPreferences(settings.music), [settings.music]);
  const preset = preferences.presets[preferences.provider];
  const [name, setName] = useState(preset.name), [link, setLink] = useState(preset.link);
  const [capability, setCapability] = useState<MusicCapability | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const alive = useRef(true), locked = useRef(false);
  const latestProvider = useRef(preferences.provider);
  latestProvider.current = preferences.provider;
  useEffect(() => { setName(preset.name); setLink(preset.link); }, [preferences.provider, preset.name, preset.link]);
  useEffect(() => {
    let active = true;
    const refresh = () => { void musicTransport.capabilities(preferences.provider).then(value => { if (active) setCapability(value); }).catch(e => { if (active) setError(e instanceof Error ? e.message : '音乐软件状态读取失败。'); }); };
    setCapability(null); refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const unlisten = musicTransport.onStatusChanged(refresh);
    return () => { active = false; listener.remove(); unlisten(); };
  }, [preferences.provider]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = async (action: () => Promise<void>) => {
    if (locked.current || !ready) return;
    locked.current = true; setBusy(true); setError('');
    try {
      await action();
      const provider = normalizeMusicPreferences(repository.getSnapshot().settings.music).provider;
      const next = await musicTransport.capabilities(provider);
      if (alive.current && latestProvider.current === provider) setCapability(next);
    }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : '音乐设置失败，请重试。'); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  const choose = (provider: MusicProvider) => run(() => updateSettings({ music: { ...preferences, provider } }));
  const allowScreen = () => {
    if (capability?.screenConsent) { void run(() => musicTransport.consent(false)); return; }
    if (capability?.screenConsentAccepted) { void run(async () => { await musicTransport.consent(true); if (!capability.accessibilityGranted) await musicTransport.permission('accessibility'); }); return; }
    confirmAction('允许模型操作音乐界面？', '仅处理网易云音乐和 QQ 音乐。必要的界面文字会发送给你配置的 DeepSeek，用来搜索、选择歌单和播放；不读取密码，不自动登录、购买或更改权限。系统无障碍授权需你手动完成，可随时关闭。', () => void run(async () => { await musicTransport.consent(true); if (!capability?.accessibilityGranted) await musicTransport.permission('accessibility'); }), { confirmLabel: '同意并前往设置' });
  };
  const allowPlayback = () => {
    if (capability?.playbackConsent) { void run(() => musicTransport.playbackConsent(false)); return; }
    if (capability?.playbackConsentAccepted) { void run(async () => { await musicTransport.playbackConsent(true); if (!capability.notificationAccess) await musicTransport.permission('notifications'); }); return; }
    confirmAction('读取音乐播放状态？', 'Android 的通知使用权范围较广。本应用仅查询两款音乐软件的媒体播放状态，不采集或发送其他通知内容。开启后模型可以核实是否播放成功；系统授权仍需你手动完成。', () => void run(async () => { await musicTransport.playbackConsent(true); if (!capability?.notificationAccess) await musicTransport.permission('notifications'); }), { confirmLabel: '同意并前往设置' });
  };
  const allowBackground = () => {
    if (capability?.backgroundEnabled) { void run(() => musicTransport.backgroundConsent(false)); return; }
    if (capability?.backgroundConsentAccepted) { void run(async () => { await musicTransport.backgroundConsent(true); if (capability.shizukuRunning && !capability.shizukuGranted) await musicTransport.permission('shizuku'); }); return; }
    confirmAction('启用不切换页面的后台点歌？', '需要 Android 14+、Shizuku 和音乐无障碍授权。Shizuku 提供较高的系统调试权限，请仅从官方渠道安装并由你手动启动、授权。音乐软件在独立虚拟屏幕运行，模型只操作两款音乐软件，不操作你的主屏。失败时不会偷偷改为前台操作。手机重启后需重新启动 Shizuku；不自动登录、购买或绕过锁屏。', () => void run(async () => {
      await musicTransport.backgroundConsent(true);
      if (capability?.shizukuRunning && !capability.shizukuGranted) await musicTransport.permission('shizuku');
    }), { confirmLabel: '同意并启用' });
  };
  return <View testID="music-settings" style={s.card}>
    <Text style={s.heading}>音乐</Text><Text style={s.note}>预设软件后，直接在对话中告诉助手想听什么。</Text>
    <View style={s.options}>{(Object.keys(musicProviders) as MusicProvider[]).map(provider => <Pressable key={provider} accessibilityRole="radio" accessibilityLabel={`默认使用${musicProviders[provider]}`} accessibilityState={{ selected: preferences.provider === provider }} aria-checked={preferences.provider === provider} disabled={busy || !ready} onPress={() => void choose(provider)} style={[s.option, preferences.provider === provider && s.selected]}><Text style={[s.optionText, preferences.provider === provider && s.selectedText]}>{musicProviders[provider]}</Text></Pressable>)}</View>
    <Text style={s.label}>默认播放内容</Text><View style={s.options}>{(['favorites', 'playlist'] as const).map(kind => <Pressable key={kind} accessibilityRole="radio" accessibilityLabel={kind === 'favorites' ? '默认播放我喜欢' : '默认播放指定歌单'} accessibilityState={{ selected: preset.kind === kind }} aria-checked={preset.kind === kind} disabled={busy || !ready} onPress={() => void run(() => updateSettings({ music: { ...preferences, presets: { ...preferences.presets, [preferences.provider]: { ...preset, kind } } } }))} style={[s.option, preset.kind === kind && s.selected]}><Text style={[s.optionText, preset.kind === kind && s.selectedText]}>{kind === 'favorites' ? '我喜欢' : '指定歌单'}</Text></Pressable>)}</View>
    {preset.kind === 'playlist' ? <>
      <TextInput accessibilityLabel="默认歌单名称" value={name} onChangeText={setName} placeholder="例如：跑步歌单" placeholderTextColor={c.muted} editable={!busy} style={s.input} />
      <TextInput accessibilityLabel="默认歌单分享链接" value={link} onChangeText={setLink} placeholder="分享链接（选填）" placeholderTextColor={c.muted} editable={!busy} autoCapitalize="none" autoCorrect={false} style={s.input} />
      <Pressable accessibilityRole="button" accessibilityLabel="保存默认音乐歌单" disabled={busy || !ready} onPress={() => void run(() => updateSettings({ music: { ...preferences, presets: { ...preferences.presets, [preferences.provider]: { kind: 'playlist', name, link } } } }))} style={s.button}><Text style={s.accent}>保存歌单</Text></Pressable>
    </> : null}
    <Text testID="music-provider-status" style={s.note}>{capability ? !capability.native ? capability.message : capability.installed ? `${musicProviders[preferences.provider]} · 已安装${capability.version ? ` v${capability.version}` : ''}` : `${musicProviders[preferences.provider]} · 尚未安装` : '检查音乐软件…'}</Text>
    <View style={s.permissions}><Text style={s.label}>可选手机授权</Text>
      <Pressable testID="music-background-toggle" accessibilityRole="button" accessibilityLabel={capability?.backgroundEnabled ? '关闭后台点歌' : '开启后台点歌'} disabled={busy || !capability?.native || !capability.backgroundSupported} onPress={allowBackground} style={s.permission}><Text style={s.text}>后台点歌 · 不切换页面</Text><Text style={s.accent}>{capability?.backgroundEnabled ? '已选择 · 关闭' : '开启'}</Text></Pressable>
      {capability?.native && !capability.backgroundSupported ? <Text style={s.note}>独立焦点模式需要 Android 14 或以上，当前系统可使用前台点歌。</Text> : null}
      {capability?.backgroundEnabled ? <View testID="music-background-status" style={s.background}>
        <Text style={s.label}>{!capability.shizukuInstalled ? '先安装 Shizuku' : !capability.shizukuRunning ? '等待启动 Shizuku' : !capability.shizukuGranted ? '等待 Shizuku 授权' : !capability.screenConsent || !capability.accessibilityConnected ? '等待音乐界面授权' : '后台授权已就绪 · 待点歌验证'}</Text>
        <Text style={s.note}>实验性功能，需验证你的机型和音乐版本。主屏继续训练或聊天，模型在虚拟屏幕选歌。首次登录或协议确认，请先在音乐软件中手动完成。后台不可用时不切换主屏；锁屏暂不作为已验收能力。</Text>
        {!capability.shizukuInstalled ? <Pressable accessibilityRole="button" accessibilityLabel="打开 Shizuku 官方下载" onPress={() => void run(async () => { await Linking.openURL('https://shizuku.rikka.app/download/'); })} style={s.button}><Text style={s.accent}>前往官方安装 Shizuku</Text></Pressable> : !capability.shizukuRunning ? <Pressable accessibilityRole="button" accessibilityLabel="打开 Shizuku 启动设置" onPress={() => void run(() => musicTransport.permission('shizuku_setup'))} style={s.button}><Text style={s.accent}>打开 Shizuku · 手动启动</Text></Pressable> : !capability.shizukuGranted ? <Pressable accessibilityRole="button" accessibilityLabel="授权 Shizuku 后台点歌" onPress={() => void run(() => musicTransport.permission('shizuku'))} style={s.button}><Text style={s.accent}>手动授予 Shizuku 权限</Text></Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="刷新后台点歌状态" onPress={() => void run(async () => {})} style={s.button}><Text style={s.accent}>重新检查状态</Text></Pressable>
      </View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={capability?.screenConsent ? '关闭音乐界面控制' : '开启音乐界面控制'} disabled={busy || !capability?.native} onPress={allowScreen} style={s.permission}><Text style={s.text}>音乐界面操作</Text><Text style={s.accent}>{capability?.screenConsent && capability.accessibilityGranted && capability.accessibilityConnected ? '已启用 · 关闭' : capability?.screenConsent ? '待系统授权 · 关闭' : '开启'}</Text></Pressable>
      {capability?.screenConsent && (!capability.accessibilityGranted || !capability.accessibilityConnected) ? <Pressable accessibilityRole="button" accessibilityLabel="前往音乐无障碍授权" onPress={() => void run(() => musicTransport.permission('accessibility'))} style={s.button}><Text style={s.accent}>前往系统开启无障碍</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={capability?.playbackConsent ? '关闭音乐播放状态读取' : '开启音乐播放状态读取'} disabled={busy || !capability?.native} onPress={allowPlayback} style={s.permission}><Text style={s.text}>读取播放状态</Text><Text style={s.accent}>{capability?.playbackConsent && capability.notificationAccess ? '已启用 · 关闭' : capability?.playbackConsent ? '待系统授权 · 关闭' : '开启'}</Text></Pressable>
      {capability?.playbackConsent && !capability.notificationAccess ? <Pressable accessibilityRole="button" accessibilityLabel="前往音乐通知使用权授权" onPress={() => void run(() => musicTransport.permission('notifications'))} style={s.button}><Text style={s.accent}>前往系统开启通知使用权</Text></Pressable> : null}
      {capability?.native ? <Pressable accessibilityRole="button" accessibilityLabel="设置点歌进度通知" disabled={busy} onPress={() => void run(() => musicTransport.permission('task_notifications'))} style={s.permission}><Text style={s.text}>点歌进度通知</Text><Text style={s.accent}>{capability.taskNotificationsEnabled ? '已开启 · 设置' : '前往开启'}</Text></Pressable> : null}
      {capability?.native && !capability.taskNotificationsEnabled ? <Text style={s.note}>开启本应用通知后，可从系统通知栏取消正在处理的点歌任务。</Text> : null}
      <Text style={s.note}>界面控制默认关闭。{capability?.backgroundEnabled ? '当前选择后台模式，不会自动切换你的页面。' : '当前为前台选歌方式，会打开音乐软件。'}模型负责选择和操作；登录、会员购买与系统授权由你处理。</Text>
    </View>
    {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text>{capability?.native ? <Pressable accessibilityRole="button" onPress={() => void run(() => musicTransport.clear())} style={s.button}><Text style={s.accent}>关闭授权并清理本机音乐操作记录</Text></Pressable> : null}</> : null}
  </View>;
}
const s = StyleSheet.create({
  card: { padding: 20, borderRadius: 22, backgroundColor: c.card, gap: 12 }, heading: { color: c.text, fontSize: 18, fontWeight: '800' }, label: { color: c.text, fontSize: 13, fontWeight: '700' },
  note: { color: c.muted, fontSize: 12, lineHeight: 19 }, text: { color: c.text, fontSize: 13 }, options: { flexDirection: 'row', gap: 8 }, option: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }, optionText: { color: c.muted, fontSize: 13, fontWeight: '700' }, selected: { borderColor: c.lime, backgroundColor: '#28321C' }, selectedText: { color: c.lime },
  input: { color: c.text, fontSize: 14, minHeight: 46, borderColor: c.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }, button: { minHeight: 44, justifyContent: 'center' }, accent: { color: c.lime, fontSize: 12 },
  permissions: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16, gap: 8 }, permission: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 48 }, error: { color: c.warning, fontSize: 12, lineHeight: 19 },
  background: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border, gap: 8 },
});
