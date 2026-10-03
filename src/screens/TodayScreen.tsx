import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Page, ProgressBar } from '../components/ui';
import { RecoveryDayContent } from '../components/RecoveryGuide';
import { ExercisePicker } from '../components/ExercisePicker';
import { ScheduleDayDetail } from '../components/ScheduleDayDetail';
import { ExerciseMedia } from '../components/ExerciseResource';
import { YearSchedule } from '../components/YearSchedule';
import { AppGlyph } from '../components/AppGlyph';
import { canPlanNeckBridges, getWorkout, getWorkoutExercises, workoutDisplayTitle } from '../data/catalog';
import { getDayTrainingState, getDisplayedSchedule, localDateKey } from '../data/planProgress';
import { getPlanDay, getWeekSchedule, RETIRED_PLAN_ID, weightLossWeekSummary } from '../data/trainingPlans';
import { estimateStrengthSession, preferredSessionMinutes } from '../data/trainingPrescription';
import { buildPlanDraft, generatePersonalPlan, type PersonalPlanSummary, type PlanGenerationStep } from '../data/personalPlan';
import { useAppStore } from '../store/AppStore';
import { appPalette, fitnessColors as colors, progressPageLayout } from '../theme';
import { dailyWorkoutKey, headstandReadiness, sessionDateKey, trainingDateKey, usesHeadstandGate } from '../data/sessionRecords';
import { confirmAction } from '../utils/confirm';
import { groupHistoryByDay } from '../data/trainingHistory';
import type { ExperienceLevel, Goal } from '../types';
import { NutritionScreen } from './NutritionScreen';
import { RunningSession } from './RunScreen';
import { TrainingGoalPicker, TrainingGoalSelector } from '../components/TrainingGoalPicker';
import { EquipmentTodayScreen } from './EquipmentTodayScreen';
import { useUpdateBlock } from '../components/AppUpdates';
import { usePersonalAgent } from '../agent/PersonalAgentHost';

type Props = {
  onStart: (workoutId: string, setMultiplier?: number, rirTarget?: number, equipmentPlan?: import('../data/equipmentTraining').EquipmentSessionPlan) => void;
  onRun: () => void;
  onNutrition: () => void;
  onOpenExercise: (exerciseId: string) => void;
};

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

export function TodayScreen(props: Props) {
  const pager = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [selectedPage, setSelectedPage] = useState<0 | 1 | 2>(0);
  const selectedRef = useRef<0 | 1 | 2>(0);
  const scrollTarget = useRef<0 | 1 | 2 | null>(null);
  const resizing = useRef(false);
  const { setAgentScene } = usePersonalAgent();
  useEffect(() => { setAgentScene(['今日训练', '饮食记录', '跑步记录'][selectedPage]); }, [selectedPage, setAgentScene]);

  useEffect(() => {
    if (!pageWidth) return;
    let restoreFrame = 0;
    const layoutFrame = requestAnimationFrame(() => {
      pager.current?.scrollTo({ x: selectedRef.current * pageWidth, animated: false });
      restoreFrame = requestAnimationFrame(() => { resizing.current = false; });
    });
    return () => { cancelAnimationFrame(layoutFrame); cancelAnimationFrame(restoreFrame); };
  }, [pageWidth]);

  const selectPage = (page: 0 | 1 | 2) => {
    scrollTarget.current = page === selectedRef.current ? null : page;
    selectedRef.current = page;
    setSelectedPage(page);
    pager.current?.scrollTo({ x: page * pageWidth, animated: true });
  };
  const readPage = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth || resizing.current) return;
    const offset = event.nativeEvent.contentOffset.x;
    if (scrollTarget.current !== null) {
      if (Math.abs(offset - scrollTarget.current * pageWidth) > 2) return;
      scrollTarget.current = null;
    }
    const page = Math.max(0, Math.min(2, Math.round(offset / pageWidth))) as 0 | 1 | 2;
    selectedRef.current = page;
    setSelectedPage(page);
  };

  return <SafeAreaView style={styles.todayRoot}>
    <View style={styles.todayHeader}>
      <View style={styles.todayHeading}><Text style={styles.todayTitle}>今日</Text><Text style={styles.wordmark}>Uncover</Text></View>
      <View accessibilityRole="tablist" style={styles.todayTabs}>
        {(['训练', '饮食', '跑步'] as const).map((label, index) => <Pressable key={label} accessibilityRole="tab" accessibilityLabel={'切换到' + label} accessibilityState={{ selected: selectedPage === index }} aria-selected={selectedPage === index} onPress={() => selectPage(index as 0 | 1 | 2)} style={[styles.todayTab, selectedPage === index && styles.todayTabActive]}><Text style={[styles.todayTabText, selectedPage === index && styles.todayTabTextActive]}>{label}</Text></Pressable>)}
      </View>
    </View>
    <View style={styles.todayPagerFrame} onLayout={event => {
      const width = event.nativeEvent.layout.width;
      if (width > 0 && width !== pageWidth) { resizing.current = true; scrollTarget.current = null; setPageWidth(width); }
    }}>
      {pageWidth > 0 ? <ScrollView ref={pager} horizontal pagingEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={readPage} onMomentumScrollEnd={readPage} onScrollBeginDrag={() => { scrollTarget.current = null; }} onTouchStart={() => { scrollTarget.current = null; }} style={styles.todayPager} contentContainerStyle={styles.todayPagerContent}>
        <View testID="today-training-page" accessibilityElementsHidden={selectedPage !== 0} importantForAccessibility={selectedPage === 0 ? 'auto' : 'no-hide-descendants'} aria-hidden={selectedPage !== 0} style={[styles.todayPage, { width: pageWidth }]}><TrainingTodayScreen {...props} onNutrition={() => selectPage(1)} /></View>
        <View testID="today-nutrition-page" accessibilityElementsHidden={selectedPage !== 1} importantForAccessibility={selectedPage === 1 ? 'auto' : 'no-hide-descendants'} aria-hidden={selectedPage !== 1} style={[styles.todayPage, { width: pageWidth }]}><NutritionScreen embedded onBack={() => selectPage(0)} /></View>
        <View testID="today-running-page" accessibilityElementsHidden={selectedPage !== 2} importantForAccessibility={selectedPage === 2 ? 'auto' : 'no-hide-descendants'} aria-hidden={selectedPage !== 2} style={[styles.todayPage, { width: pageWidth }]}><RunningSession embedded /></View>
      </ScrollView> : null}
    </View>
  </SafeAreaView>;
}

