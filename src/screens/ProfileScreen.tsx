import { PersonalProfileForm } from '../components/PersonalProfileForm';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import appConfig from '../../app.json';
import { Card, Page } from '../components/ui';
import { AppGlyph, type GlyphName } from '../components/AppGlyph';
import { RETIRED_PLAN_ID } from '../domain/training/trainingPlans';
import { trainingGoals } from '../data/trainingGoals';
import { TrainingGoalPicker } from '../components/TrainingGoalPicker';
import { groupHistoryByDay, validHistorySessions } from '../domain/training/trainingHistory';
import { useAppStore } from '../store/AppStore';
import { appPalette as palette, progressPageLayout } from '../theme';
import { confirmAction, showMessage } from '../utils/confirm';
import { useAppUpdates, useUpdateBlock } from '../components/AppUpdates';
import type { Goal } from '../types';
import { useOpenDeepseekChat } from '../integrations/DeepseekChatHost';

export function ProfileScreen() {
  const { profile, sessions, switchTrainingGoal, clearData } = useAppStore(state => ({ profile: state.profile, sessions: state.sessions, switchTrainingGoal: state.switchTrainingGoal, clearData: state.clearData }));
  const appUpdates = useAppUpdates();
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const openChat = useOpenDeepseekChat();
  useUpdateBlock(showGoalPicker || showProfileEdit || savingGoal);
  const now = useMemo(() => new Date(), [sessions]);
  const valid = useMemo(() => validHistorySessions(sessions, now), [sessions, now]);
  const days = useMemo(() => groupHistoryByDay(valid, now).length, [valid, now]);
  if (!profile) return <Page tone="dark" testID="profile-content" style={styles.content}><Text style={styles.title}>我的</Text><MenuRow icon="edit" title="建立个人档案" onPress={() => setShowProfileEdit(true)} /><ProfileSection title="服务"><MenuRow icon="chat" title="DeepSeek 聊天" onPress={openChat} last /></ProfileSection>{showProfileEdit ? <PersonalProfileForm onClose={() => setShowProfileEdit(false)} /> : null}</Page>;
  const currentGoalInfo = trainingGoals.find((item) => item.key === profile.goal) || trainingGoals[0];

  const selectGoal = async (goal: Goal) => {
    if (savingGoal) return;
    if (goal === profile.goal && profile.planId !== RETIRED_PLAN_ID) { setShowGoalPicker(false); return; }
    setSavingGoal(true);
    setGoalError('');
    try {
      await switchTrainingGoal(goal);
      setShowGoalPicker(false);
    } catch {
      setGoalError('切换失败，请重试。');
    } finally {
      setSavingGoal(false);
    }
  };
  const confirmClear = () => confirmAction(
    '清除全部数据？',
    '训练记录、饮食记录、保存的饮食照片、个人档案及本机 API 密钥都会移除。此操作无法撤销。',
    () => void clearData().catch(() => showMessage('清除失败', '数据未确认移除，请重试。')),
    { confirmLabel: '确认清除', destructive: true },
  );

  return <Page tone="dark" testID="profile-content" style={styles.content}>
    <View style={styles.header}><Text testID="profile-title" style={styles.title}>我的</Text><View style={styles.localBadge}><AppGlyph name="shield" size={15} color={palette.lime} /><Text style={styles.caption}>本机保存</Text></View></View>
    <Pressable accessibilityRole="button" accessibilityLabel="编辑个人档案" onPress={() => setShowProfileEdit(true)} style={styles.profileCard}>
      <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{profile.name.trim().slice(0, 1) || 'U'}</Text></View><View style={styles.flex}><Text style={styles.name} numberOfLines={2}>{profile.name}</Text><Text style={styles.profileSub}>Uncover · {currentGoalInfo.label}</Text></View><View style={styles.editIcon}><AppGlyph name="edit" size={18} color={palette.lime} /></View></View>
      <View style={styles.bodyStats}><BodyStat label="年龄" value={String(profile.age)} unit="岁" /><BodyStat label="身高" value={String(profile.height)} unit="cm" /><BodyStat label="体重" value={String(profile.weight)} unit="kg" /></View>
    </Pressable>
    <View style={styles.overview}><View style={styles.trainingStat}><Text testID="profile-training-count" style={styles.statValue}>{valid.length}<Text style={styles.statUnit}> 次</Text></Text><Text style={styles.caption}>累计练次</Text></View><View style={styles.statDivider} /><View style={styles.trainingStat}><Text testID="profile-training-days" style={styles.statValue}>{days}<Text style={styles.statUnit}> 天</Text></Text><Text style={styles.caption}>训练天数</Text></View></View>

    <ProfileSection title="训练"><MenuRow icon="dumbbell" title="训练专题" sub={currentGoalInfo.label} onPress={() => setShowGoalPicker(true)} last /></ProfileSection>
    <ProfileSection title="应用"><MenuRow icon="refresh" title="检查更新" sub={appUpdates.status} onPress={appUpdates.open} last /></ProfileSection>
    <ProfileSection title="数据与隐私"><MenuRow icon="trash" title="清除本机数据" sub="清除个人档案及全部记录" danger onPress={confirmClear} last /></ProfileSection>
    <ProfileSection title="服务"><MenuRow icon="chat" title="DeepSeek 聊天" onPress={openChat} last /></ProfileSection>
    <Text style={styles.version}>Uncover · v{appConfig.expo.version}</Text><Text style={styles.privacy}>记录保存在本机 · 联网处理须先确认</Text>

    <TrainingGoalPicker testID="profile-goal-sheet" visible={showGoalPicker} goal={profile.goal} saving={savingGoal} error={goalError} onClose={() => setShowGoalPicker(false)} onSelect={selectGoal} />
    {showProfileEdit ? <PersonalProfileForm onClose={() => setShowProfileEdit(false)} /> : null}
  </Page>;
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Card style={styles.list}>{children}</Card></View>;
}
function BodyStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return <View style={styles.bodyStat}><Text style={styles.bodyValue}>{value}<Text style={styles.bodyUnit}> {unit}</Text></Text><Text style={styles.caption}>{label}</Text></View>;
}
function MenuRow({ icon, title, sub, danger, last, onPress }: { icon: GlyphName; title: string; sub?: string; danger?: boolean; last?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.menuRow, last && styles.lastRow, pressed && { opacity: .72 }]}><View style={[styles.menuIcon, danger && styles.dangerIcon]}><AppGlyph name={icon} size={20} color={danger ? palette.danger : palette.lime} /></View><View style={styles.flex}><Text style={[styles.menuTitle, danger && { color: palette.danger }]}>{title}</Text>{sub ? <Text style={styles.menuSub}>{sub}</Text> : null}</View><AppGlyph name="chevron" size={16} /></Pressable>;
}

