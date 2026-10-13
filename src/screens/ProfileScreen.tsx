import { PersonalProfileForm } from '../components/PersonalProfileForm';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import appConfig from '../../app.json';
import { Page } from '../components/ui';
import { AppGlyph, type GlyphName } from '../components/AppGlyph';
import { RETIRED_PLAN_ID } from '../domain/training/trainingPlans';
import { trainingGoals } from '../data/trainingGoals';
import { TrainingGoalPicker } from '../components/TrainingGoalPicker';
import { groupHistoryByDay, validHistorySessions } from '../domain/training/trainingHistory';
import { useAppStore } from '../store/AppStore';
import { appPalette as palette } from '../theme';
import { confirmAction, showMessage } from '../utils/confirm';
import { useAppUpdates, useUpdateBlock } from '../components/AppUpdates';
import type { Goal } from '../types';
import { TrainingRecords } from '../features/history/TrainingRecords';
import type { RecordsProps } from '../features/history/useTrainingRecords';

export function ProfileScreen({ onOpenExercise, savedSessionId }: Partial<RecordsProps> = {}) {
  const { width, height } = useWindowDimensions();
  const compact = width < 360 || height < 740;
  const { profile, sessions, switchTrainingGoal, clearData } = useAppStore(state => ({ profile: state.profile, sessions: state.sessions, switchTrainingGoal: state.switchTrainingGoal, clearData: state.clearData }));
  const appUpdates = useAppUpdates();
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  useUpdateBlock(showGoalPicker || showProfileEdit || savingGoal);
  const now = useMemo(() => new Date(), [sessions]);
  const valid = useMemo(() => validHistorySessions(sessions, now), [sessions, now]);
  const days = useMemo(() => groupHistoryByDay(valid, now).length, [valid, now]);
  if (!profile) return <Page tone="dark" testID="profile-content" style={styles.content}><Text style={styles.title}>我的</Text><MenuRow icon="edit" title="建立个人档案" onPress={() => setShowProfileEdit(true)} />{showProfileEdit ? <PersonalProfileForm onClose={() => setShowProfileEdit(false)} /> : null}</Page>;
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

  return <Page tone="dark" testID="profile-content" style={[styles.content, compact && styles.compactContent]}>
    <View style={styles.header}><Text testID="profile-title" style={styles.title}>我的</Text><Text style={styles.brand}>Uncover</Text></View>
    <LinearGradient testID="profile-identity-panel" colors={['#1B2528', '#171F23']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.profileCard, compact && styles.compactCard]}>
      <View style={styles.localBadge}><AppGlyph name="shield" size={15} color={palette.muted} /><Text style={styles.caption}>本机保存</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="编辑个人档案" onPress={() => setShowProfileEdit(true)} style={({ pressed }) => [styles.identity, pressed && styles.pressed]}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{profile.name.trim().slice(0, 1) || 'U'}</Text></View><View style={styles.flex}><Text style={styles.name} numberOfLines={2}>{profile.name}</Text><Text style={styles.profileSub}>个人档案</Text></View><View style={styles.editControl}><AppGlyph name="edit" size={22} color={palette.text} /><Text style={styles.editText}>编辑</Text></View>
      </Pressable>
      <View style={[styles.bodyStats, compact && styles.compactBodyStats]}><BodyStat label="年龄" value={String(profile.age)} unit="岁" /><BodyStat label="身高" value={String(profile.height)} unit="cm" /><BodyStat label="体重" value={String(profile.weight)} unit="kg" last /></View>
      <View style={[styles.overview, compact && styles.compactOverview]}><View style={styles.trainingStat}><Text testID="profile-training-count" style={styles.statValue}>{valid.length}<Text style={styles.statUnit}> 次</Text></Text><Text style={styles.caption}>累计训练</Text></View><View style={styles.statDivider} /><View style={styles.trainingStat}><Text testID="profile-training-days" style={styles.statValue}>{days}<Text style={styles.statUnit}> 天</Text></Text><Text style={styles.caption}>训练天数</Text></View></View>
    </LinearGradient>

    <ProfileSection title="训练" compact={compact}><MenuRow icon="dumbbell" title="训练专题" trailing={currentGoalInfo.label} accent compact={compact} onPress={() => setShowGoalPicker(true)} last /></ProfileSection>
    {onOpenExercise ? <TrainingRecords onOpenExercise={onOpenExercise} savedSessionId={savedSessionId} /> : null}
    <ProfileSection title="应用与隐私" compact={compact}>
      <MenuRow icon="refresh" title="检查更新" trailing={`v${appConfig.expo.version}`} hint={appUpdates.status} compact={compact} onPress={appUpdates.open} />
      <MenuRow icon="trash" title="清除本机数据" sub="删除档案与全部记录" danger compact={compact} onPress={confirmClear} last />
    </ProfileSection>
    <View testID="profile-footer" style={[styles.footer, compact && styles.compactFooter]}><Text style={styles.version}>Uncover · v{appConfig.expo.version}</Text><Text style={styles.privacy}>记录保存在本机 · 联网处理须先确认</Text></View>

    <TrainingGoalPicker testID="profile-goal-sheet" visible={showGoalPicker} goal={profile.goal} saving={savingGoal} error={goalError} onClose={() => setShowGoalPicker(false)} onSelect={selectGoal} />
    {showProfileEdit ? <PersonalProfileForm onClose={() => setShowProfileEdit(false)} /> : null}
  </Page>;
}

