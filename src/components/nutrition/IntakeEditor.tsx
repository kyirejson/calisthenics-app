import { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { FOOD_DATA_VERSION, FOODS, getFood } from '../../nutrition/catalog';
import { calculatePortions, createCustomFoodFromLabel } from '../../nutrition/engine';
import { getFoodServings } from '../../nutrition/servings';
import type { Allergen, Food, FoodArtworkCategory, FoodLabelDraft, IntakeEntry, MealSlot, Nutrients } from '../../nutrition/types';
import { FOOD_ARTWORK_CATEGORIES, FOOD_ARTWORK_LABELS } from '../../nutrition/foodArtwork';
import { withCapturedPhoto, type CapturedNutritionPhoto } from '../../nutrition/photoStorage';
import { FoodArtwork } from './FoodArtwork';
import { compressPhoto } from './foodPhoto';
import { labelDraftFormValues } from '../../nutrition/foodImport';
import { FoodImportModal } from './FoodImportModal';
import { useAppStore } from '../../store/AppStore';
import { fitnessColors as colors, appPalette, radius, progressPageLayout } from '../../theme';
import { confirmAction, showMessage } from '../../utils/confirm';

type Props = { date: string; entry?: IntakeEntry; initialSlot?: MealSlot; onClose: () => void };
type DraftPortion = { key: string; foodId: string; grams: string };
const slots: { value: MealSlot; label: string }[] = [
  { value: 'breakfast', label: '早餐' }, { value: 'lunch', label: '午餐' },
  { value: 'snack', label: '加餐' }, { value: 'dinner', label: '晚餐' },
];
const allergenLabels: Record<Allergen, string> = { milk: '奶', egg: '蛋', soy: '大豆', wheat: '小麦', peanut: '花生', tree_nut: '树坚果', fish: '鱼', shellfish: '甲壳贝类' };
const quickFoodIds = ['rice-cooked', 'egg-boiled', 'chicken-stewed', 'egg-noodles-cooked', 'bread-whole-wheat', 'milk-2pct', 'banana-raw', 'canola-oil'];
function gramsValue(value: string): number {
  const text = value.trim().replace(',', '.');
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) ? Number(text) : NaN;
}
function validGrams(value: string): boolean { const n = gramsValue(value); return Number.isFinite(n) && n > 0 && n <= 2000; }

