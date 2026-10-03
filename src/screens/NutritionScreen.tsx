import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Card, Page } from '../components/ui';
import { AppGlyph, type GlyphName } from '../components/AppGlyph';
import { IntakeEditor } from '../components/nutrition/IntakeEditor';
import { FoodCameraModal } from '../components/nutrition/FoodCameraModal';
import { PhotoIntakeEditor } from '../components/nutrition/PhotoIntakeEditor';
import { usePersonalAgent } from '../agent/PersonalAgentHost';
import { LoggingCompletenessControls } from '../components/nutrition/NutritionLoopCards';
import { MealArtwork } from '../components/nutrition/MealArtwork';
import { mealFoodArtwork } from '../nutrition/foodArtwork';
import { WeightTrendChart } from '../components/nutrition/WeightTrendChart';
import { photoPortionSummary, photoUsesOnlyLabels, summarizePhotoEstimate, type PhotoEstimate } from '../nutrition/vision';
import { withCapturedPhoto, type CapturedNutritionPhoto } from '../nutrition/photoStorage';
import { NutritionPhotoView } from '../components/nutrition/NutritionPhotoView';
import { useAppUpdates } from '../components/AppUpdates';
import { localWeightDate, recordWeight, suggestedPlanningWeight, summarizeWeightTrend } from '../data/weightTrend';
import { FOODS, FOOD_DATA_VERSION } from '../nutrition/catalog';
import { sumNutrients } from '../nutrition/engine';
import { buildNutritionMenu } from '../nutrition/adjustments';
import { getNutritionTrainingContext } from '../nutrition/training';
import { latestNutritionTarget } from '../nutrition/timeline';
import { summarizeMealSlots } from '../nutrition/presentation';
import { offsetDate } from '../nutrition/validation';
import { NUTRITION_KNOWLEDGE, OBJECTIVE_EXPLANATIONS } from '../nutrition/knowledge';
import { slotLabels } from '../nutrition/labels';
import type { IntakeEntry, MealSlot } from '../nutrition/types';
import { useAppStore } from '../store/AppStore';
import { appPalette, fitnessColors as colors, progressPageLayout } from '../theme';
import { confirmAction, showMessage } from '../utils/confirm';

const rounded = (value: number) => Math.round(value);

