import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getFood } from '../../nutrition/catalog';
import { slotLabels } from '../../nutrition/labels';
import type { MealAdjustmentDraft } from '../../nutrition/adjustments';
import { fitnessColors as colors, appPalette, progressPageLayout } from '../../theme';

const signed = (value: number) => (value > 0 ? '+' : '') + Math.round(value * 10) / 10;

export function MealDraftContent({ draft, onApply }: {
  draft: MealAdjustmentDraft; onApply: (draft: MealAdjustmentDraft) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState(false);
  const pending = useRef(false);
  const apply = async () => {
    if (pending.current || applied) return;
    pending.current = true; setBusy(true); setError('');
    try { await onApply(draft); setApplied(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '未能保存，请重试。'); }
    finally { pending.current = false; setBusy(false); }
  };
  const body = <View style={styles.bodyContent}>
    <View style={styles.head}><Text style={styles.kicker}>{slotLabels[draft.slot]} · 待你确认</Text><Text style={styles.date}>{draft.date}</Text></View>
    <Text style={styles.title}>这一餐，怎么改</Text>
    <Text style={styles.explanation}>{draft.explanation}</Text>
    <View style={styles.before}><Text style={styles.label}>原推荐</Text><Text style={styles.beforeName}>{draft.original.name}</Text><Text style={styles.small}>{Math.round(draft.original.nutrients.calories)} kcal · 蛋白 {Math.round(draft.original.nutrients.protein)} g</Text></View>
    <View style={styles.after}><Text style={styles.label}>新推荐</Text><Text style={styles.mealName}>{draft.meal.name}</Text><Text style={styles.energy}>{Math.round(draft.meal.nutrients.calories)} <Text style={styles.unit}>kcal</Text><Text style={styles.time}> · {draft.meal.minutes} 分钟制作</Text></Text>
      <View style={styles.macros}>{([['calories', '能量', 'kcal'], ['protein', '蛋白质', 'g'], ['carbs', '碳水', 'g'], ['fat', '脂肪', 'g']] as const).map(([key, label, unit]) => <View key={key} style={styles.macro}><Text style={styles.small}>{label}差异</Text><Text style={styles.delta}>{signed(draft.difference[key])} <Text style={styles.unit}>{unit}</Text></Text></View>)}</View>
    </View>
    <Text style={styles.label}>具体份量 · 按食材标注的生熟状态</Text>
    <View style={styles.ingredients}>{draft.meal.ingredients.map((portion, index) => <View key={portion.foodId + index} style={styles.ingredient}><Text style={styles.food}>{getFood(portion.foodId)?.name || portion.foodId}</Text><Text style={styles.grams}>{portion.grams} g</Text></View>)}</View>
    <View style={styles.projection}><Text style={styles.small}>{draft.projectionLabel}</Text><Text style={styles.projectionValue}>{Math.round(draft.projected.calories)} kcal · 蛋白 {Math.round(draft.projected.protein)} g</Text></View>
    {draft.notes.some(note => note.includes('较大差距') || note.includes('尚未满足')) ? <Text style={styles.warning}>所列组合与全天参考仍有差距，不会强行用这一餐凑齐。</Text> : null}
    <Text style={styles.safety}>只改推荐菜单，不改全天目标，也不记为已吃。</Text>
    {draft.notes.some(note => note.includes('照片')) ? <Text style={styles.warning}>含照片估算，份量与用油误差会影响草案。</Text> : null}
    {draft.notes.some(note => note.includes('过敏')) ? <Text style={styles.warning}>仍须核对包装、酱料与交叉接触，筛选不保证过敏安全。</Text> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: details }} onPress={() => setDetails(value => !value)} style={styles.detailButton}><Text style={styles.link}>{details ? '收起做法与限制 −' : '查看做法与限制 ＋'}</Text></Pressable>
    {details ? <View style={styles.details}>{draft.meal.steps.map((step, index) => <Text key={index} style={styles.explanation}>{index + 1}. {step}</Text>)}{draft.notes.map(note => <Text key={note} style={styles.small}>{note}</Text>)}</View> : null}
  </View>;
  const footer = <View style={styles.footer}>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {applied ? <Text accessibilityRole="alert" style={styles.saved}>已更新推荐 · 摄入记录未改变</Text> : <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="确认应用菜单草案" disabled={busy} onPress={() => void apply()} style={[styles.apply, busy && { opacity: 0.5 }]}><Text style={[styles.buttonText, styles.applyText]}>{busy ? '保存中…' : '确认替换推荐'}</Text></Pressable>
    </View>}
  </View>;
  return <View style={styles.content}>{body}{footer}</View>;
}

const styles = StyleSheet.create({
  bodyContent: { gap: 12 }, footer: { gap: 10 },
  content: { gap: 12 }, head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, kicker: { fontSize: 11, fontWeight: '800', color: colors.green }, date: { color: colors.inkMuted, fontSize: 11 }, title: { color: colors.ink, fontSize: progressPageLayout.title.fontSize, fontWeight: '900' }, explanation: { color: colors.inkMuted, fontSize: 13, lineHeight: 21 }, label: { fontSize: 11, fontWeight: '800', color: colors.inkMuted }, before: { backgroundColor: colors.paper, borderRadius: 14, padding: 14, gap: 5 }, beforeName: { color: colors.inkMuted, fontSize: 14, fontWeight: '700' }, small: { color: colors.inkMuted, fontSize: 11, lineHeight: 18 }, after: { backgroundColor: appPalette.olive, borderRadius: 18, padding: 16, gap: 8 }, mealName: { fontSize: 16, fontWeight: '900', color: colors.ink, lineHeight: 24 }, energy: { color: colors.ink, fontSize: 25, fontWeight: '900' }, unit: { color: colors.inkMuted, fontSize: 11, fontWeight: '600' }, time: { color: colors.inkMuted, fontSize: 11, fontWeight: '500' }, macros: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, macro: { width: '46%', flexGrow: 1, paddingTop: 8 }, delta: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 3 }, ingredients: { gap: 6 }, ingredient: { flexDirection: 'row', gap: 12, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.line }, food: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 19 }, grams: { color: colors.ink, fontWeight: '800', fontSize: 12, lineHeight: 19 }, projection: { backgroundColor: colors.paper, borderRadius: 12, padding: 12, gap: 4 }, projectionValue: { color: colors.ink, fontSize: 13, fontWeight: '800' }, safety: { color: colors.green, fontSize: 12, lineHeight: 19, fontWeight: '700' }, warning: { color: appPalette.warning, fontSize: 11, lineHeight: 18 }, detailButton: { minHeight: 44, justifyContent: 'center' }, link: { color: colors.green, fontSize: 12, fontWeight: '800' }, details: { gap: 9 }, error: { color: colors.danger, fontSize: 12, lineHeight: 20 }, saved: { color: colors.green, fontSize: 13, fontWeight: '800', paddingVertical: 12 }, actions: { flexDirection: 'row', gap: 10, marginTop: 4 }, apply: { flex: 1, minHeight: 46, borderRadius: 14, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime }, applyText: { color: appPalette.onLime }, buttonText: { color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
