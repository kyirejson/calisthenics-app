import { useEffect, useMemo, useState } from 'react';
import { Animated, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppGlyph } from '../components/AppGlyph';
import { TodayTrainingTask } from '../components/TodayTrainingTask';
import { completedCourseSets, resumableSession } from '../domain/training/sessionResume';
import { todayTrainingStyles } from '../components/todayTrainingStyles';
import { EquipmentPlanEditor, type EquipmentPlanOptions } from './EquipmentPlanEditor';
import { UITheme } from '../components/ui';
import { useReducedMotion, useRouteReveal } from '../components/useProgressMotion';
import { equipmentFrequency, equipmentSplitConfig, equipmentSplitLabels, equipmentTrainingDays, equipmentSessionPlan, type EquipmentSessionPlan } from '../domain/training/equipment/equipmentTraining';
import { equipmentPlanReview } from '../domain/training/equipment/equipmentPlanReview';
import { getDayTrainingState, localDateKey } from '../domain/training/planProgress';
import { getWeekSchedule } from '../domain/training/trainingPlans';
import { useAppStore } from '../store/AppStore';
import { appPalette as p, progressPageLayout } from '../theme';

type Props = { onStart: (id: string, multiplier?: number, rir?: number, plan?: EquipmentSessionPlan) => void; onOpenExercise: (id: string) => void };
export function EquipmentTodayScreen({ onStart, onOpenExercise }: Props) {
  const { profile, sessions, patchProfile } = useAppStore(state => ({ profile: state.profile, sessions: state.sessions, patchProfile: state.patchProfile }));
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState(() => localDateKey(new Date()));
  const [modal, setModal] = useState<'plan' | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const compact = viewport.height < 742 || viewport.width < 350;
  const actionHeight = Math.max(94, Math.min(116, (viewport.height - 454) / 3));
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
  const unavailable = !!day.workoutId && (plan?.status === 'infeasible' || review?.status === 'infeasible');
  const notice = unavailable ? plan?.issues[0] || review?.issues[0] : plan?.notice;
  const items = resumableSession(sessions, selected, day.workoutId || '')?.resumeState?.items || plan?.items || [];
  const estimate = plan?.estimate;
  const setCount = items.reduce((sum, item) => sum + item.targetSets, 0);
  const states = new Map(week.map(entry => [localDateKey(entry.date), getDayTrainingState(entry, sessions, [], entry.workoutId ? equipmentSessionPlan(entry.workoutId, profile, entry.date) : undefined)]));
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
  return <UITheme><View testID="equipment-today-screen" style={s.root} onLayout={event => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setViewport(previous => Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1 ? previous : { width, height });
  }}>
    <ScrollView testID="equipment-today-scroll" showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
      <View testID="today-date-rail" accessibilityRole="tablist" style={s.calendarRow}>{week.map(entry => {
        const active = localDateKey(entry.date) === selected;
        const training = entry.type === 'strength';
        const entryState = states.get(localDateKey(entry.date))!;
        return <Pressable key={localDateKey(entry.date)} testID={training ? 'equipment-training-day' : 'equipment-rest-day'} accessibilityRole="tab" accessibilityLabel={`查看${entry.date.getMonth() + 1}月${entry.date.getDate()}日器械安排`} accessibilityState={{ selected: active }} aria-selected={active} onPress={() => setSelected(localDateKey(entry.date))} style={({ pressed }) => [s.calendarDay, localDateKey(entry.date) === localDateKey(now) && s.calendarDayToday, active && s.calendarDayActive, pressed && s.pressed]}>
          <Text style={[s.calendarWeek, active && s.calendarTextActive]}>{['日', '一', '二', '三', '四', '五', '六'][entry.date.getDay()]}</Text><Text style={[s.calendarDate, active && s.calendarTextActive]}>{entry.date.getDate()}</Text>
          <View style={[s.calendarStatus, entryState.complete && s.calendarStatusComplete, entryState.partial && s.calendarStatusPartial]} />
        </Pressable>;
      })}</View>
      <View testID="today-schedule-controls" style={s.scheduleHeader}><Text style={s.scheduleTitle}>日程</Text><View style={s.scheduleActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="调整器械训练计划" onPress={openSettings} style={s.frequencyTrigger}><Text style={s.frequencyTriggerText}>{equipmentSplitLabels[equipmentSplitConfig(profile)]} · {equipmentFrequency(profile.frequency, profile.equipmentSplit)} 练 ▾</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="设置器械训练计划" onPress={openSettings} style={s.calendarDetails}><AppGlyph name="settings" color={p.muted} size={18} /></Pressable>
      </View></View>
      <View testID="today-course-card" style={[s.course, compact && s.courseCompact]}>
        <View style={s.courseKickerRow}><View style={s.courseAccent} /><Text style={s.courseKicker}>{today ? '今日课程' : `${day.date.getMonth() + 1}月${day.date.getDate()}日课程`}{state.complete ? ' · 已完成' : state.partial ? ' · 部分完成' : ''}</Text></View>
        <View style={s.courseCopy}><Text style={[s.courseTitle, compact && s.courseTitleCompact]}>{day.type === 'strength' ? day.title : '恢复日'}</Text><Text style={s.courseSubtitle}>器械训练 · {equipmentSplitLabels[equipmentSplitConfig(profile)]}</Text></View>
        <Svg pointerEvents="none" style={s.courseRoute} width={156} height={36} viewBox="0 0 156 36" aria-hidden><Path d="M4 31H61L86 8H156" stroke="#8BA634" strokeWidth={1.2} fill="none" /><Circle cx={4} cy={31} r={2.5} fill={p.lime} /></Svg>
      </View>
      {items.length && estimate ? <Text testID="equipment-today-estimate" style={s.estimate}>{items.length} 个动作 · {setCount} 个工作组 · 预计 {estimate.rangeMinutes.join('–')} 分钟</Text> : null}
      {notice ? <Text testID="equipment-today-coverage" accessibilityRole={unavailable ? 'alert' : undefined} style={[s.notice, unavailable && s.unavailableNotice]}>{notice}</Text> : null}
      <View style={s.actionsHeader}><Text style={s.scheduleTitle}>训练清单</Text></View>
      <Animated.View testID="today-workout-list" style={[s.todayWorkoutList, { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
        {items.map((item, index) => <TodayTrainingTask key={item.id} exercise={item} index={index} completedSets={completedCourseSets(sessions, selected, day.workoutId || '', item.id)} equipment compact={compact} minHeight={actionHeight} onOpen={() => onOpenExercise(item.id)} />)}
        {!items.length ? <View style={s.restCard}><Text style={s.restTitle}>{unavailable ? '当前器械无法组成完整课程' : today ? '今天留给恢复' : '这一天留给恢复'}</Text><Text style={s.restText}>{unavailable ? '请调整可用器械或训练计划后再开始。' : '没有安排工作组，保持轻松活动即可。'}</Text></View> : null}
      </Animated.View>
    </ScrollView>
    {!today || items.length || unavailable ? <View testID="today-start-dock" style={s.startDock}><View style={s.startAction}>
      <Pressable accessibilityRole="button" onPress={() => !today ? setSelected(localDateKey(now)) : unavailable ? openSettings() : day.workoutId && onStart(day.workoutId, 1, items[0].defaultPrescription?.rirTarget, plan)} style={({ pressed }) => [s.startButton, pressed && s.pressed]}><Text style={s.startButtonText}>{!today ? '回到今日训练  →' : unavailable ? '调整计划' : resumableSession(sessions, selected, day.workoutId || '') ? '继续今日训练  →' : state.complete ? '再练一次' : '开始今日训练  →'}</Text></Pressable>
    </View></View> : <View style={s.restDockSpace} />}
    <Modal visible={modal === 'plan'} transparent animationType={reduced === false ? 'fade' : 'none'} statusBarTranslucent onRequestClose={() => setModal(null)}>{modal === 'plan' ? <SafeAreaView style={s.planSafe}><View testID="equipment-plan-overlay" style={s.planShade}><EquipmentPlanEditor profile={profile} onClose={() => setModal(null)} onSave={savePlan} /></View></SafeAreaView> : null}</Modal>
  </View></UITheme>;
}
const s = StyleSheet.create({
  ...todayTrainingStyles,
  root: { flex: 1, backgroundColor: p.background }, content: { ...progressPageLayout.content, paddingTop: 4, paddingBottom: 8 },
  estimate: { color: p.muted, fontSize: 12, lineHeight: 19, marginTop: 7 }, notice: { color: p.muted, fontSize: 11, lineHeight: 18, marginTop: 6, borderLeftWidth: 1, borderLeftColor: p.oliveBorder, paddingLeft: 10 }, unavailableNotice: { color: p.warning, borderLeftColor: p.warning },
  restDockSpace: { height: 80 },
  planSafe: { flex: 1 }, planShade: { flex: 1, backgroundColor: '#05080B70', alignItems: 'center', justifyContent: 'center', padding: 16, ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : {}) } as ViewStyle,
});