export function NutritionScreen({ onBack, embedded = false }: { onBack: () => void; embedded?: boolean }) {
  const { profile, sessions, dailyEdits, nutritionJournal, nutritionStorageIssue, saveIntakeEntry, deleteIntakeEntry, patchProfile,
    captureNutritionTarget, confirmNutritionLogging, setNutritionMealStatus } = useAppStore();
  const { blockUpdates } = useAppUpdates();
  const [today, setToday] = useState(() => localWeightDate(new Date()));
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ date: string; entry?: IntakeEntry; slot?: MealSlot } | null>(null);
  const [cameraDate, setCameraDate] = useState<string | null>(null);
  const { openAgent } = usePersonalAgent();
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recordSlot, setRecordSlot] = useState<MealSlot | 'all' | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [showWeight, setShowWeight] = useState(false);
  const [weight, setWeight] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const prefs = nutritionJournal.preferences;
  const date = chosenDate || today;
  const isToday = date === today;
  const editing = Boolean(editor || cameraDate || showDatePicker || recordSlot || busy || (showWeight && weight.trim()));
  useLayoutEffect(() => {
    if (embedded && editing) return blockUpdates();
  }, [embedded, editing, blockUpdates]);
  useEffect(() => {
    const update = () => setToday(localWeightDate(new Date()));
    const timer = setInterval(update, 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const training = useMemo(() => profile ? getNutritionTrainingContext(profile, sessions, dailyEdits, today) : null, [profile, sessions, dailyEdits, today]);
  const menu = useMemo(() => profile && training ? buildNutritionMenu(profile, nutritionJournal, training, today) : null, [profile, training, nutritionJournal, today]);
  useEffect(() => {
    if (!profile || !training) return;
    let active = true;
    void captureNutritionTarget().then(() => { if (active) setHistoryError(''); }).catch(() => { if (active) setHistoryError('当日目标快照未能保存，历史对比暂不采用该目标。请稍后重试。'); });
    return () => { active = false; };
  }, [profile, prefs, training, today, nutritionJournal.trainingTime, captureNutritionTarget]);
  const records = useMemo(() => nutritionJournal.entries.filter(item => item.date === date), [nutritionJournal.entries, date]);
  const actual = useMemo(() => sumNutrients(records.map(item => item.nutrients)), [records]);
  const mealSummaries = useMemo(() => summarizeMealSlots(records), [records]);
  if (!profile || !menu || !training) return null;
  const ready = menu.targets.status === 'ready';
  const snapshot = latestNutritionTarget(nutritionJournal, date);
  const reference = isToday ? menu.targets : snapshot?.targets;
  const referenceReady = reference?.status === 'ready';
  const dayState = nutritionJournal.days[date];
  const trend = summarizeWeightTrend(profile.weightHistory);
  const planningWeight = suggestedPlanningWeight(profile.weight, trend);
  const run = async (key: string, operation: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(key); setError('');
    try { await operation(); } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败，请重试。'); }
    finally { pending.current = false; setBusy(''); }
  };
  const confirmLogging = (slot: MealSlot | 'day', confirmed: boolean) => {
    const apply = () => void run('logging-' + slot, () => confirmNutritionLogging(date, slot, confirmed));
    if (!confirmed) { apply(); return; }
    const hasRecords = slot === 'day' ? records.length > 0 : records.some(entry => entry.slot === slot);
    confirmAction(slot === 'day' ? '确认当天全部记完整？' : '确认' + slotLabels[slot] + '已记完整？',
      hasRecords ? '仅在你确认实际吃喝都已记录时选择。无需逐餐填写；之后补录、修改或删除会撤销完整确认。'
        : '当前没有对应摄入记录。只有确实没有吃、而不是尚未记餐，才确认完成；这会按没有摄入参与完整记录统计。', apply, { confirmLabel: '确认已记完整' });
  };
  const removeEntry = (entry: IntakeEntry) => confirmAction('删除这条饮食记录？', '只删除这一次记录，菜谱和其他日期不受影响。',
    () => void run('delete-' + entry.id, () => deleteIntakeEntry(entry.id)), { confirmLabel: '删除记录', destructive: true });
  const saveWeight = () => {
    const kg = Number(weight);
    if (!Number.isFinite(kg) || kg < 30 || kg > 300 || !weight.trim()) { setError('体重请输入 30–300 kg 范围内的有效数值。'); return; }
    const apply = () => void run('weight', async () => {
      await patchProfile(current => ({ weightHistory: recordWeight(current.weightHistory, Math.round(kg * 10) / 10) }));
      setWeight(''); showMessage('体重已记录', '不会因单日波动自动调整饮食。');
    });
    if (Math.abs(kg - profile.weight) / profile.weight > 0.1) confirmAction('确认本次体重？', '与档案体重相差较大，请确认单位为 kg。', apply);
    else apply();
  };
  const openSource = (url: string) => void Linking.openURL(url).catch(() => showMessage('暂时无法打开', '请联网后重试来源链接。'));
  const savePhoto = async (estimate: PhotoEstimate, slot: MealSlot, frame?: CapturedNutritionPhoto, retain = false) => {
    if (!cameraDate) return;
    await withCapturedPhoto(frame, retain, async photo => saveIntakeEntry({ id: 'photo-' + estimate.id, date: cameraDate, slot,
      name: estimate.dishName ?? estimate.items.map(item => item.name).join('、').slice(0, 180), portions: [], source: 'photo_estimate', photoEstimate: estimate,
      ...(photo ? { photos: [photo] } : {}) }));
    setCameraDate(null);
  };

  return <Page tone="dark" testID="nutrition-content" style={[styles.page, embedded && styles.embeddedPage]}>
    {!embedded ? <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="返回今日页" onPress={onBack} style={styles.back}><AppGlyph name="back" color={appPalette.text} /></Pressable>
      <View style={styles.flex}><Text style={styles.title}>饮食</Text></View>
    </View> : null}
    <View testID="nutrition-energy-card" style={styles.hero}>
      <View style={styles.heroToolbar}><Text style={styles.heroLabel}>已记录摄入</Text><View style={styles.heroTools}>
        <Pressable accessibilityRole="button" accessibilityLabel="选择饮食记录日期" onPress={() => setShowDatePicker(true)} style={styles.datePill}><Text style={styles.datePillText}>{isToday ? '今天' : date.slice(5)}</Text><AppGlyph name="chevron" size={12} /></Pressable>
      </View></View>
      <View style={styles.energyRow}><View style={styles.flex}><View style={styles.energyNumbers}><Text testID="nutrition-recorded-energy" style={styles.energy}>{records.length ? rounded(actual.calories) : '—'}</Text><Text style={styles.energyUnit}>{referenceReady ? '/ ' + reference.calories + ' kcal' : 'kcal'}</Text></View></View><CalorieRing progress={records.length && referenceReady ? actual.calories / reference.calories : undefined} /></View>
      {!referenceReady || !isToday ? <Text style={styles.target}>{referenceReady ? '当日保存参考 ' + reference.calories + ' kcal' : isToday ? menu.targets.status === 'needs_setup' ? '告诉助手你的营养目标与饮食偏好' : '自动目标暂停 · 仍可记录饮食' : snapshot ? '当日自动目标暂停 · 不套用今天的目标' : '该日未保存目标 · 不补造历史参考值'}</Text> : null}
      <View style={styles.macroRow}><Macro label="蛋白质" value={actual.protein} target={referenceReady ? reference.protein : undefined} empty={!records.length} /><Macro label="碳水" value={actual.carbs} target={referenceReady ? reference.carbs : undefined} empty={!records.length} /><Macro label="脂肪" value={actual.fat} target={referenceReady ? reference.fat : undefined} empty={!records.length} /></View>
    </View>
    <View testID="nutrition-primary-actions" style={styles.quickActions}><CaptureAction icon="camera" label="拍照记餐" caption="食物 · 标签 · 条码" accessibilityLabel="拍照记餐" onPress={() => setCameraDate(date)} /><CaptureAction icon="chat" label="个人助手" caption="训练 · 饮食 · 记忆" accessibilityLabel="问营养助手" onPress={() => openAgent('饮食记录')} /></View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {nutritionStorageIssue ? <View style={styles.warning}><Text accessibilityRole="alert" style={styles.warningText}>{nutritionStorageIssue}</Text></View> : historyError ? <View style={styles.warning}><Text accessibilityRole="alert" style={styles.warningText}>{historyError}</Text><Action label="重试保存目标" small onPress={() => void run('capture-target', async () => { await captureNutritionTarget(); setHistoryError(''); })} /></View> : null}
    {isToday && !ready ? <Card style={styles.notice}><Text style={styles.cardTitle}>{menu.targets.status === 'needs_setup' ? '先了解你的饮食需要' : '自动配餐暂不可用'}</Text><Text style={styles.body}>{menu.targets.message}</Text><Action label="告诉营养助手" onPress={() => openAgent('饮食记录')} /></Card> : null}

    <View style={styles.section}><Text style={styles.sectionTitle}>{isToday ? '今日饮食' : '当日饮食'}</Text><Pressable accessibilityRole="button" accessibilityLabel="管理当日饮食记录" onPress={() => setRecordSlot('all')} style={styles.textAction}><Text style={styles.subtle}>记录／没吃</Text><AppGlyph name="chevron" size={14} /></Pressable></View>
    {!records.length ? <View testID="nutrition-empty-meals" style={styles.emptyMeal}><View style={styles.emptyMealIcon}><AppGlyph name="utensils" color={appPalette.lime} size={22} /></View><Text style={styles.emptyTitle}>从这一餐开始</Text></View> : <View testID="nutrition-recorded-meals" style={styles.mealRows}>{mealSummaries.map(summary => {
      const savedPhoto = summary.entries.flatMap(entry => entry.photos ?? [])[0];
      return <View key={summary.slot} style={styles.mealRow}>
      {savedPhoto ? <NutritionPhotoView photo={savedPhoto} fallbackFood={mealFoodArtwork(summary.entries)} /> : <Pressable accessibilityRole="button" accessibilityLabel={'查看' + slotLabels[summary.slot] + '食物明细'} onPress={() => setRecordSlot(summary.slot)}><MealArtwork food={mealFoodArtwork(summary.entries)} portions={summary.entries.flatMap(entry => entry.portions)} photoEstimate={summary.entries.some(entry => entry.photoEstimate)} size={60} name={summary.names.join('、')} /></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={'查看' + slotLabels[summary.slot] + '饮食记录'} onPress={() => setRecordSlot(summary.slot)} style={({ pressed }) => [{ flex: 1, minWidth: 0, minHeight: 60, flexDirection: 'row', gap: 8, alignItems: 'center' }, pressed && { opacity: .75 }]}>
      <View style={styles.flex}><View style={styles.mealRowHead}><Text style={styles.mealRowTitle}>{slotLabels[summary.slot]} · {rounded(summary.nutrients.calories)} kcal</Text>{summary.entries.some(entry => entry.customFoods?.some(f => f.source.kind === 'recipe_estimate')) ? <Text style={styles.photoBadge}>配方估算</Text> : summary.entries.some(entry => entry.photoEstimate && !entry.photoEstimate.calculation && !photoUsesOnlyLabels(entry.photoEstimate)) ? <Text style={styles.photoBadge}>照片估算</Text> : summary.entries.some(entry => entry.photoEstimate?.calculation === 'ingredients') ? <Text style={styles.photoBadge}>食材计算</Text> : summary.entries.some(entry => photoUsesOnlyLabels(entry.photoEstimate)) ? <Text style={styles.photoBadge}>标签计算</Text> : null}</View><Text numberOfLines={2} style={styles.subtle}>{summary.entries.map(entry => entry.photoEstimate?.dishName || photoPortionSummary(entry.photoEstimate) || entry.name).join('；')}</Text></View><AppGlyph name="chevron" size={16} />
    </Pressable></View>; })}</View>}

    {dayState?.skippedSlots?.map(slot => <Pressable accessibilityRole="button" accessibilityLabel={'查看' + slotLabels[slot] + '没吃状态'} key={'skipped-' + slot} onPress={() => setRecordSlot('all')} style={styles.emptyMeal}><Text style={styles.subtle}>{slotLabels[slot]} · 没吃</Text></Pressable>)}
    <View style={styles.section}><Text style={styles.sectionTitle}>体重趋势</Text><Action label={showWeight ? '收起' : '记录体重'} small onPress={() => setShowWeight(value => !value)} /></View>
    <Card><WeightTrendChart history={profile.weightHistory} today={today} />
      {showWeight ? <View style={styles.weightEditor}><Text style={styles.body}>记录的是今天体重，不会自动覆盖饮食估算体重。</Text><View style={styles.actions}><TextInput accessibilityLabel="今日体重kg" placeholder="体重 kg" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} style={styles.input} /><Action label="保存体重" disabled={Boolean(busy)} onPress={saveWeight} /></View>
        {planningWeight !== null ? <Action label={'使用近期均重 ' + planningWeight + ' kg 重新估算'} onPress={() => confirmAction('更新饮食估算体重？', '只调整之后的建议，不改写已吃的记录。', () => void run('weight-calibration', () => patchProfile({ weight: planningWeight })))} disabled={Boolean(busy)} /> : null}
      </View> : null}
    </Card>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: showKnowledge }} onPress={() => setShowKnowledge(value => !value)} style={styles.knowledgeToggle}><Text style={styles.sectionTitle}>计算与知识依据</Text><Text style={styles.link}>{showKnowledge ? '收起 −' : '查看 ＋'}</Text></Pressable>
    {showKnowledge ? <Card>
      {prefs ? <Text style={styles.body}>{OBJECTIVE_EXPLANATIONS[prefs.objective]}</Text> : null}
      {ready ? <Text style={styles.body}>估算基础代谢 {menu.targets.bmr} kcal · 估算日常消耗 {menu.targets.tdee} kcal。建议蛋白 {menu.targets.protein}g、碳水 {menu.targets.carbs}g、脂肪 {menu.targets.fat}g。</Text> : null}
      {NUTRITION_KNOWLEDGE.map(note => <View key={note.id} style={styles.knowledgeItem}><Text style={styles.cardTitle}>{note.title}</Text><Text style={styles.body}>{note.summary}</Text><Text style={styles.footnote}>{note.scope}</Text>{note.sources.map(source => <Pressable key={source.url} accessibilityRole="link" onPress={() => openSource(source.url)} style={styles.sourceLink}><Text style={styles.link}>{source.title} ↗</Text></Pressable>)}</View>)}
      <Text style={styles.footnote}>{FOODS.length} 种本地参考食材 · {FOOD_DATA_VERSION}{'\n'}食材计算与照片估算分别标注。照片无法可靠判断油量、隐藏配料或过敏原，结果不是称重实测。资料已核对来源，尚未完成执业营养专业审核。</Text>
    </Card> : null}

    {editor?.entry?.source === 'photo_estimate' ? <PhotoIntakeEditor entry={editor.entry} onClose={() => setEditor(null)} /> : editor ? <IntakeEditor date={editor.date} entry={editor.entry} initialSlot={editor.slot} onClose={() => setEditor(null)} /> : null}
    {cameraDate ? <FoodCameraModal visible onClose={() => setCameraDate(null)} onSave={savePhoto} /> : null}
    <Modal transparent visible={showDatePicker} animationType="fade" onRequestClose={() => setShowDatePicker(false)}><View style={styles.backdrop}><View style={styles.sheet} accessibilityViewIsModal>
      <View style={styles.between}><Text style={styles.sectionTitle}>饮食日期</Text><IconAction name="plus" close label="关闭饮食日期" onPress={() => setShowDatePicker(false)} /></View>
      <View style={styles.dateRow}><Action label="‹" accessibilityLabel="前一天饮食记录" onPress={() => { setChosenDate(offsetDate(date, -1)); setShowDatePicker(false); }} small /><Pressable accessibilityRole="button" accessibilityLabel="回到今天饮食记录" onPress={() => { setChosenDate(null); setShowDatePicker(false); }} style={styles.dateCenter}><Text style={styles.dateText}>{date}</Text><Text style={styles.subtle}>{isToday ? '今天' : '点此回到今天'}</Text></Pressable><Action label="›" accessibilityLabel="后一天饮食记录" disabled={isToday} onPress={() => { setChosenDate(offsetDate(date, 1)); setShowDatePicker(false); }} small /></View>
    </View></View></Modal>
    <Modal transparent visible={recordSlot !== null} animationType="fade" onRequestClose={() => { if (!busy) setRecordSlot(null); }}><View style={styles.backdrop}><View testID="nutrition-record-details" style={styles.sheet} accessibilityViewIsModal>
      <View style={styles.between}><Text style={styles.sectionTitle}>{recordSlot && recordSlot !== 'all' ? slotLabels[recordSlot] : '当日'}记录</Text><IconAction name="plus" close label="关闭饮食记录" disabled={Boolean(busy)} onPress={() => setRecordSlot(null)} /></View>
      <Text style={styles.subtle}>{date} · 只统计确认保存的食物</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.recordList}>
        {records.filter(entry => recordSlot === 'all' || entry.slot === recordSlot).map(entry => {
          return <Card key={entry.id}>
            <View style={styles.between}><Text style={styles.slot}>{slotLabels[entry.slot]}</Text><Text style={styles.mealMacros}>{rounded(entry.nutrients.calories)} kcal</Text></View>
            <Text style={styles.recordName}>{entry.name}</Text><Text style={styles.subtle}>蛋白 {rounded(entry.nutrients.protein)}g · 碳水 {rounded(entry.nutrients.carbs)}g · 脂肪 {rounded(entry.nutrients.fat)}g</Text>
            {entry.photoEstimate ? <><Text style={styles.subtle}>{photoPortionSummary(entry.photoEstimate)}</Text><Text style={styles.estimateNote}>{photoUsesOnlyLabels(entry.photoEstimate) ? '按包装标签与所选份量计算' : entry.photoEstimate.calculation === 'ingredients' ? '按确认食材查库计算 · 份量仍为估计' : '含照片估算 · ' + summarizePhotoEstimate(entry.photoEstimate).calorieRange.min + '–' + summarizePhotoEstimate(entry.photoEstimate).calorieRange.max + ' kcal'}</Text></> : null}
            {entry.customFoods?.filter(f => f.source.kind === 'recipe_estimate').map(f => <View key={f.id}><Text style={styles.estimateNote}>联网参考配方估算 · 非实测</Text><Text style={styles.subtle}>{f.source.recipe?.description}</Text>{f.source.recipe?.sources.map(source => <Pressable accessibilityRole="link" key={source.url} onPress={() => void Linking.openURL(source.url).catch(() => setError('暂时无法打开来源。'))}><Text style={styles.subtle}>{source.title} ↗</Text></Pressable>)}</View>)}
            {entry.photos?.length ? <View style={styles.actions}>{entry.photos.map(photo => <NutritionPhotoView key={photo.id} photo={photo} size={70} />)}</View> : null}
            {entry.fiberIncomplete ? <Text style={styles.subtle}>部分标签未标注纤维</Text> : null}
            <View style={styles.recordActions}><Action label="编辑" small onPress={() => { setRecordSlot(null); setEditor({ date: entry.date, entry }); }} disabled={Boolean(busy)} /><Action label="删除" small onPress={() => removeEntry(entry)} disabled={Boolean(busy)} /></View>
          </Card>;
        })}
        {!records.some(entry => recordSlot === 'all' || entry.slot === recordSlot) ? <Text style={styles.body}>暂无记录，未记录不代表没有吃。</Text> : null}
        <LoggingCompletenessControls state={dayState} recordedSlots={[...new Set(records.map(entry => entry.slot))]} disabled={Boolean(busy)} onConfirm={confirmLogging}
          onStatus={(slot, status) => void run('meal-status-' + slot, () => setNutritionMealStatus(date, slot, status))}
          onRecord={slot => { setRecordSlot(null); setEditor({ date, slot }); }} />
      </ScrollView>
      <Action label="添加饮食记录" onPress={() => { setRecordSlot(null); setEditor({ date }); }} disabled={Boolean(busy)} />
    </View></View></Modal>
  </Page>;
}

