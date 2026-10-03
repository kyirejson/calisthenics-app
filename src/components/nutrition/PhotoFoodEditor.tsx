import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FOODS } from '../../nutrition/catalog';
import { captureServings } from '../../nutrition/captureServings';
import { addPhotoFood, removePhotoItem, renamePhotoItem, replacePhotoItemWithFood, scalePhotoItem, setPhotoItemGrams, type PhotoEstimate, type PhotoFoodItem } from '../../nutrition/vision';
import type { Food } from '../../nutrition/types';
import { useAppStore } from '../../store/AppStore';
import { fitnessColors as colors, appPalette } from '../../theme';
import { FoodArtwork } from './FoodArtwork';

type Props = { estimate: PhotoEstimate; onChange: (estimate: PhotoEstimate) => void; disabled?: boolean };

/** All corrections stay on device. Never sends a photo, note, or food selection to an API. */
export function PhotoFoodEditor({ estimate, onChange, disabled = false }: Props) {
  const { nutritionJournal } = useAppStore();
  const foods = [...nutritionJournal.customFoods, ...FOODS];
  const [adding, setAdding] = useState(false);
  const [explanation, setExplanation] = useState(false);
  const [error, setError] = useState('');
  return <View style={styles.editor}>
    <Text style={styles.title}>逐项核对吃了什么</Text>
    <Text style={styles.small}>本地修改，不上传。份量按当前这项调整。</Text>
    {estimate.items.map((item, index) => <FoodRow key={index} item={item} foods={foods} disabled={disabled} onEdit={edit => onChange(edit(estimate, index))} />)}
    {!estimate.items.length ? <Text accessibilityRole="alert" style={styles.notice}>尚无食物，不能保存空记录。可补充食物或取消记餐。</Text> : null}
    <Control label={adding ? '收起补充食物' : '＋ 补充食物 / 用油'} disabled={disabled || estimate.items.length >= 12} onPress={() => setAdding(value => !value)} />
    {adding ? <FoodPicker foods={foods} disabled={disabled} inputLabel="查找漏识别的食物或用油" onSelect={(food, serving) => {
      try { onChange(addPhotoFood(estimate, food, serving)); setAdding(false); setError(''); }
      catch (reason) { setError(reason instanceof Error ? reason.message : '未能添加食物。'); }
    }} /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Text style={styles.notice}>标签食品按核对后的数值和所选份量计算；视觉份量仍有误差，不能判断隐藏过敏原。</Text>
    <Control label={explanation ? '收起估算说明' : '份量与区间如何计算？'} disabled={disabled} onPress={() => setExplanation(value => !value)} />
    {explanation ? <Text style={styles.small}>改名不重算营养。替换为标签食品时，按每100g标签和所选重量重新计算，不沿用照片估值。普通食物库替换可保留原照片的相对范围；这不是统计置信区间。选择重量不等于称重实测。</Text> : null}
  </View>;
}

function FoodRow({ item, foods, disabled, onEdit }: { item: PhotoFoodItem; foods: Food[]; disabled: boolean; onEdit: (edit: (estimate: PhotoEstimate, index: number) => PhotoEstimate) => void }) {
  const [name, setName] = useState(item.name);
  const [replacing, setReplacing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [sourceVisible, setSourceVisible] = useState(false);
  const [error, setError] = useState('');
  const [grams, setGrams] = useState(String(item.estimatedGrams ?? (item.provenance?.kind === 'catalog' ? item.provenance.grams : '')));
  useEffect(() => { setName(item.name); setReplacing(false); setRenaming(false); setSourceVisible(false); }, [item]);
  const apply = (edit: (estimate: PhotoEstimate, index: number) => PhotoEstimate) => {
    if (disabled) return;
    try { onEdit(edit); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '修改未完成，请重试。'); }
  };
  const catalog = item.provenance?.kind === 'catalog' ? item.provenance : null;
  const labelBased = catalog?.source.kind === 'user_label';
  const actualGrams = catalog?.grams ?? item.estimatedGrams;
  useEffect(() => setGrams(String(actualGrams ?? '')), [actualGrams]);
  return <View style={styles.item}>
    <View style={styles.between}><Text style={styles.badge}>{catalog?.source.kind === 'recipe_estimate' ? '联网配方估算' : labelBased ? '包装标签计算' : catalog ? '食物库参考' : '视觉估算'}</Text><Control label="移除此项" accessibilityLabel={'移除' + item.name} disabled={disabled} onPress={() => apply(removePhotoItem)} /></View>
    <View style={styles.foodHeader}><FoodArtwork food={catalog ? { id: catalog.foodId, name: item.name, photo: catalog.photo, artworkCategory: catalog.artworkCategory } : undefined} /><Text style={[styles.name, styles.flex]}>{item.name}</Text></View>
    <Text style={styles.small}>{item.portionLabel}</Text>
    <Text style={styles.small}>{actualGrams ? (catalog ? '计算份量 ' : '视觉估计约 ') + actualGrams + 'g · 请核对实际食用量' : '份量未知 · 不能把这一份当成100g'}</Text>
    <Text style={styles.macros}>约 {item.nutrients.calories} kcal · 蛋白 {item.nutrients.protein} g · 脂肪 {item.nutrients.fat} g{ '\n' }碳水 {item.nutrients.carbs} g · {catalog?.fiberKnown === false ? '纤维未知' : '纤维 ' + item.nutrients.fiber + ' g'}</Text>
    {actualGrams ? <View style={styles.row}><TextInput accessibilityLabel={item.name + '食用重量g'} value={grams} onChangeText={setGrams} editable={!disabled} keyboardType="decimal-pad" style={styles.gramsInput} /><Control label="确认克重" accessibilityLabel={'确认' + item.name + '克重'} disabled={disabled} onPress={() => apply((estimate, index) => setPhotoItemGrams(estimate, index, /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(grams.trim()) ? Number(grams) : NaN))} /></View> : null}
    {catalog?.packageGrams ? <View style={styles.row}>{[{ label: '整包', value: 1 }, { label: '半包', value: .5 }, { label: '四分之一包', value: .25 }].map(option => <Control key={option.label} label={`${option.label} · ${catalog.packageGrams! * option.value}g`} disabled={disabled} onPress={() => apply((estimate, index) => setPhotoItemGrams(estimate, index, catalog.packageGrams! * option.value))} />)}</View> : null}
    {catalog ? <><Control label={sourceVisible ? '收起计算依据' : '查看食物数据依据'} disabled={disabled} onPress={() => setSourceVisible(value => !value)} />{sourceVisible ? <Text style={styles.small}>计算依据：{catalog.foodName}{'\n'}{catalog.state}{'\n'}{catalog.source.title}{catalog.rangeBasis === 'reference-portion' ? '\n此项为参考份量的计算值，不是实测。' : ''}</Text> : null}</> : null}
    <View style={styles.row}>{[{ value: 0.5, label: '当前一半' }, { value: 1, label: '保持当前' }, { value: 1.5, label: '当前 ×1.5' }].map(option => <Control key={option.value} label={option.label} accessibilityLabel={item.name + '：' + option.label} disabled={disabled} onPress={() => apply((estimate, index) => scalePhotoItem(estimate, index, option.value))} />)}</View>
    <View style={styles.row}><Control label={renaming ? '收起改名' : '更正名称'} disabled={disabled} onPress={() => setRenaming(value => !value)} /><Control label={replacing ? '收起替换食物' : '替换食物'} accessibilityLabel={'替换' + item.name} disabled={disabled} onPress={() => setReplacing(value => !value)} /></View>
    {renaming ? <><TextInput accessibilityLabel={item.name + '的更正名称'} value={name} onChangeText={setName} editable={!disabled} maxLength={120} placeholder="更正显示名称" placeholderTextColor={colors.inkMuted} style={styles.input} /><Control label="确认改名（不改营养）" disabled={disabled || !name.trim() || name.trim() === item.name} onPress={() => apply((estimate, index) => renamePhotoItem(estimate, index, name))} /></> : null}
    {item.provenance?.renamed ? <Text style={styles.small}>名称已由你更正，数值仍按{catalog ? '上方食物库条目' : '原照片估算'}计算。</Text> : null}
    {replacing ? <FoodPicker foods={foods} disabled={disabled} inputLabel={'查找替换' + item.name + '的食物'} onSelect={(food, serving) => apply((estimate, index) => replacePhotoItemWithFood(estimate, index, food, serving))} /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

function FoodPicker({ foods, disabled, inputLabel, onSelect }: { foods: Food[]; disabled: boolean; inputLabel: string; onSelect: (food: Food, serving: { label: string; grams: number }) => void }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const search = query.trim().toLocaleLowerCase();
  const matches = foods.filter(food => !search || [food.name, ...food.aliases].some(label => label.toLocaleLowerCase().includes(search)));
  const selected = selectedId ? foods.find(food => food.id === selectedId) : null;
  return <View style={styles.replacement}>
    <Text style={styles.small}>核对生熟状态，再选择参考份量；不自动计入用油和酱料。</Text>
    <TextInput accessibilityLabel={inputLabel} value={query} onChangeText={value => { setQuery(value); setSelectedId(null); }} editable={!disabled} placeholder="如米饭、水煮蛋、食用油" placeholderTextColor={colors.inkMuted} style={styles.input} />
    {matches.slice(0, 6).map(food => <Pressable key={food.id} accessibilityRole="button" accessibilityLabel={food.name + ' · ' + food.state} accessibilityState={{ selected: selectedId === food.id, disabled }} disabled={disabled} onPress={() => setSelectedId(food.id)} style={[styles.control, styles.foodHeader, selectedId === food.id && styles.selected, disabled && styles.disabled]}><FoodArtwork food={food} /><View style={styles.flex}><Text style={styles.label}>{food.name}</Text><Text style={styles.small}>{food.state}</Text></View></Pressable>)}
    {!matches.length ? <Text style={styles.small}>本地暂无匹配，可另行手动记餐或按包装标签添加食品。</Text> : matches.length > 6 ? <Text style={styles.small}>显示前 6 项，输入名称缩小范围。</Text> : null}
    {selected ? <View style={styles.replacement}><Text style={styles.label}>使用：{selected.name}{selected.source.kind === 'user_label' ? ' · 个人标签食品' : ''}</Text><Text style={styles.small}>选择实际吃下的份量，不默认一份等于100g。</Text>{captureServings(selected).map(serving => <Control key={serving.label + serving.grams} label={'使用 ' + serving.label + ' · ' + serving.grams + 'g'} disabled={disabled} onPress={() => onSelect(selected, serving)} />)}</View> : null}
  </View>;
}

function Control({ label, accessibilityLabel, disabled, selected, onPress }: { label: string; accessibilityLabel?: string; disabled: boolean; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled, ...(selected !== undefined ? { selected } : {}) }} disabled={disabled} onPress={onPress} style={[styles.control, selected && styles.selected, disabled && styles.disabled]}><Text style={styles.controlText}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  editor: { gap: 12 }, title: { color: colors.ink, fontSize: 16, fontWeight: '800' }, small: { color: colors.inkMuted, fontSize: 12, lineHeight: 19 },
  item: { gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 12, backgroundColor: colors.paper },
  between: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }, badge: { color: colors.green, fontSize: 11, fontWeight: '800' },
  name: { color: colors.ink, fontSize: 16, fontWeight: '800' }, macros: { color: colors.ink, fontSize: 13, lineHeight: 21 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  control: { minHeight: 44, borderRadius: 10, backgroundColor: appPalette.raised, paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'center' }, controlText: { color: colors.ink, fontSize: 12, fontWeight: '700', lineHeight: 19 },
  selected: { backgroundColor: appPalette.olive }, disabled: { opacity: 0.45 }, input: { minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: appPalette.card, padding: 12, color: colors.ink, fontSize: 14 },
  replacement: { gap: 8 }, label: { color: colors.ink, fontWeight: '800', fontSize: 13 }, notice: { color: appPalette.warning, fontSize: 11, lineHeight: 18, padding: 10, backgroundColor: appPalette.warningBackground, borderRadius: 10 }, error: { color: colors.danger, fontSize: 12, lineHeight: 19 },
  foodHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' }, flex: { flex: 1, minWidth: 0 },
  gramsInput: { minHeight: 44, width: 100, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, color: colors.ink, backgroundColor: colors.card },
});
