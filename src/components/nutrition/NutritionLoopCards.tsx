import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MEAL_SLOTS } from '../../nutrition/state';
import { slotLabels } from '../../nutrition/labels';
import type { MealSlot, NutritionDayState } from '../../nutrition/types';
import { appPalette, fitnessColors as colors } from '../../theme';

export function LoggingCompletenessControls({ state, disabled, onConfirm }: { state?: NutritionDayState; disabled?: boolean; onConfirm: (slot: MealSlot | 'day', confirmed: boolean) => void }) {
  return <View testID="nutrition-logging-controls" style={styles.loggingControls}>
    <View style={styles.between}><Text style={styles.title}>核对餐次</Text><Text style={styles.badge}>{state?.completedAt ? '当天已记完整' : (state?.confirmedSlots.length || 0) + ' / 4 已核对'}</Text></View>
    <View style={styles.slotGrid}>{MEAL_SLOTS.map(slot => {
      const done = Boolean(state?.confirmedSlots.includes(slot));
      return <Pressable key={slot} accessibilityRole="checkbox" accessibilityState={{ checked: done, disabled }} aria-checked={done} accessibilityLabel={(done ? '撤销' : '确认') + slotLabels[slot] + '已记完整'} disabled={disabled} onPress={() => onConfirm(slot, !done)} style={[styles.slot, done && styles.slotDone]}><Text style={[styles.slotName, done && styles.slotDoneText]}>{slotLabels[slot]}</Text><Text style={[styles.small, done && styles.slotDoneText]}>{done ? '已记完 ✓' : '未确认'}</Text></Pressable>;
    })}</View>
    <Text style={styles.small}>核对食物、饮料与用油是否记全；没吃的餐也需核对。未确认的餐次不用于推算少吃了多少。</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={state?.completedAt ? '撤销当日完整记录确认' : '确认当日饮食全部记完整'} disabled={disabled} onPress={() => onConfirm('day', !state?.completedAt)} style={styles.completeButton}><Text style={styles.link}>{state?.completedAt ? '重新核对' : '当天全部已记完'}</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  loggingControls: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16, marginTop: 6, gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  badge: { color: colors.green, fontSize: 10, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  small: { color: colors.inkMuted, fontSize: 11, lineHeight: 18 },
  link: { color: colors.green, fontSize: 12, fontWeight: '800' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '47%', flexGrow: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, minHeight: 44, backgroundColor: colors.paper, borderRadius: 12, gap: 8 },
  slotDone: { backgroundColor: appPalette.olive },
  slotName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  slotDoneText: { color: colors.green },
  completeButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 9 },
});
