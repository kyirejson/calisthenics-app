import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, ProgressBar } from '../components/ui';
import { ExerciseInstructions, ExercisePhoto } from '../components/ExerciseResource';
import { exercises, getWorkout, getWorkoutExercises } from '../data/catalog';
import { parseMasteryCriteria } from '../data/progression';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import type { Exercise, SessionExercise, TrainingSession } from '../types';
import { confirmAction } from '../utils/confirm';

type SetState = { reps: string; completed: boolean };
type ExerciseUnit = NonNullable<SessionExercise['sets'][number]['unit']>;
type SessionQuality = NonNullable<TrainingSession['quality']>;
type TrainingProps = {
  workoutId: string;
  exerciseId?: string;
  setMultiplier?: number;
  rirTarget?: number;
  onBack: () => void;
  onComplete: () => void;
};

export function TrainingScreen({ workoutId, exerciseId, setMultiplier = 1, rirTarget, onBack, onComplete }: TrainingProps) {
  const { profile, settings, saveSession } = useAppStore();
  const selectedExercise = useMemo(() => exerciseId ? exercises.find((item) => item.id === exerciseId) : undefined, [exerciseId]);
  const masteryCriteria = useMemo(() => selectedExercise ? parseMasteryCriteria(selectedExercise) : undefined, [selectedExercise]);
  const workout = selectedExercise
    ? { id: workoutId, name: `${selectedExercise.name}专项`, description: '单动作训练', estimatedMinutes: 12, slots: [] }
    : getWorkout(workoutId);
  const items = useMemo(() => {
    if (!profile) return [];
    if (selectedExercise) {
      const mastery = masteryCriteria || parseMasteryCriteria(selectedExercise);
      return [{
        ...selectedExercise,
        targetSets: Math.max(1, mastery.sets),
        restSeconds: selectedExercise.defaultPrescription?.restSeconds || settings.restSeconds,
      }];
    }
    return getWorkoutExercises(workoutId, profile, setMultiplier);
  }, [masteryCriteria, profile, selectedExercise, setMultiplier, settings.restSeconds, workoutId]);
  const startedAt = useRef(new Date());
  const isFinishing = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [index, setIndex] = useState(0);
  const [rest, setRest] = useState(0);
  const [showQuality, setShowQuality] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [finishError, setFinishError] = useState('');
  const [constraintsConfirmed, setConstraintsConfirmed] = useState(false);
  const [sets, setSets] = useState<Record<string, SetState[]>>(() => Object.fromEntries(items.map((item) => {
    const target = getExerciseTarget(item, !!exerciseId);
    return [item.id, Array.from({ length: item.targetSets }, () => ({ reps: `${target.value}`, completed: false }))];
  })));
  const current = items[index];

  useEffect(() => { const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current.getTime()) / 1000)), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (rest <= 0) return; const id = setInterval(() => setRest((value) => { if (value <= 1) { if (settings.vibration) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); return 0; } return value - 1; }), 1000); return () => clearInterval(id); }, [rest, settings.vibration]);

  if (!profile || !current) return null;
  const currentSets = sets[current.id] || [];
  const allSetCount = Object.values(sets).flat().length;
  const completedCount = Object.values(sets).flat().filter((item) => item.completed).length;
  const currentTarget = getExerciseTarget(current, !!exerciseId);
  const currentRirTarget = Math.max(0, Math.round(rirTarget ?? current.defaultPrescription?.rirTarget ?? 2));

  const toggleSet = (setIndex: number) => {
    const next = currentSets.map((item, i) => i === setIndex ? { ...item, completed: !item.completed } : item);
    setSets({ ...sets, [current.id]: next });
    setFinishError('');
    if (!currentSets[setIndex].completed) { if (settings.vibration) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setRest(current.restSeconds || settings.restSeconds); }
  };
  const updateReps = (setIndex: number, reps: string) => setSets({ ...sets, [current.id]: currentSets.map((item, i) => i === setIndex ? { ...item, reps } : item) });
  const requestFinish = () => {
    if (completedCount < 1) {
      setFinishError('请至少完成并勾选一组，再结束训练。');
      return;
    }
    const hasInvalidValue = Object.values(sets).flat().some((set) => set.completed && (!Number.isFinite(Number(set.reps)) || Number(set.reps) <= 0));
    if (hasInvalidValue) {
      setFinishError('已完成组的次数或时长必须大于 0。');
      return;
    }
    setFinishError('');
    if (completedCount < allSetCount) {
      confirmAction(
        '保存为部分训练？',
        `还有 ${allSetCount - completedCount} 组未完成。本次记录会保留，但不会完成今日计划，也不会计入动作进阶。`,
        () => setShowQuality(true),
        { confirmLabel: '保存部分训练' },
      );
      return;
    }
    setShowQuality(true);
  };
  const finish = async (quality: SessionQuality) => {
    if (isFinishing.current) return;
    isFinishing.current = true;
    setShowQuality(false);
    const completedAt = new Date();
    const sessionExercises: SessionExercise[] = items.map((item) => {
      const target = getExerciseTarget(item, !!exerciseId);
      return {
        exerciseId: item.id,
        name: item.name,
        category: item.category,
        sets: (sets[item.id] || []).map((set) => ({ reps: Number(set.reps) || 0, completed: set.completed, unit: target.unit })),
        targetSnapshot: { sets: item.targetSets, value: target.value, unit: target.unit },
        constraintsConfirmed: selectedExercise ? (!masteryCriteria?.manual || constraintsConfirmed) : undefined,
      };
    });
    const totalReps = sessionExercises
      .flatMap((item) => item.sets)
      .filter((item) => item.completed && item.unit === 'reps')
      .reduce((sum, item) => sum + item.reps, 0);
    const session: TrainingSession = { id: `session_${Date.now()}`, workoutId, workoutName: workout.name, startedAt: startedAt.current.toISOString(), completedAt: completedAt.toISOString(), durationSeconds: Math.max(elapsed, 1), exercises: sessionExercises, totalReps, kind: 'strength', quality, completion: completedCount === allSetCount ? 'complete' : 'partial' };
    try {
      await saveSession(session);
      if (settings.vibration) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete();
    } catch {
      isFinishing.current = false;
      setFinishError('训练记录保存失败，请重试。');
    }
  };
  const confirmExit = () => confirmAction('结束本次训练？', '尚未保存的组数会丢失。', onBack, { cancelLabel: '继续训练', confirmLabel: '退出', destructive: true });

  return <SafeAreaView style={styles.safe}>
    <View style={styles.top}><Pressable onPress={confirmExit} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable><View style={{ flex: 1 }}><Text style={styles.workoutName}>{workout.name}</Text><Text style={styles.timer}>{formatTime(elapsed)}</Text></View><Text style={styles.step}>{index + 1}/{items.length}</Text></View>
    <ProgressBar value={(completedCount / Math.max(1, allSetCount)) * 100} color={colors.lime} />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.visual}><ExercisePhoto exercise={current} /><View style={styles.visualText}><Text style={styles.category}>{current.categoryLabel || current.category}</Text><Text style={styles.exerciseName}>{current.name}</Text><Text style={styles.exerciseMeta}>{current.defaultPrescription?.tempoDescription || '稳定控制节奏'} · 目标 RIR {currentRirTarget} · 休息 {current.restSeconds} 秒</Text></View></View>
      <Pressable onPress={() => setShowGuide(true)} style={styles.guideShortcut} accessibilityRole="button" accessibilityLabel={`查看${current.name}动作指导`}>
        <View style={styles.guideShortcutContent}><Text style={styles.guideShortcutTitle}>查看动作指导</Text><Text style={styles.guideShortcutSummary}>{current.keyPoints?.length || 0} 个步骤 · {current.commonIssues?.length || 0} 个易错点</Text></View><Text style={styles.guideShortcutArrow}>›</Text>
      </Pressable>
      {current.riskLevel === 'high' ? <Text style={styles.riskNotice}>高风险动作：请在保护与防护垫条件下练习，疼痛时立即停止。</Text> : null}
      <Text style={styles.setHeader}>训练组</Text>
      <View style={styles.tableHeader}><Text style={styles.tableSmall}>组</Text><Text style={styles.tableMain}>{unitHeading(currentTarget.unit)}</Text><Text style={styles.tableDone}>完成</Text></View>
      {currentSets.map((set, setIndex) => <View key={setIndex} style={[styles.setRow, set.completed && styles.setRowDone]}><View style={styles.setNumber}><Text style={styles.setNumberText}>{setIndex + 1}</Text></View><TextInput value={set.reps} onChangeText={(v) => updateReps(setIndex, v)} keyboardType={currentTarget.unit === 'meters' ? 'decimal-pad' : 'number-pad'} selectTextOnFocus style={styles.repsInput} /><Text style={styles.repsUnit}>{unitLabel(currentTarget.unit)}</Text><Pressable onPress={() => toggleSet(setIndex)} style={[styles.check, set.completed && styles.checkDone]}><Text style={[styles.checkText, set.completed && { color: colors.ink }]}>{set.completed ? '✓' : ''}</Text></Pressable></View>)}
      {current.keyPoints?.length ? <View style={styles.cue}><Text style={styles.cueLabel}>本组提示</Text><Text style={styles.cueText}>{current.keyPoints[Math.min(currentSets.filter((set) => set.completed).length, current.keyPoints.length - 1)]}</Text></View> : null}
    </ScrollView>
    {rest > 0 ? <View style={styles.rest}><View><Text style={styles.restLabel}>组间休息</Text><Text style={styles.restTime}>{formatTime(rest)}</Text></View><Pressable onPress={() => setRest(0)} style={styles.skip}><Text style={styles.skipText}>跳过</Text></Pressable></View> : null}
    <View style={styles.bottom}>{finishError ? <Text style={styles.finishError}>{finishError}</Text> : null}<View style={styles.navigationRow}>{index > 0 ? <Pressable onPress={() => setIndex(index - 1)} style={styles.previous}><Text style={styles.previousText}>← 上一个</Text></Pressable> : null}<View style={{ flex: 1 }}><Button label={index === items.length - 1 ? '完成训练' : '下一个动作  →'} variant="lime" onPress={() => index === items.length - 1 ? requestFinish() : setIndex(index + 1)} /></View></View></View>
    <Modal transparent visible={showGuide} animationType="fade" onRequestClose={() => setShowGuide(false)}>
      <View style={styles.modalShade}><View style={styles.guideCard}>
        <View style={styles.guideModalHeader}><View style={{ flex: 1 }}><Text style={styles.guideEyebrow}>动作指导</Text><Text style={styles.guideTitle}>{current.name}</Text></View><Pressable onPress={() => setShowGuide(false)} style={styles.guideClose}><Text style={styles.guideCloseText}>×</Text></Pressable></View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.guideContent}>
          {current.riskLevel === 'high' ? <View style={styles.guideRisk}><Text style={styles.guideRiskText}>请在专业教练或保护者协助下，使用合适防护垫；疼痛或疲劳时停止。</Text></View> : null}
          <ExerciseInstructions exercise={current} />
        </ScrollView>
        <View style={styles.guideFooter}><Button label="返回训练" variant="lime" onPress={() => setShowGuide(false)} /></View>
      </View></View>
    </Modal>
    <Modal transparent visible={showQuality} animationType="fade" onRequestClose={() => setShowQuality(false)}>
      <View style={styles.modalShade}><View style={styles.qualityCard}>
        <Text style={styles.qualityEyebrow}>训练反馈</Text>
        <Text style={styles.qualityTitle}>本次动作质量如何？</Text>
        <Text style={styles.qualityHint}>{selectedExercise ? '连续两次完成专项验收，才会获得进阶资格。' : '用于记录本次训练感受；动作进阶请从动作详情进入专项验收。'}</Text>
        {selectedExercise && masteryCriteria?.manual ? <Pressable onPress={() => setConstraintsConfirmed((value) => !value)} style={[styles.criteriaConfirm, constraintsConfirmed && styles.criteriaConfirmDone]}><View style={[styles.criteriaCheck, constraintsConfirmed && styles.criteriaCheckDone]}><Text style={styles.criteriaCheckText}>{constraintsConfirmed ? '✓' : ''}</Text></View><View style={{ flex: 1 }}><Text style={styles.criteriaConfirmTitle}>我已按完整标准完成</Text><Text style={styles.criteriaConfirmText}>{masteryCriteria.display}{masteryCriteria.confirmationHint ? ` · ${masteryCriteria.confirmationHint}` : ''}</Text></View></Pressable> : null}
        <Pressable disabled={!!selectedExercise && !!masteryCriteria?.manual && !constraintsConfirmed} onPress={() => void finish('solid')} style={[styles.qualityOption, styles.qualitySolid, selectedExercise && masteryCriteria?.manual && !constraintsConfirmed && styles.qualityDisabled]}><Text style={styles.qualityOptionTitle}>动作稳定</Text><Text style={styles.qualityOptionDesc}>全程可控，仍保有目标余力</Text></Pressable>
        <Pressable onPress={() => void finish('hard')} style={[styles.qualityOption, styles.qualityHard]}><Text style={styles.qualityOptionTitle}>有些勉强</Text><Text style={styles.qualityOptionDesc}>完成了，但动作或余力不够稳定</Text></Pressable>
        <Pressable onPress={() => void finish('pain')} style={[styles.qualityOption, styles.qualityPain]}><Text style={[styles.qualityOptionTitle, { color: '#9B2C2C' }]}>出现不适</Text><Text style={styles.qualityOptionDesc}>关节或肌肉出现疼痛，需要调整</Text></Pressable>
        <Pressable onPress={() => setShowQuality(false)} style={styles.qualityCancel}><Text style={styles.qualityCancelText}>返回训练</Text></Pressable>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