const styles = StyleSheet.create({
  content: { ...progressPageLayout.content },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, marginBottom: 14 },
  title: { ...progressPageLayout.title, color: palette.text },
  localBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  caption: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  profileCard: { backgroundColor: palette.card, padding: 16, borderRadius: progressPageLayout.cardRadius, borderWidth: 1, borderColor: palette.border },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: palette.lime, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.onLime, fontSize: 24, fontWeight: '900' },
  name: { color: palette.text, fontSize: 18, fontWeight: '900', lineHeight: 25 },
  profileSub: { color: palette.muted, fontSize: 11, marginTop: 4 },
  editIcon: { width: 32, height: 32, borderRadius: 12, backgroundColor: palette.olive, alignItems: 'center', justifyContent: 'center' },
  bodyStats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: palette.border, marginTop: 16, paddingTop: 14 },
  bodyStat: { flex: 1, minWidth: 0 },
  bodyValue: { color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  bodyUnit: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  overview: { flexDirection: 'row', marginTop: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  trainingStat: { flex: 1, alignItems: 'center' },
  statValue: { color: palette.lime, fontSize: 24, fontWeight: '900', marginBottom: 3, fontVariant: ['tabular-nums'] },
  statUnit: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: palette.border },
  section: { marginTop: 20 },
  sectionTitle: { ...progressPageLayout.sectionTitle, color: palette.text, marginBottom: 10 },
  list: { paddingHorizontal: 14, paddingVertical: 2 },
  menuRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border, paddingVertical: 12 },
  lastRow: { borderBottomWidth: 0 },
  menuIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: palette.olive, alignItems: 'center', justifyContent: 'center' },
  dangerIcon: { backgroundColor: '#332421' },
  menuTitle: { color: palette.text, fontSize: 14, fontWeight: '800', lineHeight: 20 },
  menuSub: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  version: { textAlign: 'center', color: palette.muted, fontSize: 11, marginTop: 24 },
  privacy: { textAlign: 'center', color: palette.faint, fontSize: 10, lineHeight: 18, marginTop: 6 },
});
