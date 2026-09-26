import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { checkForUpdates, type AvailableUpdate } from '../services/updateChecker';
import { canReloadUpdate } from '../services/updatePolicy';
import { Button, ProgressBar } from './ui';
import { colors } from '../theme';

type Phase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'current' | 'error';
type UpdateContext = { phase: Phase; status: string; open: () => void; setSafeScreen: (safe: boolean) => void };
const Context = createContext<UpdateContext | null>(null);
export function useAppUpdates() { const value = useContext(Context); if (!value) throw new Error('Missing AppUpdatesProvider'); return value; }

export function AppUpdatesProvider({ children }: { children: React.ReactNode }) {
  const native = Platform.OS !== 'web';
  const otaEnabled = native && !__DEV__ && Updates.isEnabled;
  const updateState = Updates.useUpdates();
  const [phase, setPhase] = useState<Phase>('idle');
  const [visible, setVisible] = useState(false);
  const [safeScreen, setSafe] = useState(false);
  const [apk, setApk] = useState<AvailableUpdate | null>(null);
  const [message, setMessage] = useState('');
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const safeRef = useRef(false);
  const busy = useRef(false);
  const downloaded = useRef(false);
  const lastCheck = useRef(0);
  const prompted = useRef(new Set<string>());
  const setSafeScreen = useCallback((safe: boolean) => { safeRef.current = safe; setSafe(safe); }, []);

  const check = useCallback(async (manual: boolean) => {
    if (!native || busy.current) return;
    if (downloaded.current) { setPhase('ready'); if (manual) setVisible(true); return; }
    if (!manual && Date.now() - lastCheck.current < 6 * 60 * 60 * 1000) return;
    lastCheck.current = Date.now(); busy.current = true; setPhase('checking'); setMessage('');
    if (manual) setVisible(true);
    let failures = 0;
    try {
      let packageUpdate: AvailableUpdate | null = null;
      if (Platform.OS === 'android') {
        try { packageUpdate = await checkForUpdates(manual); } catch { failures++; }
      }
      setApk(packageUpdate);
      let updateId = '';
      if (packageUpdate) updateId = packageUpdate.tag;
      else if (otaEnabled) {
        try {
          const result = await Updates.checkForUpdateAsync();
          if (result.isAvailable || result.isRollBackToEmbedded) updateId = result.manifest?.id || 'rollback';
        } catch { failures++; }
      }
      if (updateId) {
        setPhase('available');
        if (manual || !prompted.current.has(updateId)) { setVisible(true); prompted.current.add(updateId); }
      } else if (failures) {
        setPhase('error'); setMessage('检查失败，请确认网络后重试。当前版本仍可继续使用。');
      } else setPhase('current');
    } finally { busy.current = false; }
  }, [native, otaEnabled]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => { if (safeScreen && foreground) void check(false); }, [safeScreen, foreground, check]);
  useEffect(() => {
    if (otaEnabled && updateState.isUpdatePending) { downloaded.current = true; setPhase('ready'); }
  }, [otaEnabled, updateState.isUpdatePending]);

  const download = async () => {
    if (busy.current) return;
    if (apk) {
      try { await Linking.openURL(apk.apkUrl); setVisible(false); }
      catch { setMessage('无法打开安装包下载链接，请稍后重试。'); setPhase('error'); }
      return;
    }
    busy.current = true; setPhase('downloading'); setMessage('');
    try {
      const result = await Updates.fetchUpdateAsync();
      if (result.isNew || result.isRollBackToEmbedded) { downloaded.current = true; setPhase('ready'); }
      else { setPhase('current'); setMessage('此更新已撤回或无需下载，请稍后重新检查。'); }
    } catch { setPhase('error'); setMessage('下载失败，当前版本和训练记录不受影响。请重试。'); }
    finally { busy.current = false; }
  };
  const apply = async () => {
    if (!canReloadUpdate(downloaded.current, safeRef.current, AppState.currentState === 'active') || busy.current) return;
    busy.current = true;
    try { await Updates.reloadAsync(); }
    catch { busy.current = false; setPhase('error'); setMessage('重新加载失败，可关闭应用后重新打开，或稍后重试。'); }
  };
  const status = phase === 'checking' ? '正在检查…' : phase === 'downloading' ? '正在下载更新…' : phase === 'ready' ? '更新已下载，等待重新打开' : phase === 'available' ? apk ? `可更新到 v${apk.version}` : '发现内容更新' : phase === 'error' ? '检查或下载失败，点击重试' : !native ? '浏览器为本地开发预览' : !otaEnabled ? '安装包检查可用 · 热更新待连接服务／正式构建' : phase === 'current' ? '已是最新版本' : '检查安装包与内容更新';
  const title = phase === 'ready' ? '更新已准备好' : phase === 'available' ? '发现新版本' : phase === 'downloading' ? '正在下载更新' : phase === 'checking' ? '正在检查版本' : phase === 'error' ? '更新暂未完成' : '应用更新';
  const progress = updateState.downloadProgress;
  return <Context.Provider value={{ phase, status, setSafeScreen, open: () => { if (phase === 'available' || phase === 'ready' || phase === 'downloading') setVisible(true); else void check(true); } }}>
    {children}
    <Modal visible={native && visible && safeScreen && foreground} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.backdrop}><View style={styles.card}>
        <Text style={styles.kicker}>UNCOVER · 应用更新</Text><Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{message || (phase === 'ready' ? '训练记录保留在本机。点击后重新打开应用，使更新生效。' : phase === 'available' ? apk ? `v${apk.version} · 此次需下载新版安装包。请先导出备份，再由系统确认覆盖安装，不要卸载旧版。` : '有适用于此安装包的内容更新。下载完成后，由你决定何时重新打开。' : status)}</Text>
        {phase === 'downloading' ? <View style={styles.progress}><ProgressBar value={(progress || 0) * 100} /><Text style={styles.body}>{progress === undefined ? '正在准备下载…' : `${Math.round(progress * 100)}%`}</Text></View> : null}
        {phase === 'ready' ? <Button label="重新打开并更新" variant="lime" onPress={() => void apply()} /> : phase === 'available' ? <Button label={apk ? '下载安装包' : '立即下载'} variant="lime" onPress={() => void download()} /> : phase === 'error' || phase === 'current' ? <Button label="重新检查" variant="lime" onPress={() => void check(true)} /> : null}
        <Pressable accessibilityRole="button" onPress={() => setVisible(false)} style={styles.later}><Text style={styles.laterText}>{phase === 'downloading' ? '后台下载' : '稍后再说'}</Text></Pressable>
      </View></View>
    </Modal>
  </Context.Provider>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, padding: 24, borderRadius: 24, backgroundColor: colors.paper },
  kicker: { fontSize: 11, color: colors.green, fontWeight: '800' }, title: { fontSize: 24, color: colors.ink, fontWeight: '900', marginTop: 10 },
  body: { color: colors.inkMuted, fontSize: 13, lineHeight: 22, marginVertical: 15 }, progress: { marginBottom: 12 },
  later: { alignItems: 'center', padding: 14 }, laterText: { color: colors.inkMuted, fontSize: 13 },
});
