import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { AppGlyph } from './AppGlyph';
import { ExerciseMedia } from './ExerciseResource';
import { EquipmentPhoto } from './EquipmentPhoto';
import { useReducedMotion, useRouteReveal } from './useProgressMotion';
import { equipmentLoadLabel } from '../domain/training/equipment/equipmentTraining';
import { appPalette } from '../theme';
import type { PrescribedExercise, TargetUnit } from '../domain/training/trainingPrescription';
import { useTrainingVoice } from '../features/training/useTrainingVoice';
import { TrainingVoiceSettings } from '../features/training/TrainingVoiceSettings';

export type CockpitSet = { reps: string; load?: string; rir?: string; completed: boolean; completedAt?: string };
const c = { ...appPalette, ink: appPalette.text, line: appPalette.border };
export type RestReceipt = { name: string; setNumber: number; value: string; unit: TargetUnit };
const unitNames = { reps: '次', seconds: '秒', steps: '步', meters: '米' };
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
type Props = {
  items: PrescribedExercise[]; index: number; sets: Record<string, CockpitSet[]>; activeSet: number;
  elapsed: number; saving: boolean; error: string; warmupDone: boolean; rirTarget?: number;
  voiceBlocked: boolean;
  timerKind: 'rest' | 'transition' | 'hold' | null; remaining: number; timerDuration: number; paused: boolean; receipt: RestReceipt | null;
  holdTiming: { run: number; finished: boolean };
  onBack: () => void; onFinish: () => void; onGuide: () => void; onWarmup: () => void;
  onExercise: (index: number) => void; onSet: (index: number) => void; onEdit: (index: number, field: 'reps' | 'load' | 'rir', value: string) => void;
  onToggleSet: (index: number) => void; onAddSet: () => void; onRemoveSet: (index: number) => void;
  onPause: () => void; onExtend: () => void; onEndTimer: () => void; onStartTimer: () => void; onStartRest: () => void;
  onAddExercise: () => void; onSafety: () => void; onCooldown: () => void;
};

