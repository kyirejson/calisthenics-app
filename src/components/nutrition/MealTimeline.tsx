import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppGlyph, type GlyphName } from '../AppGlyph';
import { appPalette } from '../../theme';
import { slotLabels } from '../../nutrition/labels';
import { nutrientKnown } from '../../nutrition/agentFood';
import { summarizeMealSlots } from '../../nutrition/presentation';
import { photoPortionSummary } from '../../nutrition/vision';
import type { IntakeEntry, MealSlot } from '../../nutrition/types';

const slots: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const icons: Record<MealSlot, GlyphName> = { breakfast: 'sun', lunch: 'utensils', dinner: 'moon', snack: 'cup' };
const cyan = '#77d9d6';

export function MealTimeline({ entries, skipped = [], onInspect }: { entries: IntakeEntry[]; skipped?: MealSlot[]; onInspect: (slot: MealSlot) => void }) {
  const summaries = summarizeMealSlots(entries);
  return <View testID={entries.length ? 'nutrition-recorded-meals' : 'nutrition-empty-meals'} style={styles.timeline}>
    {slots.map((slot, index) => {
      const summary = summaries.find(item => item.slot === slot);
      const meals = [...(summary?.entries ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const accent = meals.length ? index === 1 ? cyan : appPalette.lime : appPalette.muted;
      const caloriesKnown = summary?.caloriesKnown;
      const caloriesMissing = summary?.caloriesMissing;
      const missing = summary?.missingNutrition ?? 0;
      const estimated = summary?.containsEstimates;
      const amountMissing = summary?.missingAmounts ?? 0;
      return <View key={slot} testID={'nutrition-meal-' + slot} style={styles.group}>
        <View style={styles.rail}>
          {index < slots.length - 1 ? <LinearGradient colors={[accent, meals.length ? '#274344' : '#273239']} style={styles.connector} /> : null}
          <View style={[styles.node, { borderColor: accent, backgroundColor: meals.length ? '#142021' : '#10171b' }]}><AppGlyph name={icons[slot]} color={accent} size={20} /></View>
        </View>
        <View style={[styles.content, index === slots.length - 1 && styles.last]}>
          <View style={styles.heading}>
            <Text style={[styles.title, { color: meals.length ? accent : appPalette.muted }]}>{slotLabels[slot]}</Text>
            {meals.some(entry => entry.source === 'agent') ? <Text style={styles.badge}>AI 已记录</Text> : null}
            <View style={styles.space} />
            {meals.length ? <Text style={styles.total}>{caloriesKnown ? (caloriesMissing ? '已统计 ' : '') + Math.round(summary!.nutrients.calories) : '—'}<Text style={styles.unit}> kcal</Text></Text> : null}
          </View>
          {meals.length ? <>
            {meals.map(entry => <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={'查看' + slotLabels[slot] + '饮食记录'} onPress={() => onInspect(slot)} style={({ pressed }) => [styles.food, pressed && { opacity: .65 }]}>
              <View style={styles.foodMain}><Text style={styles.foodName}>{entry.name}</Text><Text style={styles.amount}>{entry.source === 'agent' ? entry.agentFood?.amount ?? '份量待补' : photoPortionSummary(entry.photoEstimate) || ''}</Text></View>
              <Text style={styles.foodValue}>{nutrientKnown(entry, 'calories') ? Math.round(entry.nutrients.calories) : '—'}<Text style={styles.unit}> kcal</Text></Text>
            </Pressable>)}
            <View style={styles.notes}>{estimated ? <Text style={styles.estimate}>含估算</Text> : null}{missing || amountMissing ? <Text style={styles.pending}>{missing ? `${missing} 项营养待补` : `${amountMissing} 项份量待补`}</Text> : null}</View>
          </> : <Text style={styles.empty}>{skipped.includes(slot) ? '已记录 · 没吃' : '暂无记录'}</Text>}
        </View>
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  timeline: { marginTop: 5 },
  group: { flexDirection: 'row', gap: 14 },
  rail: { width: 36, alignItems: 'center' },
  node: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  connector: { position: 'absolute', top: 36, bottom: -4, width: 1.5 },
  content: { flex: 1, minWidth: 0, paddingBottom: 17, marginBottom: 17, borderBottomWidth: 1, borderBottomColor: '#263339' },
  last: { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 8 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 7, rowGap: 5, minHeight: 38 },
  title: { fontSize: 18, fontWeight: '800' },
  badge: { fontSize: 10, color: appPalette.lime, backgroundColor: '#1f2c1b', borderWidth: 1, borderColor: '#3d5525', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  space: { flex: 1 },
  total: { color: appPalette.text, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { color: appPalette.muted, fontSize: 11, fontWeight: '400' },
  food: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 5 },
  foodMain: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', columnGap: 7, rowGap: 2 },
  foodName: { color: appPalette.text, fontSize: 14, lineHeight: 21 },
  amount: { color: appPalette.muted, fontSize: 12, lineHeight: 21 },
  foodValue: { color: '#cad3d6', fontSize: 13, fontVariant: ['tabular-nums'], flexShrink: 0 },
  notes: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 3 },
  estimate: { fontSize: 10, color: appPalette.muted, lineHeight: 17 },
  pending: { fontSize: 10, color: appPalette.warning, lineHeight: 17 },
  empty: { color: appPalette.muted, fontSize: 12, paddingTop: 3, lineHeight: 20 },
});
