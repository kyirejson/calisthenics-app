import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Button, ProgressBar } from '../components/ui';
import { ExerciseDetailedGuide, ExercisePhoto } from '../components/ExerciseResource';
import { ExercisePicker } from '../components/ExercisePicker';
import { WarmupGuide, CooldownGuide } from '../components/WarmupCooldown';
import { PrehabGuideModal } from '../components/PrehabGuide';
import { canAddExercise, exercises, getWorkout, getWorkoutExercises } from '../data/catalog';
import { parseMasteryCriteria } from '../data/progression';
import { estimateStrengthSession, prescribeAddedExercise, type PrescribedExercise, type TargetUnit } from '../data/trainingPrescription';
import { getPlanDay } from '../data/trainingPlans';
import { cleanSession, dailyWorkoutKey, trainingDateKey } from '../data/sessionRecords';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import type { Exercise, SessionExercise, TrainingSession } from '../types';
import { confirmAction } from '../utils/confirm';

type SetState = { reps: string; completed: boolean; completedAt?: string };
type SessionQuality = NonNullable<TrainingSession['quality']>;
type TrainingProps = { workoutId: string; exerciseId?: string; setMultiplier?: number; rirTarget?: number; onBack: () => void; onComplete: () => void };
const unitLabel = (unit: TargetUnit) => ({ reps: '次', seconds: '秒', steps: '步', meters: '米' })[unit];
const timeLabel = (seconds: number) => String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(Math.max(0, seconds % 60)).padStart(2, '0');
const initialSets = (item: PrescribedExercise) => Array.from({ length: item.targetSets }, () => ({ reps: String(item.targetValue), completed: false }));

