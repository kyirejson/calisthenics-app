import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import appConfig from '../../app.json';
import { Button, Card, Header, Page, SectionTitle } from '../components/ui';
import { YearSchedule } from '../components/YearSchedule';
import { dietPatterns } from '../data/nutritionPlanner';
import { getPlanDay, recommendPlanId, RETIRED_PLAN_ID } from '../data/trainingPlans';
import { trainingGoals } from '../data/trainingGoals';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import { confirmAction } from '../utils/confirm';
import { useAppUpdates } from '../components/AppUpdates';
import type { Goal, Profile } from '../types';

export function ProfileScreen({ onNutrition, onOpenExercise }: { onNutrition: () => void; onOpenExercise: (exerciseId: string) => void }) {
  const { profile, sessions, settings, updateSettings, saveProfile, exportData, clearData } = useAppStore();
  const appUpdates = useAppUpdates();
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
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

  const shareBackup = () => void Share.share({ title: 'Uncover 数据备份', message: exportData() });
  const confirmClear = () => confirmAction(
    '清除全部数据？',
    '训练记录和个人档案都会从本机移除，此操作无法撤销。',
    () => void clearData(),
    { confirmLabel: '确认清除', destructive: true },
  );

  return <Page><Header eyebrow="仅存储在本机" title="我的" />
    <Pressable accessibilityRole="button" accessibilityLabel="编辑个人档案" onPress={() => setShowProfileEdit(true)} style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{profile.name.slice(0, 1)}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{profile.name}</Text><Text style={styles.profileSub}>{profile.age} 岁 · {profile.height} cm · {profile.weight} kg</Text></View><View style={styles.level}><Text style={styles.levelText}>{sessions.length} 训</Text></View><Text style={styles.editHint}>编辑 ›</Text></Pressable>
    <SectionTitle title="训练" />
    <Card style={styles.list}>
      <MenuRow icon={currentGoalInfo.icon || '◎'} title="训练专题" sub={currentGoalInfo.label} onPress={() => setShowGoalPicker(true)} />
      <MenuRow icon="▦" title="今日课程与计划" sub={plan.shortName} onPress={() => setShowSchedule(true)} />
    </Card>
    <SectionTitle title="营养" />
    <Card style={styles.list}><MenuRow icon="◈" title="今日能量" sub={plan.frequency === 0 ? '当前目标暂无计划' : `${profile.goal === 'weight_loss' ? '减肥控重专用' : '六艺训练供能'} · ${dietPatterns.find((item) => item.key === profile.dietPattern)?.label || ''}`} onPress={onNutrition} /></Card>
    <SectionTitle title="偏好" />
    <Card style={styles.list}><ToggleRow icon="⌁" title="震动反馈" value={settings.vibration} onValueChange={(v) => void updateSettings({ vibration: v })} /></Card>
    <SectionTitle title="数据与隐私" />
    <Card style={styles.list}><MenuRow icon="⇧" title="导出 JSON 备份" sub="通过系统分享保存" onPress={shareBackup} /><MenuRow icon="⌫" title="清除本机数据" danger onPress={confirmClear} /></Card>
    <SectionTitle title="应用更新" />
    <Card style={styles.list}><MenuRow icon="↥" title="检查更新" sub={appUpdates.status} onPress={appUpdates.open} /></Card>
    <Text style={styles.version}>Uncover · v{appConfig.expo.version}{`\n`}数据默认不上传云端</Text>
    <Modal transparent visible={showGoalPicker} animationType="fade" onRequestClose={() => setShowGoalPicker(false)}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowGoalPicker(false)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>选择训练专题</Text>
          <Text style={styles.modalInfo}>切换后从今天重新安排日程；历史记录和动作进阶不删除。</Text>
          {trainingGoals.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              disabled={savingGoal}
              onPress={() => void selectGoal(item.key)}
              style={[styles.goalChoice, profile.goal === item.key && styles.goalChoiceActive]}
            >
              <Text style={styles.goalChoiceTitle}>{item.icon}  {item.label}{profile.goal === item.key ? ' · 当前' : ''}</Text>
              <Text style={styles.goalChoiceDesc}>{item.description}</Text>
            </Pressable>
          ))}
          {goalError ? <Text style={styles.modalError}>{goalError}</Text> : null}
          <Pressable onPress={() => setShowGoalPicker(false)} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>取消</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    {showSchedule && profile ? <YearSchedule profile={profile} sessions={sessions} anchor={new Date()} onSelect={() => {}} onOpenExercise={onOpenExercise} onClose={() => setShowSchedule(false)} /> : null}
    {showProfileEdit && profile ? <EditProfileModal profile={profile} onClose={() => setShowProfileEdit(false)} /> : null}
  </Page>;
}

