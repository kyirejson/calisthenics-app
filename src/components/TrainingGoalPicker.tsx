import { ActivityIndicator, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { AppGlyph } from './AppGlyph';
import { useReducedMotion } from './useProgressMotion';
import { trainingGoals, trainingGoalLabel } from '../data/trainingGoals';
import { appPalette as p } from '../theme';
import type { Goal } from '../types';

export function TrainingGoalSelector({ goal, onPress, disabled = false }: { goal: Goal; onPress: () => void; disabled?: boolean }) {
  const option = trainingGoals.find(item => item.key === goal);
  return <Pressable testID="training-goal-selector" accessibilityRole="button" accessibilityLabel="选择训练目标" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.selector, pressed && s.pressed]}>
    <AppGlyph name={option?.icon || 'shield'} color={p.lime} size={20} />
    <Text numberOfLines={1} style={s.selectorText}>{trainingGoalLabel(goal)}</Text>
    <View style={s.down}><AppGlyph name="chevron" size={15} /></View>
  </Pressable>;
}

type Props = { visible: boolean; goal: Goal; saving: boolean; error: string; onClose: () => void; onSelect: (goal: Goal) => Promise<unknown>; testID?: string };
export function TrainingGoalPicker({ visible, goal, saving, error, onClose, onSelect, testID }: Props) {
  const reduced = useReducedMotion();
  const close = () => { if (!saving) onClose(); };
  return <Modal visible={visible} transparent animationType={reduced === false ? 'fade' : 'none'} statusBarTranslucent onRequestClose={close}>
    <SafeAreaView style={s.safe}><View style={s.backdrop}>
      <Pressable testID="training-goal-backdrop" accessibilityRole="button" accessibilityLabel="关闭训练专题遮罩" disabled={saving} onPress={close} style={StyleSheet.absoluteFill} />
      <View testID={testID || 'training-goal-sheet'} style={s.card}>
        <View style={s.head}><Text style={s.title}>选择训练专题</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭训练专题选择" disabled={saving} onPress={close} style={s.close}><View style={s.cross}><AppGlyph name="plus" size={20} /></View></Pressable></View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.options}>
          {trainingGoals.map(item => <Pressable key={item.key} testID={'training-goal-option-' + item.key} accessibilityRole="button" accessibilityLabel={'选择' + item.label} accessibilityState={{ selected: item.key === goal, disabled: saving, busy: saving }} aria-pressed={item.key === goal} disabled={saving} onPress={() => void onSelect(item.key)} style={({ pressed }) => [s.option, item.key === goal && s.active, pressed && s.pressed]}>
            <View style={[s.icon, item.key === goal && s.iconActive]}><AppGlyph name={item.icon} color={item.key === goal ? p.lime : p.muted} /></View>
            <Text style={s.optionText}>{item.label}</Text>
            {item.key === goal ? <AppGlyph name="check" color={p.lime} size={19} /> : null}
          </Pressable>)}
          {saving ? <View accessibilityRole="alert" style={s.busy}><ActivityIndicator color={p.lime} size="small" /><Text style={s.caption}>正在切换…</Text></View> : null}
          {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        </ScrollView>
      </View>
    </View></SafeAreaView>
  </Modal>;
}

const s = StyleSheet.create({
  selector: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, backgroundColor: p.card, borderWidth: 1, borderColor: p.border, borderRadius: 14 },
  selectorText: { flex: 1, minWidth: 0, color: p.text, fontSize: 13, fontWeight: '800' }, down: { transform: [{ rotate: '90deg' }] }, pressed: { opacity: 0.78 },
  safe: { flex: 1 }, backdrop: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#05080B99', ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } : {}) } as ViewStyle,
  card: { width: '100%', maxWidth: 440, maxHeight: '100%', backgroundColor: p.card, borderWidth: 1, borderColor: p.border, borderRadius: 24, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 8 }, title: { flex: 1, color: p.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: p.raised, alignItems: 'center', justifyContent: 'center' }, cross: { transform: [{ rotate: '45deg' }] },
  options: { padding: 16, paddingTop: 4, gap: 10 }, option: { minHeight: 60, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: p.raised, borderWidth: 1, borderColor: p.border }, active: { borderColor: p.oliveBorder, backgroundColor: p.olive },
  icon: { width: 32, height: 32, borderRadius: 10, backgroundColor: p.card, alignItems: 'center', justifyContent: 'center' }, iconActive: { backgroundColor: '#C7F54815' }, optionText: { flex: 1, color: p.text, fontWeight: '800', fontSize: 14 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8 }, caption: { color: p.muted, fontSize: 12 }, error: { color: p.danger, fontSize: 12, lineHeight: 19 },
});
