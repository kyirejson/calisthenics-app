import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { assistantFoodChoices, assistantFoodTotals, assistantFoodWarnings, assistantPortion, createAssistantFoodRows, getFoodServings, type AssistantFoodRow } from '../../nutrition/assistantFood';
import type { AssistantIntent } from '../../nutrition/assistantState';
import type { MealSlot } from '../../nutrition/types';
import { useAppStore } from '../../store/AppStore';
import { FoodArtwork } from './FoodArtwork';
import { appPalette as c } from '../../theme';

export function AssistantIntakeDraft({ intent, date, id, onSaved }: { intent: Extract<AssistantIntent, { type: 'log_intake' }>; date: string; id: string; onSaved?: () => void }) {
  const { nutritionJournal, saveIntakeEntry } = useAppStore();
  const [rows, setRows] = useState(() => createAssistantFoodRows(intent, nutritionJournal.customFoods));
  const [slot, setSlot] = useState<MealSlot | null>(intent.slot), [picker, setPicker] = useState<number | null>(null), [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState(''); const saving = useRef(false);
  const totals = useMemo(() => assistantFoodTotals(rows), [rows]);
  const warnings = assistantFoodWarnings(rows, nutritionJournal.preferences, nutritionJournal.assistant.facts);
  const change = (i: number, patch: Partial<AssistantFoodRow>) => setRows(current => current.map((r, n) => n === i ? { ...r, ...patch } : r));
  const confirm = async () => {
    if (!totals || !slot || saved || saving.current) return; saving.current = true; setBusy(true); setError('');
    try {
      await saveIntakeEntry({ id, date, slot, name: rows.map(r => r.food!.name).join('、').slice(0, 180), portions: totals.portions, customFoods: rows.map(r => r.food!).filter(f => f.source.kind === 'user_label'), source: 'manual' }); setSaved(true); onSaved?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '未能保存，请重试。'); }
    finally { saving.current = false; setBusy(false); }
  };
  return <View style={s.card} testID="assistant-intake-draft">
    <View style={s.between}><Text style={s.title}>{saved ? '已记录这一餐' : '待确认饮食'}</Text><Text style={s.muted}>{date.slice(5)}</Text></View>
    {rows.map((row, i) => <View key={i} style={s.row}>
      <FoodArtwork food={row.food} size={44} /><View style={s.flex}><Text style={s.text}>{row.food?.name ?? row.request.name}</Text><Text style={s.muted}>{row.food?.state ?? '选择对应食品与生熟状态'}</Text>
        {!saved ? <Pressable accessibilityRole="button" accessibilityLabel={'选择记餐食品' + (i + 1)} disabled={busy} onPress={() => { setPicker(picker === i ? null : i); setQuery(row.request.name); }} style={s.link}><Text style={s.lime}>选择／更换食品</Text></Pressable> : null}
      </View>
      <TextInput accessibilityLabel={'记餐食品' + (i + 1) + '克重'} value={row.grams === null ? '' : String(row.grams)} placeholder="克重" placeholderTextColor={c.muted} keyboardType="decimal-pad" editable={!saved && !busy && !!row.food} onChangeText={v => change(i, { grams: /^(?:\d+(?:\.\d*)?|\.\d+)$/u.test(v.trim()) ? Number(v) : null, estimated: false })} style={s.weight} />
      <Text style={s.muted}>g</Text>
    </View>)}
    {picker !== null && !saved ? <View style={s.options}><TextInput accessibilityLabel="搜索助手记餐食品" value={query} onChangeText={setQuery} style={s.search} placeholder="搜索食品或我的食品" placeholderTextColor={c.muted} />
      {assistantFoodChoices(query, 'unknown', nutritionJournal.customFoods).slice(0, 12).map(food => <Pressable accessibilityRole="button" accessibilityLabel={'记餐选择' + food.name} key={food.id} onPress={() => { change(picker, { food, ...assistantPortion(food, rows[picker].request) }); setPicker(null); }} style={s.option}><Text style={s.text}>{food.name}</Text><Text style={s.muted}>{food.state}</Text></Pressable>)}
      {!assistantFoodChoices(query, 'unknown', nutritionJournal.customFoods).length ? <Text style={s.muted}>未收录，请先通过添加食品创建包装标签；混合菜可改用拍照核对食材。</Text> : null}
    </View> : null}
    {!saved ? rows.map((row, i) => row.food && row.grams === null ? <View key={'portion-' + i} style={s.options}><Text style={s.muted}>{row.food.name} · 选择实际份量</Text>{getFoodServings(row.food).map(p => <Pressable key={p.label} accessibilityRole="button" onPress={() => change(i, { grams: p.grams, estimated: true })} style={s.option}><Text style={s.lime}>{p.label}</Text></Pressable>)}</View> : null) : null}
    {totals ? <View style={s.totals}><Text style={s.energy}>{Math.round(totals.nutrients.calories)}<Text style={s.muted}> kcal</Text></Text><Text style={s.muted}>蛋白质 {totals.nutrients.protein}g · 碳水 {totals.nutrients.carbs}g · 脂肪 {totals.nutrients.fat}g</Text></View> : <Text style={s.muted}>补齐食品、状态和份量后计算，不使用模型猜测营养。</Text>}
    {rows.some(r => r.estimated) ? <Text style={s.muted}>家用份量为参考估量，保存前请核对可食克重。</Text> : null}
    {warnings.map(w => <Text style={s.warning} key={w}>{w}</Text>)}
    {!saved ? <><View style={s.slots}>{([{ value: 'breakfast', label: '早餐' }, { value: 'lunch', label: '午餐' }, { value: 'snack', label: '加餐' }, { value: 'dinner', label: '晚餐' }] as const).map(item => <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={'记餐到' + item.label} accessibilityState={{ checked: slot === item.value }} disabled={busy} onPress={() => setSlot(item.value)} style={[s.slot, slot === item.value && s.selected]}><Text style={slot === item.value ? s.dark : s.muted}>{item.label}</Text></Pressable>)}</View><Pressable accessibilityRole="button" accessibilityLabel="确认助手记餐" disabled={!totals || !slot || busy} onPress={() => void confirm()} style={[s.confirm, (!totals || !slot || busy) && s.disabled]}><Text style={s.dark}>{busy ? '保存中…' : '确认记入这一餐'}</Text></Pressable></> : null}
    {error ? <Text accessibilityRole="alert" style={s.warning}>{error}</Text> : null}
  </View>;
}
const s = StyleSheet.create({
  card: { gap: 12, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 12 }, title: { color: c.text, fontSize: 15, fontWeight: '800' }, text: { color: c.text, fontSize: 13, fontWeight: '600' }, muted: { color: c.muted, fontSize: 11, lineHeight: 18 }, lime: { color: c.lime, fontSize: 12 }, dark: { color: c.onLime, fontWeight: '800', fontSize: 12 }, flex: { flex: 1, minWidth: 0 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, row: { flexDirection: 'row', gap: 8, alignItems: 'center' }, weight: { width: 64, minHeight: 44, padding: 8, borderRadius: 10, color: c.text, backgroundColor: c.raised, borderWidth: 1, borderColor: c.border }, link: { minHeight: 32, justifyContent: 'center' }, options: { gap: 6 }, option: { minHeight: 44, padding: 9, backgroundColor: c.raised, borderRadius: 8 }, search: { color: c.text, padding: 12, minHeight: 44, borderRadius: 10, backgroundColor: c.raised }, totals: { gap: 5 }, energy: { fontSize: 30, fontWeight: '900', color: c.text }, warning: { color: c.warning, fontSize: 12, lineHeight: 19 }, slots: { flexDirection: 'row', gap: 5 }, slot: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.raised }, selected: { backgroundColor: c.lime }, confirm: { minHeight: 44, borderRadius: 12, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: .4 },
});
