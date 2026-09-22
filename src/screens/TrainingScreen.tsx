import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, ProgressBar } from '../components/ui';
import { getWorkout, getWorkoutExercises } from '../data/catalog';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import type { SessionExercise, TrainingSession } from '../types';

type SetState = { reps: string; completed: boolean };

export function TrainingScreen({ workoutId, onBack, onComplete }: { workoutId: string; onBack: () => void; onComplete: () => void }) {
  const { profile, settings, saveSession } = useAppStore();
  const workout = getWorkout(workoutId);
  const items = useMemo(() => profile ? getWorkoutExercises(workoutId, profile) : [], [workoutId, profile]);
  const startedAt = useRef(new Date());
  const [elapsed, setElapsed] = useState(0);
  const [index, setIndex] = useState(0);
  const [rest, setRest] = useState(0);
  const [sets, setSets] = useState<Record<string, SetState[]>>(() => Object.fromEntries(items.map((item) => [item.id, Array.from({ length: item.targetSets }, () => ({ reps: `${item.defaultPrescription?.repRange?.[0] || 8}`, completed: false }))])));
  const current = items[index];

  useEffect(() => { const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current.getTime()) / 1000)), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (rest <= 0) return; const id = setInterval(() => setRest((value) => { if (value <= 1) { if (settings.vibration) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); return 0; } return value - 1; }), 1000); return () => clearInterval(id); }, [rest, settings.vibration]);

  if (!profile || !current) return null;
  const currentSets = sets[current.id] || [];
  const allSetCount = Object.values(sets).flat().length;
  const completedCount = Object.values(sets).flat().filter((item) => item.completed).length;

  const toggleSet = (setIndex: number) => {
    const next = currentSets.map((item, i) => i === setIndex ? { ...item, completed: !item.completed } : item);
    setSets({ ...sets, [current.id]: next });
    if (!currentSets[setIndex].completed) { if (settings.vibration) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setRest(current.restSeconds || settings.restSeconds); }
  };
  const updateReps = (setIndex: number, reps: string) => setSets({ ...sets, [current.id]: currentSets.map((item, i) => i === setIndex ? { ...item, reps } : item) });
  const finish = async () => {
    const completedAt = new Date();
    const sessionExercises: SessionExercise[] = items.map((item) => ({ exerciseId: item.id, name: item.name, category: item.category, sets: (sets[item.id] || []).map((set) => ({ reps: Number(set.reps) || 0, completed: set.completed })) }));
    const totalReps = sessionExercises.flatMap((item) => item.sets).filter((item) => item.completed).reduce((sum, item) => sum + item.reps, 0);
    const session: TrainingSession = { id: `session_${Date.now()}`, workoutId, workoutName: workout.name, startedAt: startedAt.current.toISOString(), completedAt: completedAt.toISOString(), durationSeconds: Math.max(elapsed, 1), exercises: sessionExercises, totalReps, kind: 'strength' };
    await saveSession(session); if (settings.vibration) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onComplete();
  };
  const confirmExit = () => Alert.alert('结束本次训练？', '尚未保存的组数会丢失。', [{ text: '继续训练', style: 'cancel' }, { text: '退出', style: 'destructive', onPress: onBack }]);

  return <SafeAreaView style={styles.safe}>
    <View style={styles.top}><Pressable onPress={confirmExit} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable><View style={{ flex: 1 }}><Text style={styles.workoutName}>{workout.name}</Text><Text style={styles.timer}>{formatTime(elapsed)}</Text></View><Text style={styles.step}>{index + 1}/{items.length}</Text></View>
    <ProgressBar value={(completedCount / Math.max(1, allSetCount)) * 100} color={colors.lime} />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.visual}><Image source={{ uri: current.realImage || current.image }} style={styles.image} /><View style={styles.shade} /><View style={styles.visualText}><Text style={styles.category}>{current.categoryLabel || current.category}</Text><Text style={styles.exerciseName}>{current.name}</Text><Text style={styles.exerciseMeta}>{current.defaultPrescription?.tempoDescription || '稳定控制节奏'} · 休息 {current.restSeconds} 秒</Text></View></View>
      <Text style={styles.setHeader}>训练组</Text>
      <View style={styles.tableHeader}><Text style={styles.tableSmall}>组</Text><Text style={styles.tableMain}>次数</Text><Text style={styles.tableDone}>完成</Text></View>
      {currentSets.map((set, setIndex) => <View key={setIndex} style={[styles.setRow, set.completed && styles.setRowDone]}><View style={styles.setNumber}><Text style={styles.setNumberText}>{setIndex + 1}</Text></View><TextInput value={set.reps} onChangeText={(v) => updateReps(setIndex, v)} keyboardType="number-pad" selectTextOnFocus style={styles.repsInput} /><Text style={styles.repsUnit}>次</Text><Pressable onPress={() => toggleSet(setIndex)} style={[styles.check, set.completed && styles.checkDone]}><Text style={[styles.checkText, set.completed && { color: colors.ink }]}>{set.completed ? '✓' : ''}</Text></Pressable></View>)}
      {current.keyPoints?.length ? <View style={styles.cue}><Text style={styles.cueLabel}>本组提示</Text><Text style={styles.cueText}>{current.keyPoints[0]}</Text></View> : null}
    </ScrollView>
    {rest > 0 ? <View style={styles.rest}><View><Text style={styles.restLabel}>组间休息</Text><Text style={styles.restTime}>{formatTime(rest)}</Text></View><Pressable onPress={() => setRest(0)} style={styles.skip}><Text style={styles.skipText}>跳过</Text></Pressable></View> : null}
    <View style={styles.bottom}><Button label={index === items.length - 1 ? '完成训练' : '下一个动作  →'} variant="lime" onPress={() => index === items.length - 1 ? void finish() : setIndex(index + 1)} /></View>
  </SafeAreaView>;
}