export function IntakeEditor({ date, entry, initialSlot, onClose }: Props) {
  const { saveIntakeEntry, saveCustomFood, deleteCustomFood, nutritionJournal } = useAppStore();
  const initial = entry;
  const [slot, setSlot] = useState<MealSlot>(initial?.slot ?? initialSlot ?? 'lunch');
  const [name, setName] = useState(initial?.name ?? '');
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<string | null>(null);
  const [amount, setAmount] = useState('100');
  const [rows, setRows] = useState<DraftPortion[]>(() => initial?.portions.map((p, index) => ({ key: 'saved-' + index, foodId: p.foodId, grams: String(p.grams) })) ?? []);
  const [snapshots, setSnapshots] = useState<Food[]>(() => initial?.customFoods ?? []);
  const [customEditing, setCustomEditing] = useState<Food | 'new' | null>(null);
  const [importMode, setImportMode] = useState<'label' | 'barcode' | null>(null);
  const [labelDraft, setLabelDraft] = useState<FoodLabelDraft | undefined>();
  const [labelPhoto, setLabelPhoto] = useState<CapturedNutritionPhoto | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const nextRow = useRef(0);
  const recordId = useRef(entry?.id ?? 'intake-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
  const recordDate = useRef(entry?.date ?? date).current;
  const availableFoods = [...nutritionJournal.customFoods, ...quickFoodIds.flatMap(id => getFood(id) ?? []), ...FOODS.filter(food => !quickFoodIds.includes(food.id))];
  const findFood = (id: string) => getFood(id) ?? snapshots.find(food => food.id === id) ?? nutritionJournal.customFoods.find(food => food.id === id);
  const customFoods = [...new Map([...nutritionJournal.customFoods, ...snapshots].map(food => [food.id, food])).values()];
  const search = query.trim().toLocaleLowerCase();
  const matches = availableFoods.filter(food => [food.name, ...food.aliases].some(label => label.toLocaleLowerCase().includes(search)));
  const selected = selectedFood ? findFood(selectedFood) : undefined;
  const fiberIncomplete = rows.some(row => findFood(row.foodId)?.fiberKnown === false);
  const validationError = !rows.length ? '请至少添加一种食物。'
    : rows.some(row => !findFood(row.foodId)) ? '记录含旧版食物，请移除并选用当前食材后保存。'
      : rows.some(row => !validGrams(row.grams)) ? '每项克数须大于 0、至多 2000，可输入小数。' : '';
  let nutrients: Nutrients | null = null;
  if (!validationError) {
    try { nutrients = calculatePortions(rows.map(row => ({ foodId: row.foodId, grams: gramsValue(row.grams) })), customFoods); }
    catch { nutrients = null; }
  }
  const close = () => { if (!busy && !submitting.current) onClose(); };
  const chooseFood = (food: Food) => {
    setSelectedFood(food.id); setAmount(String(getFoodServings(food)[0]?.grams ?? 100)); setError('');
  };
  const saveFood = async (food: Food) => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true);
    try {
      await saveCustomFood(food);
      setSnapshots(current => [food, ...current.filter(item => item.id !== food.id)]);
      setCustomEditing(null); setSelectedFood(food.id); setQuery(''); setAmount(String(food.serving?.grams ?? 100));
    } finally { submitting.current = false; setBusy(false); }
  };
  const removeCustomFood = (food: Food) => confirmAction('删除自定义食品？', '从搜索列表移除；已保存记录、常用餐和当前清单里的食品快照不受影响。', () => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true);
    void deleteCustomFood(food.id).then(() => {
      setSnapshots(current => [food, ...current.filter(item => item.id !== food.id)]); setSelectedFood(null);
    }).catch(reason => setError(reason instanceof Error ? reason.message : '删除失败，请重试。'))
      .finally(() => { submitting.current = false; setBusy(false); });
  }, { destructive: true, confirmLabel: '删除食品' });
  const addFood = () => {
    if (submitting.current || !selected || !validGrams(amount)) return;
    if (rows.length >= 100) { setError('一条记录最多添加 100 项食物。'); return; }
    const key = 'new-' + nextRow.current++;
    setRows(current => [...current, { key, foodId: selected.id, grams: amount.trim() }]);
    setSelectedFood(null); setAmount('100'); setError('');
  };
  const changeGrams = (key: string, grams: string) => {
    setRows(current => current.map(row => row.key === key ? { ...row, grams } : row)); setError('');
  };
  const save = async () => {
    if (submitting.current) return;
    if (validationError || !nutrients) { setError(validationError || '暂时无法计算营养，请核对食材和克数。'); return; }
    submitting.current = true; setBusy(true); setError('');
    let saved = false;
    try {
      const derivedName = rows.map(row => findFood(row.foodId)!.name).slice(0, 3).join('、') + (rows.length > 3 ? '等' : '');
      await saveIntakeEntry({
        id: recordId.current, date: recordDate, slot, name: name.trim() || derivedName.slice(0, 200),
        portions: rows.map(row => ({ foodId: row.foodId, grams: gramsValue(row.grams) })),
        customFoods: customFoods.filter(food => rows.some(row => row.foodId === food.id)),
        source: entry?.source ?? 'manual', ...(entry?.sourceKey ? { sourceKey: entry.sourceKey } : {}),
      });
      saved = true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败，请稍后重试。'); }
    finally { submitting.current = false; setBusy(false); }
    if (saved) { showMessage('已保存', '实际摄入记录已更新。'); onClose(); }
  };

  return <Modal visible transparent animationType="fade" onRequestClose={close}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.panel} accessibilityViewIsModal>
        <View style={styles.header}>
          <View style={styles.flex}><Text style={styles.title}>{entry ? '修改实际摄入' : '记录实际摄入'}</Text><Text style={styles.caption}>{recordDate} · 生活份量为参考，可核对包装或称重</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭实际摄入编辑器" disabled={busy} onPress={close} style={[styles.close, busy && styles.disabled]}><Text style={styles.closeText}>关闭</Text></Pressable>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.slotRow}>{slots.map(item => <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={'记餐到' + item.label} aria-checked={item.value === slot} aria-disabled={busy} disabled={busy} onPress={() => setSlot(item.value)} style={[styles.slot, item.value === slot && styles.selected]}><Text style={styles.buttonText}>{item.label}</Text></Pressable>)}</View>
          <TextInput accessibilityLabel="摄入记录名称，可选" placeholder="记录名称（可选，留空按食物命名）" value={name} onChangeText={setName} editable={!busy} maxLength={200} style={styles.input} placeholderTextColor={colors.inkMuted} />
          {entry && entry.foodDataVersion !== FOOD_DATA_VERSION ? <Text style={styles.notice}>这是旧版数据记录；保存修改后，将按当前食材数据重新计算营养。</Text> : null}
          {initial?.customFoods?.length ? <Text style={styles.small}>个人食品保留本次标签或参考配方快照，不跟随食品库修改。联网配方仍为估算。</Text> : null}
          <View style={styles.slotRow}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setLabelDraft(undefined); setCustomEditing('new'); }} style={styles.secondary}><Text style={styles.buttonText}>＋ 按包装标签添加食品</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setImportMode('label')} style={styles.secondary}><Text style={styles.buttonText}>拍营养标签</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setImportMode('barcode')} style={styles.secondary}><Text style={styles.buttonText}>扫商品条码</Text></Pressable>
          </View>
          {customEditing ? <CustomFoodForm key={(customEditing === 'new' ? 'new' : customEditing.id) + '-' + (labelDraft?.origin.fetchedAt ?? 'manual')} food={customEditing === 'new' ? undefined : customEditing} draft={labelDraft} photoInput={labelDraft ? labelPhoto : undefined} busy={busy} onBusyChange={setBusy} onSave={saveFood} onCancel={() => { setCustomEditing(null); setLabelDraft(undefined); setLabelPhoto(undefined); }} /> : null}
          <Text style={styles.label}>搜索食材</Text>
          <TextInput accessibilityLabel="搜索食材名称或别名" placeholder="如米饭、鸡蛋、豆腐" value={query} onChangeText={setQuery} editable={!busy} style={styles.input} placeholderTextColor={colors.inkMuted} />
          <ScrollView testID="nutrition-food-search-results" style={styles.searchList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {matches.map(food => <Pressable key={food.id} accessibilityRole="button" accessibilityState={{ selected: selectedFood === food.id, disabled: busy }} disabled={busy} onPress={() => chooseFood(food)} style={[styles.foodOption, selectedFood === food.id && styles.selected]}>
              <FoodArtwork food={food} /><View style={styles.flex}><Text style={styles.foodName}>{food.name}{food.source.kind === 'user_label' ? ' · 自定义' : ''}</Text><Text style={styles.small}>{food.state}</Text>
              {food.allergens.length ? <Text style={styles.allergen}>标注过敏原：{food.allergens.map(item => allergenLabels[item]).join('、')}</Text> : null}
              </View>
            </Pressable>)}
            {!matches.length ? <View style={styles.emptyBox}><Text style={styles.empty}>暂未收录这款食品。</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => { setLabelDraft(undefined); setCustomEditing('new'); }} style={styles.secondary}><Text style={styles.buttonText}>按包装标签添加</Text></Pressable></View> : null}
          </ScrollView>
          {selected ? <View style={styles.addBox}>
            <Text style={styles.foodName}>添加：{selected.name}</Text>
            <Text style={styles.small}>每 100 g：{selected.per100g.calories.toFixed(1)} kcal · 蛋白质 {selected.per100g.protein.toFixed(1)} g · 碳水 {selected.per100g.carbs.toFixed(1)} g · 脂肪 {selected.per100g.fat.toFixed(1)} g</Text>
            <Text style={styles.small}>{selected.source.title} · {selected.source.version}</Text>
            {selected.source.url ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(selected.source.url)} style={styles.secondary}><Text style={styles.buttonText}>查看食品数据来源</Text></Pressable> : null}
            <View style={styles.slotRow}>{getFoodServings(selected).map(serving => <Pressable key={serving.label} accessibilityRole="button" disabled={busy} onPress={() => setAmount(String(serving.grams))} style={styles.portion}><Text style={styles.buttonText}>{serving.label} · {serving.grams} g</Text></Pressable>)}</View>
            <View style={styles.amountRow}><TextInput accessibilityLabel={'添加' + selected.name + '的克数'} value={amount} onChangeText={setAmount} editable={!busy} keyboardType="decimal-pad" selectTextOnFocus style={[styles.input, styles.grams]} /><Text style={styles.small}>g</Text><Pressable accessibilityRole="button" disabled={busy || !validGrams(amount)} onPress={addFood} style={[styles.action, (busy || !validGrams(amount)) && styles.disabled]}><Text style={styles.actionText}>加入清单</Text></Pressable></View>
            {!validGrams(amount) ? <Text accessibilityRole="alert" style={styles.error}>请输入大于 0、至多 2000 的克数。</Text> : null}
            {selected.source.kind === 'user_label' ? <><Text style={styles.small}>个人食品，未经本应用核验。{selected.fiberKnown === false ? '纤维未知，合计中未计入。' : ''}</Text><View style={styles.slotRow}><Pressable accessibilityRole="button" disabled={busy} onPress={() => { setLabelDraft(undefined); setCustomEditing(selected); }} style={styles.secondary}><Text style={styles.buttonText}>修改标签</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => removeCustomFood(selected)} style={styles.remove}><Text style={styles.removeText}>删除自定义食品</Text></Pressable></View></> : null}
          </View> : null}
          <Text style={styles.small}>过敏标注不覆盖交叉接触或所有过敏原，请核对包装与实际配料。额外用油和配料需另加。</Text>
          <Text style={styles.label}>本次实际吃了什么 · {rows.length} 项</Text>
          {rows.map(row => {
            const food = findFood(row.foodId);
            return <View key={row.key} style={styles.basketRow}>
              <View style={styles.foodHeader}><FoodArtwork food={food} /><View style={styles.flex}><Text style={styles.foodName}>{food?.name ?? '旧版食物 · ' + row.foodId}</Text><Text style={styles.small}>{food?.state ?? '当前目录已无此食物，请移除后重新选择。'}</Text></View></View>
              <View style={styles.amountRow}><TextInput accessibilityLabel={(food?.name ?? '旧版食物') + '实际摄入克数'} value={row.grams} onChangeText={value => changeGrams(row.key, value)} editable={!busy} keyboardType="decimal-pad" selectTextOnFocus style={[styles.input, styles.grams, !validGrams(row.grams) && styles.invalid]} /><Text style={styles.small}>g</Text><Pressable accessibilityRole="button" accessibilityLabel={'移除' + (food?.name ?? '旧版食物')} disabled={busy} onPress={() => { setRows(current => current.filter(item => item.key !== row.key)); setError(''); }} style={styles.remove}><Text style={styles.removeText}>移除</Text></Pressable></View>
              {food ? <View style={styles.slotRow}>{getFoodServings(food).map(serving => <Pressable key={serving.label} accessibilityRole="button" disabled={busy} onPress={() => changeGrams(row.key, String(serving.grams))} style={styles.portion}><Text style={styles.buttonText}>{serving.label}</Text></Pressable>)}</View> : null}
            </View>;
          })}
          {!rows.length ? <Text style={styles.empty}>选择食物后，可直接点生活份量加入；包装食品也可按自己的营养标签创建。</Text> : null}
          {validationError && rows.length > 0 ? <Text accessibilityRole="alert" style={styles.error}>{validationError}</Text> : null}
          <View style={styles.totalBox}>
            <Text style={styles.foodName}>按当前食材与份量实算</Text>
            {nutrients ? <><Text style={styles.total}>{nutrients.calories.toFixed(1)} kcal</Text><Text style={styles.small}>蛋白质 {nutrients.protein.toFixed(1)} g · 碳水 {nutrients.carbs.toFixed(1)} g</Text><Text style={styles.small}>脂肪 {nutrients.fat.toFixed(1)} g · {fiberIncomplete ? '纤维信息不完整，已知部分 ' : '纤维 '}{nutrients.fiber.toFixed(1)} g</Text></> : <Text style={styles.small}>食材和克数有效后显示营养估算。</Text>}
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </ScrollView>
        <View style={styles.footer}><Pressable accessibilityRole="button" disabled={busy || !!validationError || !nutrients} onPress={() => { void save(); }} style={[styles.save, (busy || !!validationError || !nutrients) && styles.disabled]}><Text style={styles.actionText}>{busy ? '保存中…' : '保存实际摄入记录'}</Text></Pressable></View>
      </View>
      {importMode ? <FoodImportModal mode={importMode} onClose={() => setImportMode(null)} onDraft={(draft, photo) => {
        const existing = draft.origin.provider === 'open_food_facts' ? nutritionJournal.customFoods.find(food => food.source.origin?.provider === 'open_food_facts' && food.source.origin.identifier === draft.origin.identifier) : undefined;
        setImportMode(null); setLabelDraft(draft); setLabelPhoto(photo ? { ...photo, kind: 'label' } : undefined); setCustomEditing(existing ?? 'new');
      }} /> : null}
    </KeyboardAvoidingView>
  </Modal>;
}

