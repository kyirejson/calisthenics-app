import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform } from 'react-native';

import { type CockpitSet, type RestReceipt } from '../../components/TrainingCockpit';
import { useHideDeepseekDock, useOpenDeepseekChat } from '../../integrations/DeepseekChatHost';

import {
  equipmentSessionPlan,
  type EquipmentSessionPlan,
} from '../../domain/training/equipment/equipmentTraining';
import { equipmentRecoveryAfterSet } from '../../domain/training/equipment/equipmentTimeline';

import {
  canAddExercise,
  exercises,
  getWorkout,
  getWorkoutExercises,
} from '../../domain/training/catalog';
import { parseMasteryCriteria } from '../../domain/training/progression';
import {
  estimateStrengthSession,
  prescribeAddedExercise,
  type PrescribedExercise,
} from '../../domain/training/trainingPrescription';
import { getPlanDay } from '../../domain/training/trainingPlans';
import {
  cleanSession,
  dailyWorkoutKey,
  trainingDateKey,
} from '../../domain/training/sessionRecords';
import { useAppStore } from '../../store/AppStore';

import type {
  Exercise,
  SessionExercise,
  TrainingSession,
  TrainingInteractionEvent,
} from '../../types';
import { confirmAction } from '../../utils/confirm';
import { resumableSession, restoreCourseSets } from '../../domain/training/sessionResume';
export type SetState = CockpitSet;
export type SessionQuality = NonNullable<TrainingSession['quality']>;
export type TrainingProps = {
  workoutId: string;
  exerciseId?: string;
  setMultiplier?: number;
  rirTarget?: number;
  equipmentPlan?: EquipmentSessionPlan;
  onBack: () => void;
  onComplete: (sessionId: string) => void;
};
const initialSets = (item: PrescribedExercise): SetState[] =>
  Array.from({ length: item.targetSets }, () => ({
    reps: item.repRange ? '' : String(item.targetValue),
    load: '',
    rir: '',
    completed: false,
  }));
const validEquipmentSet = (item: PrescribedExercise, set: SetState) =>
  !item.loadBasis ||
  ((item.loadBasis === 'bodyweight' ||
    (set.load?.trim() !== '' &&
      set.load !== undefined &&
      Number.isFinite(Number(set.load)) &&
      Number(set.load) >= 0 &&
      Number(set.load) <= 2000)) &&
    (!set.rir?.trim() ||
      (Number.isInteger(Number(set.rir)) && Number(set.rir) >= 0 && Number(set.rir) <= 10)));