function formatTime(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, top: { height: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, backgroundColor: colors.ink }, close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 10 }, closeText: { color: '#FFFFFF', fontSize: 31, fontWeight: '300' }, workoutName: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }, timer: { color: '#AEB1A8', fontSize: 11, marginTop: 3 }, step: { color: colors.lime, fontWeight: '900', fontSize: 14 }, content: { padding: 18, paddingBottom: 120 },
  visual: { height: 218, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.ink }, image: { position: 'absolute', inset: 0, width: '100%', height: '100%' }, shade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(13,15,11,0.57)' }, visualText: { position: 'absolute', left: 20, right: 20, bottom: 19 }, category: { color: colors.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, exerciseName: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 6 }, exerciseMeta: { color: '#CDD0C8', fontSize: 11, marginTop: 5 }, setHeader: { color: colors.ink, fontSize: 19, fontWeight: '900', marginTop: 24, marginBottom: 13 }, tableHeader: { flexDirection: 'row', paddingHorizontal: 14, marginBottom: 7 }, tableSmall: { width: 48, color: colors.inkMuted, fontSize: 10, fontWeight: '700' }, tableMain: { flex: 1, color: colors.inkMuted, fontSize: 10, fontWeight: '700' }, tableDone: { width: 52, color: colors.inkMuted, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  setRow: { minHeight: 62, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, marginBottom: 9 }, setRowDone: { backgroundColor: '#F0F6DD', borderColor: '#D2E49A' }, setNumber: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginRight: 13 }, setNumberText: { fontWeight: '900', color: colors.ink }, repsInput: { color: colors.ink, fontSize: 23, fontWeight: '900', minWidth: 45, paddingVertical: 8, textAlign: 'center' }, repsUnit: { color: colors.inkMuted, fontSize: 12, flex: 1 }, check: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#C8C9C4', alignItems: 'center', justifyContent: 'center' }, checkDone: { backgroundColor: colors.lime, borderColor: colors.lime }, checkText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' }, cue: { backgroundColor: '#E7EDFF', borderRadius: radius.md, padding: 15, marginTop: 10 }, cueLabel: { color: colors.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, cueText: { color: '#293A6E', fontSize: 13, lineHeight: 20, marginTop: 5 },
  rest: { position: 'absolute', left: 18, right: 18, bottom: 88, backgroundColor: colors.ink, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 }, restLabel: { color: '#AEB1A8', fontSize: 10 }, restTime: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 2 }, skip: { paddingHorizontal: 16, paddingVertical: 9, backgroundColor: '#34372F', borderRadius: radius.pill }, skipText: { color: colors.lime, fontWeight: '800' }, bottom: { padding: 14, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper },
});