export function CustomFoodForm({ food, draft, busy: parentBusy, onSave, onCancel, saveLabel, photoInput, onBusyChange }: { food?: Food; draft?: FoodLabelDraft; busy: boolean; onSave: (food: Food) => Promise<void>; onCancel: () => void; saveLabel?: string; photoInput?: CapturedNutritionPhoto; onBusyChange?: (busy: boolean) => void }) {
  const prefill = draft ? labelDraftFormValues(draft) : undefined;
  const id = useRef(food?.id ?? 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
  const [name, setName] = useState(prefill?.name ?? food?.name ?? '');
  const [state, setState] = useState(prefill?.state ?? food?.state ?? '');
  const [basis, setBasis] = useState<'100g' | 'serving'>(prefill?.basis ?? '100g');
  const [basisGrams, setBasisGrams] = useState(prefill?.basisGrams ?? String(food?.serving?.grams ?? ''));
  const [energyUnit, setEnergyUnit] = useState<'kcal' | 'kJ' | null>(prefill ? prefill.energyUnit : 'kcal');
  const [values, setValues] = useState(prefill?.values ?? { calories: food ? String(food.per100g.calories) : '', protein: food ? String(food.per100g.protein) : '', carbs: food ? String(food.per100g.carbs) : '', fat: food ? String(food.per100g.fat) : '', fiber: food?.fiberKnown ? String(food.per100g.fiber) : '' });
  const [servingLabel, setServingLabel] = useState(draft?.serving?.label ?? food?.serving?.label ?? '一份');
  const [servingGrams, setServingGrams] = useState(String(draft?.serving?.grams ?? food?.serving?.grams ?? ''));
  const [packageGrams, setPackageGrams] = useState(String(draft?.packageGrams ?? food?.packageGrams ?? ''));
  const savingLabel = useRef(false);
  const [allergens, setAllergens] = useState<Allergen[]>(draft?.allergens ?? food?.allergens ?? []);
  const [reviewed, setReviewed] = useState(!draft);
  const [error, setError] = useState('');
  const [localBusy, setLocalBusy] = useState(false);
  const [photo, setPhoto] = useState(food?.photo);
  const [pendingPhoto, setPendingPhoto] = useState<CapturedNutritionPhoto | undefined>();
  const [category, setCategory] = useState<FoodArtworkCategory>(food?.artworkCategory ?? 'mixed');
  const [choosingCategory, setChoosingCategory] = useState(false);
  const alive = useRef(true);
  const photoWork = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const busy = parentBusy || localBusy;
  const pickPhoto = async () => {
    if (photoWork.current || savingLabel.current || busy) return;
    photoWork.current = true; setLocalBusy(true); onBusyChange?.(true); setError('');
    try {
      const picked = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, allowsEditing: false, exif: false, quality: 1 });
      if (!alive.current || picked.canceled || !picked.assets[0]) return;
      const dataUrl = await compressPhoto(picked.assets[0], 720);
      if (alive.current) setPendingPhoto({ dataUrl, capturedAt: Date.now(), kind: 'food' });
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '无法读取图片，请重试。'); }
    finally { photoWork.current = false; onBusyChange?.(false); if (alive.current) setLocalBusy(false); }
  };
  const save = async () => {
    if (savingLabel.current || busy) return;
    savingLabel.current = true; setLocalBusy(true); onBusyChange?.(true);
    setError('');
    try {
      if (!reviewed) throw new Error('请先核对包装标签并勾选确认，识别结果不会自动保存。');
      if (!energyUnit) throw new Error('标签能量单位未读清，请选择包装标注的 kcal 或 kJ。');
      const grams = basis === 'serving' ? gramsValue(basisGrams) : 100;
      const savedServingGrams = basis === 'serving' ? grams : servingGrams.trim() ? gramsValue(servingGrams) : undefined;
      const labelFood = createCustomFoodFromLabel({ id: id.current, name, state, basisGrams: grams, energyUnit,
        calories: gramsValue(values.calories), protein: gramsValue(values.protein), carbs: gramsValue(values.carbs), fat: gramsValue(values.fat),
        ...(values.fiber.trim() ? { fiber: gramsValue(values.fiber) } : {}), allergens,
        ...((draft?.origin ?? food?.source.origin) ? { origin: draft?.origin ?? food?.source.origin } : {}),
        ...(packageGrams.trim() ? { packageGrams: gramsValue(packageGrams) } : {}),
        ...(savedServingGrams !== undefined ? { serving: { label: servingLabel, grams: savedServingGrams } } : {}) });
      await withCapturedPhoto(pendingPhoto, !!pendingPhoto, async storedPhoto => onSave({ ...labelFood, artworkCategory: category,
        ...((storedPhoto ?? photo) ? { photo: (storedPhoto ?? photo)! } : {}) }));
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '自定义食品保存失败，请核对标签。'); }
    finally { savingLabel.current = false; onBusyChange?.(false); if (alive.current) setLocalBusy(false); }
  };
  const fields: { key: keyof typeof values; label: string }[] = [{ key: 'calories', label: '能量' }, { key: 'protein', label: '蛋白质 g' }, { key: 'carbs', label: '碳水化合物 g' }, { key: 'fat', label: '脂肪 g' }, { key: 'fiber', label: '膳食纤维 g（可留空）' }];
  return <View style={styles.customForm}>
    <Text style={styles.foodName}>{food ? '修改包装营养标签' : '创建包装食品'}</Text>
    <View style={styles.foodHeader}>
      {pendingPhoto ? <Image source={{ uri: pendingPhoto.dataUrl }} accessibilityLabel="待保存的个人食品照片" style={styles.photoPreview} resizeMode="cover" /> : <FoodArtwork size={64} food={{ id: id.current, name: name || '个人食品', artworkCategory: category, ...(photo ? { photo } : {}) }} />}
      <View style={styles.flex}><Text style={styles.foodName}>食品图片</Text><Text style={styles.small}>{pendingPhoto || photo ? '保存在本机，下次添加时复用' : '未上传照片时使用分类配图'}</Text></View>
    </View>
    <View style={styles.slotRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="选择个人食品图片" disabled={busy} onPress={() => void pickPhoto()} style={styles.secondary}><Text style={styles.buttonText}>{pendingPhoto || photo ? '更换图片' : '上传图片'}</Text></Pressable>
      {photoInput && !pendingPhoto ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setPendingPhoto(photoInput)} style={styles.secondary}><Text style={styles.buttonText}>保存本次包装照片</Text></Pressable> : null}
      {pendingPhoto || photo ? <Pressable accessibilityRole="button" accessibilityLabel="移除个人食品图片" disabled={busy} onPress={() => { setPendingPhoto(undefined); setPhoto(undefined); }} style={styles.secondary}><Text style={styles.buttonText}>移除图片</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="选择食品配图分类" disabled={busy} onPress={() => setChoosingCategory(value => !value)} style={styles.secondary}><Text style={styles.buttonText}>{FOOD_ARTWORK_LABELS[category]}配图 ▾</Text></Pressable>
    </View>
    {choosingCategory ? <View style={styles.slotRow}>{FOOD_ARTWORK_CATEGORIES.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={'食品图片分类：' + FOOD_ARTWORK_LABELS[value]} accessibilityState={{ checked: value === category }} disabled={busy} onPress={() => { setCategory(value); setChoosingCategory(false); }} style={[styles.portion, category === value && styles.selected]}><Text style={styles.buttonText}>{FOOD_ARTWORK_LABELS[value]}</Text></Pressable>)}</View> : null}
    {draft ? <>
      {food ? <Text style={styles.notice}>此条码已在个人食品库中。核对保存后更新该食品，历史摄入记录不变。</Text> : null}
      <Text style={styles.small}>{draft.origin.provider === 'open_food_facts' ? '来源：Open Food Facts · ODbL · 条码 ' + draft.origin.identifier : '来源：本人标签照片 · 模型文字抄录，非热量猜测'}</Text>
      {draft.origin.url ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(draft.origin.url)} style={styles.secondary}><Text style={styles.buttonText}>查看原始产品资料</Text></Pressable> : null}
      {draft.warnings.map((warning, i) => <Text key={i} style={styles.notice}>{warning}</Text>)}
      {draft.basisUnit === 'ml' ? <Text style={styles.notice}>标签按 {draft.basisAmount ?? '未读清'} mL 计。请称量该体积的实际克重后填写，不能把毫升当作克。</Text> : draft.basisUnit === 'unknown' || draft.basisAmount === null ? <Text style={styles.notice}>未读清计量基准，请对照标签填写这一列对应的克重。</Text> : null}
    </> : null}
    <Text style={styles.small}>按标签的克重录入（不是每 100 mL）。纤维未标注可留空。修改不会倒改已保存的记录或常用餐。</Text>
    <TextInput accessibilityLabel="自定义食品名称" placeholder="食品名称，例如原味酸奶" maxLength={80} value={name} onChangeText={setName} editable={!busy} style={styles.input} />
    <TextInput accessibilityLabel="包装食用状态" placeholder="标签对应状态，例如开袋即食、冲调后" maxLength={120} value={state} onChangeText={setState} editable={!busy} style={styles.input} />
    <View style={styles.slotRow}>{(['100g', 'serving'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: basis === value }} disabled={busy} onPress={() => setBasis(value)} style={[styles.portion, basis === value && styles.selected]}><Text style={styles.buttonText}>{value === '100g' ? '标签按每 100 g' : '标签按每份'}</Text></Pressable>)}</View>
    {basis === 'serving' ? <TextInput accessibilityLabel="标签每份重量g" placeholder="标签这一列对应多少克（必填）" keyboardType="decimal-pad" value={basisGrams} onChangeText={setBasisGrams} editable={!busy} style={styles.input} /> : null}
    <View style={styles.slotRow}>{(['kcal', 'kJ'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: energyUnit === value }} disabled={busy} onPress={() => setEnergyUnit(value)} style={[styles.portion, energyUnit === value && styles.selected]}><Text style={styles.buttonText}>{value === 'kcal' ? '能量为 kcal / 千卡' : '能量为 kJ / 千焦'}</Text></Pressable>)}</View>
    {fields.map(field => <View key={field.key} style={styles.amountRow}><Text style={[styles.small, styles.flex]}>{field.label}{field.key === 'calories' ? ' ' + energyUnit : ''}</Text><TextInput accessibilityLabel={'标签' + field.label} placeholder={field.key === 'fiber' ? '未知可留空' : '必填'} keyboardType="decimal-pad" value={values[field.key]} onChangeText={value => setValues(current => ({ ...current, [field.key]: value }))} editable={!busy} style={[styles.input, styles.grams]} /></View>)}
    <TextInput accessibilityLabel="自定义食品生活份量名称" placeholder="生活份量名称，例如一盒、一袋" maxLength={40} value={servingLabel} onChangeText={setServingLabel} editable={!busy} style={styles.input} />
    {basis === '100g' ? <TextInput accessibilityLabel="自定义生活份量重量g" placeholder="这一盒/袋有多少克（可选）" keyboardType="decimal-pad" value={servingGrams} onChangeText={setServingGrams} editable={!busy} style={styles.input} /> : null}
    <TextInput accessibilityLabel="包装净重g" placeholder="整包净重 g（可选，不能填每100g基准）" keyboardType="decimal-pad" value={packageGrams} onChangeText={setPackageGrams} editable={!busy} style={styles.input} />
    <Text style={styles.small}>按配料表勾选已知过敏原。未勾选不代表无过敏原，不会加入自动配餐。</Text>
    <View style={styles.slotRow}>{(Object.keys(allergenLabels) as Allergen[]).map(value => <Pressable key={value} accessibilityRole="checkbox" accessibilityState={{ checked: allergens.includes(value) }} disabled={busy} onPress={() => setAllergens(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])} style={[styles.portion, allergens.includes(value) && styles.selected]}><Text style={styles.buttonText}>{allergenLabels[value]}</Text></Pressable>)}</View>
    {draft ? <Pressable accessibilityRole="checkbox" accessibilityLabel="已核对包装标签的数值单位及过敏原" accessibilityState={{ checked: reviewed }} disabled={busy} onPress={() => setReviewed(v => !v)} style={styles.secondary}><Text style={styles.buttonText}>{reviewed ? '☑' : '☐'} 已核对包装标签的数值、单位及过敏原</Text></Pressable> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <View style={styles.slotRow}><Pressable accessibilityRole="button" disabled={busy || !reviewed} onPress={() => void save()} style={[styles.action, (busy || !reviewed) && styles.disabled]}><Text style={styles.actionText}>{busy ? '保存中…' : saveLabel ?? '保存食品标签'}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.secondary}><Text style={styles.buttonText}>取消编辑标签</Text></Pressable></View>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center', padding: 14 },
  panel: { width: '100%', maxWidth: progressPageLayout.content.maxWidth, maxHeight: '94%', backgroundColor: colors.paper, borderRadius: radius.md, overflow: 'hidden', flexShrink: 1 },
  header: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  flex: { flex: 1, minWidth: 0 }, title: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  caption: { color: colors.inkMuted, fontSize: 11, marginTop: 5, lineHeight: 17 },
  close: { minHeight: 44, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12 }, closeText: { color: colors.inkMuted, fontWeight: '800', fontSize: 12 },
  scroll: { flexShrink: 1 }, content: { padding: 16, gap: 12 },
  slotRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  portion: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  secondary: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, backgroundColor: appPalette.raised, alignSelf: 'flex-start' },
  customForm: { padding: 14, gap: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: appPalette.raised },
  slot: { paddingHorizontal: 16, paddingVertical: 11, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm },
  selected: { backgroundColor: appPalette.olive, borderColor: colors.limeDark }, buttonText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, color: colors.ink, paddingHorizontal: 12, paddingVertical: 11, minHeight: 44, borderRadius: 10, fontSize: 13 },
  label: { color: colors.ink, fontWeight: '900', fontSize: 14, marginTop: 3 },
  searchList: { maxHeight: 210, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.card }, emptyBox: { padding: 10 },
  foodOption: { padding: 12, borderBottomWidth: 1, borderColor: colors.line, gap: 10, flexDirection: 'row', alignItems: 'center' },
  foodHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, photoPreview: { width: 64, height: 64, borderRadius: 14, flexShrink: 0 },
  foodName: { color: colors.ink, fontSize: 13, fontWeight: '800', lineHeight: 19 },
  small: { color: colors.inkMuted, fontSize: 11, lineHeight: 17 }, allergen: { color: appPalette.warning, fontSize: 10, lineHeight: 16 },
  addBox: { padding: 12, gap: 10, borderRadius: radius.sm, backgroundColor: appPalette.olive },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, grams: { width: 110, maxWidth: '45%' },
  action: { paddingVertical: 12, paddingHorizontal: 14, backgroundColor: appPalette.olive, borderRadius: 10 }, actionText: { color: colors.lime, fontWeight: '900', fontSize: 12 },
  basketRow: { padding: 12, gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.card },
  remove: { paddingHorizontal: 12, paddingVertical: 12 }, removeText: { color: colors.danger, fontWeight: '800', fontSize: 12 },
  empty: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, padding: 12 },
  invalid: { borderColor: colors.danger }, error: { color: colors.danger, fontSize: 12, lineHeight: 19 },
  notice: { color: appPalette.warning, backgroundColor: appPalette.warningBackground, padding: 11, borderRadius: 10, fontSize: 11, lineHeight: 18 },
  totalBox: { padding: 14, borderRadius: radius.sm, backgroundColor: appPalette.olive, gap: 5 }, total: { color: colors.ink, fontSize: 25, fontWeight: '900' },
  footer: { padding: 14, borderTopWidth: 1, borderTopColor: colors.line }, save: { backgroundColor: appPalette.olive, padding: 15, borderRadius: radius.sm, alignItems: 'center' }, disabled: { opacity: 0.45 },
});