function TrainingTodayScreen({ onStart, onRun, onOpenExercise }: Props) {
  const { profile, sessions, patchProfile, switchTrainingGoal, dailyEdits, addDailyExercise, removeDailyExercise, resetTrainingDay } = useAppStore();
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [dayEditError, setDayEditError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [savingNeck, setSavingNeck] = useState(false);
  const [showGateDetails, setShowGateDetails] = useState(false);
  const pageScroll = useRef<ScrollView>(null);
  const scheduleTop = useRef(0);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [showTodayDetails, setShowTodayDetails] = useState(false);
  const [showFrequency, setShowFrequency] = useState(false);
  const [savingFrequency, setSavingFrequency] = useState(false);
  const [frequencyError, setFrequencyError] = useState('');
  const [draftFrequency, setDraftFrequency] = useState<number | null>(null);
  const [draftMinutes, setDraftMinutes] = useState<number | null>(null);
  const [draftExperience, setDraftExperience] = useState<ExperienceLevel | null>(null);
  const [draftBaseline, setDraftBaseline] = useState({ push: false, pull: false, squat: true });
  const [draftRest, setDraftRest] = useState(120);
  const [generationStep, setGenerationStep] = useState<PlanGenerationStep | null>(null);
  const [generationSummary, setGenerationSummary] = useState<PersonalPlanSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => localDateKey(new Date()));
  // 日期条详情默认收起：点选中的日期展开/收起，点新日期切换并展开。
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  useUpdateBlock(showFrequency || savingFrequency || showExercisePicker || showGoal || savingGoal || savingNeck || resetting);
  if (!profile) return null;

  const selectGoal = async (goal: Goal) => {
    if (savingGoal) return false;
    if (goal === profile.goal && profile.planId !== RETIRED_PLAN_ID) return true;
    setSavingGoal(true);
    setGoalError('');
    try {
      await switchTrainingGoal(goal);
      return true;
    } catch {
      setGoalError('切换失败，请重试。');
      return false;
    } finally {
      setSavingGoal(false);
    }
  };

  if (profile.goal === 'equipment') return <EquipmentTodayScreen onStart={onStart} onOpenExercise={onOpenExercise} onSelectGoal={selectGoal} goalError={goalError} savingGoal={savingGoal} />;

  if ((profile.goal !== 'weight_loss' && profile.goal !== 'street_mastery') || profile.planId === RETIRED_PLAN_ID) return <Page tone="dark">
    <View style={styles.unavailableCard}>
      <Text style={styles.unavailableEyebrow}>训练计划已移除</Text>
      <Text style={styles.unavailableTitle}>当前目标暂无课程</Text>
      <Text style={styles.unavailableBody}>当前旧目标的课程已移除。档案、动作阶数和历史训练记录仍会保留。</Text>
      <Text style={styles.unavailableBody}>可主动选择减肥控重或街头健身专题。</Text>
      {goalError ? <Text style={styles.unavailableError}>{goalError}</Text> : null}
      <Button label={savingGoal ? '切换中…' : '启用减肥控重计划'} variant="lime" disabled={savingGoal} onPress={() => void selectGoal('weight_loss')} />
      <Button label={savingGoal ? '切换中…' : '启用街头健身专题'} variant="lime" disabled={savingGoal} onPress={() => void selectGoal('street_mastery')} />
    </View>
  </Page>;

  const now = new Date();
  const todayKey = trainingDateKey(now);
  const resolved = getPlanDay(profile, now);
  const editableWorkoutId = resolved.day.workoutId || 'custom_daily';
  const addedIds = dailyEdits[dailyWorkoutKey(todayKey, editableWorkoutId)]?.exerciseIds || [];
  const workout = resolved.day.workoutId || addedIds.length ? getWorkout(editableWorkoutId) : null;
  const workoutExercises = workout ? getWorkoutExercises(workout.id, profile, resolved.cycle.setMultiplier, resolved.cycle.dupDay, resolved.cycle.week, { sessions, date: now, addedExerciseIds: addedIds }) : [];
  const workoutEstimate = workout ? estimateStrengthSession(workoutExercises, preferredSessionMinutes(profile), profile.goal === 'street_mastery') : null;
  const week = getDisplayedSchedule(profile, now);
  const activeDay = week.find((day) => localDateKey(day.date) === selectedDate) || week[0];
  const progressWeek = getWeekSchedule(profile, now);
  const plannedDays = progressWeek.filter((day) => day.type !== 'recovery' || Boolean(day.workoutId));
  const weightLossWeek = profile.goal === 'weight_loss' ? weightLossWeekSummary(profile) : null;
  const completedDays = plannedDays.filter((day) => getDayTrainingState(day, sessions).complete).length;
  const todayState = getDayTrainingState({ date: now, ...resolved.day, ...(workout?.id === 'custom_daily' ? { type: 'strength' as const, workoutId: workout.id } : {}) }, sessions, addedIds);
  const gate = headstandReadiness(sessions, now);
  const todayRecordCount = sessions.filter((session) => sessionDateKey(session) === todayKey).length;
  const hasDayEdits = Object.values(dailyEdits).some((edit) => edit.date === todayKey);
  const prisoner = profile.goal === 'street_mastery';
  const recordedDays = new Set(groupHistoryByDay(sessions, now).map(day => localDateKey(day.date)));
  const streakDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (!recordedDays.has(localDateKey(streakDate))) streakDate.setDate(streakDate.getDate() - 1);
  let streakDays = 0;
  while (recordedDays.has(localDateKey(streakDate))) { streakDays++; streakDate.setDate(streakDate.getDate() - 1); }
  const previewProfile = buildPlanDraft(profile, draftFrequency || profile.frequency, draftMinutes || preferredSessionMinutes(profile), draftExperience || profile.experience, draftRest, draftBaseline);
  const previewDay = getPlanDay({ ...previewProfile, planStartedAt: now.toISOString() }, now);
  const previewItems = showFrequency && previewDay.day.workoutId ? getWorkoutExercises(previewDay.day.workoutId, previewProfile, previewDay.cycle.setMultiplier, previewDay.cycle.dupDay, previewDay.cycle.week, { sessions }) : [];
  const previewEstimate = previewItems.length ? estimateStrengthSession(previewItems, preferredSessionMinutes(previewProfile), previewProfile.goal === 'street_mastery') : null;

  const openPlanSettings = () => {
    setDraftFrequency(profile.frequency);
    setDraftMinutes(preferredSessionMinutes(profile));
    setDraftExperience(profile.experience);
    setDraftBaseline({ push: (profile.planLevels?.push || profile.levels.push || 1) >= 5, pull: (profile.planLevels?.pull || profile.levels.pull || 1) >= 5, squat: (profile.planLevels?.squat || 5) >= 5 });
    setDraftRest(profile.trainingRestSeconds || 120);
    setFrequencyError('');
    setGenerationStep(null);
    setGenerationSummary(null);
    setShowFrequency(true);
  };

  const changeNeckPreparation = () => {
    const save = async (enabled: boolean) => {
      setSavingNeck(true); setDayEditError('');
      try { await patchProfile({ neckBridgeConsent: enabled }); }
      catch { setDayEditError('颈部训练设置保存失败，请重试。'); }
      finally { setSavingNeck(false); }
    };
    if (profile.neckBridgeConsent) { void save(false); return; }
    setShowGateDetails(false);
    confirmAction('确认颈桥练习的适宜性', '仅在已掌握标准桥、没有颈部伤病或相关症状，且已接受合格专业人士的评估与动作指导后启用。档案阶数只是自报信息，不构成安全评估。启用后按原书成对安排正、反颈桥预备式，各 1 组 × 3 次是应用起步量，不是原书升级标准；每周自动安排不超过两次。不满足条件请选择取消，继续手阻抬头准备。', () => { void save(true); }, { confirmLabel: '已满足条件，启用预备式' });
  };

  const applyFrequency = async () => {
    if (savingFrequency) return;
    const days = draftFrequency || profile.frequency;
    const minutes = draftMinutes || preferredSessionMinutes(profile);
    const experience = draftExperience || profile.experience;
    const baselineChanged = (['push', 'pull', 'squat'] as const).some((key) => draftBaseline[key] !== ((profile.planLevels?.[key] || (key === 'squat' ? 5 : profile.levels[key]) || 1) >= 5));
    if (days === profile.frequency && minutes === preferredSessionMinutes(profile) && experience === profile.experience && draftRest === (profile.trainingRestSeconds || 120) && !baselineChanged) { setShowFrequency(false); return; }
    setSavingFrequency(true);
    setFrequencyError('');
    try {
      const summary = await generatePersonalPlan(buildPlanDraft(profile, days, minutes, experience, draftRest, draftBaseline), async next => {
        await patchProfile(current => {
          if (current.goal !== next.goal) throw new Error('训练专题已变化，请重新生成计划。');
          const updated = buildPlanDraft(current, days, minutes, experience, draftRest, draftBaseline);
          return { frequency: updated.frequency, sessionMinutes: updated.sessionMinutes, experience: updated.experience,
            trainingRestSeconds: updated.trainingRestSeconds, planLevels: updated.planLevels, planId: next.planId, planStartedAt: next.planStartedAt };
        });
      }, setGenerationStep, sessions);
      setGenerationSummary(summary);
      setShowTodayDetails(true);
    } catch {
      setFrequencyError('保存失败，请重试。');
    } finally {
      setSavingFrequency(false);
    }
  };

  const requestReset = () => confirmAction('重置今天的训练？', `将删除今天的 ${todayRecordCount} 条训练记录（含力量、专项与有氧），移除今天自加的动作，并恢复默认课程。其他日期不变；统计及倒立解锁条件会重新计算。此操作无法撤销。`, () => {
    setResetting(true); setDayEditError('');
    void resetTrainingDay(todayKey).catch(() => setDayEditError('重置失败，记录未更新，请重试。')).finally(() => setResetting(false));
  }, { confirmLabel: '重置今天', destructive: true });

  return <Page tone="dark" testID="today-training-content" scrollRef={pageScroll}>
    <View style={styles.goalRow}>
      <TrainingGoalSelector goal={profile.goal} disabled={savingGoal} onPress={() => setShowGoal(true)} />
      <View accessibilityLabel={'连续训练' + streakDays + '天'} style={styles.streak}><AppGlyph name="flame" color={streakDays ? colors.lime : appPalette.faint} size={20} /><Text style={styles.streakText}>连续 <Text style={styles.streakNumber}>{streakDays}</Text> 天</Text></View>
    </View>
    {/* 今日安排、训练进度与动作详情合为一张卡 */}
    <LinearGradient colors={todayState.complete ? ['#202E23', '#1B2420'] : ['#242D22', '#1B2028']} style={styles.heroCard}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showTodayDetails }} onPress={() => setShowTodayDetails((value) => !value)}>
        <View style={styles.heroTop}>
          <View style={styles.heroKickerGroup}>
            <Text style={styles.heroKicker}>{todayState.complete ? '今日 · 已完成' : '今日安排'}</Text>
            {resolved.day.type === 'strength' ? (
              <View style={[styles.dupTag, styles.dupVol]}>
                <Text style={styles.dupTagText}>{prisoner ? '六艺训练' : '全身保肌'}</Text>
              </View>
            ) : resolved.day.workoutId ? (
              <View style={[styles.dupTag, styles.dupVol]}>
                <Text style={styles.dupTagText}>主动恢复</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroBadge}>{resolved.cycle.label}</Text>
        </View>
        <View style={styles.heroIntro}><View style={styles.heroIntroCopy}><Text style={styles.heroTitle}>{todayState.complete ? '今天的训练已完成' : workoutDisplayTitle(resolved.day.title, workoutExercises)}</Text></View>{workoutExercises[0] ? <ExerciseMedia exercise={workoutExercises[0]} width={100} minHeight={64} maxHeight={100} /> : null}</View>
        <Text style={styles.heroDesc}>{todayState.complete && todayState.session ? `${Math.max(1, Math.ceil(todayState.session.durationSeconds / 60))} 分钟 · ${todayState.session.kind === 'running' ? '有氧训练' : todayState.session.workoutName}` : workout && workoutEstimate ? `${workoutExercises.length} 个动作 · 预计 ${workoutEstimate.totalMinutes} 分钟 · 含热身与休息` : resolved.day.tip}</Text>
        <View style={styles.heroProgressHead}><Text style={styles.heroProgressLabel}>本周训练进度</Text><Text style={styles.heroProgressValue}>{completedDays} / {plannedDays.length} 课</Text></View>
        <View style={styles.heroProgressTrack}><View style={[styles.heroProgressFill, { width: `${plannedDays.length ? completedDays / plannedDays.length * 100 : 0}%` }]} /></View>
        <View style={styles.heroExpandRow}><Text style={styles.heroExpandText}>{showTodayDetails ? '收起今日内容' : '查看动作与注意事项'}</Text><Text style={styles.heroExpandArrow}>{showTodayDetails ? '⌃' : '⌄'}</Text></View>
      </Pressable>
      {showTodayDetails ? <View style={styles.heroDetails}>
        <Text style={styles.heroDetailLabel}>{resolved.day.type === 'recovery' ? '恢复建议' : '训练注意'}</Text>
        <Text style={styles.heroDetailText}>{resolved.day.tip}</Text>
        {resolved.day.type === 'recovery' && !resolved.day.workoutId ? (
          <View style={styles.recoveryWrap}>
            <RecoveryDayContent dayOfWeek={now.getDay()} weightLoss={profile.goal === 'weight_loss'} profile={profile} />
          </View>
        ) : null}
        {workoutEstimate ? <Text style={styles.heroDetailText}>预计：热身 {workoutEstimate.warmupSeconds / 60} 分钟 · 动作与转换 {Math.ceil((workoutEstimate.workSeconds + workoutEstimate.transitionsSeconds) / 60)} 分钟 · 组间休息 {Math.ceil(workoutEstimate.restSeconds / 60)} 分钟 · 整理 {workoutEstimate.cooldownSeconds / 60} 分钟</Text> : null}
        {resolved.day.type === 'cardio' ? <Text style={styles.heroDetailText}>{profile.goal === 'weight_loss' ? '以能正常交谈为准；疲劳时缩短或休息，不补偿性加练。' : '以能够正常交谈的轻松强度完成；疲劳时改为快走。'}</Text> : null}
      </View> : null}
      {usesHeadstandGate(profile) ? <View style={styles.gateBox}>
        <Text style={styles.gateTitle}>{gate.unlocked ? '倒立训练 · 已满足解锁条件' : '倒立训练 · 尚未解锁'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="查看倒立训练条件" onPress={() => setShowGateDetails(true)} style={styles.gateLink}>
          <Text style={styles.gateLinkText}>查看条件 ›</Text>
        </Pressable>
      </View> : null}
      {workout && workoutExercises.length > 0 ? <View style={styles.heroAction}>
        <Button
          label={todayState.complete ? '再练一次' : resolved.day.type === 'recovery'
            ? (todayState.partial ? '继续完整恢复  →' : '开始今日恢复  →')
            : (todayState.partial ? '开始完整训练  →' : '开始今日训练  →')}
          variant="lime"
          onPress={() => onStart(workout.id, resolved.cycle.setMultiplier, resolved.cycle.rirTarget)}
        />
      </View> : resolved.day.type === 'cardio' && !todayState.complete ? <View style={styles.heroAction}><Button label={prisoner ? '记录轻松活动  →' : '记录今日有氧  →'} variant="lime" onPress={onRun} /></View> : null}
      <View style={styles.dayTools}><Pressable disabled={resetting} onPress={() => setShowExercisePicker(true)} style={styles.dayTool}><Text style={styles.dayToolText}>＋ 添加动作</Text></Pressable><Pressable disabled={resetting || (!todayRecordCount && !hasDayEdits)} onPress={requestReset} style={[styles.dayTool, !todayRecordCount && !hasDayEdits && { opacity: .4 }]}><Text style={styles.dayToolText}>{resetting ? '重置中…' : '重置今天'}</Text></Pressable></View>
      {dayEditError ? <Text style={styles.dayError}>{dayEditError}</Text> : null}
    </LinearGradient>
    <ExercisePicker visible={showExercisePicker} onClose={() => setShowExercisePicker(false)} excludedIds={workoutExercises.map((item) => item.id)} onSelect={async (exercise) => { await addDailyExercise(todayKey, editableWorkoutId, exercise.id); setShowTodayDetails(true); }} />

    <View style={styles.scheduleHeader} onLayout={(event) => { scheduleTop.current = event.nativeEvent.layout.y; }}>
      <Text style={styles.scheduleTitle}>日程安排</Text>
      <View style={styles.scheduleActions}>
        <Pressable accessibilityRole="button" onPress={openPlanSettings} style={styles.frequencyTrigger}>
          <Text style={styles.frequencyTriggerText}>
            {prisoner ? (
              profile.experience === 'supermax' ? '阶段 V · 登峰造极 ▾'
              : profile.experience === 'elite' ? '阶段 IV · 闭关修炼 ▾'
              : profile.experience === 'advanced' || profile.frequency === 6 ? '阶段 III · 炉火纯青 ▾'
              : profile.experience === 'intermediate' || profile.frequency === 3 ? '阶段 II · 渐入佳境 ▾'
              : '阶段 I · 初试身手 ▾'
            ) : `每周 ${profile.frequency} 天 ▾`}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="查看全年训练日历" onPress={() => setShowCalendar(true)} style={styles.calendarDetails}><AppGlyph name="chevron" size={18} color={colors.ink} /></Pressable>
      </View>
    </View>
    {weightLossWeek ? <View style={styles.weightLossSchedule}>
      <Text style={styles.weightLossScheduleTitle}>减肥控重 · 本周安排</Text>
      <Text style={styles.weightLossScheduleMain}>{weightLossWeek.strengthDays} 次全身保肌 <Text style={styles.weightLossScheduleSep}>/</Text> {weightLossWeek.cardioDays} 次低冲击有氧 · 计划内 {weightLossWeek.plannedCardioMinutes} 分钟</Text>
      <Text style={styles.weightLossScheduleNote}>{profile.age < 18 ? '生长发育期不以体重下降速度为目标；按身体状态活动，并寻求专业指导。' : '成人可逐步靠近每周 150 分钟中等强度活动；上方仅统计计划内有氧，未计入日常步行。'}</Text>
    </View> : null}
    <View style={styles.calendarRow}>
      {week.map((day) => {
        const dayKey = localDateKey(day.date);
        const today = localDateKey(day.date) === localDateKey(now);
        const isSelected = dayKey === (selectedDate || localDateKey(now));
        const state = getDayTrainingState(day, sessions);
        return (
          <Pressable
            key={dayKey}
            accessibilityRole="button"
            accessibilityLabel={`${day.date.getMonth() + 1}月${day.date.getDate()}日 周${weekdayLabels[day.date.getDay()]}`}
            accessibilityState={{ selected: isSelected }}
            onPress={() => {
              const same = dayKey === (selectedDate || localDateKey(now));
              if (same) setDayDetailOpen((value) => !value);
              else { setSelectedDate(dayKey); setDayDetailOpen(true); }
            }}
            style={[
              styles.calendarDay,
              today && styles.calendarDayToday,
              isSelected && styles.calendarDayActive,
            ]}
          >
            <Text style={[styles.calendarWeek, isSelected && styles.calendarTextActive]}>{weekdayLabels[day.date.getDay()]}</Text>
            <Text style={[styles.calendarDate, isSelected && styles.calendarTextActive]}>{day.date.getDate()}</Text>
            <Text style={[styles.calendarKind, day.type === 'strength' && styles.calendarKindStrength, day.type === 'cardio' && styles.calendarKindCardio, isSelected && styles.calendarTextActive]}>{state.complete ? '完成' : day.type === 'strength' ? '力量' : day.type === 'cardio' ? prisoner ? '活动' : '有氧' : day.workoutId ? '恢复' : '休养'}</Text>
          </Pressable>
        );
      })}
    </View>
    {activeDay && dayDetailOpen ? (
      <View style={styles.scheduleDetailWrap}>
        <ScheduleDayDetail
          profile={profile}
          day={activeDay}
          sessions={sessions}
          onOpenExercise={onOpenExercise}
        />
      </View>
    ) : workoutExercises.length ? <View testID="today-workout-list" style={styles.todayWorkoutList}>
      {workoutExercises.map((exercise) => <View key={exercise.id}>
        <Pressable accessibilityRole="button" accessibilityLabel={`查看${exercise.name}动作指导`} onPress={() => onOpenExercise(exercise.id)} style={styles.heroExerciseRow}>
          <ExerciseMedia exercise={exercise} width={82} minHeight={56} maxHeight={96} />
          <View style={styles.heroExerciseContent}><Text style={styles.heroExerciseName}>{exercise.name}</Text><Text style={styles.heroExerciseMeta}>{exercise.targetSets} 组 × {exercise.targetValue} {exercise.targetUnit === 'seconds' ? '秒' : exercise.targetUnit === 'meters' ? '米' : exercise.targetUnit === 'steps' ? '步' : '次'}{exercise.id === 'aux_singleLegCalf' ? '（左右合计）' : ''} · 休息 {exercise.restSeconds} 秒</Text></View><AppGlyph name="chevron" size={16} />
        </Pressable>
        {addedIds.includes(exercise.id) ? <Pressable accessibilityRole="button" accessibilityLabel={'移除' + exercise.name} onPress={() => void removeDailyExercise(todayKey, editableWorkoutId, exercise.id).catch(() => setDayEditError('移除失败，请重试。'))} style={styles.daySmallAction}><Text style={styles.daySmallActionText}>移除自加动作</Text></Pressable> : null}
      </View>)}
    </View> : null}

    {showCalendar ? <YearSchedule profile={profile} sessions={sessions} anchor={now} onSelect={() => {}} onOpenExercise={id => { setShowCalendar(false); onOpenExercise(id); }} onClose={() => setShowCalendar(false)} /> : null}
    <TrainingGoalPicker visible={showGoal} goal={profile.goal} saving={savingGoal} error={goalError} onClose={() => setShowGoal(false)} onSelect={goal => selectGoal(goal).then(saved => { if (saved) setShowGoal(false); })} />

    <Modal transparent visible={showGateDetails} animationType="none" onRequestClose={() => setShowGateDetails(false)}>
      <View style={styles.frequencyBackdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="关闭倒立训练条件" onPress={() => setShowGateDetails(false)} style={StyleSheet.absoluteFill} />
        <View style={styles.frequencyCard}>
          <ScrollView style={styles.frequencyScroll} contentContainerStyle={styles.frequencyContent}>
            <Text style={styles.frequencyTitle}>倒立训练条件</Text>
            <View style={styles.gateDetailSection}>
              <Text style={styles.gateDetailTitle}>{gate.unlocked ? '已满足解锁条件' : '窄距俯卧撑 · 单日累计 200 次'}</Text>
              <Text style={styles.gateDetailText}>{gate.unlocked ? `达标日期 ${gate.qualifiedDay}；倒立训练日按当前阶数安排。` : `今日 ${gate.todayReps} 次 · 历史单日最高 ${gate.bestDayReps} 次\n未达标时安排俯卧撑与颈部准备，不安排靠墙顶立。`}</Text>
              <Text style={styles.gateDetailNote}>各阶段统一检查。这是应用门槛，并非原书标准或安全评估；无需强凑次数。</Text>
            </View>
            <View style={styles.gateDetailSection}>
              <Text style={styles.gateDetailTitle}>颈部准备 · {canPlanNeckBridges(profile) ? '正、反颈桥预备式' : '轻量手阻抬头'}</Text>
              <Text style={styles.gateDetailText}>{canPlanNeckBridges(profile) ? '按已确认的基础与适宜性安排，两项各 1 组起步；可查看原图与指导，不自动升级为标准颈桥。' : '轻阻力 1 组共 10 次起步，附 AI 写实示范与原文指导。颈桥另需标准桥基础与适宜性确认。'}</Text>
              <Text style={styles.gateDetailNote}>每周自动安排最多两次；不适时停止，不补课加量。</Text>
            </View>
            <Button label={savingNeck ? '保存中…' : profile.neckBridgeConsent ? '改回轻量颈部准备' : '我已掌握标准桥，检查颈桥条件'} disabled={savingNeck || (!profile.neckBridgeConsent && (profile.levels.bridge || 1) < 6)} onPress={changeNeckPreparation} />
            {!profile.neckBridgeConsent && (profile.levels.bridge || 1) < 6 ? <Text style={styles.gateDetailNote}>掌握标准桥后，才可检查颈桥条件。</Text> : null}
            {dayEditError ? <Text style={styles.frequencyError}>{dayEditError}</Text> : null}
          </ScrollView>
          <View style={styles.frequencyFooter}><Button label="关闭" variant="lime" onPress={() => setShowGateDetails(false)} /></View>
        </View>
      </View>
    </Modal>
    <Modal transparent visible={showFrequency} animationType="none" onRequestClose={() => { if (!savingFrequency) setShowFrequency(false); }}>
      <View style={styles.frequencyBackdrop}>
        <Pressable onPress={() => { if (!savingFrequency) setShowFrequency(false); }} style={StyleSheet.absoluteFill} />
        <View style={styles.frequencyCard}>
          <ScrollView style={styles.frequencyScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.frequencyContent}>
          {generationSummary ? <>
            <Text style={styles.frequencySection}>计划已生成</Text>
            <Text style={styles.frequencyInfo}>每周 {generationSummary.strengthDays} 天力量{generationSummary.cardioDays ? ` · ${generationSummary.cardioDays} 天${prisoner ? '轻松活动' : '有氧'}` : ''}；力量课预计 {generationSummary.longestMinutes} 分钟。</Text>
          </> : prisoner ? <>
            <Text style={styles.frequencyTitle}>选择街头健身进阶阶段</Text>
            <Text style={styles.frequencyInfo}>原著《囚徒健身》官方五大进阶日程，选择对应你体能与恢复能力的阶段：</Text>
            <View style={styles.prisonerStageList}>
              {([
                {
                  key: 'beginner' as const,
                  tag: '阶段 I',
                  name: '初试身手 · 筑基四艺',
                  desc: '每周2练（周一/五）：推拉蹲腿四艺打底，养护关节与韧带；严禁练桥与倒立撑',
                  defaultFreq: 2,
                  cue: '【初试身手】：新手或大体重首选。周一俯卧撑+举腿、周五引体+深蹲，各练2~3组。严禁过早挑战倒立和铁桥，动作保持2-1-2-1慢速节奏。',
                },
                {
                  key: 'intermediate' as const,
                  tag: '阶段 II',
                  name: '渐入佳境 · 六艺合璧',
                  desc: '每周3练（周一/三/五）：六艺两两合流，每练严格2项，各练2组全力组；身心和谐增长',
                  defaultFreq: 3,
                  cue: '【渐入佳境】：四艺达标后的中流砥柱计划。周一推腹、周三拉蹲、周五倒桥，各练2组全力组，练一休一留足充能时间。',
                },
                {
                  key: 'advanced' as const,
                  tag: '阶段 III',
                  name: '炉火纯青 · 一日一艺',
                  desc: '每周6练（周一至六）：每天专攻一艺（引体->桥->倒立->举腿->深蹲->俯卧撑），6~15分钟专注微课',
                  defaultFreq: 6,
                  cue: '【炉火纯青】：每天专注一个动作，2~3组全力组即停。上下半身与推拉严格交替，极频极精，神经高频激活。',
                },
                {
                  key: 'elite' as const,
                  tag: '阶段 IV',
                  name: '闭关修炼 · 双循环六练',
                  desc: '每周6练（周一至六）：3天分化×双循环，六艺加握力、小腿、颈部全覆盖；45~60分钟大课轰炸',
                  defaultFreq: 6,
                  cue: '【闭关修炼】：原著高阶严酷计划。周一/四拉蹲握、周二/五推腹腿、周三/六倒桥颈，周日彻底休息，适合恢复力极好的高阶训练者。',
                },
                {
                  key: 'supermax' as const,
                  tag: '阶段 V',
                  name: '登峰造极 · 超级耐力',
                  desc: '每周6练（周一至六）：两两组合，每项10~50组（每组10次），组间仅喘几口气；专攻钢铁超人体能',
                  defaultFreq: 6,
                  cue: '【登峰造极】：原著终极大运动量耐力计划。每日两艺各10组起步（组间极短休息连续推进），专攻超人般的耐力与体能。',
                },
              ] as const).map((stage) => {
                const active = (draftExperience || profile.experience) === stage.key;
                return (
                  <Pressable
                    key={stage.key}
                    disabled={savingFrequency}
                    onPress={() => {
                      setDraftExperience(stage.key);
                      setDraftFrequency(stage.defaultFreq);
                    }}
                    style={[styles.prisonerStageCard, active && styles.prisonerStageCardActive]}
                  >
                    <View style={styles.prisonerStageHead}>
                      <View style={[styles.prisonerStageTag, active && styles.prisonerStageTagActive]}>
                        <Text style={[styles.prisonerStageTagText, active && styles.prisonerStageTagTextActive]}>{stage.tag}</Text>
                      </View>
                      <Text style={[styles.prisonerStageName, active && styles.prisonerStageNameActive]}>{stage.name}</Text>
                    </View>
                    <Text style={styles.prisonerStageDesc}>{stage.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
            {(draftExperience || profile.experience) ? (
              <View style={styles.coachNoticeBox}>
                <Text style={styles.coachNoticeText}>
                  {(draftExperience || profile.experience) === 'beginner'
                    ? '🥋 教练建议：初试身手每周2练。周一俯卧撑+举腿、周五引体+深蹲，各练2~3组。严禁过早挑战倒立和铁桥，动作保持2-1-2-1慢速节奏。'
                    : (draftExperience || profile.experience) === 'intermediate'
                    ? '🥋 教练建议：渐入佳境每周3练。周一推腹、周三拉蹲、周五倒桥，各练2组全力组，练一休一留足充能时间。'
                    : (draftExperience || profile.experience) === 'advanced'
                    ? '🥋 教练建议：炉火纯青每周6练。周一至周六一日一艺（引体->桥->倒立->举腿->深蹲->俯卧撑），每日6~15分钟微课专注突破。'
                    : (draftExperience || profile.experience) === 'elite'
                    ? '🥋 教练建议：闭关修炼每周6练。周一/四拉蹲握、周二/五推腹腿、周三/六倒桥颈，周日彻底休息，45~60分钟高密度大课轰炸。'
                    : '🥋 教练建议：登峰造极每周6练。周一/四拉蹲、周二/五推腹、周三/六倒桥，每项10组起步（组间极短休息），专攻钢铁超人体能。'}
                </Text>
                {profile.weight / ((profile.height / 100) ** 2) >= 28 ? (
                  <Text style={styles.coachSafetyWarning}>
                    ⚠️ 你的 BMI 偏高（{ (profile.weight / ((profile.height / 100) ** 2)).toFixed(1) }）：体重是自重的杠铃，过重会成倍放大腕肘肩负荷。强烈建议先选【阶段 I · 初试身手】，同时开启控重减脂剥离死重！
                  </Text>
                ) : null}
                {(draftExperience || profile.experience) === 'intermediate' && ['push', 'pull', 'squat', 'legRaise'].some((art) => (profile.levels[art] || 1) < 6) ? (
                  <Text style={styles.coachSafetyWarning}>
                    ⚠️ 原著准入提醒：原著严格规定基础四艺（俯卧撑、引体、深蹲、举腿）全部达到第 6 式打牢关节肌腱后，方可进阶至【阶段 II · 渐入佳境】开启倒立撑与桥。若目前四艺尚未达标，建议在阶段 I 筑基稳固。
                  </Text>
                ) : null}
                {(draftExperience || profile.experience) === 'supermax' ? (
                  <Text style={styles.coachSafetyWarning}>
                    ⚠️ 原著红线警告：【阶段 V · 登峰造极】属于终极超大容量耐力循环（每日 10~50 组），原著明确指出这是通关六艺终极十式后的超人体能挑战，过早冲击极易引发过度训练与结缔组织损伤！
                  </Text>
                ) : null}
              </View>
            ) : null}
            {previewEstimate ? (
              <View style={styles.planPreview}>
                <Text style={styles.planPreviewTitle}>首课预览 · {previewItems.length} 个动作 · 预计 {previewEstimate.totalMinutes} 分钟</Text>
                <Text style={styles.planPreviewMeta}>热身 {previewEstimate.warmupSeconds / 60} 分钟 · 整理 {previewEstimate.cooldownSeconds / 60} 分钟</Text>
                {previewItems.map((item) => <Text key={item.id} style={styles.planPreviewItem}>{item.name} · {item.targetSets} 组 × {item.targetValue} {item.targetUnit === 'seconds' ? '秒' : item.targetUnit === 'steps' ? '步' : item.targetUnit === 'meters' ? '米' : '次'} · 组间休 {item.restSeconds} 秒</Text>)}
              </View>
            ) : null}
          </> : <>
            <Text style={styles.frequencyTitle}>定制训练计划</Text>
            <Text style={styles.frequencySection}>每周训练天数</Text>
            <View style={styles.frequencyOptions}>{[2, 3, 4, 5, 6].map((days) => <Pressable key={days} disabled={savingFrequency} onPress={() => setDraftFrequency(days)} style={[styles.frequencyOption, draftFrequency === days && styles.frequencyOptionActive]}><Text style={styles.frequencyNumber}>{days}</Text><Text style={[styles.frequencyUnit, draftFrequency === days && styles.frequencyUnitActive]}>天</Text></Pressable>)}</View>
            <Text style={styles.frequencySection}>希望每次训练多久（含休息）</Text>
            <View style={styles.frequencyOptions}>{[20, 30, 45, 60, 75].map((minutes) => <Pressable key={minutes} disabled={savingFrequency} onPress={() => setDraftMinutes(minutes)} style={[styles.frequencyOption, draftMinutes === minutes && styles.frequencyOptionActive]}><Text style={styles.frequencyNumber}>{minutes}</Text><Text style={[styles.frequencyUnit, draftMinutes === minutes && styles.frequencyUnitActive]}>分钟</Text></Pressable>)}</View>
            <Text style={styles.frequencySection}>目前训练基础</Text>
            <View style={styles.experienceOptions}>{([['beginner', '刚开始'], ['intermediate', '有基础'], ['advanced', '高阶']] as const).map(([key, label]) => <Pressable key={key} disabled={savingFrequency} onPress={() => setDraftExperience(key)} style={[styles.experienceOption, draftExperience === key && styles.frequencyOptionActive]}><Text style={styles.experienceText}>{label}</Text></Pressable>)}</View>
          </>}
          </ScrollView>
          <View style={styles.frequencyFooter}>
            {generationStep ? <View style={styles.generationBox}><Text style={styles.generationLabel}>{generationStep.label} · {generationStep.progress}%</Text><ProgressBar value={generationStep.progress} color={colors.limeDark} /></View> : null}
            {frequencyError ? <Text style={styles.frequencyError}>{frequencyError}</Text> : null}
            {generationSummary ? <Button label="查看日程" variant="lime" onPress={() => setShowFrequency(false)} /> : <Button label={savingFrequency ? '正在生成…' : '应用计划'} variant="lime" disabled={savingFrequency} onPress={() => void applyFrequency()} />}
            {!generationSummary ? <Pressable disabled={savingFrequency} onPress={() => setShowFrequency(false)} style={styles.frequencyClose}><Text style={styles.frequencyCloseText}>取消</Text></Pressable> : null}
          </View>
        </View>
      </View>
    </Modal>
  </Page>;
}



/* ━━ Styles ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const styles = StyleSheet.create({
  todayRoot: { flex: 1, minWidth: 0, backgroundColor: appPalette.background },
  todayHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, maxWidth: 440, width: '100%', alignSelf: 'center' },
  todayHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, marginBottom: 10 },
  todayTitle: { ...progressPageLayout.title, color: appPalette.text }, wordmark: { color: appPalette.muted, fontSize: 13, fontWeight: '800', letterSpacing: -.3 },
  todayTabs: { width: '100%', flexDirection: 'row', padding: 3, gap: 3, borderRadius: 16, borderWidth: 1, borderColor: appPalette.border, backgroundColor: appPalette.card },
  todayTab: { flex: 1, minHeight: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  todayTabActive: { backgroundColor: appPalette.lime }, todayTabText: { color: appPalette.muted, fontSize: 13, fontWeight: '800' }, todayTabTextActive: { color: appPalette.onLime },
  todayPagerFrame: { flex: 1, minWidth: 0, overflow: 'hidden', maxWidth: 440, width: '100%', alignSelf: 'center' },
  todayPager: { flex: 1, minWidth: 0 }, todayPagerContent: { alignItems: 'stretch' }, todayPage: { height: '100%', minWidth: 0, flexShrink: 0, overflow: 'hidden' },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 }, streakText: { color: appPalette.muted, fontSize: 12 }, streakNumber: { color: appPalette.text, fontWeight: '800', fontVariant: ['tabular-nums'] },
  dayTools: { flexDirection: 'row', gap: 8, marginTop: 10 }, dayTool: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: appPalette.border, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, dayToolText: { color: appPalette.muted, fontSize: 12, fontWeight: '700' },
  daySmallAction: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 }, daySmallActionText: { color: appPalette.muted, fontSize: 11 }, dayError: { color: appPalette.danger, fontSize: 12, lineHeight: 19, marginTop: 10 },
  gateBox: { borderTopWidth: 1, borderTopColor: appPalette.border, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, gateTitle: { flex: 1, color: appPalette.muted, fontSize: 11, fontWeight: '700' }, gateLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }, gateLinkText: { color: appPalette.lime, fontSize: 11, fontWeight: '700' },
  gateDetailSection: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: appPalette.border, marginBottom: 12 }, gateDetailTitle: { color: appPalette.text, fontSize: 14, fontWeight: '800' }, gateDetailText: { color: appPalette.muted, fontSize: 13, lineHeight: 21, marginTop: 8 }, gateDetailNote: { color: appPalette.muted, fontSize: 11, lineHeight: 18, marginTop: 8 },
  unavailableCard: { marginTop: 18, backgroundColor: appPalette.card, borderColor: appPalette.border, borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 }, unavailableEyebrow: { color: appPalette.lime, fontSize: 11, fontWeight: '800' }, unavailableTitle: { ...progressPageLayout.title, color: appPalette.text }, unavailableBody: { color: appPalette.muted, fontSize: 13, lineHeight: 21 }, unavailableError: { color: appPalette.danger, fontSize: 12 },
  heroCard: { borderRadius: 20, borderWidth: 1, borderColor: '#4A5C37', padding: 16, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, heroKickerGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }, heroKicker: { color: appPalette.lime, fontSize: 11, fontWeight: '800' },
  dupTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1 }, dupVol: { backgroundColor: '#2D3C23', borderColor: '#506936' }, dupTagText: { color: '#C9DCA7', fontSize: 9, fontWeight: '700' }, heroBadge: { color: appPalette.muted, fontSize: 10, flexShrink: 1, textAlign: 'right' },
  heroIntro: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }, heroIntroCopy: { flex: 1, minWidth: 0 }, heroTitle: { color: appPalette.text, fontSize: 18, lineHeight: 25, fontWeight: '900', letterSpacing: -.4 },
  heroDesc: { color: appPalette.muted, fontSize: 12, lineHeight: 19, marginTop: 10 }, heroProgressHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 7 }, heroProgressLabel: { color: appPalette.muted, fontSize: 11 }, heroProgressValue: { color: appPalette.lime, fontSize: 11, fontWeight: '800' },
  heroProgressTrack: { height: 5, borderRadius: 3, backgroundColor: appPalette.border, overflow: 'hidden' }, heroProgressFill: { height: 5, borderRadius: 3, backgroundColor: appPalette.lime },
  heroExpandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }, heroExpandText: { color: appPalette.muted, fontSize: 11, fontWeight: '700' }, heroExpandArrow: { color: appPalette.lime, fontSize: 16 },
  heroDetails: { borderTopWidth: 1, borderTopColor: appPalette.border, paddingTop: 12, marginBottom: 8 }, heroDetailLabel: { color: appPalette.lime, fontSize: 11, fontWeight: '800' }, heroDetailText: { color: appPalette.muted, fontSize: 12, lineHeight: 20, marginTop: 6 },
  todayWorkoutList: { gap: 8, marginTop: 4 }, heroExerciseRow: { flexDirection: 'row', padding: 10, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: appPalette.border, backgroundColor: appPalette.card, borderRadius: 16 },
  heroExerciseContent: { flex: 1, minWidth: 0 }, heroExerciseName: { ...progressPageLayout.actionTitle, color: appPalette.text, fontSize: 14, lineHeight: 20 }, heroExerciseMeta: { color: appPalette.muted, fontSize: 11, lineHeight: 17, marginTop: 5 }, heroAction: { marginTop: 6 },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 18, marginBottom: 10 }, scheduleTitle: { ...progressPageLayout.sectionTitle, color: appPalette.text }, scheduleActions: { flexDirection: 'row', alignItems: 'center', gap: 3 }, calendarDetails: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: appPalette.border, backgroundColor: appPalette.card },
  scheduleDetailWrap: { marginTop: 4, marginBottom: 14 }, frequencyTrigger: { minHeight: 44, borderRadius: 22, backgroundColor: appPalette.card, borderWidth: 1, borderColor: appPalette.border, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 1 }, frequencyTriggerText: { color: appPalette.muted, fontSize: 10, fontWeight: '700' },
  weightLossSchedule: { backgroundColor: appPalette.olive, borderRadius: 16, padding: 12, marginBottom: 12 }, weightLossScheduleTitle: { color: appPalette.lime, fontSize: 10, fontWeight: '800' }, weightLossScheduleMain: { color: appPalette.text, fontSize: 12, lineHeight: 19, fontWeight: '700', marginTop: 4 }, weightLossScheduleSep: { color: appPalette.muted }, weightLossScheduleNote: { color: appPalette.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  calendarRow: { flexDirection: 'row', gap: 4, marginBottom: 10 }, calendarDay: { flex: 1, minWidth: 0, height: 70, borderRadius: 12, backgroundColor: appPalette.card, borderWidth: 1, borderColor: appPalette.border, alignItems: 'center', justifyContent: 'center' }, calendarDayToday: { borderColor: appPalette.oliveBorder }, calendarDayActive: { backgroundColor: appPalette.lime, borderColor: appPalette.lime }, calendarWeek: { color: appPalette.muted, fontSize: 10, fontWeight: '700' }, calendarDate: { color: appPalette.text, fontSize: 17, fontWeight: '900', marginTop: 2 }, calendarTextActive: { color: appPalette.onLime }, calendarKind: { color: appPalette.muted, fontSize: 9, fontWeight: '700', marginTop: 5 }, calendarKindStrength: { color: appPalette.lime }, calendarKindCardio: { color: colors.blue },
  frequencyBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', alignItems: 'center', justifyContent: 'center', padding: 16 }, frequencyCard: { width: '100%', maxWidth: 440, maxHeight: '92%', backgroundColor: appPalette.background, borderWidth: 1, borderColor: appPalette.border, borderRadius: 20, overflow: 'hidden' }, frequencyScroll: { flexShrink: 1 }, frequencyContent: { padding: 16 },
  planPreview: { backgroundColor: appPalette.card, borderRadius: 16, padding: 14, marginTop: 16 }, planPreviewTitle: { color: appPalette.text, fontSize: 13, fontWeight: '800' }, planPreviewMeta: { color: appPalette.muted, fontSize: 11, lineHeight: 18, marginTop: 5, marginBottom: 7 }, planPreviewItem: { color: appPalette.text, fontSize: 12, lineHeight: 22 },
  frequencyFooter: { paddingHorizontal: 16, paddingBottom: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: appPalette.border }, frequencyTitle: { ...progressPageLayout.title, color: appPalette.text }, frequencyInfo: { color: appPalette.muted, fontSize: 12, lineHeight: 19, marginTop: 7 }, frequencyOptions: { flexDirection: 'row', gap: 7, marginTop: 14 }, frequencySection: { color: appPalette.text, fontSize: 12, fontWeight: '800', marginTop: 15 },
  frequencyOption: { flex: 1, minWidth: 0, height: 63, borderRadius: 12, backgroundColor: appPalette.card, borderWidth: 1, borderColor: appPalette.border, alignItems: 'center', justifyContent: 'center' }, frequencyOptionActive: { backgroundColor: appPalette.olive, borderColor: appPalette.lime }, frequencyNumber: { color: appPalette.text, fontSize: 20, fontWeight: '900' }, frequencyUnit: { color: appPalette.muted, fontSize: 10 }, frequencyUnitActive: { color: appPalette.lime },
  experienceOptions: { flexDirection: 'row', gap: 7, marginTop: 9 }, experienceOption: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: appPalette.card, borderWidth: 1, borderColor: appPalette.border }, experienceText: { color: appPalette.text, fontSize: 11, fontWeight: '800' },
  prisonerStageList: { gap: 8, marginTop: 12 }, prisonerStageCard: { backgroundColor: appPalette.card, borderRadius: 16, borderWidth: 1, borderColor: appPalette.border, padding: 14 }, prisonerStageCardActive: { borderColor: appPalette.lime, backgroundColor: appPalette.olive }, prisonerStageHead: { flexDirection: 'row', alignItems: 'center', gap: 8 }, prisonerStageTag: { backgroundColor: appPalette.raised, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }, prisonerStageTagActive: { backgroundColor: appPalette.lime }, prisonerStageTagText: { color: appPalette.muted, fontSize: 10, fontWeight: '800' }, prisonerStageTagTextActive: { color: appPalette.onLime }, prisonerStageName: { color: appPalette.text, fontSize: 13, fontWeight: '800', flexShrink: 1 }, prisonerStageNameActive: { color: appPalette.lime }, prisonerStageDesc: { color: appPalette.muted, fontSize: 11, lineHeight: 18, marginTop: 7 },
  coachNoticeBox: { backgroundColor: appPalette.card, borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: appPalette.border }, coachNoticeText: { color: appPalette.muted, fontSize: 11, lineHeight: 18 }, coachSafetyWarning: { color: appPalette.warning, fontSize: 11, lineHeight: 18, fontWeight: '700', marginTop: 8 },
  generationBox: { marginTop: 16, marginBottom: 12, gap: 8 }, generationLabel: { color: appPalette.text, fontSize: 11, fontWeight: '800' }, frequencyError: { color: appPalette.danger, fontSize: 11, lineHeight: 18, marginTop: 8 }, frequencyClose: { alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: 8 }, frequencyCloseText: { color: appPalette.muted, fontSize: 12, fontWeight: '700' },
  recoveryWrap: { marginTop: 12, borderRadius: 16, overflow: 'hidden', maxHeight: 360 },
});
