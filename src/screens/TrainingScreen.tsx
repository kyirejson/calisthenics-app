import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, ProgressBar, UITheme } from '../components/ui';
import { ExerciseDetailedGuide, ExerciseMedia } from '../components/ExerciseResource';
import { AppGlyph } from '../components/AppGlyph';
import { useReducedMotion, useRouteReveal } from '../components/useProgressMotion';
import { ExercisePicker } from '../components/ExercisePicker';
import { WarmupGuide, CooldownGuide } from '../components/WarmupCooldown';
import { PrehabGuideModal } from '../components/PrehabGuide';
import { canAddExercise, exercises, getWorkout, getWorkoutExercises } from '../data/catalog';
import { parseMasteryCriteria } from '../data/progression';
import { estimateStrengthSession, prescribeAddedExercise, type PrescribedExercise, type TargetUnit } from '../data/trainingPrescription';
import { getPlanDay } from '../data/trainingPlans';
import { cleanSession, dailyWorkoutKey, trainingDateKey } from '../data/sessionRecords';
import { useAppStore } from '../store/AppStore';
import { appPalette, fitnessColors as colors, progressPageLayout } from '../theme';
import type { Exercise, SessionExercise, TrainingSession } from '../types';
import { confirmAction } from '../utils/confirm';

type SetState = { reps: string; completed: boolean; completedAt?: string };
type SessionQuality = NonNullable<TrainingSession['quality']>;
type TrainingProps = { workoutId: string; exerciseId?: string; setMultiplier?: number; rirTarget?: number; onBack: () => void; onComplete: () => void };
const unitLabel = (unit: TargetUnit) => ({ reps: '次', seconds: '秒', steps: '步', meters: '米' })[unit];
const timeLabel = (seconds: number) => String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(Math.max(0, seconds % 60)).padStart(2, '0');
const initialSets = (item: PrescribedExercise) => Array.from({ length: item.targetSets }, () => ({ reps: String(item.targetValue), completed: false }));

