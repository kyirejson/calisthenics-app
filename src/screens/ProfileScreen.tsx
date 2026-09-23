import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import appConfig from '../../app.json';
import { Card, Header, Page, SectionTitle } from '../components/ui';
import { dietPatterns, nutritionGoals } from '../data/nutritionPlanner';
import { getPlanDay } from '../data/trainingPlans';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import { confirmAction } from '../utils/confirm';
import { checkForUpdates, type AvailableUpdate } from '../services/updateChecker';

export function ProfileScreen({ onPlans, onNutrition }: { onPlans: () => void; onNutrition: () => void }) {
  const { profile, sessions, settings, updateSettings, exportData, clearData } = useAppStore();
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [updateState, setUpdateState] = useState<'checking' | 'current' | 'error'>('checking');
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let active = true;
    void checkForUpdates()
      .then((available) => {
        if (!active) return;
        setUpdate(available);
        setUpdateState('current');
      })
      .catch(() => { if (active) setUpdateState('error'); });
    return () => { active = false; };
  }, []);
  if (!profile) return null;
  const plan = getPlanDay(profile).plan;
  const nutritionGoal = nutritionGoals.find((item) => item.key === profile.nutritionGoal)?.label || profile.nutritionGoal;
  const dietPattern = dietPatterns.find((item) => item.key === profile.dietPattern)?.label || profile.dietPattern;
  const shareBackup = () => void Share.share({ title: 'Uncover 数据备份', message: exportData() });
  const confirmClear = () => confirmAction(
    '清除全部数据？',
    '训练记录和个人档案都会从本机移除，此操作无法撤销。',
    () => void clearData(),
    { confirmLabel: '确认清除', destructive: true },
  );
  const refreshUpdate = () => {
    setUpdateState('checking');
    void checkForUpdates(true)
      .then((available) => { setUpdate(available); setUpdateState('current'); })
      .catch(() => setUpdateState('error'));
  };
  const downloadUpdate = () => {
    if (!update) return;
    void Linking.openURL(update.apkUrl).catch(() => Alert.alert('下载未打开', '请稍后在 GitHub 发布页下载更新包。'));
  };

  return <Page><Header eyebrow="仅存储在本机" title="我的" />
    <View style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{profile.name.slice(0, 1)}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{profile.name}</Text><Text style={styles.profileSub}>{profile.age} 岁 · {profile.height} cm · {profile.weight} kg</Text></View><View style={styles.level}><Text style={styles.levelText}>{sessions.length} 训</Text></View></View>
    <SectionTitle title="训练" />
    <Card style={styles.list}><MenuRow icon="▦" title="训练计划" sub={`${plan.shortName} · ${plan.frequency} 练/周`} onPress={onPlans} /></Card>
    <SectionTitle title="营养" />
    <Card style={styles.list}><MenuRow icon="◈" title="今日能量" sub={nutritionGoal} onPress={onNutrition} /><MenuRow icon="◌" title="饮食模式" sub={dietPattern} onPress={onNutrition} /></Card>
    <SectionTitle title="偏好" />
    <Card style={styles.list}><ToggleRow icon="⌁" title="震动反馈" value={settings.vibration} onValueChange={(v) => void updateSettings({ vibration: v })} /><MenuRow icon="◷" title="默认组间休息" sub={`${settings.restSeconds} 秒`} onPress={() => void updateSettings({ restSeconds: settings.restSeconds === 60 ? 90 : settings.restSeconds === 90 ? 120 : 60 })} /></Card>
    <SectionTitle title="数据与隐私" />
    <Card style={styles.list}><MenuRow icon="⇧" title="导出 JSON 备份" sub="通过系统分享保存" onPress={shareBackup} /><MenuRow icon="⌫" title="清除本机数据" danger onPress={confirmClear} /></Card>
    {Platform.OS === 'android' ? <>
      <SectionTitle title="应用更新" />
      <Card style={styles.list}>
        <MenuRow
          icon="↥"
          title={update ? `可更新到 v${update.version}` : '检查安装包更新'}
          sub={updateState === 'checking' ? '正在检查…' : updateState === 'error' ? '检查失败，点击重试' : update ? '点击重新检查' : '已是最新版本'}
          onPress={refreshUpdate}
        />
        {update ? <Pressable onPress={downloadUpdate} style={styles.updateButton}>
          <Text style={styles.updateButtonText}>下载 {update.title || `Uncover v${update.version}`}</Text>
          <Text style={styles.updateArrow}>↗</Text>
        </Pressable> : null}
      </Card>
    </> : null}
    <Text style={styles.version}>Uncover · v{appConfig.expo.version}{`\n`}数据默认不上传云端</Text>
  </Page>;
}

function MenuRow({ icon, title, sub, danger, onPress }: { icon: string; title: string; sub?: string; danger?: boolean; onPress?: () => void }) { return <Pressable onPress={onPress} style={styles.menuRow}><View style={[styles.menuIcon, danger && { backgroundColor: '#FCEAE7' }]}><Text style={[styles.menuIconText, danger && { color: colors.danger }]}>{icon}</Text></View><Text style={[styles.menuTitle, danger && { color: colors.danger }]}>{title}</Text><Text style={styles.menuSub}>{sub}</Text>{onPress ? <Text style={styles.chevron}>›</Text> : null}</Pressable>; }
function ToggleRow({ icon, title, value, onValueChange }: { icon: string; title: string; value: boolean; onValueChange: (value: boolean) => void }) { return <View style={styles.menuRow}><View style={styles.menuIcon}><Text style={styles.menuIconText}>{icon}</Text></View><Text style={styles.menuTitle}>{title}</Text><Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#D9D8D2', true: colors.limeDark }} thumbColor="#FFFFFF" /></View>; }
const styles = StyleSheet.create({
  profileCard: { backgroundColor: colors.ink, padding: 20, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 58, height: 58, borderRadius: 19, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginRight: 15 }, avatarText: { color: colors.ink, fontSize: 25, fontWeight: '900' }, name: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' }, profileSub: { color: '#AEB1A8', fontSize: 12, marginTop: 5 }, level: { backgroundColor: '#32352D', paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill }, levelText: { color: colors.lime, fontSize: 11, fontWeight: '800' },
  list: { paddingVertical: 2 }, menuRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, menuIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, menuIconText: { color: colors.ink, fontSize: 16, fontWeight: '900' }, menuTitle: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '700' }, menuSub: { color: colors.inkMuted, fontSize: 12 }, chevron: { color: colors.inkMuted, fontSize: 24, marginLeft: 8 }, version: { textAlign: 'center', color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 28 },
  updateButton: { minHeight: 45, borderRadius: radius.md, backgroundColor: colors.lime, marginVertical: 10, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' },
  updateButtonText: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '900' },
  updateArrow: { color: colors.ink, fontSize: 18, fontWeight: '900' },
});
