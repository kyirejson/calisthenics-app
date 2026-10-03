import { useEffect, useMemo, useState } from 'react';
import { Animated, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { AppGlyph } from '../components/AppGlyph';
import { EquipmentPhoto } from '../components/EquipmentPhoto';
import { EquipmentTierBadge } from '../components/EquipmentTier';
import { EquipmentPlanEditor, type EquipmentPlanOptions } from './EquipmentPlanEditor';
import { Button, ProgressBar, UITheme } from '../components/ui';
import { useReducedMotion, useRouteReveal } from '../components/useProgressMotion';
import { equipmentFrequency, equipmentSplitConfig, equipmentTrainingDays, equipmentSessionPlan, type EquipmentSessionPlan } from '../data/equipmentTraining';
import { getEquipmentMovement } from '../data/equipment';
import { equipmentPlanReview } from '../data/equipmentPlanReview';
import { getDayTrainingState, localDateKey } from '../data/planProgress';
import { getWeekSchedule } from '../data/trainingPlans';
import { TrainingGoalPicker, TrainingGoalSelector } from '../components/TrainingGoalPicker';
import { useAppStore } from '../store/AppStore';
import { appPalette as p, progressPageLayout } from '../theme';
import type { Goal } from '../types';
import { overlayDate } from '../agent/trainingOverlay';

type Props = { onStart: (id: string, multiplier?: number, rir?: number, plan?: EquipmentSessionPlan) => void; onOpenExercise: (id: string) => void; onSelectGoal: (goal: Goal) => Promise<boolean>; goalError: string; savingGoal: boolean };
export function EquipmentTodayScreen({ onStart, onOpenExercise, onSelectGoal, goalError, savingGoal }: Props) {
  const { profile, sessions, patchProfile } = useAppStore();
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState(() => localDateKey(new Date()));
  const [modal, setModal] = useState<'goal' | 'plan' | null>(null);
  const reduced = useReducedMotion();
  const reveal = useRouteReveal(selected, reduced);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { setSelected(localDateKey(now)); }, [localDateKey(now)]);
  const review = useMemo(() => profile ? equipmentPlanReview(profile, now) : undefined, [profile, localDateKey(now)]);
  if (!profile) return null;
  const week = getWeekSchedule(profile, now);
  const day = week.find(entry => localDateKey(entry.date) === selected) || week.find(entry => localDateKey(entry.date) === localDateKey(now))!;
  const today = localDateKey(day.date) === localDateKey(now);
  const plan = day.workoutId ? equipmentSessionPlan(day.workoutId, profile, day.date) : undefined;
  const editedCourses = Object.keys(profile.agentTrainingOverlay?.courses || {});
  const agentEditedWeek = week.some(entry => profile.agentTrainingOverlay?.days[overlayDate(entry.date)] || editedCourses.some(key => key.startsWith(overlayDate(entry.date) + ':')));
  const unavailable = !!day.workoutId && (plan?.status === 'infeasible' || !agentEditedWeek && review?.status === 'infeasible');
  const notice = unavailable ? plan?.issues[0] || review?.issues[0] : agentEditedWeek ? `已应用助手调整，周审计${review?.status === 'infeasible' ? '存在差异：' + review.issues[0] : '通过'}；不是原模板剂量。` : plan?.notice;
  const items = plan?.items || [];
  const estimate = plan?.estimate;
  const setCount = items.reduce((sum, item) => sum + item.targetSets, 0);
  const states = new Map(week.map(entry => [localDateKey(entry.date), getDayTrainingState(entry, sessions, [], entry.workoutId ? equipmentSessionPlan(entry.workoutId, profile, entry.date) : undefined)]));
  const completed = [...states.values()].filter(state => state.complete).length;
  const state = states.get(localDateKey(day.date))!;
  const openSettings = () => setModal('plan');
  const savePlan = async (options: EquipmentPlanOptions) => {
    await patchProfile(current => {
      if (current.goal !== 'equipment') throw new Error('训练专题已变化，请重新打开器械计划。');
      return { ...options, sessionMinutes: undefined,
        planStartedAt: options.frequency !== current.frequency || options.equipmentSplit !== equipmentSplitConfig(current) || options.equipmentTrainingDays?.slice().sort().join() !== equipmentTrainingDays(current).join() ? new Date().toISOString() : current.planStartedAt };
    });
    setSelected(localDateKey(now)); setModal(null);
  };
  return <UITheme><View testID="equipment-today-screen" style={s.root}>
    <ScrollView testID="equipment-today-scroll" showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
      <View style={s.modeRow}><TrainingGoalSelector goal={profile.goal} disabled={savingGoal} onPress={() => setModal('goal')} /><Pressable accessibilityRole="button" accessibilityLabel="设置器械训练计划" onPress={openSettings} style={s.settings}><AppGlyph name="settings" color={p.muted} size={20} /></Pressable></View>
      <View style={s.summary}>
        <Text style={s.title}>{day.type === 'strength' ? day.title : '恢复日'}</Text>
        {items.length && estimate ? <><View style={s.stats}><Text style={s.stat}><Text style={s.statValue}>{items.length}</Text> 动作</Text><Text style={s.stat}><Text style={s.statValue}>{setCount}</Text> 工作组</Text><Text testID="equipment-today-estimate" style={s.stat}><Text style={s.statValue}>{estimate.rangeMinutes.join('–')}</Text> 分钟</Text></View><Text testID="equipment-today-coverage" accessibilityRole={unavailable ? 'alert' : undefined} style={[s.muted, { marginTop: 8 }]}>{notice}</Text></> : <Text style={s.muted}>{unavailable ? notice : '休息恢复，为下一次训练蓄力'}</Text>}
        <View style={[s.row, { marginTop: 16, marginBottom: 7 }]}><Text style={s.muted}>本周 {completed} / {equipmentFrequency(profile.frequency, profile.equipmentSplit)} 练</Text>{state.complete || state.partial ? <Text style={s.status}>{state.complete ? '已完成' : '部分完成'}</Text> : null}</View>
        <ProgressBar value={completed / equipmentFrequency(profile.frequency, profile.equipmentSplit) * 100} color={p.lime} />
      </View>
      <View accessibilityRole="tablist" style={s.days}>{week.map(entry => {
        const active = localDateKey(entry.date) === selected;
        const training = entry.type === 'strength';
        const done = states.get(localDateKey(entry.date))!.complete;
        const code = entry.workoutId ? (entry.title.startsWith('推') ? '推' : entry.title.startsWith('拉') ? '拉' : entry.title.startsWith('上') ? '上' : entry.title.startsWith('下') ? '腿' : entry.title.startsWith('全身') ? '' : entry.title.startsWith('手臂') ? '臂' : entry.title[0]) + (/[ABC]$/.test(entry.title) ? entry.title.slice(-1) : '') : '休';
        return <Pressable key={localDateKey(entry.date)} testID={training ? 'equipment-training-day' : 'equipment-rest-day'} accessibilityRole="tab" accessibilityLabel={`查看${entry.date.getMonth() + 1}月${entry.date.getDate()}日器械安排`} accessibilityState={{ selected: active }} aria-selected={active} onPress={() => setSelected(localDateKey(entry.date))} style={[s.day, !training && s.dayRest, active && (training ? s.dayActive : s.dayRestActive)]}><Text style={[s.dayWeek, active && (training ? s.activeText : s.restActiveText)]}>{['日', '一', '二', '三', '四', '五', '六'][entry.date.getDay()]}</Text><Text style={[s.dayNumber, active && (training ? s.activeText : s.restActiveText)]}>{entry.date.getDate()}</Text><Text style={[s.dayCode, !training && s.restCode, active && (training ? s.activeText : s.restActiveText)]}>{done && training ? '✓' : code}</Text></Pressable>;
      })}</View>
      <View style={s.sectionHead}><Text style={s.section}>{today ? '今日动作' : `${day.date.getMonth() + 1}月${day.date.getDate()}日动作`}</Text><Pressable accessibilityRole="button" accessibilityLabel="调整器械训练计划" onPress={openSettings} style={s.adjust}><Text style={s.muted}>调整 ›</Text></Pressable></View>
      <Animated.View style={{ opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
        {items.map(item => {
          return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'查看' + item.name + '器械动作指导'} onPress={() => onOpenExercise(item.id)} style={s.action}>
            <EquipmentPhoto exerciseId={item.id} name={item.name} compact thumbnailWidth={80} />
            <View style={s.actionCopy}><View style={s.actionHeading}><Text numberOfLines={2} style={s.actionTitle}>{item.name}</Text><EquipmentTierBadge tier={getEquipmentMovement(item.id)!.recommendation.tier} /></View>
              <Text style={s.dose}>{item.targetSets} 组 × {item.repRange?.join('–')} 次{item.perSide ? ' / 侧' : ''}</Text>
            </View><Text style={s.chevron}>›</Text>
          </Pressable>;
        })}
        {!items.length ? <View style={s.rest}><AppGlyph name="dumbbell" size={28} color={p.muted} /><Text style={s.restTitle}>今天不安排工作组</Text><Text style={s.muted}>休息恢复，不生成训练记录。</Text></View> : null}
      </Animated.View>
    </ScrollView>
    {!today || items.length || unavailable ? <View style={s.footer}><Button label={!today ? '返回今日' : unavailable ? '调整计划' : state.complete ? '再练一次' : state.partial ? '开始新一次训练' : '开始训练  ›'} variant="lime" onPress={() => !today ? setSelected(localDateKey(now)) : unavailable ? openSettings() : day.workoutId && onStart(day.workoutId, 1, items[0].defaultPrescription?.rirTarget, plan)} /></View> : null}
    <Modal visible={modal === 'plan'} transparent animationType={reduced === false ? 'fade' : 'none'} statusBarTranslucent onRequestClose={() => setModal(null)}>{modal === 'plan' ? <SafeAreaView style={s.planSafe}><View testID="equipment-plan-overlay" style={s.planShade}><EquipmentPlanEditor profile={profile} onClose={() => setModal(null)} onSave={savePlan} /></View></SafeAreaView> : null}</Modal>
    <TrainingGoalPicker visible={modal === 'goal'} goal={profile.goal} saving={savingGoal} error={goalError} onClose={() => setModal(null)} onSelect={goal => onSelectGoal(goal).then(ok => { if (ok) setModal(null); })} />
  </View></UITheme>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: p.background }, content: { ...progressPageLayout.content, paddingTop: 4, paddingBottom: 180 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }, settings: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  summary: { backgroundColor: p.olive, borderWidth: 1, borderColor: p.oliveBorder, borderRadius: 18, padding: 16 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, status: { color: p.lime, fontSize: 11, fontWeight: '700' }, title: { color: p.text, fontSize: 24, fontWeight: '900', marginBottom: 13 }, stats: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, stat: { color: p.muted, fontSize: 11 }, statValue: { color: p.text, fontSize: 16, fontWeight: '900' }, muted: { color: p.muted, fontSize: 12, lineHeight: 19 },
  days: { flexDirection: 'row', gap: 5, marginTop: 12 }, day: { flex: 1, minWidth: 0, minHeight: 71, alignItems: 'center', justifyContent: 'center', backgroundColor: p.card, borderRadius: 12, gap: 3, borderWidth: 1, borderColor: p.border }, dayActive: { backgroundColor: p.lime, borderColor: p.lime }, dayRest: { backgroundColor: '#14191F', borderColor: '#29313B' }, dayRestActive: { backgroundColor: p.raised, borderColor: p.muted }, dayWeek: { fontSize: 10, color: p.muted }, dayNumber: { color: p.text, fontSize: 16, fontWeight: '900' }, dayCode: { color: p.lime, fontSize: 10, fontWeight: '700' }, restCode: { color: p.faint }, activeText: { color: p.onLime }, restActiveText: { color: p.text },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }, section: { color: p.text, fontSize: 16, fontWeight: '800' }, adjust: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
  action: { backgroundColor: p.card, borderWidth: 1, borderColor: p.border, borderRadius: 14, padding: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 86 }, actionCopy: { flex: 1, minWidth: 0 }, actionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 }, actionTitle: { color: p.text, fontWeight: '800', fontSize: 13, lineHeight: 19, flex: 1 }, dose: { color: p.muted, fontSize: 11, marginTop: 4, lineHeight: 17 }, chevron: { fontSize: 24, color: p.muted },
  footer: { position: 'absolute', bottom: 94, width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: p.background }, rest: { borderRadius: 18, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, padding: 20, alignItems: 'center', gap: 12 }, restTitle: { color: p.text, fontWeight: '800', fontSize: 15 },
  planSafe: { flex: 1 }, planShade: { flex: 1, backgroundColor: '#05080B70', alignItems: 'center', justifyContent: 'center', padding: 16, ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : {}) } as ViewStyle,
});