export function TrainingScreen({ workoutId, exerciseId, setMultiplier = 1, rirTarget, onBack, onComplete }: TrainingProps) {
  const { profile, sessions, settings, dailyEdits, addDailyExercise, saveSession, deleteSession } = useAppStore();
  const startedAt = useRef(new Date());
  const sessionId = useRef('session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
  const trainingDate = trainingDateKey(startedAt.current);
  const selectedExercise = exerciseId ? exercises.find((item) => item.id === exerciseId) : undefined;
  const mastery = selectedExercise ? parseMasteryCriteria(selectedExercise) : undefined;
  const workout = selectedExercise ? { id: workoutId, name: selectedExercise.name + '专项' } : getWorkout(workoutId);
  // Freeze a course on entry. Saving a record must not replace its active rows.
  const [items, setItems] = useState<PrescribedExercise[]>(() => {
    if (!profile) return [];
    if (selectedExercise && mastery) {
      if (!canAddExercise(selectedExercise, profile, sessions)) return [];
      const initial = prescribeAddedExercise(selectedExercise, profile);
      return [selectedExercise.category === 'neck' || selectedExercise.id === 'neck_handResistance' ? initial
        : { ...initial, targetSets: mastery.sets, targetValue: mastery.value, targetUnit: mastery.unit }];
    }
    const cycle = getPlanDay(profile).cycle;
    return getWorkoutExercises(workoutId, profile, setMultiplier, cycle.dupDay, cycle.week, { sessions, addedExerciseIds: dailyEdits[dailyWorkoutKey(trainingDate, workoutId)]?.exerciseIds });
  });
  const [sets, setSets] = useState<Record<string, SetState[]>>(() => Object.fromEntries(items.map((item) => [item.id, initialSets(item)])));
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [timerKind, setTimerKind] = useState<'rest' | 'hold' | null>(null);
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
  const [warmupDone, setWarmupDone] = useState(false);
  const current = items[index];
  const reduced = useReducedMotion();
  const actionReveal = useRouteReveal(current?.id || '', reduced);
  const currentSets = current ? sets[current.id] || [] : [];
  const allSetCount = Object.values(sets).flat().length;
  const completedCount = Object.values(sets).flat().filter((set) => set.completed).length;
  const estimateItems = items.map((item) => ({ ...item, targetSets: sets[item.id]?.length || item.targetSets }));
  const estimate = estimateStrengthSession(estimateItems, profile?.sessionMinutes, profile?.goal === 'street_mastery');

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current.getTime()) / 1000));
      if (deadline.current) setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (timerKind && remaining === 0 && !paused) {
      deadline.current = 0;
      setTimerKind(null);
      if (settings.vibration) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  }, [remaining, paused, timerKind, settings.vibration]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { exitHandler.current(); return true; });
    return () => listener.remove();
  }, []);

  const startTimer = (kind: 'rest' | 'hold', seconds: number) => {
    const duration = Math.max(1, Math.round(seconds));
    deadline.current = Date.now() + duration * 1000;
    setRemaining(duration); setPaused(false); setTimerKind(kind);
  };
  const stopTimer = () => { deadline.current = 0; setTimerKind(null); setRemaining(0); setPaused(false); };
  const togglePause = () => {
    if (paused) deadline.current = Date.now() + remaining * 1000;
    else deadline.current = 0;
    setPaused(!paused);
  };
  const extendRest = () => {
    setRemaining((value) => value + 30);
    if (!paused) deadline.current = Math.max(Date.now(), deadline.current) + 30000;
  };
  const invalidCheckedSet = () => items.some((item) => (sets[item.id] || []).some((set) => set.completed && (!Number.isFinite(Number(set.reps)) || Number(set.reps) <= 0 || (item.targetUnit !== 'meters' && !Number.isInteger(Number(set.reps))))));

  const createRecord = (quality?: SessionQuality, finalized = false) => {
    const sessionExercises: SessionExercise[] = items.map((item) => ({
      exerciseId: item.id, name: item.name, category: item.category,
      sets: (sets[item.id] || []).map((set) => ({ reps: Number(set.reps), completed: set.completed && (item.targetUnit === 'meters' || Number.isInteger(Number(set.reps))), unit: item.targetUnit, completedAt: set.completedAt })),
      targetSnapshot: { sets: sets[item.id]?.length || item.targetSets, value: item.targetValue, unit: item.targetUnit },
      constraintsConfirmed: selectedExercise && items.length === 1 ? !mastery?.manual || constraintsConfirmed : undefined,
    }));
    return cleanSession({ id: sessionId.current, workoutId, workoutName: workout?.name || '自选训练',
      startedAt: startedAt.current.toISOString(), completedAt: new Date().toISOString(), trainingDate,
      durationSeconds: Math.max(1, Math.floor((Date.now() - startedAt.current.getTime()) / 1000)),
      exercises: sessionExercises, totalReps: 0, kind: 'strength', quality,
      completion: finalized && completedCount === allSetCount ? 'complete' : 'partial',
    });
  };
  const draftFactory = useRef(createRecord);
  draftFactory.current = createRecord;
  useEffect(() => {
    if (finishing.current) return;
    const record = draftFactory.current();
    if (!record.exercises.length && !draftSaved.current) return;
    draftSaved.current = record.exercises.length > 0;
    const operation = record.exercises.length ? saveSession(record) : deleteSession(sessionId.current);
    void operation.catch(() => { if (!finishing.current) setError('自动暂存失败，请保持此页打开，并在结束时重试保存。'); });
  }, [sets, items, saveSession, deleteSession]);

  const save = async (quality?: SessionQuality, leave = false) => {
    if (finishing.current) return;
    if (!completedCount) {
      if (!leave) { setError('请先勾选实际完成的组。'); return; }
      finishing.current = true; setSaving(true);
      try { await deleteSession(sessionId.current); stopTimer(); onBack(); }
      catch { finishing.current = false; setSaving(false); setError('清理空记录失败，请重试退出。'); }
      return;
    }
    if (invalidCheckedSet()) { setError('请检查已勾选组：次数和秒数应为正整数，距离应大于 0。'); return; }
    finishing.current = true; setSaving(true); setError('');
    try {
      await saveSession(createRecord(quality, true));
      stopTimer();
      if (leave) onBack(); else onComplete();
    } catch {
      finishing.current = false; setSaving(false); setShowQuality(false);
      setError('保存失败，已勾选内容仍在本页，请重试。');
    }
  };
  const confirmExit = () => {
    if (saving) return;
    confirmAction(completedCount ? '保存并退出训练？' : '退出本次训练？', completedCount ? '只保存已勾选的 ' + completedCount + ' 组，未勾选的组不会计入记录。' : '尚未勾选任何组，退出不会产生空记录。', () => { void save(undefined, true); }, { confirmLabel: completedCount ? '保存并退出' : '退出', cancelLabel: '继续训练' });
  };
  exitHandler.current = confirmExit;

  const toggleSet = (setIndex: number) => {
    if (!current || saving) return;
    const previous = currentSets[setIndex];
    const value = Number(previous.reps);
    if (!previous.completed && (!Number.isFinite(value) || value <= 0 || (current.targetUnit !== 'meters' && !Number.isInteger(value)))) { setError('填写实际完成数量后再勾选。'); return; }
    setSets((old) => ({ ...old, [current.id]: old[current.id].map((set, i) => i === setIndex ? { ...set, completed: !set.completed, completedAt: set.completed ? undefined : new Date().toISOString() } : set) }));
    setError('');
    if (!previous.completed) {
      if (settings.vibration) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      if (completedCount + 1 < allSetCount) startTimer('rest', current.restSeconds || settings.restSeconds);
      else stopTimer();
    }
  };
  const addSet = () => {
    if (!current) return;
    setSets((old) => ({ ...old, [current.id]: [...old[current.id], { reps: String(current.targetValue), completed: false }] }));
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
    if (!completedCount) { setError('请先勾选实际完成的组。'); return; }
    if (invalidCheckedSet()) { setError('已勾选组的数量有误，请修正后保存。'); return; }
    if (completedCount < allSetCount) confirmAction('保存部分训练？', '只记录已勾选的 ' + completedCount + ' 组，剩余 ' + (allSetCount - completedCount) + ' 组不会记入。', () => setShowQuality(true), { confirmLabel: '记录已完成组' });
    else setShowQuality(true);
  };

  if (!profile || !workout || !current) return <UITheme><SafeAreaView style={styles.safe}><View style={styles.empty}><Text style={styles.actionTitle}>当前没有可训练动作</Text><Text style={styles.note}>请查看今日页的倒立解锁条件；颈桥还需标准桥基础及适宜性确认。可先选择准备动作。</Text><Button label="返回" onPress={onBack} /></View></SafeAreaView></UITheme>;

  return <UITheme><SafeAreaView style={styles.safe}>
    <View style={styles.top}><Pressable disabled={saving} accessibilityRole="button" accessibilityLabel="保存并退出训练" onPress={confirmExit} style={styles.close}><AppGlyph name="back" color={colors.ink} /></Pressable><View style={{ flex: 1 }}><Text testID="training-screen-title" style={styles.workoutName}>训练中</Text><Text style={styles.topSub}>{completedCount} / {allSetCount} 组完成 · 预计 {estimate.totalMinutes} 分钟</Text></View><View style={styles.elapsedBox}><Text style={styles.clockLabel}>训练计时</Text><Text style={styles.elapsed}>{timeLabel(elapsed)}</Text></View></View>
    <View style={styles.overallProgress}><ProgressBar value={completedCount / Math.max(1, allSetCount) * 100} color={colors.lime} /></View>
    <ScrollView testID="training-scroll" contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" accessibilityLabel="查看今日热身动作" onPress={() => setShowWarmup(true)} style={styles.warmup}><View style={{ flex: 1 }}><Text style={styles.warmupTitle}>{warmupDone ? '✓ 已完成热身' : '先做热身'} · 约 {Math.ceil(estimate.warmupSeconds / 60)} 分钟</Text><Text style={styles.note}>查看具体动作与热身组 · 不计入正式组</Text></View><Text style={styles.arrow}>›</Text></Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exerciseTabs}>{items.map((item, position) => <Pressable key={item.id} onPress={() => setIndex(position)} style={[styles.exerciseTab, position === index && styles.exerciseTabActive]}><Text style={[styles.exerciseTabText, position === index && styles.exerciseTabTextActive]}>{position + 1}. {item.name}</Text></Pressable>)}</ScrollView>
      <Animated.View testID="training-action-reveal" style={[styles.actionCard, { opacity: actionReveal, transform: [{ translateY: actionReveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
        <View style={styles.actionInfo}><Text style={styles.eyebrow}>动作 {index + 1} / {items.length}{current.step ? ' · 第 ' + current.step + ' 式' : ''}</Text><View style={styles.actionHeading}><Text style={styles.actionTitle}>{current.name}</Text><Pressable accessibilityRole="button" accessibilityLabel="查看当前动作指导" onPress={() => setShowGuide(true)} style={styles.link}><Text style={styles.linkText}>动作指导与原文  ›</Text></Pressable></View></View>
        <ExerciseMedia key={current.id} exercise={current} minHeight={100} maxHeight={190} testID="training-action-photo" style={styles.actionStage} />
        <View style={styles.actionFooter}><Text style={styles.prescription}>{currentSets.length} 组 × {current.targetValue} {unitLabel(current.targetUnit)} · 休息 {current.restSeconds} 秒{current.targetUnit !== 'seconds' ? ' · RIR ' + (rirTarget ?? current.defaultPrescription?.rirTarget ?? 2) : ''}</Text>
          {current.id === 'aux_singleLegCalf' ? <Text style={styles.tempo}>每组左右各 {current.targetValue / 2} 次；记录两侧实际合计，双侧完成后打钩。</Text> : null}
          {current.category === 'hspu' || current.riskLevel === 'high' ? <Text style={styles.risk}>解锁不等于安全评估。头颈、肩腕不适时停止；倒立应在合适防护和专业指导下练习。</Text> : null}
        </View>
      </Animated.View>
      <View testID="training-timer-card" style={styles.timerPanel}><Text style={styles.clockLabel}>{timerKind === 'hold' ? '动作保持' : '组间休息'}{paused ? ' · 已暂停' : ''}</Text><Text testID="training-rest-time" numberOfLines={1} accessibilityRole="timer" style={styles.countdown}>{timeLabel(timerKind ? remaining : current.restSeconds)}</Text><View style={styles.timerActions}>
        {timerKind ? <><Pressable accessibilityRole="button" onPress={togglePause} style={styles.timerButton}><Text style={styles.timerButtonText}>{paused ? '继续' : '暂停'}</Text></Pressable>{timerKind === 'rest' ? <Pressable accessibilityRole="button" onPress={extendRest} style={styles.timerButton}><Text style={styles.timerButtonText}>＋30 秒</Text></Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel={timerKind === 'rest' ? '结束休息' : '停止计时'} onPress={stopTimer} style={styles.timerButton}><Text style={styles.timerButtonText}>{timerKind === 'rest' ? '跳过休息' : '停止计时'}</Text></Pressable></> : <Pressable accessibilityRole="button" onPress={() => startTimer(current.targetUnit === 'seconds' ? 'hold' : 'rest', current.targetUnit === 'seconds' ? Number(currentSets.find(set => !set.completed)?.reps) || current.targetValue : current.restSeconds)} style={styles.timerButton}><Text style={styles.timerButtonText}>{current.targetUnit === 'seconds' ? '开始保持计时' : '手动开始休息'}</Text></Pressable>}
      </View></View>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>训练组</Text><Pressable accessibilityRole="button" disabled={saving} onPress={addSet} style={styles.addSet}><Text style={styles.addSetText}>＋ 加一组</Text></Pressable></View>
      <View style={styles.tableHeader}><Text style={styles.colNumber}>组</Text><Text style={styles.colValue}>实际完成 / {unitLabel(current.targetUnit)}</Text><Text style={styles.colCheck}>完成</Text></View>
      {currentSets.map((set, setIndex) => <View key={setIndex} style={[styles.setRow, set.completed && styles.setRowDone]}>
        <Text style={styles.setNumber}>{String(setIndex + 1).padStart(2, '0')}</Text>
        <View style={styles.inputColumn}><TextInput accessibilityLabel={'第' + (setIndex + 1) + '组' + unitLabel(current.targetUnit)} editable={!saving} value={set.reps} onChangeText={(value) => setSets((old) => ({ ...old, [current.id]: old[current.id].map((entry, i) => i === setIndex ? { ...entry, reps: value } : entry) }))} keyboardType={current.targetUnit === 'meters' ? 'decimal-pad' : 'number-pad'} selectTextOnFocus style={styles.repsInput} />
          {!set.completed && setIndex >= current.targetSets ? <Pressable accessibilityLabel={'移除新增的第' + (setIndex + 1) + '组'} onPress={() => setSets((old) => ({ ...old, [current.id]: old[current.id].filter((_, i) => i !== setIndex) }))} style={styles.removeSet}><Text style={styles.note}>移除</Text></Pressable> : null}
        </View>
        <View style={styles.checkColumn}><Pressable disabled={saving} accessibilityRole="checkbox" accessibilityLabel={'第' + (setIndex + 1) + '组完成'} accessibilityState={{ checked: set.completed, disabled: saving }} aria-checked={set.completed} aria-disabled={saving} onPress={() => toggleSet(setIndex)} style={[styles.check, set.completed && styles.checkDone]}><Text style={styles.checkText}>{set.completed ? '✓' : ''}</Text></Pressable></View>
      </View>)}
      <View style={styles.inlineTools}><Pressable accessibilityRole="button" disabled={saving} onPress={() => setShowPicker(true)} style={styles.secondaryButton}><Text style={styles.secondaryText}>＋ 添加动作</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setShowPrehab(true)} style={styles.secondaryButton}><Text style={styles.secondaryText}>训练安全 ›</Text></Pressable></View>
      <Text style={styles.helper}>已勾选组自动暂存到本机。计时结束不会自动打钩；请按实际完成数量填写。</Text>
      <Pressable onPress={() => setShowCooldown(true)} style={styles.cooldownLink}><Text style={styles.linkText}>查看训练后整理建议  ›</Text></Pressable>
    </ScrollView>
    <View style={styles.bottom}>{error ? <Text style={styles.error}>{error}</Text> : null}<View style={styles.navigation}>{index > 0 ? <Pressable disabled={saving} onPress={() => setIndex(index - 1)} style={styles.previous}><Text style={styles.secondaryText}>上一个</Text></Pressable> : null}<View style={{ flex: 1 }}><Button label={saving ? '保存中…' : index < items.length - 1 ? '下一个动作 →' : '保存训练'} variant="lime" disabled={saving} onPress={() => index < items.length - 1 ? setIndex(index + 1) : requestFinish()} /></View>{index < items.length - 1 ? <Pressable disabled={saving} onPress={requestFinish} style={styles.previous}><Text style={styles.secondaryText}>结束</Text></Pressable> : null}</View></View>
    <ExercisePicker visible={showPicker} onClose={() => setShowPicker(false)} onSelect={addExercise} excludedIds={items.map((item) => item.id)} />
    <Modal transparent visible={showGuide} animationType="fade" onRequestClose={() => setShowGuide(false)}><View style={styles.shade}><View style={styles.sheet}><View style={styles.modalHead}><Text style={styles.modalTitle}>{current.name}</Text><Pressable accessibilityLabel="关闭动作指导" onPress={() => setShowGuide(false)} style={styles.close}><Text style={styles.modalClose}>×</Text></Pressable></View><ScrollView contentContainerStyle={styles.guideContent}><ExerciseDetailedGuide key={current.id} exercise={current} /></ScrollView><View style={styles.modalFoot}><Button label="返回训练" variant="lime" onPress={() => setShowGuide(false)} /></View></View></View></Modal>
    <Modal visible={showWarmup} animationType="slide" onRequestClose={() => setShowWarmup(false)}><WarmupGuide items={items} minutes={estimate.warmupSeconds / 60} onSkip={() => setShowWarmup(false)} onComplete={() => { setWarmupDone(true); setShowWarmup(false); }} /></Modal>
    <Modal visible={showCooldown} animationType="slide" onRequestClose={() => setShowCooldown(false)}><CooldownGuide minutes={estimate.cooldownSeconds / 60} onComplete={() => setShowCooldown(false)} /></Modal>
    <PrehabGuideModal visible={showPrehab} onClose={() => setShowPrehab(false)} profile={profile} />
    <Modal transparent visible={showQuality} animationType="fade" onRequestClose={() => { if (!saving) setShowQuality(false); }}><View style={styles.shade}><View style={[styles.sheet, styles.qualitySheet]}>
      <Text style={styles.eyebrow}>本次记录 · {completedCount} 组</Text><Text style={[styles.modalTitle, { flex: 0 }]}>训练感觉如何？</Text><Text style={styles.helper}>{selectedExercise && items.length === 1 ? '动作稳定且满足专项标准的完整记录，才能计入进阶。' : '未勾选的组和未练的动作不会写入记录。'}</Text>
      {selectedExercise && mastery?.manual && items.length === 1 ? <Pressable disabled={saving} onPress={() => setConstraintsConfirmed((value) => !value)} style={styles.criteria}><Text style={styles.secondaryText}>{constraintsConfirmed ? '☑' : '□'} 已按完整标准完成</Text><Text style={styles.note}>{mastery.display}{mastery.confirmationHint ? ' · ' + mastery.confirmationHint : ''}</Text></Pressable> : null}
      {([{ value: 'solid', title: '动作稳定', detail: '可控完成，仍有余力' }, { value: 'hard', title: '有些勉强', detail: '后续需要调整难度或训练量' }, { value: 'pain', title: '出现不适', detail: '停止相关动作，优先处理疼痛' }] as const).map((option) => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={'按' + option.title + '保存训练'} disabled={saving || (option.value === 'solid' && !!selectedExercise && items.length === 1 && !!mastery?.manual && !constraintsConfirmed)} onPress={() => void save(option.value)} style={[styles.qualityOption, option.value === 'pain' && styles.qualityPain, (saving || (option.value === 'solid' && !!selectedExercise && items.length === 1 && !!mastery?.manual && !constraintsConfirmed)) && { opacity: .4 }]}><Text style={styles.secondaryText}>{option.title}</Text><Text style={styles.note}>{option.detail}</Text></Pressable>)}
      <Pressable disabled={saving} onPress={() => setShowQuality(false)} style={styles.cooldownLink}><Text style={styles.linkText}>{saving ? '保存中…' : '返回训练'}</Text></Pressable>
    </View></View></Modal>
  </SafeAreaView></UITheme>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: appPalette.background }, empty: { ...progressPageLayout.content, paddingTop: 24, gap: 20 },
  top: { minHeight: 72, maxWidth: 440, width: '100%', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  close: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }, workoutName: { ...progressPageLayout.title, color: colors.ink }, topSub: { color: colors.inkMuted, fontSize: 10, lineHeight: 17, marginTop: 3 }, elapsedBox: { alignItems: 'flex-end' }, clockLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' }, elapsed: { color: colors.inkMuted, fontSize: 16, lineHeight: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  overallProgress: { maxWidth: 408, width: '100%', alignSelf: 'center', paddingHorizontal: 16 },
  content: { ...progressPageLayout.content, paddingBottom: 24 },
  warmup: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 54, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, marginBottom: 10 }, warmupTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' }, note: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 3 }, arrow: { color: colors.lime, fontSize: 22 },
  exerciseTabs: { gap: 7, paddingBottom: 10 }, exerciseTab: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 12 }, exerciseTabActive: { backgroundColor: appPalette.olive, borderColor: appPalette.oliveBorder }, exerciseTabText: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' }, exerciseTabTextActive: { color: colors.lime },
  actionCard: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }, actionInfo: { paddingHorizontal: 14, paddingTop: 12 }, actionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, actionTitle: { ...progressPageLayout.actionTitle, color: colors.ink, flex: 1, lineHeight: 23 }, eyebrow: { color: colors.lime, fontSize: 10, fontWeight: '700', marginBottom: 4 },
  actionStage: { borderRadius: 0 }, actionFooter: { paddingHorizontal: 14, paddingVertical: 10 }, prescription: { color: colors.inkMuted, fontSize: 11, lineHeight: 18 }, tempo: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 6 }, risk: { color: appPalette.warning, backgroundColor: appPalette.warningBackground, borderRadius: 12, padding: 11, fontSize: 11, lineHeight: 18, marginTop: 8 },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }, linkText: { color: colors.green, fontSize: 11, fontWeight: '700' },
  timerPanel: { marginTop: 12, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, padding: 14, alignItems: 'center' }, countdown: { color: colors.ink, fontSize: 56, lineHeight: 68, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 1, marginVertical: 3 }, timerActions: { flexDirection: 'row', gap: 8, width: '100%' }, timerButton: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, borderRadius: 12, backgroundColor: appPalette.raised, borderWidth: 1, borderColor: colors.line }, timerButtonText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }, sectionTitle: { ...progressPageLayout.sectionTitle, color: colors.ink }, addSet: { minHeight: 44, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }, addSetText: { color: colors.lime, fontSize: 12, fontWeight: '800' },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8 }, colNumber: { width: 44, textAlign: 'center', color: colors.inkMuted, fontSize: 11 }, colValue: { flex: 1, textAlign: 'center', color: colors.inkMuted, fontSize: 11 }, colCheck: { width: 56, textAlign: 'center', color: colors.inkMuted, fontSize: 11 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, minHeight: 58, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, marginBottom: 7 }, setRowDone: { backgroundColor: appPalette.olive, borderColor: appPalette.oliveBorder }, setNumber: { width: 44, textAlign: 'center', fontSize: 13, fontWeight: '800', color: colors.inkMuted },
  inputColumn: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 }, repsInput: { textAlign: 'center', color: colors.ink, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], paddingVertical: 7, width: 78, minHeight: 44, borderRadius: 10, backgroundColor: appPalette.raised }, removeSet: { paddingHorizontal: 10, minHeight: 44, justifyContent: 'center' },
  checkColumn: { width: 56, alignItems: 'center' }, check: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#697587', alignItems: 'center', justifyContent: 'center' }, checkDone: { backgroundColor: colors.lime, borderColor: colors.lime }, checkText: { fontWeight: '900', fontSize: 20, color: appPalette.onLime },
  inlineTools: { flexDirection: 'row', gap: 8, marginTop: 6 }, secondaryButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }, secondaryText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  helper: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginVertical: 12 }, cooldownLink: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  bottom: { backgroundColor: appPalette.background, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.line }, navigation: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 408, width: '100%', alignSelf: 'center' }, previous: { paddingHorizontal: 12, height: 44, justifyContent: 'center' }, error: { color: colors.danger, textAlign: 'center', fontSize: 12, lineHeight: 19, marginBottom: 9 },
  shade: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,.72)' }, sheet: { width: '100%', maxWidth: 440, maxHeight: '90%', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 20, overflow: 'hidden' }, modalHead: { flexDirection: 'row', alignItems: 'center', padding: 16 }, modalTitle: { flex: 1, color: colors.ink, fontSize: 20, fontWeight: '900' }, modalClose: { color: colors.inkMuted, fontSize: 28 }, guideContent: { paddingHorizontal: 16, paddingBottom: 20 }, modalFoot: { padding: 16 }, qualitySheet: { padding: 16 }, qualityOption: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, marginTop: 9 }, qualityPain: { backgroundColor: '#302322' }, criteria: { padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
});