function MenuRow({ icon, title, sub, danger, onPress }: { icon: string; title: string; sub?: string; danger?: boolean; onPress?: () => void }) { return <Pressable onPress={onPress} style={styles.menuRow}><View style={[styles.menuIcon, danger && { backgroundColor: '#FCEAE7' }]}><Text style={[styles.menuIconText, danger && { color: colors.danger }]}>{icon}</Text></View><Text style={[styles.menuTitle, danger && { color: colors.danger }]}>{title}</Text><Text style={styles.menuSub}>{sub}</Text>{onPress ? <Text style={styles.chevron}>›</Text> : null}</Pressable>; }
function ToggleRow({ icon, title, value, onValueChange }: { icon: string; title: string; value: boolean; onValueChange: (value: boolean) => void }) {
  // 自绘开关：RN Switch 在 web 端 thumbColor 不生效会渲染成主题外颜色，这里完全自控配色。
  return <View style={styles.menuRow}><View style={styles.menuIcon}><Text style={styles.menuIconText}>{icon}</Text></View><Text style={styles.menuTitle}>{title}</Text><Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onValueChange(!value)} style={[styles.toggleTrack, value && styles.toggleTrackOn]}><View style={[styles.toggleThumb, value && styles.toggleThumbOn]} /></Pressable></View>;
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
  const valid = Boolean(name.trim()) && Number(age) > 12 && Number(height) > 100 && Number(weight) > 30;
  const save = () => {
    if (saving) return;
    if (!valid) { setError('请核对各字段：姓名必填，年龄大于 12，身高大于 100 cm，体重大于 30 kg。'); return; }
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
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <ScrollView style={styles.editScroll} contentContainerStyle={styles.modalCard} showsVerticalScrollIndicator={false}>
        <Text style={styles.modalTitle}>编辑档案</Text>
        <Text style={styles.modalInfo}>身体数据用于计算训练量、营养建议与恢复安排；训练记录和动作进阶不受影响。</Text>
        <Text style={styles.editLabel}>怎么称呼你</Text>
        <TextInput value={name} onChangeText={clearError(setName)} style={styles.editInput} placeholderTextColor="#A1A39C" />
        <View style={styles.editRow}>
          <View style={{ flex: 1 }}><Text style={styles.editLabel}>年龄</Text><TextInput value={age} onChangeText={clearError(setAge)} keyboardType="number-pad" style={styles.editInput} /></View>
          <View style={{ flex: 1 }}><Text style={styles.editLabel}>身高 cm</Text><TextInput value={height} onChangeText={clearError(setHeight)} keyboardType="number-pad" style={styles.editInput} /></View>
        </View>
        <Text style={styles.editLabel}>体重 kg</Text>
        <TextInput value={weight} onChangeText={clearError(setWeight)} keyboardType="decimal-pad" style={styles.editInput} />
        <Text style={styles.editLabel}>生理性别（影响代谢估算）</Text>
        <View style={styles.editSexRow}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: sex === 'male' }} onPress={() => setSex('male')} style={[styles.sexPill, sex === 'male' && styles.sexPillActive]}><Text style={[styles.sexPillText, sex === 'male' && styles.sexPillTextActive]}>男性</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: sex === 'female' }} onPress={() => setSex('female')} style={[styles.sexPill, sex === 'female' && styles.sexPillActive]}><Text style={[styles.sexPillText, sex === 'female' && styles.sexPillTextActive]}>女性</Text></Pressable>
        </View>
        {error ? <Text style={styles.modalError}>{error}</Text> : null}
        <Button label={saving ? '保存中…' : '保存修改'} variant="dark" disabled={saving} onPress={save} />
        <Pressable onPress={onClose} style={styles.modalClose}><Text style={styles.modalCloseText}>取消</Text></Pressable>
      </ScrollView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  profileCard: { backgroundColor: colors.ink, padding: 20, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 58, height: 58, borderRadius: 19, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginRight: 15 }, avatarText: { color: colors.ink, fontSize: 25, fontWeight: '900' }, name: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' }, profileSub: { color: '#AEB1A8', fontSize: 12, marginTop: 5 }, level: { backgroundColor: '#32352D', paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill }, levelText: { color: colors.lime, fontSize: 11, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: colors.paper, borderRadius: radius.lg, padding: 20 },
  modalTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  modalInfo: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 10 },
  goalChoice: { padding: 14, marginTop: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.card },
  goalChoiceActive: { borderColor: colors.limeDark, backgroundColor: '#F1F6E4' },
  goalChoiceTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  goalChoiceDesc: { color: colors.inkMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  modalError: { color: colors.danger, fontSize: 12, marginTop: 8 },
  modalClose: { alignItems: 'center', paddingVertical: 12, marginTop: 10 },
  modalCloseText: { color: colors.inkMuted, fontSize: 13, fontWeight: '800' },
  list: { paddingVertical: 2 }, menuRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, menuIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, menuIconText: { color: colors.ink, fontSize: 16, fontWeight: '900' }, menuTitle: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '700' }, menuSub: { color: colors.inkMuted, fontSize: 12 }, chevron: { color: colors.inkMuted, fontSize: 24, marginLeft: 8 }, version: { textAlign: 'center', color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 28 },
  toggleTrack: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#D9D8D2', padding: 2, justifyContent: 'center' },
  toggleTrackOn: { backgroundColor: colors.limeDark },
  toggleThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },
  editHint: { color: '#9BBE3E', fontSize: 12, fontWeight: '800', marginLeft: 10 },
  editScroll: { maxHeight: '84%', width: '100%', maxWidth: 420, backgroundColor: colors.paper, borderRadius: radius.lg, overflow: 'hidden' },
  editLabel: { color: colors.inkMuted, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 12 },
  editInput: { height: 48, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 14, fontSize: 16, color: colors.ink },
  editRow: { flexDirection: 'row', gap: 10 },
  editSexRow: { flexDirection: 'row', gap: 8 },
  sexPill: { minHeight: 40, paddingHorizontal: 20, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  sexPillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  sexPillText: { color: colors.inkMuted, fontSize: 13, fontWeight: '800' },
  sexPillTextActive: { color: '#FFFFFF' },
});
