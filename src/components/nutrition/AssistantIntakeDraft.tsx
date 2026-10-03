import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { assistantFoodChoices, assistantFoodTotals, assistantFoodWarnings, assistantPortion, createAssistantFoodRows, getFoodServings, type AssistantFoodRow } from '../../nutrition/assistantFood';
import type { AssistantIntent } from '../../nutrition/assistantState';
import type { Food, MealSlot } from '../../nutrition/types';
import { searchNutritionDish } from '../../nutrition/agentClient';
import { portionReferences } from '../../agent/portionReferences';
import { suggestedMealSlot } from '../../agent/mealSuggestion';
import { slotLabels } from '../../nutrition/labels';
import { useAppStore } from '../../store/AppStore';
import { FoodArtwork } from './FoodArtwork';
import { appPalette as c } from '../../theme';

export function AssistantIntakeDraft({ intent, date, id, onSaved, proof }: { intent: Extract<AssistantIntent, { type: 'log_intake' }>; date: string; id: string; onSaved?: () => void; proof?: { basis: string; policyVersion: number; auto: boolean } }) {
  const { nutritionJournal, executeAssistantOperation } = useAppStore();
  const [rows, setRows] = useState(() => createAssistantFoodRows(intent, nutritionJournal.customFoods));
  const [slot, setSlot] = useState<MealSlot>(intent.slot || suggestedMealSlot(new Date())), [picker, setPicker] = useState<number | null>(null), [query, setQuery] = useState('');
  const [showSlots, setShowSlots] = useState(false);
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [error, setError] = useState(''); const saving = useRef(false);
  const [searches, setSearches] = useState<Record<number, { query: string; status: 'loading' | 'ready' | 'error'; candidates: Food[]; message: string }>>({});
  const controllers = useRef(new Map<number, AbortController>()), alive = useRef(true);
  const totals = useMemo(() => assistantFoodTotals(rows), [rows]);
  const warnings = assistantFoodWarnings(rows, nutritionJournal.preferences, nutritionJournal.assistant.facts);
  const change = (i: number, patch: Partial<AssistantFoodRow>) => setRows(current => current.map((r, n) => n === i ? { ...r, ...patch } : r));
  const editIngredients = (i?: number) => {
    for (const controller of controllers.current.values()) controller.abort(); controllers.current.clear(); setSearches({});
    const request = { name: '待选择食材', quantity: null, unit: null, state: 'unknown' } as const;
    if (i === undefined) { if (rows.length >= 8) return; setRows(current => [...current, { request, food: null, grams: null, estimated: true }]); setPicker(rows.length); }
    else { change(i, { request, food: null, grams: null, estimated: true }); setPicker(i); }
    setQuery(''); setError('');
  };
  const findDish = async (i: number, query: string) => {
    if (!nutritionJournal.assistant.consentAt || nutritionJournal.assistant.consentScope !== 2) { setError('请先同意助手联网，再搜索菜品。'); return; }
    if (!query.trim()) return;
    controllers.current.get(i)?.abort();
    const controller = new AbortController(); controllers.current.set(i, controller);
    setSearches(v => ({ ...v, [i]: { query, status: 'loading', candidates: [], message: '' } }));
    try {
      const result = await searchNutritionDish(query, rows[i].request.state, controller.signal);
      if (alive.current && !controller.signal.aborted) setSearches(v => ({ ...v, [i]: { query, status: 'ready', ...result } }));
    } catch (e) {
      if (alive.current && !controller.signal.aborted) setSearches(v => ({ ...v, [i]: { query, status: 'error', candidates: [], message: e instanceof Error ? e.message : '未搜索到菜品，请补充主要食材和做法后重试。' } }));
    } finally { if (controllers.current.get(i) === controller) controllers.current.delete(i); }
  };
  useEffect(() => {
    alive.current = true;
    let stopped = false;
    // Unknown dishes auto-search once, in sequence, rather than opening eight
    // parallel provider calls or refetching while the user types the amount.
    void (async () => { for (let i = 0; i < rows.length && !stopped; i++) {
      if (!rows[i].food && !assistantFoodChoices(rows[i].request.name, 'unknown', nutritionJournal.customFoods).length) await findDish(i, rows[i].request.name);
    } })();
    const background = AppState.addEventListener('change', state => { if (state === 'background') {
      stopped = true; for (const controller of controllers.current.values()) controller.abort(); controllers.current.clear();
      setSearches(v => Object.fromEntries(Object.entries(v).map(([i, s]) => [i, s.status === 'loading' ? { ...s, status: 'error' as const, message: '搜索已暂停，回到应用后可重新搜索。' } : s])));
    } });
    return () => { alive.current = false; stopped = true; background.remove(); for (const controller of controllers.current.values()) controller.abort(); controllers.current.clear(); };
  }, []);
  const confirm = async (confirmed = true) => {
    if (!totals || !slot || saved || saving.current) return; saving.current = true; setBusy(true); setError('');
    try {
      if (!proof) throw new Error('请重新发送记餐请求。');
      const customFoods = [...new Map(rows.filter(r => r.food?.source.kind).map(r => [r.food!.id, r.food!])).values()];
      await executeAssistantOperation({ id, ...proof, confirmed, kind: 'log_intake', input: { id, date, slot, name: rows.map(r => r.food!.name).join('、').slice(0, 180), portions: totals.portions, customFoods, source: 'manual' } }); if (alive.current) { setSaved(true); onSaved?.(); }
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '未能保存，请重试。'); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  };
  const autoAttempted = useRef(false);
  useEffect(() => {
    // Only an initially complete request auto-runs. Typing a weight must not
    // save the first digit, and changing permissions must not run an old card.
    if (autoAttempted.current) return; autoAttempted.current = true;
    if (proof?.auto && totals && intent.slot) void confirm(false);
  }, []);
  return <View style={s.card} testID="assistant-intake-draft">
    <View style={s.between}><Text style={s.title}>{saved ? '已记录这一餐' : proof?.auto ? '饮食记录' : '待确认饮食'}</Text><Text style={s.muted}>{date.slice(5)}</Text></View>
    {rows.map((row, i) => <View key={i} style={s.options}><View style={s.row}>
      <FoodArtwork food={row.food} size={44} /><View style={s.flex}><Text style={s.text}>{row.food?.name ?? row.request.name}</Text><Text style={s.muted}>{row.food?.state ?? '选择对应食品与生熟状态'}</Text>
        {!saved ? <Pressable accessibilityRole="button" accessibilityLabel={'选择记餐食品' + (i + 1)} disabled={busy} onPress={() => { setPicker(picker === i ? null : i); setQuery(row.request.name); }} style={s.link}><Text style={s.lime}>选择／更换食品</Text></Pressable> : null}
        {!saved && rows.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={'移除记餐食材' + (i + 1)} disabled={busy} onPress={() => { for (const controller of controllers.current.values()) controller.abort(); controllers.current.clear(); setSearches({}); setPicker(null); setRows(current => current.filter((_, n) => n !== i)); }} style={s.link}><Text style={s.muted}>移除这项草案</Text></Pressable> : null}
      </View>
      <TextInput accessibilityLabel={'记餐食品' + (i + 1) + '克重'} value={row.grams === null ? '' : String(row.grams)} placeholder="克重" placeholderTextColor={c.muted} keyboardType="decimal-pad" editable={!saved && !busy && !!row.food} onChangeText={v => change(i, { grams: /^(?:\d+(?:\.\d*)?|\.\d+)$/u.test(v.trim()) ? Number(v) : null, estimated: false })} style={s.weight} />
      <Text style={s.muted}>g</Text>
    </View>{!saved && !row.food && (searches[i] || !assistantFoodChoices(row.request.name, 'unknown', nutritionJournal.customFoods).length) ? <View style={s.options} testID={'dish-search-' + i}>
      <Text style={s.lime}>① 匹配菜品 → ② 确认做法 → ③ 填写份量</Text>
      <View style={s.row}><TextInput accessibilityLabel={'菜品' + (i + 1) + '搜索名称'} value={searches[i]?.query ?? row.request.name} onChangeText={query => setSearches(v => ({ ...v, [i]: { query, status: 'ready', candidates: [], message: '' } }))} placeholder="菜名，可补充地方名称和做法" placeholderTextColor={c.muted} style={[s.search, s.flex]} editable={searches[i]?.status !== 'loading'} /><Pressable accessibilityRole="button" accessibilityLabel={'重新搜索菜品' + (i + 1)} disabled={searches[i]?.status === 'loading'} onPress={() => void findDish(i, searches[i]?.query ?? row.request.name)} style={s.option}><Text style={s.lime}>搜索</Text></Pressable></View>
      {searches[i]?.status === 'loading' ? <View style={s.row}><ActivityIndicator color={c.lime} /><Text style={s.muted}>正在联网匹配菜名与做法…</Text></View> : <Text style={s.muted}>{searches[i]?.message}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={'菜品' + (i + 1) + '改为按食材记录'} disabled={busy} onPress={() => editIngredients(i)} style={s.option}><Text style={s.lime}>不搜索 · 按实际食材拆分记录</Text><Text style={s.muted}>选择吃下的食材并填写克重；用油可另添，不假设整盘重量。</Text></Pressable>
      {searches[i]?.candidates.map(food => <View key={food.id} style={s.card}><Text style={s.text}>{food.name}</Text><Text style={s.muted}>{food.source.recipe?.description}</Text><Text style={s.muted}>参考配方估算，油量和含水量会影响结果；不是这份餐食的实测数据。</Text>
        {food.source.recipe?.sources.map(source => <Pressable accessibilityRole="link" key={source.url} onPress={() => void Linking.openURL(source.url).catch(() => setError('暂时无法打开来源。'))}><Text style={s.lime}>{source.title} ↗</Text></Pressable>)}
        <Pressable accessibilityRole="button" accessibilityLabel={'确认菜品' + (i + 1) + '为' + food.name} onPress={() => { change(i, { food, ...assistantPortion(food, row.request) }); controllers.current.get(i)?.abort(); }} style={s.confirm}><Text style={s.dark}>是这道菜 · 核对实际份量</Text></Pressable>
      </View>)}
    </View> : row.food?.source.kind === 'recipe_estimate' ? <Text style={s.muted}>已确认参考做法 · 请填实际吃下的成品克重，保留联网估算来源。</Text> : null}</View>)}
    {picker !== null && !saved ? <View style={s.options}><TextInput accessibilityLabel="搜索助手记餐食品" value={query} onChangeText={setQuery} style={s.search} placeholder="搜索食品或我的食品" placeholderTextColor={c.muted} />
      {assistantFoodChoices(query, 'unknown', nutritionJournal.customFoods).slice(0, 12).map(food => <Pressable accessibilityRole="button" accessibilityLabel={'记餐选择' + food.name} key={food.id} onPress={() => { change(picker, { food, ...assistantPortion(food, rows[picker].request) }); setPicker(null); }} style={s.option}><Text style={s.text}>{food.name}</Text><Text style={s.muted}>{food.state}</Text></Pressable>)}
      {!assistantFoodChoices(query, 'unknown', nutritionJournal.customFoods).length ? <Pressable accessibilityRole="button" onPress={() => { change(picker, { food: null, grams: null, estimated: true }); void findDish(picker, query); setPicker(null); }} style={s.option}><Text style={s.lime}>联网搜索这道菜 · 不需要标签或照片</Text></Pressable> : null}
    </View> : null}
    {!saved ? rows.map((row, i) => row.food && row.grams === null ? <View key={'portion-' + i} style={s.options}><Text style={s.muted}>{row.food.name} · 选择实际份量</Text>{[...getFoodServings(row.food), ...portionReferences(row.food)].map(p => <Pressable key={p.label} accessibilityRole="button" onPress={() => change(i, { grams: p.grams, estimated: true })} style={s.option}><Text style={s.lime}>{p.label}</Text>{'note' in p ? <Text style={s.muted}>{String(p.note)}</Text> : null}</Pressable>)}</View> : null) : null}
    {!saved && rows.length < 8 ? <Pressable accessibilityRole="button" accessibilityLabel="添加记餐食材" disabled={busy} onPress={() => editIngredients()} style={s.option}><Text style={s.lime}>＋ 添加食材／用油</Text></Pressable> : null}
    {totals ? <View style={s.totals}><Text style={s.energy}>{rows.some(r => r.food?.source.kind === 'recipe_estimate') ? '≈ ' : ''}{Math.round(totals.nutrients.calories)}<Text style={s.muted}> kcal</Text></Text><Text style={s.muted}>蛋白质 {totals.nutrients.protein}g · 碳水 {totals.nutrients.carbs}g · 脂肪 {totals.nutrients.fat}g</Text></View> : <Text style={s.muted}>{rows.some(r => !r.food) ? '先选择匹配的食品或确认搜索到的菜品。搜索不可用也可按食材分别记录，不需要标签或照片。' : '填写实际吃下的可食克重即可记入，不必补齐其他餐次。'}</Text>}
    {rows.some(r => r.estimated) ? <Text style={s.muted}>家用份量为参考估量，保存前请核对可食克重。</Text> : null}
    {warnings.map(w => <Text style={s.warning} key={w}>{w}</Text>)}
    {!saved ? <>
      <Pressable accessibilityRole="button" accessibilityLabel="修改记餐餐次" disabled={busy} onPress={() => setShowSlots(v => !v)} style={s.option}><Text style={s.lime}>{slotLabels[slot]} · {intent.slot ? '按你的描述' : '按当前时间建议，可修改'}　⌄</Text></Pressable>
      {showSlots ? <View style={s.slots}>{([{ value: 'breakfast', label: '早餐' }, { value: 'lunch', label: '午餐' }, { value: 'snack', label: '加餐' }, { value: 'dinner', label: '晚餐' }] as const).map(item => <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={'记餐到' + item.label} accessibilityState={{ checked: slot === item.value }} disabled={busy} onPress={() => { setSlot(item.value); setShowSlots(false); }} style={[s.slot, slot === item.value && s.selected]}><Text style={slot === item.value ? s.dark : s.muted}>{item.label}</Text></Pressable>)}</View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={proof?.auto ? '保存助手记餐' : '确认助手记餐'} disabled={!totals || busy} onPress={() => void confirm()} style={[s.confirm, (!totals || busy) && s.disabled]}><Text style={s.dark}>{busy ? '保存中…' : proof?.auto ? '记入这一餐' : '确认记入这一餐'}</Text></Pressable>
    </> : null}
    {error ? <Text accessibilityRole="alert" style={s.warning}>{error}</Text> : null}
  </View>;
}
const s = StyleSheet.create({
  card: { gap: 12, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 12 }, title: { color: c.text, fontSize: 15, fontWeight: '800' }, text: { color: c.text, fontSize: 13, fontWeight: '600' }, muted: { color: c.muted, fontSize: 11, lineHeight: 18 }, lime: { color: c.lime, fontSize: 12 }, dark: { color: c.onLime, fontWeight: '800', fontSize: 12 }, flex: { flex: 1, minWidth: 0 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, row: { flexDirection: 'row', gap: 8, alignItems: 'center' }, weight: { width: 64, minHeight: 44, padding: 8, borderRadius: 10, color: c.text, backgroundColor: c.raised, borderWidth: 1, borderColor: c.border }, link: { minHeight: 32, justifyContent: 'center' }, options: { gap: 6 }, option: { minHeight: 44, padding: 9, backgroundColor: c.raised, borderRadius: 8 }, search: { color: c.text, padding: 12, minHeight: 44, borderRadius: 10, backgroundColor: c.raised }, totals: { gap: 5 }, energy: { fontSize: 30, fontWeight: '900', color: c.text }, warning: { color: c.warning, fontSize: 12, lineHeight: 19 }, slots: { flexDirection: 'row', gap: 5 }, slot: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.raised }, selected: { backgroundColor: c.lime }, confirm: { minHeight: 44, borderRadius: 12, backgroundColor: c.lime, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: .4 },
});