export function useTrainingSession({
  workoutId,
  exerciseId,
  setMultiplier = 1,
  rirTarget,
  equipmentPlan,
  onBack,
  onComplete,
}: TrainingProps) {
  const { profile, sessions, settings, dailyEdits, addDailyExercise, saveSession, deleteSession } =
    useAppStore((state) => ({
      profile: state.profile,
      sessions: state.sessions,
      settings: state.settings,
      dailyEdits: state.dailyEdits,
      addDailyExercise: state.addDailyExercise,
      saveSession: state.saveSession,
      deleteSession: state.deleteSession,
    }));
  useHideDeepseekDock();
  const openChat = useOpenDeepseekChat();
  const [selectedSet, setSelectedSet] = useState<number | null>(null);
  const [timerDuration, setTimerDuration] = useState(0);
  const [receipt, setReceipt] = useState<RestReceipt | null>(null);
  const [resumed] = useState(() => resumableSession(sessions, trainingDateKey(), workoutId));
  const startedAt = useRef(resumed ? new Date(resumed.startedAt) : new Date());
  const enteredAt = useRef(Date.now());
  const carriedSeconds = resumed?.durationSeconds || 0;
  const sessionId = useRef(resumed?.id || 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  const trainingDate = trainingDateKey(startedAt.current);
  const [courseProfile] = useState(() => profile);
  const [plan] = useState(
    () =>
      equipmentPlan ||
      (profile?.goal === 'equipment' && workoutId.startsWith('equipment_')
        ? equipmentSessionPlan(workoutId, profile, startedAt.current)
        : undefined),
  );
  const interactions = useRef<TrainingInteractionEvent[]>(resumed?.interactionEvents?.slice() || []);
  const [interactionRevision, setInteractionRevision] = useState(0);
  const logInteraction = (
    kind: TrainingInteractionEvent['kind'],
    exerciseId?: string,
    plannedSeconds?: number,
    setIndex?: number,
  ) => {
    interactions.current.push({
      kind,
      at: new Date().toISOString(),
      exerciseId,
      plannedSeconds,
      setIndex,
    });
    setInteractionRevision((value) => value + 1);
  };
  const selectedExercise = exerciseId
    ? exercises.find((item) => item.id === exerciseId)
    : undefined;
  const mastery = selectedExercise ? parseMasteryCriteria(selectedExercise) : undefined;
  const workout = selectedExercise
    ? { id: workoutId, name: selectedExercise.name + '专项' }
    : getWorkout(workoutId);
  // Freeze a course on entry. Saving a record must not replace its active rows.
  const [items, setItems] = useState<PrescribedExercise[]>(() => {
    if (!profile) return [];
    if (resumed?.resumeState?.items.length) return resumed.resumeState.items;
    if (plan) return plan.status === 'feasible' ? plan.items : [];
    if (selectedExercise && mastery) {
      if (!canAddExercise(selectedExercise, profile, sessions)) return [];
      const initial = prescribeAddedExercise(selectedExercise, profile);
      return [
        selectedExercise.category === 'neck' || selectedExercise.id === 'neck_handResistance'
          ? initial
          : {
              ...initial,
              targetSets: mastery.sets,
              targetValue: mastery.value,
              targetUnit: mastery.unit,
            },
      ];
    }
    const cycle = getPlanDay(profile).cycle;
    return getWorkoutExercises(workoutId, profile, setMultiplier, cycle.dupDay, cycle.week, {
      sessions,
      addedExerciseIds: dailyEdits[dailyWorkoutKey(trainingDate, workoutId)]?.exerciseIds,
    });
  });
  const [sets, setSets] = useState<Record<string, SetState[]>>(() =>
    restoreCourseSets(items, resumed),
  );
  const [index, setIndex] = useState(() => Math.max(0, items.findIndex(item => sets[item.id]?.some(set => !set.completed))));
  const [elapsed, setElapsed] = useState(carriedSeconds);
  const [timerKind, setTimerKind] = useState<'rest' | 'transition' | 'hold' | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [paused, setPaused] = useState(false);
  const deadline = useRef(0);
  const finishing = useRef(false);
  const draftSaved = useRef(false);
  const exitHandler = useRef<() => void>(() => onBack());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [showWarmup, setShowWarmup] = useState(false);
  const [showCooldown, setShowCooldown] = useState(false);
  const [showPrehab, setShowPrehab] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [constraintsConfirmed, setConstraintsConfirmed] = useState(false);
  const [warmupDone, setWarmupDone] = useState(resumed?.resumeState?.warmupDone || false);
  const current = items[index];
  const equipment = !!current?.loadBasis;
  const currentSets = current ? sets[current.id] || [] : [];
  const firstPending = currentSets.findIndex((set) => !set.completed);
  const activeSet =
    selectedSet !== null && currentSets[selectedSet] && !currentSets[selectedSet].completed
      ? selectedSet
      : Math.max(0, firstPending);
  const changeExercise = (position: number) => {
    setIndex(position);
    setSelectedSet(null);
  };
  const advanceAfterRest = () => {
    if (timerKind === 'hold' || !current || currentSets.some((set) => !set.completed)) return;
    const position = items.findIndex((item) => (sets[item.id] || []).some((set) => !set.completed));
    if (position >= 0) changeExercise(position);
  };
  const allSetCount = Object.values(sets).flat().length;
  const completedCount = Object.values(sets)
    .flat()
    .filter((set) => set.completed).length;
  const estimateItems = items.map((item) => ({
    ...item,
    targetSets: sets[item.id]?.length || item.targetSets,
  }));
  const estimate = estimateStrengthSession(
    estimateItems,
    plan ? undefined : courseProfile?.sessionMinutes,
    courseProfile?.goal === 'street_mastery',
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(carriedSeconds + Math.floor((Date.now() - enteredAt.current) / 1000));
      if (deadline.current)
        setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (timerKind && remaining === 0 && !paused) {
      deadline.current = 0;
      advanceAfterRest();
      setTimerKind(null);
      if (plan && timerKind !== 'hold') logInteraction('timer_finished');
      if (settings.vibration)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
    }
  }, [remaining, paused, timerKind, settings.vibration]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      exitHandler.current();
      return true;
    });
    return () => listener.remove();
  }, []);

  const startTimer = (kind: 'rest' | 'transition' | 'hold', seconds: number) => {
    const duration = Math.max(1, Math.round(seconds));
    deadline.current = Date.now() + duration * 1000;
    setRemaining(duration);
    setTimerDuration(duration);
    setPaused(false);
    setTimerKind(kind);
    if (plan && kind !== 'hold')
      logInteraction(
        kind === 'transition' ? 'transition_started' : 'rest_started',
        current?.id,
        duration,
      );
  };
  const stopTimer = () => {
    if (plan && timerKind) logInteraction('timer_skipped', current?.id, remaining);
    deadline.current = 0;
    setTimerKind(null);
    setRemaining(0);
    setPaused(false);
  };
  const togglePause = () => {
    if (paused) deadline.current = Date.now() + remaining * 1000;
    else deadline.current = 0;
    setPaused(!paused);
    if (plan) logInteraction(paused ? 'timer_resumed' : 'timer_paused', current?.id, remaining);
  };
  const extendRest = () => {
    setRemaining((value) => value + 30);
    setTimerDuration((value) => value + 30);
    if (!paused) deadline.current = Math.max(Date.now(), deadline.current) + 30000;
    if (plan) logInteraction('timer_extended', current?.id, 30);
  };
  const invalidCheckedSet = () =>
    items.some((item) =>
      (sets[item.id] || []).some(
        (set) =>
          set.completed &&
          (!Number.isFinite(Number(set.reps)) ||
            Number(set.reps) <= 0 ||
            (item.targetUnit !== 'meters' && !Number.isInteger(Number(set.reps))) ||
            !validEquipmentSet(item, set)),
      ),
    );

  const createRecord = (quality?: SessionQuality, finalized = false, continuing = true) => {
    const sessionExercises: SessionExercise[] = items.map((item) => ({
      exerciseId: item.id,
      name: item.name,
      category: item.category,
      sets: (sets[item.id] || []).map((set) => ({
        reps: Number(set.reps),
        completed:
          set.completed &&
          validEquipmentSet(item, set) &&
          (item.targetUnit === 'meters' || Number.isInteger(Number(set.reps))),
        unit: item.targetUnit,
        completedAt: set.completedAt,
        ...(item.loadBasis
          ? {
              loadKg: item.loadBasis === 'bodyweight' ? undefined : Number(set.load),
              rir: set.rir?.trim() ? Number(set.rir) : undefined,
            }
          : {}),
      })),
      targetSnapshot: {
        sets: sets[item.id]?.length || item.targetSets,
        value: item.targetValue,
        unit: item.targetUnit,
        repRange: item.repRange,
        perSide: item.perSide,
        loadBasis: item.loadBasis,
        restSeconds: item.restSeconds,
        rirTarget: item.defaultPrescription?.rirTarget,
      },
      constraintsConfirmed:
        selectedExercise && items.length === 1
          ? !mastery?.manual || constraintsConfirmed
          : undefined,
    }));
    return cleanSession({
      id: sessionId.current,
      workoutId,
      workoutName: workout?.name || '自选训练',
      startedAt: startedAt.current.toISOString(),
      completedAt: new Date().toISOString(),
      trainingDate,
      durationSeconds: Math.max(1, carriedSeconds + Math.floor((Date.now() - enteredAt.current) / 1000)),
      exercises: sessionExercises,
      totalReps: 0,
      kind: 'strength',
      quality,
      completion: finalized && completedCount === allSetCount ? 'complete' : 'partial',
      inProgress: continuing && (!finalized || completedCount < allSetCount),
      resumeState: continuing && (!finalized || completedCount < allSetCount) ? { items, sets, warmupDone } : undefined,
      ...(resumed?.planSnapshot ? { planSnapshot: resumed.planSnapshot, interactionEvents: interactions.current.slice() } : plan
        ? {
            planSnapshot: {
              schemaVersion: plan.schemaVersion,
              revision: plan.revision,
              workoutId,
              estimate: plan.estimate,
              targets: plan.items.map((item) => ({
                id: item.id,
                sets: item.targetSets,
                range: item.repRange,
                restSeconds: item.restSeconds,
                rir: item.defaultPrescription?.rirTarget,
                perSide: item.perSide,
                loadBasis: item.loadBasis,
              })),
            },
            interactionEvents: interactions.current.slice(),
          }
        : {}),
    });
  };
  const draftFactory = useRef(createRecord);
  draftFactory.current = createRecord;
  useEffect(() => {
    if (finishing.current) return;
    const record = draftFactory.current();
    if (!record.exercises.length && !draftSaved.current) return;
    draftSaved.current = record.exercises.length > 0;
    const operation = saveSession(record);
    void operation.catch(() => {
      if (!finishing.current) setError('自动暂存失败，请保持此页打开，并在结束时重试保存。');
    });
  }, [sets, items, interactionRevision, saveSession, deleteSession]);

  const save = async (quality?: SessionQuality, leave = false) => {
    if (finishing.current) return;
    if (!completedCount) {
      if (!leave) {
        setError('请先完成至少一组。');
        return;
      }
      finishing.current = true;
      setSaving(true);
      try {
        await deleteSession(sessionId.current);
        stopTimer();
        onBack();
      } catch {
        finishing.current = false;
        setSaving(false);
        setError('清理空记录失败，请重试退出。');
      }
      return;
    }
    if (invalidCheckedSet()) {
      setError('请检查已完成组：次数和秒数应为正整数，距离应大于 0。');
      return;
    }
    finishing.current = true;
    setSaving(true);
    setError('');
    try {
      await saveSession(createRecord(quality, true, leave));
      stopTimer();
      if (leave) onBack();
      else onComplete(sessionId.current);
    } catch {
      finishing.current = false;
      setSaving(false);
      setShowQuality(false);
      setError('保存失败，已完成内容仍在本页，请重试。');
    }
  };
  const confirmExit = () => {
    if (saving) return;
    confirmAction(
      completedCount ? '保存并退出训练？' : '退出本次训练？',
      completedCount
        ? '已完成的 ' + completedCount + ' 组会保留，返回今日页后可以从剩余动作继续。'
        : '尚未完成任何组，退出不会产生空记录。',
      () => {
        void save(undefined, true);
      },
      { confirmLabel: completedCount ? '保存并退出' : '退出', cancelLabel: '继续训练' },
    );
  };
  exitHandler.current = confirmExit;

  const toggleSet = (setIndex: number) => {
    if (!current || saving) return;
    const previous = currentSets[setIndex];
    if (!previous) return;
    const value = Number(previous.reps);
    if (
      !previous.completed &&
      (!Number.isFinite(value) ||
        value <= 0 ||
        (current.targetUnit !== 'meters' && !Number.isInteger(value)))
    ) {
      setError('请填写有效的实际完成数量。');
      return;
    }
    if (!previous.completed && !validEquipmentSet(current, previous)) {
      setError('请填写有效重量（kg）；余力可留空，填写时为 0–10。');
      return;
    }
    setSets((old) => ({
      ...old,
      [current.id]: old[current.id].map((set, i) =>
        i === setIndex
          ? {
              ...set,
              completed: !set.completed,
              completedAt: set.completed ? undefined : new Date().toISOString(),
            }
          : set,
      ),
    }));
    setError('');
    if (!previous.completed) {
      setSelectedSet(null);
      setReceipt({
        name: current.name,
        setNumber: setIndex + 1,
        value: previous.reps,
        unit: current.targetUnit,
      });
      if (settings.vibration)
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      if (plan) {
        logInteraction('set_completed', current.id, undefined, setIndex);
        const completed = Object.fromEntries(
          items.map((item) => [
            item.id,
            (sets[item.id] || []).map((set, i) =>
              item.id === current.id && i === setIndex ? true : set.completed,
            ),
          ]),
        );
        const recovery = equipmentRecoveryAfterSet(estimateItems, completed, current.id);
        if (recovery.seconds)
          startTimer(recovery.kind === 'transition' ? 'transition' : 'rest', recovery.seconds);
        else stopTimer();
      } else if (completedCount + 1 < allSetCount)
        startTimer('rest', current.restSeconds || settings.restSeconds);
      else stopTimer();
    } else if (plan) {
      logInteraction('set_unchecked', current.id, undefined, setIndex);
    }
  };
  const editSet = (setIndex: number, field: 'reps' | 'load' | 'rir', value: string) => {
    if (!current || saving) return;
    setSelectedSet(setIndex);
    setSets((old) => ({
      ...old,
      [current.id]: old[current.id].map((set, index) =>
        index === setIndex
          ? { ...set, [field]: value }
          : set,
      ),
    }));
  };
  const endTimer = () => {
    advanceAfterRest();
    stopTimer();
  };
  const startManualTimer = () => {
    if (current.targetUnit !== 'seconds') setReceipt(null);
    startTimer(
      current.targetUnit === 'seconds' ? 'hold' : 'rest',
      current.targetUnit === 'seconds'
        ? Number(currentSets[activeSet]?.reps) || current.targetValue
        : current.restSeconds,
    );
  };
  const addSet = () => {
    if (!current || saving) return;
    setSets((old) => ({
      ...old,
      [current.id]: [...old[current.id], initialSets({ ...current, targetSets: 1 })[0]],
    }));
  };
  const removeSet = (position: number) => {
    if (
      saving ||
      !current ||
      !currentSets[position] ||
      currentSets[position].completed ||
      position < current.targetSets
    )
      return;
    setSets((old) => ({ ...old, [current.id]: old[current.id].filter((_, i) => i !== position) }));
    setSelectedSet(null);
  };
  const startRest = () => {
    if (!saving && current) {
      setReceipt(null);
      startTimer('rest', current.restSeconds);
    }
  };
  const addExercise = async (exercise: Exercise) => {
    if (!profile || items.some((item) => item.id === exercise.id)) return;
    if (!canAddExercise(exercise, profile, sessions)) throw new Error('尚未解锁');
    const item = prescribeAddedExercise(exercise, profile);
    if (!selectedExercise) await addDailyExercise(trainingDate, workoutId, exercise.id);
    setItems((old) => [...old, item]);
    setSets((old) => ({ ...old, [item.id]: initialSets(item) }));
  };
  const requestFinish = () => {
    if (!completedCount) {
      setError('请先完成至少一组。');
      return;
    }
    if (invalidCheckedSet()) {
      setError('已完成组的数量有误，请修正后保存。');
      return;
    }
    if (completedCount < allSetCount)
      confirmAction(
        '保存部分训练？',
        '只记录已完成的 ' +
          completedCount +
          ' 组，剩余 ' +
          (allSetCount - completedCount) +
          ' 组不会记入。',
        () => setShowQuality(true),
        { confirmLabel: '记录已完成组' },
      );
    else setShowQuality(true);
  };

  return {
    exerciseId,
    rirTarget,
    onBack,
    onComplete,
    profile,
    openChat,
    setSelectedSet,
    timerDuration,
    receipt,
    setReceipt,
    plan,
    logInteraction,
    selectedExercise,
    mastery,
    workout,
    items,
    sets,
    setSets,
    index,
    elapsed,
    timerKind,
    remaining,
    paused,
    saving,
    error,
    showGuide,
    setShowGuide,
    showWarmup,
    setShowWarmup,
    showCooldown,
    setShowCooldown,
    showPrehab,
    setShowPrehab,
    showPicker,
    setShowPicker,
    showQuality,
    setShowQuality,
    constraintsConfirmed,
    setConstraintsConfirmed,
    warmupDone,
    setWarmupDone,
    current,
    equipment,
    currentSets,
    activeSet,
    changeExercise,
    completedCount,
    estimate,
    startTimer,
    togglePause,
    extendRest,
    save,
    confirmExit,
    toggleSet,
    editSet,
    endTimer,
    startManualTimer,
    addSet,
    removeSet,
    startRest,
    addExercise,
    requestFinish,
  };
}