export function TrainingCockpit(p: Props) {
  const [showExercises, setShowExercises] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const [showSettings, setShowSettings] = useState(false), [editingCount, setEditingCount] = useState(false);
  const current = p.items[p.index], rows = p.sets[current.id] || [], active = rows[p.activeSet];
  const equipment = !!current.loadBasis, unit = unitNames[current.targetUnit];
  const all = Object.values(p.sets).flat(), done = all.filter(set => set.completed).length;
  const next = p.items.find((item, index) => index > p.index && (p.sets[item.id] || []).some(set => !set.completed));
  const nextPending = p.items.find(item => (p.sets[item.id] || []).some(set => !set.completed));
  const target = current.repRange ? current.repRange.join('–') : String(current.targetValue);
  const rest = !!p.timerKind;
  const allCurrentDone = rows.every(set => set.completed);
  const voice = useTrainingVoice({ identity: `${current.id}:${p.activeSet}`, unit: current.targetUnit,
    goal: Number(active?.reps) > 0 ? Number(active?.reps) : current.targetValue,
    complete: allCurrentDone || !!active?.completed,
    blocked: p.voiceBlocked || showExercises || showRecords || showSettings || editingCount,
    timerKind: p.timerKind, timerDuration: p.timerDuration, remaining: p.remaining, paused: p.paused, holdTiming: p.holdTiming });
  const reduced = useReducedMotion();
  const actionReveal = useRouteReveal(current.id, reduced);
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!rest || p.paused || reduced !== false) { breath.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 2400, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(breath, { toValue: 0, duration: 2400, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]));
    animation.start(); return () => animation.stop();
  }, [rest, p.paused, reduced, breath]);
  const changeValue = (delta: number) => {
    if (active) p.onEdit(p.activeSet, 'reps', String(Math.max(0, (Number(active.reps) || 0) + delta)));
  };
  const primary = () => {
    if (rest) { p.onEndTimer(); return; }
    if (allCurrentDone) {
      if (nextPending) p.onExercise(p.items.indexOf(nextPending)); else p.onFinish();
    } else if (active) p.onToggleSet(p.activeSet);
  };
  const primaryLabel = rest ? (p.timerKind === 'hold' ? '停止计时' : '结束休息') : allCurrentDone ? (nextPending ? '下一个动作 →' : '保存训练') : active?.completed ? '修改这一组' : '完成这一组';

  return <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
    <View style={s.header}>
      <Pressable disabled={p.saving} accessibilityRole="button" accessibilityLabel="保存并退出训练" onPress={() => { voice.reset(); p.onBack(); }} style={s.icon}><AppGlyph name="back" color={c.ink} /></Pressable>
      <Text testID="training-screen-title" style={s.title}>训练中</Text>
      <Pressable disabled={p.saving} accessibilityRole="switch" accessibilityLabel={voice.enabled ? '关闭语音报数' : '开启语音报数'} accessibilityState={{ checked: voice.enabled }} aria-checked={voice.enabled} onPress={() => { const wasEnabled = voice.enabled; voice.toggle(); if (!wasEnabled && current.targetUnit === 'seconds' && !p.timerKind && !allCurrentDone) p.onStartTimer(); }} style={s.voiceIcon}><AppGlyph name={voice.enabled ? 'speaker' : 'speakerOff'} color={voice.enabled ? c.lime : c.muted} size={21} /></Pressable>
      <Pressable disabled={p.saving} accessibilityRole="button" accessibilityLabel="打开训练设置" onPress={() => setShowSettings(true)} style={s.voiceIcon}><AppGlyph name="settings" color={c.muted} size={20} /></Pressable>
      <Pressable disabled={p.saving} accessibilityRole="button" accessibilityLabel="结束训练" onPress={() => { voice.reset(); p.onFinish(); }} style={s.icon}><Text style={s.end}>结束</Text></Pressable>
    </View>
    <View style={s.progressRow}><Text testID="training-set-progress" style={s.progressText}>{done} / {all.length} 组</Text>
      <View style={s.segments}>{Array.from({ length: Math.min(12, all.length) }, (_, index) => <View key={index} style={[s.segment, (index + 1) / Math.min(12, all.length) <= done / Math.max(1, all.length) && s.segmentDone]} />)}</View>
      <Text style={s.elapsed}>{clock(p.elapsed)}</Text>
    </View>
    <ScrollView testID="training-scroll" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="查看今日热身动作" onPress={p.onWarmup} style={s.warmup}><Text style={s.muted}>{p.warmupDone ? '✓ 热身已查看' : '热身'} ›</Text></Pressable>
      {rest ? <View testID="training-timer-card" style={s.restBody}>
        <Text style={s.restTitle}>{p.timerKind === 'hold' ? '动作保持' : p.timerKind === 'transition' ? '动作间恢复' : '组间休息'}</Text>
        <Text style={s.restSubtitle}>{p.receipt && p.timerKind !== 'hold' ? `${p.receipt.name} · 已完成第 ${p.receipt.setNumber} 组` : current.name}</Text>
        <View style={s.orbit}>
          <Animated.View pointerEvents="none" style={[s.breath, { opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [.16, .3] }), transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [.9, 1.05] }) }] }]} />
          <Svg width="100%" height="100%" viewBox="0 0 280 280">
            <Circle cx="140" cy="140" r="130" fill="none" stroke={c.line} strokeWidth="1" />
            <Circle cx="140" cy="140" r="112" fill="none" stroke="#344137" strokeWidth="2" />
            <Circle cx="140" cy="140" r="112" fill="none" stroke={c.lime} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 112 * Math.min(1, p.remaining / Math.max(1, p.timerDuration))} ${2 * Math.PI * 112}`} rotation="-90" origin="140, 140" />
            <Circle cx="140" cy="140" r="94" fill="none" stroke="#2C3831" strokeWidth="1" />
          </Svg>
          <View pointerEvents="none" style={s.orbitLabel}><Text testID="training-rest-time" accessibilityRole="timer" style={s.countdown}>{clock(p.remaining)}</Text><Text style={s.muted}>{p.paused ? '已暂停' : '剩余时间'}</Text></View>
        </View>
        {p.receipt && p.timerKind !== 'hold' ? <View style={s.receipt}><Text style={s.lime}>✓</Text><Text style={s.receiptText}>第 {p.receipt.setNumber} 组 · {p.receipt.value} {unitNames[p.receipt.unit]}</Text></View> : null}
        <View style={s.upNext}><Text style={s.muted}>{p.timerKind === 'hold' ? '计时结束后按实际结果记录' : '下一组'}</Text><Text style={s.nextName}>{allCurrentDone ? nextPending?.name || '本次训练已完成' : `${current.name} · 第 ${p.activeSet + 1} 组`}</Text><Text style={s.muted}>{allCurrentDone ? '休息结束后继续' : `目标 ${target} ${unit}${current.perSide ? ' / 侧' : ''}`}</Text></View>
      </View> : <>
        <Animated.View testID="training-action-reveal" style={[s.cardStack, { opacity: actionReveal, transform: [{ translateY: actionReveal.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}><View pointerEvents="none" style={s.stackEdge} />
          <LinearGradient colors={['#2B3A2A', '#1B2526', '#1B2028']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.actionCard}>
            <View style={s.cardCopy}><Pressable accessibilityRole="button" accessibilityLabel="选择训练动作" onPress={() => setShowExercises(true)} style={s.actionSwitch}><Text style={s.muted}>动作 {p.index + 1} / {p.items.length} ⌄</Text></Pressable><Text style={s.actionName}>{current.name}</Text><Pressable accessibilityRole="button" accessibilityLabel="查看当前动作指导" onPress={p.onGuide} style={s.guide}><Text style={s.guideText}>动作指导 ↗</Text></Pressable></View>
            <View style={s.heroPhoto}>{equipment ? <EquipmentPhoto exerciseId={current.id} name={current.name} /> : <ExerciseMedia key={current.id} exercise={current} minHeight={150} maxHeight={170} testID="training-action-photo" />}</View>
          </LinearGradient>
        </Animated.View>
        {current.category === 'hspu' || current.riskLevel === 'high' ? <Pressable accessibilityRole="button" onPress={p.onSafety} style={s.safetyNotice}><Text style={s.warning}>高风险动作 · 不适时停止，查看安全指导 ›</Text></Pressable> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.journey}>
          {rows.map((set, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`选择第${index + 1}组${set.completed ? '，已完成' : ''}`} accessibilityState={{ selected: index === p.activeSet, disabled: p.saving }} disabled={p.saving} onPress={() => set.completed ? setShowRecords(true) : p.onSet(index)} style={s.nodeHit}><View style={[s.node, set.completed && s.nodeDone, index === p.activeSet && !set.completed && s.nodeActive]}><Text style={[s.nodeText, (set.completed || index === p.activeSet) && s.nodeTextActive]}>{set.completed ? '✓' : index + 1}</Text></View><Text style={s.nodeCaption}>{index + 1}</Text></Pressable>)}
        </ScrollView>
        <Text style={s.setCaption}>{allCurrentDone ? '当前动作已完成' : `第 ${p.activeSet + 1} 组 / 共 ${rows.length} 组`}</Text>
        {!allCurrentDone && active ? <>
          <Text style={s.actualLabel}>实际{current.targetUnit === 'reps' ? '次数' : current.targetUnit === 'seconds' ? '保持时长' : current.targetUnit === 'meters' ? '距离' : '步数'}</Text>
          <View style={s.counter}><Pressable accessibilityRole="button" accessibilityLabel="减少实际数量" disabled={p.saving} onPress={() => changeValue(-1)} style={s.stepper}><Text style={s.stepperText}>−</Text></Pressable>
            <View style={s.counterValue}><TextInput testID="training-actual-input" accessibilityLabel={`第${p.activeSet + 1}组${unit}`} editable={!p.saving} value={active.reps} placeholder="—" placeholderTextColor={c.muted} onFocus={() => setEditingCount(true)} onBlur={() => setEditingCount(false)} onChangeText={value => p.onEdit(p.activeSet, 'reps', value)} keyboardType={current.targetUnit === 'meters' ? 'decimal-pad' : 'number-pad'} selectTextOnFocus style={s.largeInput} /><Text style={s.unit}>{unit}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="增加实际数量" disabled={p.saving} onPress={() => changeValue(1)} style={s.stepper}><Text style={s.stepperText}>＋</Text></Pressable>
          </View><Text style={s.target}>本组目标 {target} {unit}{current.perSide ? ' / 侧' : ''}</Text>
          {equipment ? <View style={s.equipmentFields}>{current.loadBasis !== 'bodyweight' ? <View style={s.field}><Text style={s.muted}>重量 / kg</Text><TextInput accessibilityLabel={`第${p.activeSet + 1}组重量kg`} editable={!p.saving} value={active.load || ''} placeholder="待填" placeholderTextColor={c.muted} onChangeText={value => p.onEdit(p.activeSet, 'load', value)} keyboardType="decimal-pad" style={s.smallInput} /></View> : null}<View style={s.field}><Text style={s.muted}>余力 / 选填</Text><TextInput accessibilityLabel={`第${p.activeSet + 1}组实际余力`} editable={!p.saving} value={active.rir || ''} placeholder="—" placeholderTextColor={c.muted} onChangeText={value => p.onEdit(p.activeSet, 'rir', value)} keyboardType="number-pad" style={s.smallInput} /></View></View> : null}
          {equipment ? <Text style={s.target}>目标余力 {p.rirTarget ?? current.defaultPrescription?.rirTarget ?? 2} · 实际余力选填 0–10</Text> : null}
          {equipment ? <Text style={s.target}>{equipmentLoadLabel(current.loadBasis)} · 不同设备重量不直接比较</Text> : null}
          {current.perSide ? <Text style={s.target}>记录每侧数量，左右均完成后记录本组。</Text> : current.id === 'aux_singleLegCalf' ? <Text style={s.target}>记录两侧实际合计数量。</Text> : null}
          {current.targetUnit === 'seconds' ? <Pressable accessibilityRole="button" onPress={p.onStartTimer} style={s.holdButton}><Text style={s.lime}>开始保持计时</Text></Pressable> : null}
        </> : <Text style={s.actionDone}>✓ 做得好，继续下一步</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="调整训练组" onPress={() => setShowRecords(true)} style={s.records}><Text style={s.recordLink}>调整组数与已完成数据 ›</Text></Pressable>
      </>}
    </ScrollView>
    <View style={s.footer}>
      {p.error ? <Text accessibilityRole="alert" style={s.error}>{p.error}</Text> : null}
      {voice.error ? <Text accessibilityRole="alert" style={s.error}>{voice.error}</Text> : null}
      {rest ? <View style={s.restControls}><Pressable accessibilityRole="button" disabled={p.saving} onPress={p.onPause} style={s.restButton}><Text style={s.controlText}>{p.paused ? '继续' : '暂停'}</Text></Pressable>{p.timerKind !== 'hold' ? <Pressable accessibilityRole="button" disabled={p.saving} onPress={p.onExtend} style={s.restButton}><Text style={s.controlText}>+30 秒</Text></Pressable> : null}</View> : <View style={s.footerMeta}><Pressable accessibilityRole="button" accessibilityLabel="手动开始组间休息" disabled={p.saving} onPress={p.onStartRest} style={s.metaButton}><Text style={s.muted}>休息 {clock(current.restSeconds)} ↗</Text></Pressable><Pressable accessibilityRole="button" disabled={p.saving} accessibilityLabel="切换到下一个动作" onPress={() => next ? p.onExercise(p.items.indexOf(next)) : setShowExercises(true)} style={s.metaButton}><Text numberOfLines={1} style={s.muted}>接下来 {next?.name || '结束训练'} →</Text></Pressable></View>}
      <Pressable testID="training-primary" accessibilityRole="button" accessibilityLabel={primaryLabel} accessibilityState={{ disabled: p.saving }} disabled={p.saving} onPress={primary} style={[s.primary, p.saving && s.disabled]}><Text style={s.primaryText}>{p.saving ? '保存中…' : primaryLabel}</Text></Pressable>
    </View>
    <TrainingVoiceSettings visible={showSettings} interval={voice.interval} onChange={voice.changeInterval} onClose={() => setShowSettings(false)} />
    <Modal transparent visible={showExercises || showRecords} animationType="fade" onRequestClose={() => { setShowExercises(false); setShowRecords(false); }}>
      <KeyboardAvoidingView style={s.shade} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={s.sheet}>
        <View style={s.sheetHead}><Text style={s.sheetTitle}>{showRecords ? `${current.name} · 组记录` : '切换动作'}</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭训练记录面板" onPress={() => { setShowExercises(false); setShowRecords(false); }} style={s.icon}><Text style={s.controlText}>×</Text></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}>
          {showRecords ? <>{rows.map((set, index) => <View key={index} style={s.editRow}><Text style={s.editNumber}>{index + 1}</Text><View style={s.editField}><Text style={s.muted}>{unit}</Text><TextInput accessibilityLabel={`修改第${index + 1}组${unit}`} editable={!p.saving} value={set.reps} onChangeText={value => p.onEdit(index, 'reps', value)} keyboardType={current.targetUnit === 'meters' ? 'decimal-pad' : 'number-pad'} style={s.smallInput} /></View>{equipment && current.loadBasis !== 'bodyweight' ? <View style={s.editField}><Text style={s.muted}>kg</Text><TextInput accessibilityLabel={`修改第${index + 1}组重量`} editable={!p.saving} value={set.load || ''} onChangeText={value => p.onEdit(index, 'load', value)} keyboardType="decimal-pad" style={s.smallInput} /></View> : null}{equipment ? <View style={s.editField}><Text style={s.muted}>余力</Text><TextInput accessibilityLabel={`修改第${index + 1}组余力`} editable={!p.saving} value={set.rir || ''} onChangeText={value => p.onEdit(index, 'rir', value)} keyboardType="number-pad" style={s.smallInput} /></View> : null}{set.completed ? <Pressable accessibilityRole="button" accessibilityLabel={`撤销第${index + 1}组完成`} disabled={p.saving} onPress={() => p.onToggleSet(index)} style={s.check}><Text style={s.lime}>撤销</Text></Pressable> : <Text style={s.muted}>待完成</Text>}{!set.completed && index >= current.targetSets ? <Pressable accessibilityRole="button" accessibilityLabel={`移除新增的第${index + 1}组`} onPress={() => p.onRemoveSet(index)} style={s.remove}><Text style={s.muted}>−</Text></Pressable> : null}</View>)}<Text style={s.editHint}>修改已完成数量会自动保存；待完成组请使用主按钮完成。</Text><Pressable accessibilityRole="button" disabled={p.saving} onPress={p.onAddSet} style={s.choice}><Text style={s.lime}>＋ 加一组</Text></Pressable>{!equipment ? <Pressable accessibilityRole="button" disabled={p.saving} onPress={() => { setShowRecords(false); p.onAddExercise(); }} style={s.choice}><Text style={s.controlText}>＋ 添加动作</Text></Pressable> : null}<Pressable accessibilityRole="button" onPress={() => { setShowRecords(false); p.onSafety(); }} style={s.choice}><Text style={s.controlText}>训练安全 ›</Text></Pressable><Pressable accessibilityRole="button" onPress={() => { setShowRecords(false); p.onCooldown(); }} style={s.choice}><Text style={s.controlText}>训练后整理 ›</Text></Pressable></> : p.items.map((item, index) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`切换动作：${item.name}`} accessibilityState={{ selected: index === p.index }} disabled={p.saving} onPress={() => { p.onExercise(index); setShowExercises(false); }} style={s.choice}><Text style={s.controlText}>{index + 1}. {item.name}</Text><Text style={s.muted}>{(p.sets[item.id] || []).filter(set => set.completed).length}/{(p.sets[item.id] || []).length} 组</Text></Pressable>)}
        </ScrollView>
      </View></KeyboardAvoidingView>
    </Modal>
  </KeyboardAvoidingView>;
}

const s = StyleSheet.create({
  voiceIcon: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1 }, header: { width: '100%', maxWidth: 440, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 60 }, icon: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, title: { flex: 1, color: c.ink, fontSize: 18, fontWeight: '800', textAlign: 'center' }, end: { color: c.ink, fontSize: 14, fontWeight: '700' },
  progressRow: { width: '100%', maxWidth: 440, paddingHorizontal: 20, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 4 }, progressText: { color: c.ink, fontSize: 13, fontWeight: '700' }, elapsed: { color: c.muted, fontSize: 13, fontVariant: ['tabular-nums'] }, segments: { flex: 1, flexDirection: 'row', gap: 3 }, segment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: c.line }, segmentDone: { backgroundColor: c.lime },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 16 }, warmup: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }, muted: { color: c.muted, fontSize: 12, lineHeight: 19 }, lime: { color: c.lime, fontSize: 15, fontWeight: '700' },
  cardStack: { marginRight: 4, marginBottom: 10 }, stackEdge: { position: 'absolute', right: -5, top: 12, bottom: 12, width: 15, borderRadius: 18, borderWidth: 1, borderColor: '#576253', backgroundColor: c.card }, actionCard: { minHeight: 176, borderRadius: 22, borderWidth: 1, borderColor: '#465348', overflow: 'hidden', flexDirection: 'row', alignItems: 'center' }, cardCopy: { flex: 1, paddingLeft: 17, paddingVertical: 12, zIndex: 1 }, actionSwitch: { minHeight: 36, justifyContent: 'center' }, actionName: { color: c.ink, fontWeight: '900', fontSize: 22, lineHeight: 30 }, guide: { minHeight: 44, justifyContent: 'center' }, guideText: { color: '#CED9CA', fontSize: 12 }, heroPhoto: { width: '38%', paddingRight: 6, overflow: 'hidden' },
  journey: { flexGrow: 1, justifyContent: 'space-evenly', gap: 10, paddingVertical: 4 }, nodeHit: { minWidth: 48, minHeight: 58, alignItems: 'center' }, node: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: '#657069', alignItems: 'center', justifyContent: 'center' }, nodeDone: { backgroundColor: c.lime, borderColor: c.lime }, nodeActive: { backgroundColor: c.lime, borderColor: c.lime, shadowColor: c.lime, shadowOpacity: .2, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }, nodeText: { color: c.muted, fontWeight: '800', fontSize: 13 }, nodeTextActive: { color: c.onLime, fontWeight: '800', fontSize: 15 }, nodeCaption: { color: c.muted, fontSize: 10, marginTop: 5 }, setCaption: { color: c.muted, fontSize: 12, textAlign: 'center', marginBottom: 14 },
  actualLabel: { color: c.ink, fontSize: 12, textAlign: 'center' }, counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, stepper: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: '#66726D', alignItems: 'center', justifyContent: 'center' }, stepperText: { color: c.ink, fontSize: 32, lineHeight: 38 }, counterValue: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' }, largeInput: { color: c.ink, fontSize: 64, lineHeight: 78, height: 88, padding: 0, textAlign: 'center', minWidth: 72, maxWidth: 140, fontWeight: '900', fontVariant: ['tabular-nums'] }, unit: { color: c.ink, fontSize: 16, fontWeight: '700', marginLeft: 3 }, target: { color: c.muted, textAlign: 'center', fontSize: 12, marginBottom: 18 }, equipmentFields: { flexDirection: 'row', gap: 12, marginBottom: 12 }, field: { flex: 1 }, smallInput: { color: c.ink, backgroundColor: c.raised, borderRadius: 10, textAlign: 'center', height: 48, minWidth: 40, fontSize: 18, fontWeight: '700', paddingHorizontal: 4 }, holdButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, actionDone: { color: c.lime, fontSize: 18, paddingVertical: 25, textAlign: 'center' },
  safetyNotice: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 }, warning: { color: c.warning, fontSize: 12, lineHeight: 19 },
  records: { backgroundColor: c.card, borderRadius: 16, minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }, recordLink: { color: c.ink, fontSize: 12, fontWeight: '700' },
  footer: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4, backgroundColor: c.background }, footerMeta: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' }, metaButton: { minHeight: 44, maxWidth: '62%', justifyContent: 'center' }, primary: { minHeight: 58, borderRadius: 29, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, primaryText: { color: c.onLime, fontSize: 17, fontWeight: '900' }, disabled: { opacity: .5 }, error: { color: c.warning, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  restBody: { alignItems: 'center' }, restTitle: { color: c.ink, fontSize: 30, lineHeight: 42, fontWeight: '900', marginTop: 10 }, restSubtitle: { color: c.muted, fontSize: 12, textAlign: 'center', marginTop: 2 }, orbit: { width: '100%', maxWidth: 280, aspectRatio: 1, marginVertical: 14, alignItems: 'center', justifyContent: 'center' }, breath: { position: 'absolute', width: '74%', height: '74%', borderRadius: 150, backgroundColor: '#719B55' }, orbitLabel: { position: 'absolute', alignItems: 'center' }, countdown: { color: c.ink, fontSize: 50, fontWeight: '900', fontVariant: ['tabular-nums'], lineHeight: 64 }, receipt: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#53663E', borderRadius: 30, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 16 }, receiptText: { color: c.ink, fontSize: 12 }, upNext: { width: '100%', backgroundColor: c.card, borderRadius: 18, padding: 16, gap: 4 }, nextName: { color: c.ink, fontSize: 18, fontWeight: '800' }, restControls: { flexDirection: 'row', gap: 10, marginBottom: 10 }, restButton: { flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: '#66726D', alignItems: 'center', justifyContent: 'center' }, controlText: { color: c.ink, fontSize: 14, fontWeight: '700' },
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,.78)', justifyContent: 'center', alignItems: 'center', padding: 16 }, sheet: { width: '100%', maxWidth: 440, maxHeight: '88%', backgroundColor: c.background, borderRadius: 24, borderWidth: 1, borderColor: c.line }, sheetHead: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingVertical: 8 }, sheetTitle: { flex: 1, color: c.ink, fontSize: 18, fontWeight: '800' }, sheetContent: { padding: 16, gap: 10 }, choice: { minHeight: 54, backgroundColor: c.card, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', gap: 12, justifyContent: 'space-between', alignItems: 'center' }, editRow: { flexDirection: 'row', gap: 5, alignItems: 'center' }, editNumber: { width: 20, color: c.muted, fontSize: 14 }, editField: { flex: 1 }, check: { width: 48, height: 48, marginTop: 18, borderRadius: 24, borderWidth: 1, borderColor: c.line, justifyContent: 'center', alignItems: 'center' }, remove: { width: 24, height: 48, justifyContent: 'center', alignItems: 'center' }, editHint: { color: c.muted, fontSize: 12, lineHeight: 19 },
});
