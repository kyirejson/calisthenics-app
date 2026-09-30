import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { addPhotoFood, photoUsesOnlyLabels, summarizePhotoEstimate, type PhotoEstimate } from '../../nutrition/vision';
import { calculateIngredients, createIngredientReview, ingredientForFood, ingredientIssue, referenceServings, type CaptureIngredient, type IngredientRecognition } from '../../nutrition/ingredientCapture';
import { FOODS } from '../../nutrition/catalog';
import type { Food, FoodLabelDraft, MealSlot } from '../../nutrition/types';
import type { CapturedNutritionPhoto } from '../../nutrition/photoStorage';
import { captureServings } from '../../nutrition/captureServings';
import { useAppStore } from '../../store/AppStore';
import { FoodCaptureCamera, type FoodCaptureResult } from './FoodCaptureCamera';
import { CustomFoodForm } from './IntakeEditor';
import { AppGlyph } from '../AppGlyph';
import { FoodArtwork } from './FoodArtwork';

type Props = { visible: boolean; onClose: () => void; onSave: (estimate: PhotoEstimate, slot: MealSlot, frame?: CapturedNutritionPhoto, retain?: boolean) => Promise<void>; initialSlot?: MealSlot; saveLabel?: string };
type Phase = 'idle' | 'capturing' | 'saving';
const slots: { value: MealSlot; label: string }[] = [{ value: 'breakfast', label: '早餐' }, { value: 'lunch', label: '午餐' }, { value: 'dinner', label: '晚餐' }, { value: 'snack', label: '加餐' }];
const fractions = [{ label: '全部', value: 1 }, { label: '一半', value: .5 }, { label: '四分之一', value: .25 }];
const c = { paper: '#0D1114', card: '#1B2028', raised: '#222833', line: '#343C48', ink: '#F4F6FA', muted: '#A8B1BF', lime: '#C7F548' };
const isForeground = () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive' && !(Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden);

