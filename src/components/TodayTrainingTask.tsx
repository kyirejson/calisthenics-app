import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PrescribedExercise } from '../domain/training/trainingPrescription';
import { appPalette as c } from '../theme';
import { ExerciseMedia } from './ExerciseResource';
import { EquipmentPhoto } from './EquipmentPhoto';

/** Planned cells become receipts only for groups actually recorded in this course. */
export function TodayTrainingTask({ exercise, index, compact, minHeight, onOpen, onRemove, equipment = false, completedSets = [] }: {
  exercise: PrescribedExercise;
  index: number;
  compact: boolean;
  minHeight: number;
  onOpen: () => void;
  onRemove?: () => void;
  equipment?: boolean;
  completedSets?: import('../types').SetLog[];
}) {
  const unit = exercise.targetUnit === 'seconds' ? '秒' : exercise.targetUnit === 'meters' ? '米' : exercise.targetUnit === 'steps' ? '步' : '次';
  const side = exercise.perSide ? ' · 每侧' : exercise.id === 'aux_singleLegCalf' ? ' · 左右合计' : '';
  const value = equipment && exercise.repRange ? exercise.repRange.join('–') : exercise.targetValue;
  const loadNote = equipment && exercise.loadBasis ? { machine: '设备配重', total: '总负重', per_hand: '单手负重', bodyweight: '自重' }[exercise.loadBasis] : '';
  return <View style={s.task}>
    <View style={s.rail} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <View style={s.railLine} /><Text style={s.number}>{String(index + 1).padStart(2, '0')}</Text><View style={s.railDot} />
    </View>
    <View style={s.body}>
      <Pressable testID={'today-exercise-' + exercise.id} accessibilityRole="button" accessibilityLabel={`查看${exercise.name}${equipment ? '器械' : ''}动作指导`} accessibilityHint={`${exercise.targetSets}组，每组${value}${unit}${side}，组间休息${exercise.restSeconds}秒`} onPress={onOpen} style={({ pressed }) => [s.pressable, pressed && s.pressed]}>
        <LinearGradient colors={index === 0 ? ['#293319', '#1B2423'] : ['#1C2429', '#192125']} start={{ x: 0, y: 0 }} end={{ x: 1, y: .6 }} style={[s.card, { minHeight }]}>
          <View style={s.copy}>
            <Text testID={'today-exercise-name-' + exercise.id} style={[s.name, compact && s.nameCompact]}>{exercise.name}</Text>
            <Text testID={'today-completed-' + exercise.id} style={[s.dose, compact && s.doseCompact]}>{completedSets.length ? `已完成 ${completedSets.length} / ${exercise.targetSets} 组` : `${exercise.targetSets} 组`}{side}</Text>
            <View testID={'today-prescribed-sets-' + exercise.id} style={[s.sets, compact && s.setsCompact]}>
              {Array.from({ length: Math.max(exercise.targetSets, completedSets.length) }, (_, setIndex) => <View testID={'today-prescribed-set-' + exercise.id + '-' + setIndex} key={setIndex} style={[s.setCell, completedSets[setIndex] && { backgroundColor: c.olive, borderColor: c.lime }]}>
                <Text style={s.setValue}>{completedSets[setIndex] ? `✓ ${completedSets[setIndex].reps}` : value}<Text style={s.setUnit}> {unit}</Text></Text>
              </View>)}
            </View>
            <Text style={[s.rest, compact && s.restCompact]}>组间休息 {exercise.restSeconds} 秒{loadNote ? ` · ${loadNote}` : ''}</Text>
          </View>
          <View style={s.art} pointerEvents="none">
            {equipment ? <EquipmentPhoto exerciseId={exercise.id} name={exercise.name} compact thumbnailWidth={compact ? 58 : 72} /> : <ExerciseMedia testID={'today-exercise-photo-' + exercise.id} exercise={exercise} width="100%" minHeight={compact ? 76 : 88} maxHeight={compact ? 76 : 88} style={s.photo} />}
          </View>
        </LinearGradient>
      </Pressable>
      {onRemove ? <Pressable accessibilityRole="button" accessibilityLabel={'移除' + exercise.name} onPress={onRemove} style={s.remove}><Text style={s.removeText}>移除自加动作</Text></Pressable> : null}
    </View>
  </View>;
}

const s = StyleSheet.create({
  task: { flexDirection: 'row', gap: 6, minWidth: 0 },
  rail: { width: 22, flexShrink: 0, alignItems: 'center', paddingTop: 9 },
  railLine: { position: 'absolute', width: 1, top: 38, bottom: -10, backgroundColor: '#566D27' },
  number: { color: c.lime, fontSize: 14, lineHeight: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  railDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: '#526137', backgroundColor: c.lime, marginTop: 9 },
  body: { flex: 1, minWidth: 0 },
  pressable: { borderRadius: 14, overflow: 'hidden' },
  pressed: { opacity: .76 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: '#303A35', paddingVertical: 6, paddingLeft: 12, paddingRight: 16, justifyContent: 'center', overflow: 'hidden' },
  copy: { width: '73%', zIndex: 1 },
  name: { color: '#F0F3E9', fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -.4 },
  nameCompact: { fontSize: 17, lineHeight: 21 },
  dose: { color: '#CCD3C8', fontSize: 12, lineHeight: 16, marginTop: 1 },
  doseCompact: { lineHeight: 14, marginTop: 0 },
  sets: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  setsCompact: { marginTop: 3 },
  setCell: { flexBasis: '23%', minWidth: 35, minHeight: 25, borderRadius: 5, borderWidth: 1, borderColor: '#A4AF94', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  setValue: { color: '#F0F3E9', fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
  setUnit: { fontSize: 11 },
  rest: { color: '#BAC3B5', fontSize: 12, lineHeight: 16, marginTop: 5 },
  restCompact: { lineHeight: 14, marginTop: 3 },
  art: { position: 'absolute', right: 16, width: '24%', top: 8, bottom: 8, justifyContent: 'center' },
  photo: { borderRadius: 8, backgroundColor: 'transparent' },
  remove: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  removeText: { color: c.muted, fontSize: 12 },
});