function ProfileSection({ title, children, compact }: { title: string; children: React.ReactNode; compact?: boolean }) {
  return <View style={[styles.section, compact && styles.compactSection]}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.list}>{children}</View></View>;
}
function BodyStat({ label, value, unit, last }: { label: string; value: string; unit: string; last?: boolean }) {
  return <View style={[styles.bodyStat, last && styles.lastBodyStat]}><Text style={styles.bodyValue}>{value}<Text style={styles.bodyUnit}> {unit}</Text></Text><Text style={styles.caption}>{label}</Text></View>;
}
function MenuRow({ icon, title, sub, trailing, hint, accessibilityLabel, accent, danger, compact, last, onPress }: { icon: GlyphName; title: string; sub?: string; trailing?: string; hint?: string; accessibilityLabel?: string; accent?: boolean; danger?: boolean; compact?: boolean; last?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || title} accessibilityHint={hint} onPress={onPress} style={({ pressed }) => [styles.menuRow, compact && styles.compactMenuRow, last && styles.lastRow, pressed && styles.pressed]}><View style={[styles.menuIcon, accent && styles.accentIcon]}><AppGlyph name={icon} size={24} color={danger ? '#F18A82' : accent ? palette.lime : palette.text} /></View><View style={styles.flex}><Text style={[styles.menuTitle, danger && styles.dangerText]}>{title}</Text>{sub ? <Text style={styles.menuSub}>{sub}</Text> : null}</View>{trailing ? <Text numberOfLines={1} style={styles.menuTrailing}>{trailing}</Text> : null}<AppGlyph name="chevron" size={17} color={palette.muted} /></Pressable>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 88 },
  compactContent: { paddingTop: 12 },
  compactCard: { padding: 12 },
  compactBodyStats: { marginTop: 16, marginBottom: 12 },
  compactOverview: { paddingTop: 12 },
  compactFooter: { marginTop: 12, paddingHorizontal: 26 },
  compactSection: { marginTop: 12 },
  compactMenuRow: { minHeight: 54, paddingVertical: 8 },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: 18 },
  title: { color: palette.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  brand: { color: '#929A9F', fontSize: 18, fontWeight: '700' },
  localBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5, marginBottom: 8 },
  caption: { color: '#A8AFB5', fontSize: 12, lineHeight: 18 },
  pressed: { opacity: .72 },
  profileCard: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#303B3F', overflow: 'hidden' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 64, height: 64, borderRadius: 16, backgroundColor: palette.lime, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.onLime, fontSize: 36, fontWeight: '900' },
  name: { color: palette.text, fontSize: 23, fontWeight: '800', lineHeight: 30 },
  profileSub: { color: '#A8AFB5', fontSize: 14, marginTop: 4 },
  editControl: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  editText: { color: '#C4CBCD', fontSize: 14 },
  bodyStats: { flexDirection: 'row', marginTop: 24, marginBottom: 20 },
  bodyStat: { flex: 1, minWidth: 0, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#303B3F' },
  lastBodyStat: { borderRightWidth: 0 },
  bodyValue: { color: palette.text, fontSize: 23, fontWeight: '700', marginBottom: 5, fontVariant: ['tabular-nums'] },
  bodyUnit: { color: palette.text, fontSize: 17, fontWeight: '600' },
  overview: { flexDirection: 'row', paddingTop: 18, borderTopWidth: 1, borderTopColor: '#303B3F' },
  trainingStat: { flex: 1, alignItems: 'center' },
  statValue: { color: palette.text, fontSize: 21, fontWeight: '700', marginBottom: 3, fontVariant: ['tabular-nums'] },
  statUnit: { color: palette.text, fontSize: 14, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: '#303B3F' },
  section: { marginTop: 18 },
  sectionTitle: { color: '#A8AFB5', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  list: { backgroundColor: '#182124', borderWidth: 1, borderColor: '#303B3F', borderRadius: 12, paddingHorizontal: 14 },
  menuRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#303B3F', paddingVertical: 10 },
  lastRow: { borderBottomWidth: 0 },
  menuIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  accentIcon: { borderRadius: 10, backgroundColor: palette.olive },
  menuTitle: { color: palette.text, fontSize: 16, fontWeight: '700', lineHeight: 23 },
  dangerText: { color: '#F18A82' },
  menuSub: { color: '#A8AFB5', fontSize: 12, lineHeight: 18, marginTop: 3 },
  menuTrailing: { color: '#A8AFB5', fontSize: 13, maxWidth: '38%' },
  footer: { marginTop: 22, paddingHorizontal: 42 },
  version: { textAlign: 'center', color: '#929A9F', fontSize: 11 },
  privacy: { textAlign: 'center', color: '#929A9F', fontSize: 10, lineHeight: 16, marginTop: 4 },
});
