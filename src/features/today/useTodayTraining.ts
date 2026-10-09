import { useState } from 'react';

import { getWorkoutExercises } from '../../domain/training/catalog';
import { getDisplayedSchedule, localDateKey } from '../../domain/training/planProgress';
import { getPlanDay, weightLossWeekSummary } from '../../domain/training/trainingPlans';
import { getTrainingDayView } from '../../domain/training/trainingDayView';
import {
  estimateStrengthSession,
  preferredSessionMinutes,
} from '../../domain/training/trainingPrescription';
import {
  buildPlanDraft,
  generatePersonalPlan,
  type PersonalPlanSummary,
  type PlanGenerationStep,
} from '../../domain/training/personalPlan';
import { useAppStore } from '../../store/AppStore';

import {
  headstandReadiness,
  sessionDateKey,
  trainingDateKey,
} from '../../domain/training/sessionRecords';
import { confirmAction } from '../../utils/confirm';
import type { ExperienceLevel } from '../../types';

import { useUpdateBlock } from '../../components/AppUpdates';
import type { Profile } from '../../types';
import type { TodayTrainingProps } from './types';
export function useTodayTraining({
  onStart,
  onOpenExercise,
  viewDate,
  onViewDateChange,
  profile,
}: TodayTrainingProps & { profile: Profile }) {
  const {
    sessions,
    patchProfile,
    dailyEdits,
    addDailyExercise,
    removeDailyExercise,
    resetTrainingDay,
  } = useAppStore((state) => ({
    sessions: state.sessions,
    patchProfile: state.patchProfile,
    dailyEdits: state.dailyEdits,
    addDailyExercise: state.addDailyExercise,
    removeDailyExercise: state.removeDailyExercise,
    resetTrainingDay: state.resetTrainingDay,
  }));
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [dayEditError, setDayEditError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [savingNeck, setSavingNeck] = useState(false);
  const [showGateDetails, setShowGateDetails] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const compact = viewport.height < 742 || viewport.width < 350;
  // Header/date/course/controls remain stable; surplus height belongs to task cards.
  // Long names or many prescribed sets may grow naturally instead of being cropped.
  const actionHeight = Math.max(94, Math.min(116, (viewport.height - 454) / 3));
  const [showFrequency, setShowFrequency] = useState(false);
  const [showPlanPreview, setShowPlanPreview] = useState(false);
  const [savingFrequency, setSavingFrequency] = useState(false);
  const [frequencyError, setFrequencyError] = useState('');
  const [draftFrequency, setDraftFrequency] = useState<number | null>(null);
  const [draftMinutes, setDraftMinutes] = useState<number | null>(null);
  const [draftExperience, setDraftExperience] = useState<ExperienceLevel | null>(null);
  const [draftBaseline, setDraftBaseline] = useState({ push: false, pull: false, squat: true });
  const [draftRest, setDraftRest] = useState(120);
  const [generationStep, setGenerationStep] = useState<PlanGenerationStep | null>(null);
  const [generationSummary, setGenerationSummary] = useState<PersonalPlanSummary | null>(null);
  useUpdateBlock(showFrequency || savingFrequency || showExercisePicker || savingNeck || resetting);
  const now = new Date();
  const todayKey = trainingDateKey(now);
  const {
    date: displayedDate,
    isToday: isViewingToday,
    resolved,
    editableWorkoutId,
    addedIds,
    workout,
    exercises: workoutExercises,
    state: todayState,
    title: courseTitle,
  } = getTrainingDayView(profile, sessions, dailyEdits, now, viewDate);
  const selectedDate = localDateKey(displayedDate);
  const week = getDisplayedSchedule(profile, now);
  const weightLossWeek = profile.goal === 'weight_loss' ? weightLossWeekSummary(profile) : null;
  const gate = headstandReadiness(sessions, now);
  const todayRecordCount = sessions.filter(
    (session) => sessionDateKey(session) === todayKey,
  ).length;
  const hasDayEdits = Object.values(dailyEdits).some((edit) => edit.date === todayKey);
  const prisoner = profile.goal === 'street_mastery';
  const previewProfile = buildPlanDraft(
    profile,
    draftFrequency || profile.frequency,
    draftMinutes || preferredSessionMinutes(profile),
    draftExperience || profile.experience,
    draftRest,
    draftBaseline,
  );
  const previewDay = getPlanDay({ ...previewProfile, planStartedAt: now.toISOString() }, now);
  const previewItems =
    showFrequency && previewDay.day.workoutId
      ? getWorkoutExercises(
          previewDay.day.workoutId,
          previewProfile,
          previewDay.cycle.setMultiplier,
          previewDay.cycle.dupDay,
          previewDay.cycle.week,
          { sessions },
        )
      : [];
  const previewEstimate = previewItems.length
    ? estimateStrengthSession(
        previewItems,
        preferredSessionMinutes(previewProfile),
        previewProfile.goal === 'street_mastery',
      )
    : null;

  const openPlanSettings = () => {
    setShowPlanPreview(false);
    setDraftFrequency(profile.frequency);
    setDraftMinutes(preferredSessionMinutes(profile));
    setDraftExperience(profile.experience);
    setDraftBaseline({
      push: (profile.planLevels?.push || profile.levels.push || 1) >= 5,
      pull: (profile.planLevels?.pull || profile.levels.pull || 1) >= 5,
      squat: (profile.planLevels?.squat || 5) >= 5,
    });
    setDraftRest(profile.trainingRestSeconds || 120);
    setFrequencyError('');
    setGenerationStep(null);
    setGenerationSummary(null);
    setShowFrequency(true);
  };

  const changeNeckPreparation = () => {
    const save = async (enabled: boolean) => {
      setSavingNeck(true);
      setDayEditError('');
      try {
        await patchProfile({ neckBridgeConsent: enabled });
      } catch {
        setDayEditError('颈部训练设置保存失败，请重试。');
      } finally {
        setSavingNeck(false);
      }
    };
    if (profile.neckBridgeConsent) {
      void save(false);
      return;
    }
    setShowGateDetails(false);
    confirmAction(
      '确认颈桥练习的适宜性',
      '仅在已掌握标准桥、没有颈部伤病或相关症状，且已接受合格专业人士的评估与动作指导后启用。档案阶数只是自报信息，不构成安全评估。启用后按原书成对安排正、反颈桥预备式，各 1 组 × 3 次是应用起步量，不是原书升级标准；每周自动安排不超过两次。不满足条件请选择取消，继续手阻抬头准备。',
      () => {
        void save(true);
      },
      { confirmLabel: '已满足条件，启用预备式' },
    );
  };

  const applyFrequency = async () => {
    if (savingFrequency) return;
    const days = draftFrequency || profile.frequency;
    const minutes = draftMinutes || preferredSessionMinutes(profile);
    const experience = draftExperience || profile.experience;
    const baselineChanged = (['push', 'pull', 'squat'] as const).some(
      (key) =>
        draftBaseline[key] !==
        (profile.planLevels?.[key] || (key === 'squat' ? 5 : profile.levels[key]) || 1) >= 5,
    );
    if (
      days === profile.frequency &&
      minutes === preferredSessionMinutes(profile) &&
      experience === profile.experience &&
      draftRest === (profile.trainingRestSeconds || 120) &&
      !baselineChanged
    ) {
      setShowFrequency(false);
      return;
    }
    setSavingFrequency(true);
    setFrequencyError('');
    try {
      const summary = await generatePersonalPlan(
        buildPlanDraft(profile, days, minutes, experience, draftRest, draftBaseline),
        async (next) => {
          await patchProfile((current) => {
            if (current.goal !== next.goal) throw new Error('训练专题已变化，请重新生成计划。');
            const updated = buildPlanDraft(
              current,
              days,
              minutes,
              experience,
              draftRest,
              draftBaseline,
            );
            return {
              frequency: updated.frequency,
              sessionMinutes: updated.sessionMinutes,
              experience: updated.experience,
              trainingRestSeconds: updated.trainingRestSeconds,
              planLevels: updated.planLevels,
              planId: next.planId,
              planStartedAt: next.planStartedAt,
            };
          });
        },
        setGenerationStep,
        sessions,
      );
      setGenerationSummary(summary);
    } catch {
      setFrequencyError('保存失败，请重试。');
    } finally {
      setSavingFrequency(false);
    }
  };

  const requestReset = () =>
    confirmAction(
      '重置今天的训练？',
      `将删除今天的 ${todayRecordCount} 条训练记录（含力量、专项与有氧），移除今天自加的动作，并恢复默认课程。其他日期不变；统计及倒立解锁条件会重新计算。此操作无法撤销。`,
      () => {
        setResetting(true);
        setDayEditError('');
        void resetTrainingDay(todayKey)
          .catch(() => setDayEditError('重置失败，记录未更新，请重试。'))
          .finally(() => setResetting(false));
      },
      { confirmLabel: '重置今天', destructive: true },
    );

  return {
    sessions,
    addDailyExercise,
    removeDailyExercise,
    showExercisePicker,
    setShowExercisePicker,
    showCalendar,
    setShowCalendar,
    dayEditError,
    setDayEditError,
    resetting,
    savingNeck,
    showGateDetails,
    setShowGateDetails,
    setViewport,
    compact,
    actionHeight,
    showFrequency,
    setShowFrequency,
    showPlanPreview,
    setShowPlanPreview,
    savingFrequency,
    frequencyError,
    draftFrequency,
    setDraftFrequency,
    draftMinutes,
    setDraftMinutes,
    draftExperience,
    setDraftExperience,
    generationStep,
    generationSummary,
    now,
    todayKey,
    displayedDate,
    isViewingToday,
    resolved,
    editableWorkoutId,
    addedIds,
    workout,
    workoutExercises,
    todayState,
    courseTitle,
    selectedDate,
    week,
    weightLossWeek,
    gate,
    todayRecordCount,
    hasDayEdits,
    prisoner,
    previewItems,
    previewEstimate,
    openPlanSettings,
    changeNeckPreparation,
    applyFrequency,
    requestReset,
    onStart,
    onOpenExercise,
    onViewDateChange,
    profile,
  };
}