function Macro({ label, value, target, empty }: { label: string; value: number; target?: number; empty?: boolean }) {
  return <View style={styles.macro}><Text style={styles.macroLabel}>{label}</Text><Text style={styles.macroValue}>{empty ? '—' : rounded(value)}<Text style={styles.macroUnit}> g</Text>{target ? <Text style={styles.macroReference}> / {target}</Text> : null}</Text>{target ? <View style={styles.macroTrack}><View style={[styles.fill, { width: `${Math.min(100, value / target * 100)}%` }]} /></View> : null}</View>;
}
function IconAction({ name, label, hint, onPress, close, disabled }: { name: GlyphName; label: string; hint?: string; onPress: () => void; close?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.iconAction, close && styles.closeIcon, (pressed || disabled) && { opacity: .5 }]}><AppGlyph name={name} size={18} /></Pressable>;
}
function CaptureAction({ icon, label, caption, accessibilityLabel, onPress }: { icon: 'camera' | 'chat'; label: string; caption: string; accessibilityLabel: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.captureAction, pressed && { opacity: .75 }]}><AppGlyph name={icon} size={23} color={icon === 'chat' ? appPalette.lime : appPalette.text} /><View style={styles.flex}><Text style={styles.captureTitle}>{label}</Text><Text style={styles.captureCaption}>{caption}</Text></View></Pressable>;
}
function Action({ label, onPress, disabled, bright, small, accessibilityLabel }: { label: string; onPress: () => void; disabled?: boolean; bright?: boolean; small?: boolean; accessibilityLabel?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, bright && styles.actionBright, small && styles.actionSmall, (disabled || pressed) && { opacity: disabled ? 0.45 : 0.7 }]}><Text style={[styles.actionText, bright && { color: appPalette.onLime }]}>{label}</Text></Pressable>;
}