function getExerciseTarget(exercise: Exercise, masteryMode = false) {
  if (masteryMode) {
    const mastery = parseMasteryCriteria(exercise);
    return { unit: mastery.unit, value: mastery.value };
  }
  const enriched = exercise as Exercise & {
    isHold?: boolean;
    defaultPrescription?: NonNullable<Exercise['defaultPrescription']> & { holdRange?: number[] };
  };
  const standardsText = Object.values(enriched.standards || {}).join(' ');
  let unit: ExerciseUnit = 'reps';
  if (enriched.isHold || enriched.defaultPrescription?.holdRange?.length) unit = 'seconds';
  else if (standardsText.includes('步')) unit = 'steps';
  else if (standardsText.includes('米')) unit = 'meters';

  let value = enriched.defaultPrescription?.repRange?.[0] || 8;
  if (unit === 'seconds') value = enriched.defaultPrescription?.holdRange?.[0] || readStandardValue(enriched.standards?.beginner, '秒') || 15;
  if (unit === 'meters') value = readStandardValue(enriched.standards?.beginner, '米') || value;
  return { unit, value };
}

function readStandardValue(text: string | undefined, suffix: string) {
  const match = text?.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${suffix}`));
  return match ? Number(match[1]) : 0;
}

function unitLabel(unit: ExerciseUnit) { return ({ reps: '次', seconds: '秒', steps: '步', meters: '米' } as const)[unit]; }
function unitHeading(unit: ExerciseUnit) { return ({ reps: '次数', seconds: '时长', steps: '步数', meters: '距离' } as const)[unit]; }
function formatTime(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, top: { height: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, backgroundColor: colors.ink }, close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, closeText: { color: '#FFFFFF', fontSize: 31, fontWeight: '300' }, workoutName: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }, timer: { color: '#AEB1A8', fontSize: 11, marginTop: 3 }, step: { color: colors.lime, fontWeight: '900', fontSize: 14 }, content: { padding: 18, paddingBottom: 120 },
  visual: { height: 218, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.ink }, visualText: { position: 'absolute', left: 20, right: 20, bottom: 19 }, category: { color: colors.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, exerciseName: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 6 }, exerciseMeta: { color: '#CDD0C8', fontSize: 11, marginTop: 5 },
  guideShortcut: { marginTop: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center' }, guideShortcutContent: { flex: 1 }, guideShortcutTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' }, guideShortcutSummary: { color: colors.inkMuted, fontSize: 11, marginTop: 3 }, guideShortcutArrow: { color: colors.inkMuted, fontSize: 26, lineHeight: 30 }, riskNotice: { color: '#9B2C2C', fontSize: 11, lineHeight: 17, fontWeight: '700', marginTop: 10 },
  setHeader: { color: colors.ink, fontSize: 19, fontWeight: '900', marginTop: 22, marginBottom: 13 }, tableHeader: { flexDirection: 'row', paddingHorizontal: 14, marginBottom: 7 }, tableSmall: { width: 48, color: colors.inkMuted, fontSize: 10, fontWeight: '700' }, tableMain: { flex: 1, color: colors.inkMuted, fontSize: 10, fontWeight: '700' }, tableDone: { width: 52, color: colors.inkMuted, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  setRow: { minHeight: 62, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, marginBottom: 9 }, setRowDone: { backgroundColor: '#F0F6DD', borderColor: '#D2E49A' }, setNumber: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginRight: 13 }, setNumberText: { fontWeight: '900', color: colors.ink }, repsInput: { color: colors.ink, fontSize: 23, fontWeight: '900', minWidth: 45, paddingVertical: 8, textAlign: 'center' }, repsUnit: { color: colors.inkMuted, fontSize: 12, flex: 1 }, check: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#C8C9C4', alignItems: 'center', justifyContent: 'center' }, checkDone: { backgroundColor: colors.lime, borderColor: colors.lime }, checkText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' }, cue: { backgroundColor: '#E7EDFF', borderRadius: radius.md, padding: 15, marginTop: 10 }, cueLabel: { color: colors.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, cueText: { color: '#293A6E', fontSize: 13, lineHeight: 20, marginTop: 5 },
  rest: { position: 'absolute', left: 18, right: 18, bottom: 88, backgroundColor: colors.ink, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 }, restLabel: { color: '#AEB1A8', fontSize: 10 }, restTime: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 2 }, skip: { paddingHorizontal: 16, paddingVertical: 9, backgroundColor: '#34372F', borderRadius: radius.pill }, skipText: { color: colors.lime, fontWeight: '800' }, bottom: { padding: 14, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper }, finishError: { color: '#A43232', fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 9 },
  navigationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, previous: { minHeight: 52, minWidth: 94, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, previousText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  modalShade: { flex: 1, backgroundColor: 'rgba(10,12,9,0.65)', alignItems: 'center', justifyContent: 'center', padding: 22 }, qualityCard: { width: '100%', maxWidth: 440, backgroundColor: colors.paper, borderRadius: radius.lg, padding: 22 }, qualityEyebrow: { color: colors.limeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, qualityTitle: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 7 }, qualityHint: { color: colors.inkMuted, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 17 }, qualityOption: { borderRadius: radius.md, padding: 15, marginBottom: 10, borderWidth: 1 }, qualitySolid: { backgroundColor: '#EEF5D8', borderColor: '#CBDF8E' }, qualityHard: { backgroundColor: '#FFF3DD', borderColor: '#E8C984' }, qualityPain: { backgroundColor: '#FCE8E8', borderColor: '#E8B2B2' }, qualityOptionTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, qualityOptionDesc: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 3 }, qualityCancel: { alignItems: 'center', paddingVertical: 10, marginTop: 2 }, qualityCancelText: { color: colors.inkMuted, fontSize: 13, fontWeight: '800' },
  guideCard: { width: '100%', maxWidth: 480, maxHeight: '85%', backgroundColor: colors.paper, borderRadius: radius.lg, overflow: 'hidden' }, guideModalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }, guideEyebrow: { color: colors.limeDark, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, guideTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', marginTop: 4 }, guideClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, guideCloseText: { color: colors.inkMuted, fontSize: 26, lineHeight: 30 }, guideContent: { paddingHorizontal: 20, paddingBottom: 24 }, guideRisk: { backgroundColor: '#FCEAE7', padding: 12, borderRadius: radius.md, marginTop: 8 }, guideRiskText: { color: '#9B2C2C', fontSize: 12, lineHeight: 18, fontWeight: '700' }, guideFooter: { paddingHorizontal: 20, paddingVertical: 15, borderTopWidth: 1, borderTopColor: colors.line },
  criteriaConfirm: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: '#D0D1CB', backgroundColor: colors.card, padding: 13, marginBottom: 11 }, criteriaConfirmDone: { borderColor: '#A9C93F', backgroundColor: '#F4F8E7' }, criteriaCheck: { width: 26, height: 26, borderRadius: 9, borderWidth: 2, borderColor: '#B7B9B1', alignItems: 'center', justifyContent: 'center', marginRight: 11 }, criteriaCheckDone: { borderColor: colors.limeDark, backgroundColor: colors.lime }, criteriaCheckText: { color: colors.ink, fontWeight: '900' }, criteriaConfirmTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' }, criteriaConfirmText: { color: colors.inkMuted, fontSize: 11, lineHeight: 16, marginTop: 2 }, qualityDisabled: { opacity: 0.42 },
});
