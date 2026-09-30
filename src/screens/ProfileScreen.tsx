import React, { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import appConfig from '../../app.json';
import { Button, Card, Page } from '../components/ui';
import { AppGlyph, type GlyphName } from '../components/AppGlyph';
import { YearSchedule } from '../components/YearSchedule';
import { objectiveLabels, patternLabels } from '../nutrition/labels';
import { getPlanDay, recommendPlanId, RETIRED_PLAN_ID } from '../data/trainingPlans';
import { trainingGoals } from '../data/trainingGoals';
import { groupHistoryByDay, validHistorySessions } from '../data/trainingHistory';
import { useAppStore } from '../store/AppStore';
import { appPalette as palette, progressPageLayout } from '../theme';
import { confirmAction, showMessage } from '../utils/confirm';
import { useAppUpdates } from '../components/AppUpdates';
import type { Goal, Profile } from '../types';

export function ProfileScreen({ onNutrition, onOpenExercise }: { onNutrition: () => void; onOpenExercise: (exerciseId: string) => void }) {
  const { profile, sessions, settings, updateSettings, saveProfile, exportData, clearData, nutritionJournal } = useAppStore();
  const appUpdates = useAppUpdates();
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const settingsPending = useRef(false);
  const now = useMemo(() => new Date(), [sessions]);
  const valid = useMemo(() => validHistorySessions(sessions, now), [sessions, now]);
  const days = useMemo(() => groupHistoryByDay(valid, now).length, [valid, now]);
  if (!profile) return null;
  const plan = getPlanDay(profile).plan;
  const currentGoalInfo = trainingGoals.find((item) => item.key === profile.goal) || trainingGoals[0];

  const selectGoal = async (goal: Goal) => {
    if (savingGoal) return;
    if (goal === profile.goal && profile.planId !== RETIRED_PLAN_ID) { setShowGoalPicker(false); return; }
    setSavingGoal(true);
    setGoalError('');
    try {
      await saveProfile({
        ...profile,
        goal,
        frequency: goal === 'street_mastery' && ![2, 3, 6].includes(profile.frequency) ? 3 : profile.frequency,
        planId: recommendPlanId({ goal }),
        nutritionGoal: goal === 'street_mastery' ? 'performance' : 'rapid_loss',
        dietPattern: goal === 'street_mastery' ? 'balanced_cn' : profile.dietPattern,
        trainingRestSeconds: goal === 'street_mastery' ? 180 : profile.trainingRestSeconds,
        planStartedAt: new Date().toISOString(),
      });
      setShowGoalPicker(false);
    } catch {
      setGoalError('切换失败，请重试。');
    } finally {
      setSavingGoal(false);
    }
  };
  const setVibration = async (value: boolean) => {
    if (settingsPending.current) return;
    settingsPending.current = true; setSettingsSaving(true); setSettingsError('');
    try { await updateSettings({ vibration: value }); }
    catch { setSettingsError('偏好未能保存，请重试。'); }
    finally { settingsPending.current = false; setSettingsSaving(false); }
  };
  const shareBackup = () => void Share.share({ title: 'Uncover 数据备份', message: exportData() })
    .catch(() => showMessage('备份未导出', '请稍后重试系统分享。'));
  const confirmClear = () => confirmAction(
    '清除全部数据？',
    '训练记录、饮食记录、保存的饮食照片和个人档案都会从本机移除。JSON备份不包含照片文件，清除后不能用JSON恢复照片。此操作无法撤销。',
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

    <ProfileSection title="训练与营养"><MenuRow icon="dumbbell" title="训练专题" sub={currentGoalInfo.label} onPress={() => setShowGoalPicker(true)} /><MenuRow icon="calendar" title="训练日历" sub={plan.shortName + ' · 每周 ' + profile.frequency + ' 练'} onPress={() => setShowSchedule(true)} /><MenuRow icon="utensils" title="饮食与营养" sub={nutritionJournal.preferences ? `${objectiveLabels[nutritionJournal.preferences.objective]} · ${patternLabels[nutritionJournal.preferences.pattern]}` : '营养档案 · 菜谱与记餐'} onPress={onNutrition} last /></ProfileSection>
    <ProfileSection title="使用偏好"><ToggleRow value={settings.vibration} disabled={settingsSaving} onValueChange={(value) => void setVibration(value)} /><MenuRow icon="refresh" title="检查更新" sub={appUpdates.status} onPress={appUpdates.open} last />{settingsError ? <Text accessibilityRole="alert" style={styles.modalError}>{settingsError}</Text> : null}</ProfileSection>
    <ProfileSection title="数据与隐私"><MenuRow icon="download" title="导出数据备份" sub="分享 JSON，不含照片文件" onPress={shareBackup} /><MenuRow icon="trash" title="清除本机数据" sub="清除前请先备份" danger onPress={confirmClear} last /></ProfileSection>
    <Text style={styles.version}>Uncover · v{appConfig.expo.version}</Text><Text style={styles.privacy}>记录保存在本机 · 联网处理须先确认</Text>

    <Modal transparent visible={showGoalPicker} animationType="fade" onRequestClose={() => { if (!savingGoal) setShowGoalPicker(false); }}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!savingGoal) setShowGoalPicker(false); }} />
        <View testID="profile-goal-sheet" style={styles.modalCard}>
          <View style={styles.modalHead}><Text style={styles.modalTitle}>选择训练专题</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭训练专题选择" disabled={savingGoal} onPress={() => setShowGoalPicker(false)} style={styles.closeIcon}><AppGlyph name="plus" color={palette.muted} /></Pressable></View>
          <Text style={styles.modalInfo}>从今天重新安排日程，保留历史记录与动作进阶。</Text>
          {trainingGoals.map((item) => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={'选择' + item.label} accessibilityState={{ selected: profile.goal === item.key, disabled: savingGoal }} disabled={savingGoal} onPress={() => void selectGoal(item.key)} style={[styles.goalChoice, profile.goal === item.key && styles.goalChoiceActive]}><View style={styles.choiceHeading}><Text style={styles.goalChoiceTitle}>{item.label}</Text>{profile.goal === item.key ? <AppGlyph name="check" size={18} color={palette.lime} /> : null}</View><Text style={styles.goalChoiceDesc}>{item.description}</Text></Pressable>)}
          {goalError ? <Text accessibilityRole="alert" style={styles.modalError}>{goalError}</Text> : null}
        </View>
      </View>
    </Modal>
    {showSchedule ? <YearSchedule profile={profile} sessions={sessions} anchor={new Date()} onSelect={() => {}} onOpenExercise={onOpenExercise} onClose={() => setShowSchedule(false)} /> : null}
    {showProfileEdit ? <EditProfileModal profile={profile} onClose={() => setShowProfileEdit(false)} /> : null}
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
function ToggleRow({ value, disabled, onValueChange }: { value: boolean; disabled: boolean; onValueChange: (value: boolean) => void }) {
  return <View style={styles.menuRow}><View style={styles.menuIcon}><AppGlyph name="vibrate" size={20} color={palette.lime} /></View><View style={styles.flex}><Text style={styles.menuTitle}>震动反馈</Text><Text style={styles.menuSub}>{disabled ? '正在保存…' : '训练操作的触感反馈'}</Text></View><Pressable accessibilityRole="switch" accessibilityLabel="震动反馈" accessibilityState={{ checked: value, disabled }} aria-checked={value} aria-disabled={disabled} disabled={disabled} onPress={() => onValueChange(!value)} style={styles.toggleHit}><View style={[styles.toggleTrack, value && styles.toggleTrackOn]}><View style={[styles.toggleThumb, value && styles.toggleThumbOn]} /></View></Pressable></View>;
}

function EditProfileModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { saveProfile } = useAppStore();
  const [name, setName] = useState(profile.name);
  const [sex, setSex] = useState(profile.sex);
  const [age, setAge] = useState(String(profile.age));
  const [height, setHeight] = useState(String(profile.height));
  const [weight, setWeight] = useState(String(profile.weight));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const valid = Boolean(name.trim()) && ['male', 'female'].includes(sex) && [Number(age), Number(height), Number(weight)].every(Number.isFinite) && Number(age) > 12 && Number(height) > 100 && Number(weight) > 30;
  const save = () => {
    if (saving) return;
    if (!valid) { setError('请核对各字段：姓名必填，请选择性别；年龄大于 12，身高大于 100 cm，体重大于 30 kg。'); return; }
    const nextWeight = Math.round(Number(weight) * 10) / 10;
    const apply = () => {
      setSaving(true);
      void saveProfile({ ...profile, name: name.trim(), sex, age: Number(age), height: Number(height), weight: nextWeight })
        .then(onClose)
        .catch(() => setError('保存失败，请重试。'))
        .finally(() => setSaving(false));
    };
    if (Math.abs(nextWeight - profile.weight) > profile.weight * 0.1) {
      confirmAction('体重变化较大', `新体重 ${nextWeight} kg 与当前 ${profile.weight} kg 相差超过 10%，营养与训练量建议会随之重新计算。确认保存吗？`, apply, { confirmLabel: '确认保存' });
      return;
    }
    apply();
  };
  const clearError = (setter: (value: string) => void) => (value: string) => { setter(value); setError(''); };
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!saving) onClose(); }}>
    <View style={styles.modalBackdrop}><View testID="profile-edit-sheet" style={styles.editSheet}>
      <View style={[styles.modalHead, styles.editModalHead]}><Text style={styles.modalTitle}>编辑档案</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭档案编辑" disabled={saving} onPress={onClose} style={styles.closeIcon}><AppGlyph name="plus" /></Pressable></View>
      <ScrollView contentContainerStyle={styles.editContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.modalInfo}>用于训练与营养估算，不修改已有训练记录。</Text>
        <Text style={styles.editLabel}>怎么称呼你</Text><TextInput accessibilityLabel="姓名" value={name} onChangeText={clearError(setName)} editable={!saving} style={styles.editInput} placeholderTextColor={palette.faint} />
        <View style={styles.editRow}><View style={styles.flex}><Text style={styles.editLabel}>年龄</Text><TextInput accessibilityLabel="年龄" value={age} onChangeText={clearError(setAge)} editable={!saving} keyboardType="number-pad" style={styles.editInput} /></View><View style={styles.flex}><Text style={styles.editLabel}>身高 cm</Text><TextInput accessibilityLabel="身高cm" value={height} onChangeText={clearError(setHeight)} editable={!saving} keyboardType="number-pad" style={styles.editInput} /></View></View>
        <Text style={styles.editLabel}>体重 kg</Text><TextInput accessibilityLabel="体重kg" value={weight} onChangeText={clearError(setWeight)} editable={!saving} keyboardType="decimal-pad" style={styles.editInput} />
        <Text style={styles.editLabel}>生理性别（影响代谢估算）</Text><View style={styles.editSexRow}>{(['male', 'female'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: sex === value }} disabled={saving} onPress={() => setSex(value)} style={[styles.sexPill, sex === value && styles.sexPillActive]}><Text style={[styles.sexPillText, sex === value && styles.sexPillTextActive]}>{value === 'male' ? '男性' : '女性'}</Text></Pressable>)}</View>
        {error ? <Text accessibilityRole="alert" style={styles.modalError}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.editFooter}><Button label={saving ? '保存中…' : '保存修改'} variant="lime" disabled={saving} onPress={save} /></View>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  content: { ...progressPageLayout.content }, flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, marginBottom: 14 }, title: { ...progressPageLayout.title, color: palette.text }, localBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 }, caption: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  profileCard: { backgroundColor: palette.card, padding: 16, borderRadius: progressPageLayout.cardRadius, borderWidth: 1, borderColor: palette.border }, identity: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 48, height: 48, borderRadius: 16, backgroundColor: palette.lime, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: palette.onLime, fontSize: 24, fontWeight: '900' }, name: { color: palette.text, fontSize: 18, fontWeight: '900', lineHeight: 25 }, profileSub: { color: palette.muted, fontSize: 11, marginTop: 4 }, editIcon: { width: 32, height: 32, borderRadius: 12, backgroundColor: palette.olive, alignItems: 'center', justifyContent: 'center' },
  bodyStats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: palette.border, marginTop: 16, paddingTop: 14 }, bodyStat: { flex: 1, minWidth: 0 }, bodyValue: { color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 4 }, bodyUnit: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  overview: { flexDirection: 'row', marginTop: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card }, trainingStat: { flex: 1, alignItems: 'center' }, statValue: { color: palette.lime, fontSize: 24, fontWeight: '900', marginBottom: 3, fontVariant: ['tabular-nums'] }, statUnit: { color: palette.muted, fontSize: 11, fontWeight: '600' }, statDivider: { width: 1, backgroundColor: palette.border },
  section: { marginTop: 20 }, sectionTitle: { ...progressPageLayout.sectionTitle, color: palette.text, marginBottom: 10 }, list: { paddingHorizontal: 14, paddingVertical: 2 }, menuRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border, paddingVertical: 12 }, lastRow: { borderBottomWidth: 0 }, menuIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: palette.olive, alignItems: 'center', justifyContent: 'center' }, dangerIcon: { backgroundColor: '#332421' }, menuTitle: { color: palette.text, fontSize: 14, fontWeight: '800', lineHeight: 20 }, menuSub: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  version: { textAlign: 'center', color: palette.muted, fontSize: 11, marginTop: 24 }, privacy: { textAlign: 'center', color: palette.faint, fontSize: 10, lineHeight: 18, marginTop: 6 },
  toggleHit: { width: 52, minHeight: 44, justifyContent: 'center' }, toggleTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: palette.border, padding: 3 }, toggleTrackOn: { backgroundColor: palette.lime }, toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: palette.muted }, toggleThumbOn: { alignSelf: 'flex-end', backgroundColor: palette.onLime },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'center', alignItems: 'center', padding: 16 }, modalCard: { width: '100%', maxWidth: progressPageLayout.content.maxWidth, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, borderRadius: progressPageLayout.cardRadius, padding: 16 }, modalHead: { flexDirection: 'row', alignItems: 'center', gap: 10 }, modalTitle: { ...progressPageLayout.title, color: palette.text, flex: 1 }, modalInfo: { color: palette.muted, fontSize: 12, lineHeight: 19, marginTop: 6, marginBottom: 10 }, closeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.raised, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }] },
  goalChoice: { padding: 14, marginTop: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.raised }, goalChoiceActive: { borderColor: palette.oliveBorder, backgroundColor: palette.olive }, choiceHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, goalChoiceTitle: { color: palette.text, fontSize: 14, fontWeight: '800' }, goalChoiceDesc: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }, modalError: { color: palette.danger, fontSize: 12, lineHeight: 19, marginTop: 10 },
  editSheet: { maxHeight: '90%', width: '100%', maxWidth: progressPageLayout.content.maxWidth, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, borderRadius: progressPageLayout.cardRadius, overflow: 'hidden', paddingTop: 12 }, editModalHead: { paddingHorizontal: 16, paddingBottom: 8 }, editContent: { paddingHorizontal: 16, paddingBottom: 16 }, editLabel: { color: palette.muted, fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 12 }, editInput: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.raised, paddingHorizontal: 12, fontSize: 14, color: palette.text }, editRow: { flexDirection: 'row', gap: 10 }, editSexRow: { flexDirection: 'row', gap: 8 }, sexPill: { minHeight: 44, flex: 1, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.raised, alignItems: 'center', justifyContent: 'center' }, sexPillActive: { backgroundColor: palette.olive, borderColor: palette.oliveBorder }, sexPillText: { color: palette.muted, fontSize: 13, fontWeight: '800' }, sexPillTextActive: { color: palette.lime }, editFooter: { padding: 16, borderTopWidth: 1, borderTopColor: palette.border },
});