function CalorieRing({ progress }: { progress?: number }) {
  const circumference = 2 * Math.PI * 28;
  const value = typeof progress === 'number' && Number.isFinite(progress) ? Math.max(0, progress) : undefined;
  return <View testID="nutrition-energy-ring" style={styles.ring}><Svg width={64} height={64} viewBox="0 0 64 64"><Circle cx={32} cy={32} r={28} fill="none" stroke={appPalette.border} strokeWidth={6} /><Circle cx={32} cy={32} r={28} fill="none" stroke={appPalette.lime} strokeWidth={6} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.min(1, value || 0))} rotation={-90} origin="32,32" /></Svg><View style={styles.ringCopy}><Text style={styles.ringValue}>{value === undefined ? '—' : Math.round(value * 100) + '%'}</Text></View></View>;
}

const styles = StyleSheet.create({

  page: { ...progressPageLayout.content }, embeddedPage: { paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }, back: { width: 44, height: 44, justifyContent: 'center' }, title: { ...progressPageLayout.title, color: colors.ink }, flex: { flex: 1, minWidth: 0 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 }, dateCenter: { flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, dateText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, subtle: { color: colors.inkMuted, fontSize: 11, lineHeight: 18 },
  hero: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 14, borderRadius: 20 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, heroLabel: { fontSize: 11, fontWeight: '700', color: colors.inkMuted, flex: 1 }, heroToolbar: { flexDirection: 'row', alignItems: 'center', gap: 4 }, heroTools: { flexDirection: 'row', alignItems: 'center' }, datePill: { minHeight: 44, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, datePillText: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' }, iconAction: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }, closeIcon: { transform: [{ rotate: '45deg' }] },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, energyNumbers: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6 }, energy: { color: colors.ink, fontSize: 40, lineHeight: 48, fontWeight: '900', letterSpacing: -1.2, fontVariant: ['tabular-nums'] }, energyUnit: { color: colors.inkMuted, fontSize: 11 }, target: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 8 },
  ring: { width: 64, height: 64, flexShrink: 0 }, ringCopy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' }, ringValue: { color: colors.ink, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  macroRow: { flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line }, macro: { flex: 1, minWidth: 0 }, macroValue: { color: colors.ink, fontSize: 16, fontWeight: '800', lineHeight: 22, marginTop: 3, fontVariant: ['tabular-nums'] }, macroUnit: { fontSize: 10, color: colors.inkMuted }, macroLabel: { color: colors.inkMuted, fontSize: 11 }, macroReference: { color: colors.inkMuted, fontSize: 10, fontWeight: '500' }, macroTrack: { height: 4, backgroundColor: colors.line, borderRadius: 3, overflow: 'hidden', marginTop: 6 }, fill: { height: '100%', backgroundColor: colors.lime },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 10 }, action: { borderRadius: 14, minHeight: 44, backgroundColor: appPalette.raised, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 1 }, actionBright: { backgroundColor: colors.lime, borderColor: colors.lime }, actionSmall: { paddingHorizontal: 10, minHeight: 44, borderRadius: 12 }, actionText: { fontSize: 12, color: colors.ink, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  captureAction: { flex: 1, minWidth: 0, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }, captureTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', lineHeight: 19 }, captureCaption: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: 2 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6, gap: 12 }, sectionTitle: { ...progressPageLayout.sectionTitle, color: colors.ink },

  recordList: { gap: 10, paddingVertical: 12 }, recordName: { color: colors.ink, fontSize: 16, fontWeight: '800', marginVertical: 8, lineHeight: 22 }, recordActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 }, estimateNote: { color: appPalette.warning, fontSize: 11, lineHeight: 18, marginTop: 8 }, emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 3 }, textAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  emptyMeal: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, borderRadius: 14 }, emptyMealIcon: { width: 36, height: 36, backgroundColor: appPalette.olive, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }, mealRows: { gap: 7 }, mealRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14 }, mealRowHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 4 }, mealRowTitle: { fontSize: 13, lineHeight: 20, fontWeight: '800', color: colors.ink }, photoBadge: { fontSize: 9, lineHeight: 15, color: appPalette.warning, backgroundColor: appPalette.warningBackground, paddingHorizontal: 5, borderRadius: 5 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  slot: { color: colors.green, fontSize: 11, fontWeight: '700', flexShrink: 1 }, mealMacros: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 4 },

  link: { color: colors.green, fontSize: 12, fontWeight: '700', lineHeight: 18 }, actions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 }, body: { color: colors.inkMuted, fontSize: 12, lineHeight: 20, marginVertical: 6 }, footnote: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginVertical: 10 },
  warning: { padding: 12, borderRadius: 12, backgroundColor: appPalette.warningBackground, marginTop: 7 }, warningText: { color: appPalette.warning, fontSize: 12, lineHeight: 19 }, notice: { marginTop: 16, gap: 9 },
  weightEditor: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 15, paddingTop: 9, gap: 10 }, input: { flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: colors.line, padding: 12, borderRadius: 12, color: colors.ink, backgroundColor: colors.paper, fontSize: 13 },
  knowledgeToggle: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 20, alignItems: 'center', gap: 12 }, knowledgeItem: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 16, paddingTop: 16 }, sourceLink: { minHeight: 44, justifyContent: 'center' }, error: { color: colors.danger, fontSize: 12, lineHeight: 21, marginVertical: 12 },
  backdrop: { flex: 1, padding: 16, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'center', alignItems: 'center' }, sheet: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 16, width: '100%', maxWidth: 440, maxHeight: '90%' },
});