// Closing destroys pending captures; saved network consent survives future sessions.
export function FoodCameraModal({ visible, ...props }: Props) { return visible ? <FoodCameraSession {...props} /> : null; }
function FoodCameraSession({ onClose, onSave, initialSlot = 'lunch', saveLabel }: Omit<Props, 'visible'>) {
  const { nutritionJournal, saveCustomFood } = useAppStore();
  const alive = useRef(true), saving = useRef(false);
  const [active, setActive] = useState(isForeground);
  const [phase, setPhase] = useState<Phase>('idle'), [error, setError] = useState('');
  const [frame, setFrame] = useState<CapturedNutritionPhoto | null>(null);
  const [recognition, setRecognition] = useState<IngredientRecognition | null>(null), [rows, setRows] = useState<CaptureIngredient[]>([]);
  const [fraction, setFraction] = useState(1), [estimate, setEstimate] = useState<PhotoEstimate | null>(null);
  const [slot, setSlot] = useState(initialSlot), [retainPhoto, setRetainPhoto] = useState(false);
  const [advanced, setAdvanced] = useState(false), [details, setDetails] = useState(false);
  const [picker, setPicker] = useState<number | null>(null), [query, setQuery] = useState(''), [chosenFood, setChosenFood] = useState<Food | null>(null);
  const [labelDraft, setLabelDraft] = useState<FoodLabelDraft | null>(null), [labelFood, setLabelFood] = useState<Food | null>(null), [labelGrams, setLabelGrams] = useState('');
  const busy = phase !== 'idle', stage = estimate ? 3 : recognition || labelDraft || labelFood ? 2 : 1;
  const totals = useMemo(() => estimate ? summarizePhotoEstimate(estimate).nutrients : null, [estimate]);
  const issue = recognition ? ingredientIssue(rows) : null;
  const foods = useMemo(() => [...FOODS, ...nutritionJournal.customFoods], [nutritionJournal.customFoods]);
  useEffect(() => {
    alive.current = true;
    const changed = () => { if (alive.current) setActive(isForeground()); };
    const subscription = AppState.addEventListener('change', changed);
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', changed);
    return () => { alive.current = false; subscription.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', changed); };
  }, []);
  const close = () => { if (saving.current) return; alive.current = false; onClose(); };
  const reset = () => { setFrame(null); setRecognition(null); setRows([]); setEstimate(null); setLabelDraft(null); setLabelFood(null); setError(''); setFraction(1); setRetainPhoto(false); setAdvanced(false); setDetails(false); setPhase('idle'); };
  const back = () => {
    if (saving.current) return;
    if (busy) { close(); return; }
    if (picker !== null) { setPicker(null); return; }
    if (estimate && (recognition || labelFood)) { setEstimate(null); setDetails(false); setError(''); return; }
    if (stage > 1) { reset(); return; }
    close();
  };
  const receiveCapture = (result: FoodCaptureResult) => {
    setPhase('idle'); setFrame(result.frame ?? null); setEstimate(null); setError(''); setFraction(1); setRetainPhoto(false);
    if (result.kind === 'label') { setLabelDraft(result.draft); setLabelFood(null); setLabelGrams(''); setRecognition(null); setRows([]); }
    else { setLabelDraft(null); setLabelFood(null); setRecognition(result.recognition); setRows(createIngredientReview(result.recognition, nutritionJournal.customFoods)); }
  };
  const useLabelPortion = (grams: number, label: string) => {
    if (!labelFood) return;
    try { setEstimate(addPhotoFood({ id: 'capture-' + Date.now().toString(36), model: 'label-calculator', items: [], assumptions: ['按核对后的产品标签与食用份量计算。'], warnings: ['标签净重不代表实际吃下重量。'] }, labelFood, { label, grams })); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '请确认食用量。'); }
  };
  const changeRow = (index: number, change: Partial<CaptureIngredient>) => setRows(current => current.map((row, i) => i === index ? { ...row, ...change } : row));
  const openPicker = (index: number) => { setPicker(index); setQuery(''); setChosenFood(null); };
  const chooseServing = (food: Food, grams: number) => {
    const previous = picker !== null && picker >= 0 ? rows[picker] : null;
    const row = ingredientForFood(food, { name: food.name, state: 'unknown', role: previous?.role ?? (food.id.endsWith('-oil') ? 'oil' : 'food'), estimatedGrams: grams, count: null }, previous?.key ?? 'ingredient-' + Date.now());
    row.grams = grams; row.quantityLabel = '参考份量';
    setRows(current => picker === -1 ? [...current, row] : current.map((item, i) => i === picker ? row : item)); setPicker(null); setError('');
  };
  const save = async () => {
    if (!estimate || busy || saving.current || !active || !alive.current) return;
    saving.current = true; setPhase('saving'); setError('');
    try { await onSave(estimate, slot, frame ?? undefined, retainPhoto); if (alive.current) { saving.current = false; close(); } }
    catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '记录未能保存，请重试。'); }
    finally { saving.current = false; if (alive.current) setPhase('idle'); }
  };
  const title = picker !== null ? '选择食材与份量' : stage === 1 ? '拍照记餐' : stage === 3 ? '确认这一餐' : labelDraft ? '核对包装标签' : labelFood ? '实际吃了多少？' : '核对食材';
  return <Modal visible transparent animationType="slide" onRequestClose={back}>
    <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.sheet} accessibilityViewIsModal>
        <View style={s.header}><Icon label="返回" name="back" onPress={back} disabled={saving.current} /><Text style={s.title}>{title}</Text><Text style={s.step}>{stage === 1 ? '' : stage + ' / 3'}</Text></View>
        {stage === 1 ? <FoodCaptureCamera onResult={receiveCapture} onBusyChange={value => { if (alive.current) setPhase(value ? 'capturing' : 'idle'); }} /> : <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {picker !== null ? <>
            <TextInput accessibilityLabel="搜索食材" placeholder="搜索食品库或我的食品" placeholderTextColor={c.muted} value={query} onChangeText={text => { setQuery(text); setChosenFood(null); }} style={s.input} />
            {chosenFood ? <View style={s.card}><View style={s.ingredientRow}><FoodArtwork food={chosenFood} size={64} /><View style={s.flex}><Text style={s.cardTitle}>{chosenFood.name}</Text><Text style={s.small}>{chosenFood.state}</Text></View></View>{referenceServings(chosenFood).map(portion => <Button key={portion.label} label={portion.label} onPress={() => chooseServing(chosenFood, portion.grams)} />)}</View> : foods.filter(food => !query.trim() || [food.name, ...food.aliases].some(name => name.includes(query.trim()))).map(food => <Pressable key={food.id} accessibilityRole="button" onPress={() => setChosenFood(food)} style={s.searchRow}><FoodArtwork food={food} /><View style={s.flex}><Text style={s.name}>{food.name}</Text><Text style={s.small}>{food.state}</Text></View><AppGlyph name="chevron" /></Pressable>)}
            <Text style={s.small}>找不到时，可返回“今日饮食 → 添加食品”按包装标签创建，再选择这项食品。不会自动套用其他菜肴。</Text>
          </> : labelDraft ? <>
            {frame?.dataUrl ? <Image source={{ uri: frame.dataUrl }} style={s.labelPhoto} resizeMode="contain" accessibilityLabel="待核对的包装照片" /> : null}
            <CustomFoodForm draft={labelDraft} photoInput={frame ?? undefined} food={labelDraft.origin.provider === 'open_food_facts' ? nutritionJournal.customFoods.find(food => food.source.origin?.identifier === labelDraft.origin.identifier && food.source.origin.provider === 'open_food_facts') : undefined} busy={busy} onBusyChange={value => { saving.current = value; if (alive.current) setPhase(value ? 'saving' : 'idle'); }} saveLabel="保存食品，选择食用份量" onCancel={reset} onSave={async food => {
              saving.current = true; setPhase('saving');
              try { await saveCustomFood(food); if (alive.current) { setLabelFood(food); setLabelDraft(null); setLabelGrams(''); } } finally { saving.current = false; if (alive.current) setPhase('idle'); }
            }} />
          </> : labelFood && !estimate ? <View style={s.card}>
            <Text style={s.cardTitle}>{labelFood.name}</Text><Text style={s.small}>每100g：{labelFood.per100g.calories.toFixed(1)} kcal · 蛋白质 {labelFood.per100g.protein.toFixed(1)}g</Text>
            <Text style={s.small}>{labelFood.packageGrams ? '包装净重 ' + labelFood.packageGrams + 'g，请选择实际吃下的比例。' : '净重未知，不会默认一份等于100g。'}</Text>
            {captureServings(labelFood).map(portion => <Button key={portion.label + portion.grams} label={portion.label + ' · ' + portion.grams + 'g'} onPress={() => useLabelPortion(portion.grams, portion.label)} />)}
            <TextInput accessibilityLabel="包装食品实际食用重量g" value={labelGrams} onChangeText={setLabelGrams} keyboardType="decimal-pad" placeholder="可选：实际食用克重" placeholderTextColor={c.muted} style={s.input} /><Button label="按克重计算" onPress={() => useLabelPortion(/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(labelGrams.trim()) ? Number(labelGrams) : NaN, '用户确认份量')} />
          </View> : stage === 2 && recognition ? <>
            <DishPhoto frame={frame} title={recognition.dishName} badge="视觉初估" />
            <View style={s.card}><Text style={s.cardTitle}>确认食材</Text>{rows.map((row, index) => <View key={row.key} style={[s.ingredient, index > 0 && s.divider]}>
              <View style={s.ingredientRow}><FoodArtwork food={row.food} size={48} /><View style={s.flex}><Text style={s.name}>{row.name}</Text><Text style={s.small}>{!row.food ? '尚未匹配食品库' : row.quantityLabel}</Text></View>
                {row.role !== 'oil' && row.grams !== null ? <View style={s.counter}><Icon label={'减少' + row.name} text="−" onPress={() => {
                  const unit = row.gramsPerUnit ?? row.grams!, count = row.count ?? row.grams! / unit; if (count <= 1) return; const next = Math.max(1, count - 1); changeRow(index, { count: row.unit === '个' ? next : null, grams: Math.round(next * unit * 10) / 10 });
                }} disabled={busy || row.grams <= (row.gramsPerUnit ?? row.grams)} /><Text style={s.count}>{row.count ?? (row.gramsPerUnit ? Math.round(row.grams / row.gramsPerUnit * 10) / 10 : 1)}</Text><Icon label={'增加' + row.name} text="＋" onPress={() => { const unit = row.gramsPerUnit ?? row.grams!, count = row.count ?? row.grams! / unit; changeRow(index, { count: row.unit === '个' ? count + 1 : null, grams: Math.round((row.grams! + unit) * 10) / 10 }); }} disabled={busy || row.grams + (row.gramsPerUnit ?? row.grams) > 2000} /><Text style={s.unit}>{row.unit}</Text></View> : row.role !== 'oil' ? <Button label="选份量" onPress={() => openPicker(index)} /> : null}
              </View>
              {row.role === 'oil' ? <><View style={s.chips}>{[{ label: '无油', grams: 0 }, { label: '少油', grams: 5 }, { label: '普通', grams: 10 }, { label: '多油', grams: 15 }].map(option => <Chip key={option.label} label={option.label} selected={row.grams === option.grams} onPress={() => changeRow(index, { grams: option.grams })} />)}</View><Text style={s.small}>用油参考 0 / 5 / 10 / 15g · {row.food?.name ?? '请选择油种'}</Text></> : null}
              {!row.food ? <Button label="选择对应食品库条目" onPress={() => openPicker(index)} /> : null}
            </View>)}</View>
            <View style={s.card}><Text style={s.cardTitle}>这盆吃了多少？</Text><View style={s.chips}>{fractions.map(option => <Chip key={option.label} label={option.label} selected={fraction === option.value} filled onPress={() => setFraction(option.value)} />)}</View></View>
            <Button label="＋ 补充食材 / 调味料" onPress={() => openPicker(-1)} disabled={rows.length >= 12} />
            <Button label={advanced ? '收起克重与配料 ﹀' : '调整克重与配料 ›'} onPress={() => setAdvanced(value => !value)} />
            {advanced ? <View style={s.card}><Text style={s.small}>按食品库所示生熟状态填写；鸡蛋约50.3g/个，番茄约125g/个，均为参考估量。</Text>{rows.map((row, index) => <View key={row.key} style={s.advancedRow}><View style={s.flex}><Text style={s.name}>{row.name}</Text><Text style={s.small}>{row.food?.state ?? '状态尚未确认'}</Text><View style={s.chips}><Button label="替换" onPress={() => openPicker(index)} /><Button label="移除" onPress={() => setRows(current => current.filter((_, i) => i !== index))} /></View></View><GramInput row={row} onChange={grams => changeRow(index, { grams, count: null, gramsPerUnit: grams, unit: '份', quantityLabel: '用户调整份量' })} /></View>)}</View> : null}
            {issue ? <Text style={s.validation}>{issue}</Text> : null}
          </> : estimate && totals ? <>
            <DishPhoto frame={frame} title={estimate.dishName ?? estimate.items[0].name} badge={photoUsesOnlyLabels(estimate) ? '按核对标签计算' : '按确认食材计算'} />
            <View style={s.card}><Text style={s.small}>本次食用 · {recognition ? fractions.find(option => option.value === fraction)?.label : estimate.items[0].portionLabel}</Text><View style={s.energy}><Text style={s.approx}>约</Text><Text style={s.energyValue}>{Math.round(totals.calories)}</Text><Text style={s.unit}>kcal</Text></View>
              <View style={s.macros}>{([{ label: '蛋白质', value: totals.protein }, { label: '碳水', value: totals.carbs }, { label: '脂肪', value: totals.fat }]).map((macro, i) => <View key={macro.label} style={[s.macro, i > 0 && s.macroBorder]}><Text style={s.small}>{macro.label}</Text><Text style={s.macroValue}>{macro.value}<Text style={s.unit}> g</Text></Text></View>)}</View><Text style={s.centerHint}>食材份量仍为估计</Text></View>
            <View style={s.card}><Pressable accessibilityRole="button" accessibilityLabel="展开食材与计算依据" onPress={() => setDetails(value => !value)} style={s.between}><Text style={s.cardTitle}>食材与计算依据</Text><AppGlyph name={details ? 'back' : 'chevron'} /></Pressable>
              {details ? estimate.items.map((item, index) => <View key={index} style={s.sourceRow}><Text style={s.name}>{item.name} · {item.estimatedGrams}g</Text>{item.provenance?.kind === 'catalog' ? <><Text style={s.small}>{item.provenance.state}</Text><Text style={s.small}>{item.provenance.source.title}</Text><Text style={s.small}>每100g {item.provenance.per100g.calories} kcal · 食用 {item.provenance.grams}g</Text></> : null}</View>) : null}
              <Pressable accessibilityRole="button" onPress={back} style={s.editLink}><AppGlyph name="edit" color={c.lime} size={17} /><Text style={s.link}>{recognition ? '返回调整食材' : '返回调整份量'}</Text></Pressable></View>
            <View style={s.card}><Text style={s.cardTitle}>记到哪一餐？</Text><View style={s.chips}>{slots.map(option => <Chip key={option.value} label={option.label} selected={slot === option.value} filled onPress={() => setSlot(option.value)} disabled={busy} />)}</View></View>
            {frame?.dataUrl ? <Pressable accessibilityRole="checkbox" accessibilityLabel="保存饮食照片到本机" accessibilityState={{ checked: retainPhoto }} disabled={busy} onPress={() => setRetainPhoto(value => !value)} style={s.photoChoice}><View style={[s.checkbox, retainPhoto && s.checkboxSelected]}>{retainPhoto ? <AppGlyph name="check" size={15} color={c.paper} /> : null}</View><Text style={s.small}>保存照片到本机</Text></Pressable> : null}
          </> : null}
          {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        </ScrollView>}
        {picker === null && recognition && !estimate ? <View style={s.footer}><Text style={s.centerHint}>ⓘ 按食品库计算，份量仍有误差</Text><Button primary label="按食材计算 ›" disabled={!!issue || busy || !active} onPress={() => { try { setEstimate(calculateIngredients(recognition, rows, fraction)); setDetails(false); setError(''); } catch (reason) { setError(reason instanceof Error ? reason.message : '请核对食材。'); } }} /></View>
          : estimate ? <View style={s.footer}><Button primary label={phase === 'saving' ? '正在保存…' : saveLabel ?? '确认，记录' + slots.find(option => option.value === slot)?.label} disabled={busy || !active} onPress={() => void save()} /></View> : null}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

function DishPhoto({ frame, title, badge }: { frame: CapturedNutritionPhoto | null; title: string; badge: string }) {
  return <View style={s.dishPhoto}>{frame?.dataUrl ? <Image source={{ uri: frame.dataUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="本次拍摄的餐食" /> : null}<LinearGradient colors={['transparent', 'rgba(0,0,0,.82)']} style={StyleSheet.absoluteFill} /><View style={s.dishCaption}><Text style={s.dishTitle}>{title}</Text><Text style={s.badge}>{badge}</Text></View></View>;
}
function GramInput({ row, onChange }: { row: CaptureIngredient; onChange: (grams: number | null) => void }) {
  const [text, setText] = useState(String(row.grams ?? '')); useEffect(() => setText(String(row.grams ?? '')), [row.grams]);
  return <View style={s.grams}><TextInput accessibilityLabel={row.name + '整盆原料克重g'} value={text} keyboardType="decimal-pad" placeholder="g" placeholderTextColor={c.muted} onChangeText={value => { setText(value); onChange(/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) ? Number(value) : null); }} style={s.gramInput} /><Text style={s.small}>g</Text></View>;
}
function Icon({ label, name, text, onPress, disabled = false }: { label: string; name?: React.ComponentProps<typeof AppGlyph>['name']; text?: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} hitSlop={4} style={[s.iconButton, text && s.counterButton, disabled && s.disabled]}>{name ? <AppGlyph name={name} color={c.ink} /> : <Text style={s.iconText}>{text}</Text>}</Pressable>;
}
function Button({ label, onPress, disabled = false, primary = false }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, primary && s.primary, disabled && s.disabled]}><Text style={[s.buttonText, primary && s.primaryText]}>{label}</Text></Pressable>;
}
function Chip({ label, selected = false, filled = false, disabled = false, onPress }: { label: string; selected?: boolean; filled?: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} style={[s.chip, selected && s.selected, selected && filled && s.primary, disabled && s.disabled]}><Text style={[s.chipText, selected && s.selectedText, selected && filled && s.primaryText]}>{label}</Text></Pressable>;
}
const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.7)', justifyContent: 'center', alignItems: 'center', padding: Platform.OS === 'web' ? 8 : 0 },
  sheet: { width: '100%', maxWidth: 440, height: '96%', backgroundColor: c.paper, borderRadius: 20, overflow: 'hidden' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  title: { color: c.ink, fontSize: 19, fontWeight: '800', flex: 1, textAlign: 'center' }, step: { color: c.muted, fontSize: 14, minWidth: 44, textAlign: 'right' },
  scroll: { flex: 1 }, content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 18, gap: 12 }, flex: { flex: 1, minWidth: 0 },
  card: { padding: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 18, gap: 12 },
  cardTitle: { color: c.ink, fontSize: 17, fontWeight: '800' }, name: { color: c.ink, fontSize: 14, fontWeight: '700', lineHeight: 21 }, small: { color: c.muted, fontSize: 11, lineHeight: 17 },
  centerHint: { color: c.muted, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  dishPhoto: { height: 170, borderRadius: 18, overflow: 'hidden', backgroundColor: c.card }, dishCaption: { position: 'absolute', left: 16, right: 12, bottom: 14, alignItems: 'flex-start', gap: 6 },
  dishTitle: { color: c.ink, fontSize: 23, fontWeight: '900' }, badge: { color: c.lime, borderWidth: 1, borderColor: c.lime, backgroundColor: 'rgba(13,17,20,.72)', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 4, fontSize: 10 },
  ingredient: { gap: 9, paddingTop: 2 }, ingredientRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  divider: { borderTopWidth: 1, borderColor: c.line, paddingTop: 12 }, counter: { flexDirection: 'row', alignItems: 'center', gap: 4 }, count: { color: c.ink, fontSize: 21, fontWeight: '800', minWidth: 25, textAlign: 'center' }, unit: { color: c.muted, fontSize: 12 },
  iconButton: { minWidth: 36, height: 44, alignItems: 'center', justifyContent: 'center' }, iconText: { fontSize: 22, color: c.ink },
  counterButton: { backgroundColor: c.raised, borderColor: c.line, borderWidth: 1, borderRadius: 9, height: 36, marginVertical: 4 },
  button: { minHeight: 48, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: c.ink, fontSize: 14, fontWeight: '700' },
  primary: { backgroundColor: c.lime, borderColor: c.lime }, primaryText: { color: c.paper }, disabled: { opacity: .4 },
  chips: { flexDirection: 'row', gap: 6 }, chip: { flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: c.line, backgroundColor: c.raised, borderRadius: 12, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  chipText: { color: c.muted, fontSize: 12, fontWeight: '700' }, selected: { borderColor: c.lime, backgroundColor: '#272F1D' }, selectedText: { color: c.lime },
  input: { backgroundColor: c.raised, borderRadius: 12, padding: 12, minHeight: 46, color: c.ink, borderWidth: 1, borderColor: c.line }, searchRow: { borderBottomWidth: 1, borderColor: c.line, paddingVertical: 10, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10 },
  advancedRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderTopWidth: 1, borderColor: c.line, paddingTop: 12 }, grams: { flexDirection: 'row', alignItems: 'center', gap: 5 }, gramInput: { width: 64, minHeight: 44, color: c.ink, backgroundColor: c.raised, borderWidth: 1, borderColor: c.line, borderRadius: 9, padding: 8 },
  validation: { color: '#DDB579', fontSize: 12 }, error: { color: '#FFADAB', backgroundColor: '#35252B', padding: 12, borderRadius: 12, fontSize: 12, lineHeight: 18 },
  footer: { padding: 16, gap: 9, borderTopWidth: 1, borderColor: c.line },
  energy: { flexDirection: 'row', gap: 7, alignItems: 'baseline' }, approx: { color: c.muted, fontSize: 15 }, energyValue: { color: c.ink, fontSize: 48, fontWeight: '900', fontVariant: ['tabular-nums'] },
  macros: { flexDirection: 'row', borderTopWidth: 1, borderColor: c.line, paddingTop: 14 }, macro: { flex: 1, alignItems: 'center', gap: 6 }, macroBorder: { borderLeftWidth: 1, borderColor: c.line }, macroValue: { color: c.ink, fontSize: 20, fontWeight: '800' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }, sourceRow: { borderTopWidth: 1, borderColor: c.line, paddingTop: 12, gap: 4 }, editLink: { minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }, link: { color: c.lime, fontSize: 12, fontWeight: '700' },
  photoChoice: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, checkbox: { width: 21, height: 21, borderRadius: 5, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }, checkboxSelected: { backgroundColor: c.lime, borderColor: c.lime }, labelPhoto: { width: '100%', height: 160, borderRadius: 16 },
});