export function TrainingScreen({ workoutId, exerciseId, setMultiplier = 1, rirTarget, onBack, onComplete }: TrainingProps) {
  const viewportWidth = useWindowDimensions().width;
  const narrow = viewportWidth < 360;
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

  if (!profile || !workout || !current) return <SafeAreaView style={styles.safe}><View style={styles.empty}><Text style={styles.actionTitle}>当前没有可训练动作</Text><Text style={styles.note}>请查看今日页的倒立解锁条件；颈桥还需标准桥基础及适宜性确认。可先选择准备动作。</Text><Button label="返回" onPress={onBack} /></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <View style={styles.top}><Pressable disabled={saving} accessibilityLabel="保存并退出训练" onPress={confirmExit} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.workoutName}>{workout.name}</Text><Text style={styles.topSub}>{completedCount} / {allSetCount} 组完成 · 预计 {estimate.totalMinutes} 分钟</Text></View><View style={styles.elapsedBox}><Text style={styles.clockLabel}>训练计时</Text><Text style={styles.elapsed}>{timeLabel(elapsed)}</Text></View></View>
    <ProgressBar value={completedCount / Math.max(1, allSetCount) * 100} color={colors.lime} />
    {timerKind ? <View style={[styles.timerPanel, narrow && styles.timerPanelNarrow]}><View style={styles.timerMain}><Text style={styles.clockLabel}>{timerKind === 'rest' ? '组间休息' : '动作保持'}{paused ? ' · 已暂停' : ''}</Text><Text numberOfLines={1} accessibilityRole="timer" style={[styles.countdown, narrow && styles.countdownNarrow]}>{timeLabel(remaining)}</Text></View><View style={[styles.timerActions, narrow && styles.timerActionsNarrow]}><Pressable onPress={togglePause} style={styles.timerButton}><Text style={styles.timerButtonText}>{paused ? '继续' : '暂停'}</Text></Pressable>{timerKind === 'rest' ? <Pressable onPress={extendRest} style={styles.timerButton}><Text style={styles.timerButtonText}>＋30 秒</Text></Pressable> : null}<Pressable onPress={stopTimer} style={styles.timerButton}><Text style={styles.timerButtonText}>{timerKind === 'rest' ? '结束休息' : '停止计时'}</Text></Pressable></View></View> : null}
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" accessibilityLabel="查看今日热身动作" onPress={() => setShowWarmup(true)} style={styles.warmup}><View style={{ flex: 1 }}><Text style={styles.warmupTitle}>{warmupDone ? '✓ 已完成热身' : '先做热身'} · 约 {Math.ceil(estimate.warmupSeconds / 60)} 分钟</Text><Text style={styles.note}>查看具体动作与热身组 · 不计入正式组</Text></View><Text style={styles.arrow}>›</Text></Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exerciseTabs}>{items.map((item, position) => <Pressable key={item.id} onPress={() => setIndex(position)} style={[styles.exerciseTab, position === index && styles.exerciseTabActive]}><Text style={[styles.exerciseTabText, position === index && styles.exerciseTabTextActive]}>{position + 1}. {item.name}</Text></Pressable>)}</ScrollView>
      <View style={[styles.actionCard, viewportWidth >= 600 && { flexDirection: 'row', alignItems: 'center' }]}>
        <View style={[styles.actionStage, viewportWidth >= 600 && { width: 200, height: 230 }]}><ExercisePhoto exercise={current} resizeMode="contain" showShade={false} showTag={false} /></View>
        <View style={[styles.actionInfo, viewportWidth >= 600 && { flex: 1, minWidth: 0 }]}><Text style={styles.eyebrow}>动作 {index + 1} / {items.length} · {current.categoryLabel || '自选动作'}{current.step ? ' · 第 ' + current.step + ' 式' : ''}</Text><Text style={styles.actionTitle}>{current.name}</Text>
          <View style={styles.metrics}><View style={styles.metric}><Text style={styles.metricValue}>{currentSets.length} × {current.targetValue}<Text style={styles.metricUnit}> {unitLabel(current.targetUnit)}</Text></Text><Text style={styles.note}>组数 × 每组目标</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{current.restSeconds}<Text style={styles.metricUnit}> 秒</Text></Text><Text style={styles.note}>建议组间休息</Text></View></View>
          <Text style={styles.tempo}>{current.defaultPrescription?.tempoDescription || '稳定完成，顺畅呼吸'} · {current.targetUnit === 'seconds' ? '保持可控，不憋气' : '保留约 ' + (rirTarget ?? current.defaultPrescription?.rirTarget ?? 2) + ' 次余力'}</Text>
          {current.id === 'aux_singleLegCalf' ? <Text style={styles.tempo}>每组左右各 {current.targetValue / 2} 次；记录两侧实际合计，双侧完成后打钩。</Text> : null}
          {current.category === 'hspu' || current.riskLevel === 'high' ? <Text style={styles.risk}>解锁不等于安全评估。头颈、肩腕不适时停止；倒立应在合适防护和专业指导下练习。</Text> : null}
          <View style={styles.linkRow}><Pressable onPress={() => setShowGuide(true)} style={styles.link}><Text style={styles.linkText}>动作指导与原文  ›</Text></Pressable><Pressable onPress={() => setShowPrehab(true)} style={styles.link}><Text style={styles.linkText}>训练安全  ›</Text></Pressable></View>
        </View>
      </View>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>训练组</Text><Pressable disabled={saving} onPress={addSet} style={styles.addSet}><Text style={styles.addSetText}>＋ 加一组</Text></Pressable></View>
      <View style={styles.tableHeader}><Text style={styles.colNumber}>组</Text><Text style={styles.colValue}>实际完成 / {unitLabel(current.targetUnit)}</Text><Text style={styles.colCheck}>完成</Text></View>
      {currentSets.map((set, setIndex) => <View key={setIndex} style={[styles.setRow, set.completed && styles.setRowDone]}>
        <Text style={styles.setNumber}>{String(setIndex + 1).padStart(2, '0')}</Text>
        <View style={styles.inputColumn}><TextInput accessibilityLabel={'第' + (setIndex + 1) + '组' + unitLabel(current.targetUnit)} editable={!saving} value={set.reps} onChangeText={(value) => setSets((old) => ({ ...old, [current.id]: old[current.id].map((entry, i) => i === setIndex ? { ...entry, reps: value } : entry) }))} keyboardType={current.targetUnit === 'meters' ? 'decimal-pad' : 'number-pad'} selectTextOnFocus style={styles.repsInput} />
          {!set.completed && setIndex >= current.targetSets ? <Pressable accessibilityLabel={'移除新增的第' + (setIndex + 1) + '组'} onPress={() => setSets((old) => ({ ...old, [current.id]: old[current.id].filter((_, i) => i !== setIndex) }))} style={styles.removeSet}><Text style={styles.note}>移除</Text></Pressable> : null}
        </View>
        <View style={styles.checkColumn}><Pressable disabled={saving} accessibilityRole="checkbox" accessibilityLabel={'第' + (setIndex + 1) + '组完成'} accessibilityState={{ checked: set.completed }} onPress={() => toggleSet(setIndex)} style={[styles.check, set.completed && styles.checkDone]}><Text style={styles.checkText}>{set.completed ? '✓' : ''}</Text></Pressable></View>
      </View>)}
      <View style={styles.inlineTools}>{current.targetUnit === 'seconds' ? <Pressable onPress={() => startTimer('hold', Number(currentSets.find((set) => !set.completed)?.reps) || current.targetValue)} style={styles.secondaryButton}><Text style={styles.secondaryText}>开始保持计时</Text></Pressable> : <Pressable onPress={() => startTimer('rest', current.restSeconds)} style={styles.secondaryButton}><Text style={styles.secondaryText}>手动开始休息</Text></Pressable>}<Pressable disabled={saving} onPress={() => setShowPicker(true)} style={styles.secondaryButton}><Text style={styles.secondaryText}>＋ 添加动作</Text></Pressable></View>
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
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  timerPanelNarrow: { paddingHorizontal: 16, gap: 8 }, timerActionsNarrow: { maxWidth: 100 }, countdownNarrow: { fontSize: 44, lineHeight: 52 },
  safe: { flex: 1, backgroundColor: '#F3F5EF' }, empty: { padding: 26, gap: 20 },
  top: { minHeight: 86, backgroundColor: colors.ink, paddingHorizontal: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  close: { width: 42, height: 44, justifyContent: 'center', alignItems: 'center' }, closeText: { color: '#E8EBDD', fontSize: 30 }, workoutName: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, topSub: { color: '#A7B198', fontSize: 10, marginTop: 7 },
  elapsedBox: { alignItems: 'flex-end', paddingRight: 5 }, clockLabel: { color: '#BDC9AC', fontSize: 11, fontWeight: '700' }, elapsed: { color: colors.lime, fontSize: 30, lineHeight: 37, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  timerPanel: { backgroundColor: '#252E1D', paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, timerMain: { flex: 1 }, countdown: { color: '#E5F8B3', fontSize: 56, lineHeight: 62, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  timerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, maxWidth: 162, justifyContent: 'flex-end' }, timerButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#3B482E' }, timerButtonText: { color: '#E2ECCF', fontSize: 12, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 24, maxWidth: 720, width: '100%', alignSelf: 'center' }, warmup: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#E9EEDC', borderRadius: 16, marginBottom: 12 }, warmupTitle: { color: '#415326', fontSize: 13, fontWeight: '800' }, note: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 3 }, arrow: { color: '#415326', fontSize: 25 },
  exerciseTabs: { gap: 7, paddingBottom: 14 }, exerciseTab: { backgroundColor: '#E6E9DF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }, exerciseTabActive: { backgroundColor: colors.ink }, exerciseTabText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' }, exerciseTabTextActive: { color: '#E4F2C5' },
  actionCard: { backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }, actionStage: { height: 180, backgroundColor: '#E9EDE1' }, actionInfo: { padding: 17 }, eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', marginBottom: 6 }, actionTitle: { color: colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -.5 },
  metrics: { flexDirection: 'row', gap: 12, marginTop: 15 }, metric: { flex: 1, padding: 12, backgroundColor: '#F3F5EF', borderRadius: 12 }, metricValue: { color: colors.ink, fontSize: 21, fontWeight: '900', fontVariant: ['tabular-nums'] }, metricUnit: { fontSize: 11, fontWeight: '600' }, tempo: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 12 }, risk: { color: '#946132', backgroundColor: '#FFF4DF', borderRadius: 10, padding: 11, fontSize: 11, lineHeight: 18, marginTop: 12 },
  linkRow: { flexDirection: 'row', gap: 16, marginTop: 8 }, link: { paddingVertical: 9 }, linkText: { color: colors.green, fontSize: 12, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }, sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' }, addSet: { minHeight: 40, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#E5EBCF' }, addSetText: { color: '#455B25', fontSize: 13, fontWeight: '800' },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 13, paddingBottom: 9 }, colNumber: { width: 44, textAlign: 'center', color: colors.inkMuted, fontSize: 11 }, colValue: { flex: 1, textAlign: 'center', color: colors.inkMuted, fontSize: 11 }, colCheck: { width: 56, textAlign: 'center', color: colors.inkMuted, fontSize: 11 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, minHeight: 66, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 15, marginBottom: 9 }, setRowDone: { backgroundColor: '#EEF4DE', borderColor: '#CCD9A8' }, setNumber: { width: 44, textAlign: 'center', fontSize: 14, fontWeight: '800', color: colors.inkMuted }, inputColumn: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 }, repsInput: { textAlign: 'center', color: colors.ink, fontSize: 25, fontWeight: '800', fontVariant: ['tabular-nums'], paddingVertical: 5, width: 90, borderRadius: 10, backgroundColor: '#F5F6F0' }, removeSet: { paddingHorizontal: 10, paddingVertical: 3 }, checkColumn: { width: 56, alignItems: 'center' }, check: { width: 44, height: 44, borderRadius: 14, borderWidth: 2, borderColor: '#D7DDCB', alignItems: 'center', justifyContent: 'center' }, checkDone: { backgroundColor: colors.lime, borderColor: colors.lime }, checkText: { fontWeight: '900', fontSize: 21, color: colors.ink },
  inlineTools: { flexDirection: 'row', gap: 10, marginTop: 8 }, secondaryButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: '#D5DDC6', backgroundColor: '#F8FAF4' }, secondaryText: { color: colors.ink, fontSize: 13, fontWeight: '800' }, helper: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginVertical: 12 }, cooldownLink: { paddingVertical: 12, alignItems: 'center' },
  bottom: { backgroundColor: '#F3F5EF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.line }, navigation: { flexDirection: 'row', alignItems: 'center', gap: 9, maxWidth: 720, width: '100%', alignSelf: 'center' }, previous: { paddingHorizontal: 13, height: 48, justifyContent: 'center' }, error: { color: colors.danger, textAlign: 'center', fontSize: 12, marginBottom: 9 },
  shade: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(12,16,8,.65)' }, sheet: { width: '100%', maxWidth: 600, maxHeight: '90%', backgroundColor: colors.paper, borderRadius: radius.lg, overflow: 'hidden' }, modalHead: { flexDirection: 'row', alignItems: 'center', padding: 16 }, modalTitle: { flex: 1, color: colors.ink, fontSize: 22, fontWeight: '900' }, modalClose: { color: colors.ink, fontSize: 28 }, guideContent: { paddingHorizontal: 18, paddingBottom: 20 }, modalFoot: { padding: 15 }, qualitySheet: { padding: 22 }, qualityOption: { backgroundColor: '#EAF0DD', borderRadius: 14, padding: 15, marginTop: 9 }, qualityPain: { backgroundColor: '#F9E7E0' }, criteria: { padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
});
