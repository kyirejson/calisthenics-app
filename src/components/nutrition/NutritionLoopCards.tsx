import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MEAL_SLOTS } from '../../nutrition/state';
import { slotLabels } from '../../nutrition/labels';
import type { MealSlot, NutritionDayState } from '../../nutrition/types';
import { appPalette, fitnessColors as colors } from '../../theme';

export function LoggingCompletenessControls({ state, recordedSlots, disabled, onConfirm, onStatus, onRecord }: {
  state?: NutritionDayState; recordedSlots: MealSlot[]; disabled?: boolean;
  onConfirm: (slot: MealSlot | 'day', confirmed: boolean) => void;
  onStatus: (slot: MealSlot, status: 'not_eaten' | 'unrecorded') => void;
  onRecord: (slot: MealSlot) => void;
}) {
  return <View testID="nutrition-logging-controls" style={styles.loggingControls}>
    <View style={styles.between}><Text style={styles.title}>按需记录餐次</Text><Text style={styles.badge}>{state?.completedAt ? '已确认当天记完整' : '选填'}</Text></View>
    <Text style={styles.small}>只记录你想记录的餐。没吃可以单独标记；留空不等于没吃，不必补齐四餐。</Text>
    {MEAL_SLOTS.map(slot => {
      const skipped = Boolean(state?.skippedSlots?.includes(slot)), recorded = recordedSlots.includes(slot), done = Boolean(state?.confirmedSlots.includes(slot));
      return <View key={slot} style={[styles.slot, skipped && styles.slotSkipped]}>
        <View style={styles.name}><Text style={styles.slotName}>{slotLabels[slot]}</Text><Text style={styles.small}>{skipped ? '没吃' : recorded ? done ? '已记录 · 已核对' : '已记录' : done ? '已核对结束' : '未记录 · 可留空'}</Text></View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={'记录' + slotLabels[slot]} disabled={disabled} onPress={() => onRecord(slot)} style={styles.option}><Text style={styles.link}>记餐</Text></Pressable>
          {skipped || done ? <Pressable accessibilityRole="button" accessibilityLabel={'撤销' + slotLabels[slot] + '状态'} disabled={disabled} onPress={() => onStatus(slot, 'unrecorded')} style={styles.option}><Text style={styles.small}>撤销状态</Text></Pressable>
            : recorded ? <Pressable accessibilityRole="button" accessibilityLabel={'确认' + slotLabels[slot] + '已记完整'} disabled={disabled} onPress={() => onConfirm(slot, true)} style={styles.option}><Text style={styles.small}>已记全</Text></Pressable>
            : <Pressable accessibilityRole="button" accessibilityLabel={'标记' + slotLabels[slot] + '没吃'} disabled={disabled} onPress={() => onStatus(slot, 'not_eaten')} style={styles.option}><Text style={styles.small}>没吃</Text></Pressable>}
        </View>
      </View>;
    })}
    <Pressable accessibilityRole="button" accessibilityLabel={state?.completedAt ? '撤销当日完整记录确认' : '确认当日饮食全部记完整'} disabled={disabled} onPress={() => onConfirm('day', !state?.completedAt)} style={styles.completeButton}><Text style={styles.link}>{state?.completedAt ? '撤销全天确认' : '可选：今天全部记完了'}</Text></Pressable>
    <Text style={styles.small}>仅自愿确认全天记完整后，才用于全天摄入比较；不影响单餐记录和查询。</Text>
  </View>;
}

const styles = StyleSheet.create({
  loggingControls: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16, marginTop: 6, gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  badge: { color: colors.green, fontSize: 10, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  small: { color: colors.inkMuted, fontSize: 11, lineHeight: 18 },
  link: { color: colors.green, fontSize: 12, fontWeight: '800' },
  slot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, minHeight: 54, backgroundColor: colors.paper, borderRadius: 12, gap: 4 },
  slotSkipped: { backgroundColor: appPalette.olive }, name: { flex: 1, minWidth: 0 }, actions: { flexDirection: 'row', gap: 4 },
  option: { minHeight: 44, minWidth: 44, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  slotName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  completeButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 9 },
});
