import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Page } from '../components/ui';
import { AppGlyph, type GlyphName } from '../components/AppGlyph';
import { MealTimeline } from '../components/nutrition/MealTimeline';
import { WeightTrendChart } from '../components/nutrition/WeightTrendChart';
import { photoPortionSummary, photoUsesOnlyLabels, summarizePhotoEstimate } from '../nutrition/vision';
import { NutritionPhotoView } from '../components/nutrition/NutritionPhotoView';
import { useAppUpdates } from '../components/AppUpdates';
import { localWeightDate, recordWeight, suggestedPlanningWeight, summarizeWeightTrend } from '../domain/weight/weightTrend';
import { calculateTargets, sumNutrients } from '../nutrition/engine';
import { getNutritionTrainingContext } from '../nutrition/training';
import { latestNutritionTarget } from '../nutrition/timeline';
import { hasUnknownNutrition, nutrientKnown } from '../nutrition/agentFood';
import { offsetDate } from '../nutrition/validation';
import { slotLabels } from '../nutrition/labels';
import type { MealSlot } from '../nutrition/types';
import { useAppStore } from '../store/AppStore';
import { appPalette, fitnessColors as colors, progressPageLayout } from '../theme';
import { confirmAction, showMessage } from '../utils/confirm';

const rounded = (value: number) => Math.round(value);

export function NutritionScreen({ onBack, embedded = false }: { onBack: () => void; embedded?: boolean }) {
  const { profile, sessions, dailyEdits, nutritionJournal, nutritionStorageIssue, patchProfile,
    captureNutritionTarget } = useAppStore(state => ({ profile: state.profile, sessions: state.sessions, dailyEdits: state.dailyEdits, nutritionJournal: state.nutritionJournal, nutritionStorageIssue: state.nutritionStorageIssue, patchProfile: state.patchProfile, captureNutritionTarget: state.captureNutritionTarget }));
  const { blockUpdates } = useAppUpdates();
  const [today, setToday] = useState(() => localWeightDate(new Date()));
  const [chosenDate, setChosenDate] = useState<string | null>(null);
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
  const editing = Boolean(showDatePicker || recordSlot || busy || (showWeight && weight.trim()));
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
  const targets = useMemo(() => profile ? calculateTargets(profile, nutritionJournal.preferences) : null, [profile, nutritionJournal.preferences]);
  useEffect(() => {
    if (!profile || !training) return;
    let active = true;
    void captureNutritionTarget().then(() => { if (active) setHistoryError(''); }).catch(() => { if (active) setHistoryError('当日目标快照未能保存，历史对比暂不采用该目标。请稍后重试。'); });
    return () => { active = false; };
  }, [profile, prefs, training, today, nutritionJournal.trainingTime, captureNutritionTarget]);
  const records = useMemo(() => nutritionJournal.entries.filter(item => item.date === date), [nutritionJournal.entries, date]);
  const actual = useMemo(() => sumNutrients(records.map(item => item.nutrients)), [records]);
  const missingNutrition = records.filter(hasUnknownNutrition).length;
  const knownEnergy = records.some(entry => nutrientKnown(entry, 'calories'));
  const containsEstimates = records.some(entry => entry.agentFood?.estimated || entry.photoEstimate);
  if (!profile || !targets || !training) return null;
  const ready = targets.status === 'ready';
  const snapshot = latestNutritionTarget(nutritionJournal, date);
  const reference = isToday ? targets : snapshot?.targets;
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

  return <Page tone="dark" testID="nutrition-content" style={[styles.page, embedded && styles.embeddedPage]}>
    {!embedded ? <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="返回今日页" onPress={onBack} style={styles.back}><AppGlyph name="back" color={appPalette.text} /></Pressable>
      <View style={styles.flex}><Text style={styles.title}>饮食</Text></View>
    </View> : null}
    <LinearGradient testID="nutrition-energy-card" colors={['#172629', '#10191d', '#142024']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.hero}>
      <View style={styles.heroToolbar}><Text style={styles.heroLabel}>已记录摄入</Text><View style={styles.heroTools}>
        <Pressable accessibilityRole="button" accessibilityLabel="选择饮食记录日期" onPress={() => setShowDatePicker(true)} style={styles.datePill}><Text style={styles.datePillText}>{isToday ? '今天' : date.slice(5)}</Text><AppGlyph name="chevron" size={12} /></Pressable>
      </View></View>
      <View style={styles.energyRow}><View style={styles.flex}><View style={styles.energyNumbers}><Text testID="nutrition-recorded-energy" style={styles.energy}>{knownEnergy ? rounded(actual.calories) : '—'}</Text><Text style={styles.energyUnit}>{referenceReady ? '/ ' + reference.calories + ' kcal' : 'kcal'}</Text></View>{containsEstimates || missingNutrition ? <Text style={styles.target}>{[containsEstimates ? '含估算' : '', missingNutrition ? missingNutrition + ' 项营养待补 · 仅汇总已知值' : ''].filter(Boolean).join(' · ')}</Text> : null}</View><CalorieRing progress={knownEnergy && referenceReady ? actual.calories / reference.calories : undefined} /></View>
      {!referenceReady || !isToday ? <Text style={styles.target}>{referenceReady ? '当日保存参考 ' + reference.calories + ' kcal' : isToday ? targets.status === 'needs_setup' ? '尚未设置营养目标与饮食偏好' : '自动目标暂停 · 仍可记录饮食' : snapshot ? '当日自动目标暂停 · 不套用今天的目标' : '该日未保存目标 · 不补造历史参考值'}</Text> : null}
      <View style={styles.macroRow}><Macro label="蛋白质" value={actual.protein} target={referenceReady ? reference.protein : undefined} empty={!records.some(entry => nutrientKnown(entry, 'protein'))} /><Macro label="碳水" value={actual.carbs} target={referenceReady ? reference.carbs : undefined} empty={!records.some(entry => nutrientKnown(entry, 'carbs'))} cyan /><Macro label="脂肪" value={actual.fat} target={referenceReady ? reference.fat : undefined} empty={!records.some(entry => nutrientKnown(entry, 'fat'))} /></View>
    </LinearGradient>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {nutritionStorageIssue ? <View style={styles.warning}><Text accessibilityRole="alert" style={styles.warningText}>{nutritionStorageIssue}</Text></View> : historyError ? <View style={styles.warning}><Text accessibilityRole="alert" style={styles.warningText}>{historyError}</Text><Action label="重试保存目标" small onPress={() => void run('capture-target', async () => { await captureNutritionTarget(); setHistoryError(''); })} /></View> : null}
    {isToday && !ready ? <Card style={styles.notice}><Text style={styles.cardTitle}>{targets.status === 'needs_setup' ? '先了解你的饮食需要' : '营养目标暂不可用'}</Text><Text style={styles.body}>{targets.message}</Text></Card> : null}

    <View style={styles.mealSection}><View style={styles.sectionAccent} /><View><Text style={styles.eyebrow}>AI 饮食记录</Text><Text style={styles.sectionTitle}>{isToday ? '今日饮食' : '当日饮食'}</Text></View></View>
    <MealTimeline entries={records} skipped={dayState?.skippedSlots} onInspect={setRecordSlot} />
    <View style={styles.section}><Text style={styles.sectionTitle}>体重趋势</Text><Action label={showWeight ? '收起' : '记录体重'} small onPress={() => setShowWeight(value => !value)} /></View>
    <Card><WeightTrendChart history={profile.weightHistory} today={today} />
      {showWeight ? <View style={styles.weightEditor}><Text style={styles.body}>记录的是今天体重，不会自动覆盖饮食估算体重。</Text><View style={styles.actions}><TextInput accessibilityLabel="今日体重kg" placeholder="体重 kg" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} style={styles.input} /><Action label="保存体重" disabled={Boolean(busy)} onPress={saveWeight} /></View>
        {planningWeight !== null ? <Action label={'使用近期均重 ' + planningWeight + ' kg 重新估算'} onPress={() => confirmAction('更新饮食估算体重？', '只调整之后的建议，不改写已吃的记录。', () => void run('weight-calibration', () => patchProfile({ weight: planningWeight })))} disabled={Boolean(busy)} /> : null}
      </View> : null}
    </Card>

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
            <View style={styles.between}><Text style={styles.slot}>{slotLabels[entry.slot]}</Text><Text style={styles.mealMacros}>{nutrientKnown(entry, 'calories') ? rounded(entry.nutrients.calories) : '—'} kcal</Text></View>
            <Text style={styles.recordName}>{entry.name}</Text><Text style={styles.subtle}>蛋白 {nutrientKnown(entry, 'protein') ? rounded(entry.nutrients.protein) : '—'}g · 碳水 {nutrientKnown(entry, 'carbs') ? rounded(entry.nutrients.carbs) : '—'}g · 脂肪 {nutrientKnown(entry, 'fat') ? rounded(entry.nutrients.fat) : '—'}g</Text>
            {entry.source === 'agent' ? <><Text style={styles.subtle}>{entry.agentFood?.amount ?? '份量待补'}</Text><Text style={styles.estimateNote}>{entry.agentFood?.estimated ? 'AI 已记录 · 含估算' : 'AI 已记录'}{hasUnknownNutrition(entry) ? ' · 部分营养待补' : ''}</Text></> : null}
            {entry.photoEstimate ? <><Text style={styles.subtle}>{photoPortionSummary(entry.photoEstimate)}</Text><Text style={styles.estimateNote}>{photoUsesOnlyLabels(entry.photoEstimate) ? '按包装标签与所选份量计算' : entry.photoEstimate.calculation === 'ingredients' ? '按确认食材查库计算 · 份量仍为估计' : '含照片估算 · ' + summarizePhotoEstimate(entry.photoEstimate).calorieRange.min + '–' + summarizePhotoEstimate(entry.photoEstimate).calorieRange.max + ' kcal'}</Text></> : null}
            {entry.photos?.length ? <View style={styles.actions}>{entry.photos.map(photo => <NutritionPhotoView key={photo.id} photo={photo} size={70} />)}</View> : null}
            {entry.fiberIncomplete ? <Text style={styles.subtle}>部分标签未标注纤维</Text> : null}
          </Card>;
        })}
        {!records.some(entry => recordSlot === 'all' || entry.slot === recordSlot) ? <Text style={styles.body}>暂无记录，未记录不代表没有吃。</Text> : null}
      </ScrollView>
    </View></View></Modal>
  </Page>;
}

function Macro({ label, value, target, empty, cyan }: { label: string; value: number; target?: number; empty?: boolean; cyan?: boolean }) {
  return <View style={styles.macro}><Text style={styles.macroLabel}>{label}</Text><Text style={styles.macroValue}>{empty ? '—' : rounded(value)}<Text style={styles.macroUnit}> g</Text>{target ? <Text style={styles.macroReference}> / {target}</Text> : null}</Text>{target ? <View style={styles.macroTrack}><View style={[styles.fill, cyan && { backgroundColor: '#77d9d6' }, { width: `${Math.min(100, value / target * 100)}%` }]} /></View> : null}</View>;
}
function IconAction({ name, label, hint, onPress, close, disabled }: { name: GlyphName; label: string; hint?: string; onPress: () => void; close?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.iconAction, close && styles.closeIcon, (pressed || disabled) && { opacity: .5 }]}><AppGlyph name={name} size={18} /></Pressable>;
}
function Action({ label, onPress, disabled, bright, small, accessibilityLabel }: { label: string; onPress: () => void; disabled?: boolean; bright?: boolean; small?: boolean; accessibilityLabel?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, bright && styles.actionBright, small && styles.actionSmall, (disabled || pressed) && { opacity: disabled ? 0.45 : 0.7 }]}><Text style={[styles.actionText, bright && { color: appPalette.onLime }]}>{label}</Text></Pressable>;
}

function CalorieRing({ progress }: { progress?: number }) {
  const circumference = 2 * Math.PI * 34;
  const value = typeof progress === 'number' && Number.isFinite(progress) ? Math.max(0, progress) : undefined;
  return <View testID="nutrition-energy-ring" style={styles.ring}><Svg width={92} height={92} viewBox="0 0 92 92"><Circle cx={46} cy={46} r={44} fill="none" stroke="#395958" strokeWidth={1} strokeDasharray="1 5" /><Circle cx={46} cy={46} r={34} fill="none" stroke="#283d40" strokeWidth={7} /><Circle cx={46} cy={46} r={26} fill="none" stroke="#3c512d" strokeWidth={1} /><Circle cx={46} cy={46} r={34} fill="none" stroke={appPalette.lime} strokeWidth={7} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.min(1, value || 0))} transform="rotate(-90 46 46)" /></Svg><View style={styles.ringCopy}><Text style={styles.ringValue}>{value === undefined ? '—' : Math.round(value * 100) + '%'}</Text></View></View>;
}

const styles = StyleSheet.create({
  page: { ...progressPageLayout.content },
  embeddedPage: { paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  back: { width: 44, height: 44, justifyContent: 'center' },
  title: { ...progressPageLayout.title, color: colors.ink },
  flex: { flex: 1, minWidth: 0 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  dateCenter: { flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dateText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  subtle: { color: colors.inkMuted, fontSize: 11, lineHeight: 18 },
  hero: { borderWidth: 1, borderColor: '#355354', paddingHorizontal: 15, paddingTop: 4, paddingBottom: 17, borderRadius: 20, overflow: 'hidden' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heroLabel: { fontSize: 11, fontWeight: '700', color: colors.inkMuted, flex: 1 },
  heroToolbar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroTools: { flexDirection: 'row', alignItems: 'center' },
  datePill: { minHeight: 44, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  datePillText: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  iconAction: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  closeIcon: { transform: [{ rotate: '45deg' }] },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  energyNumbers: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6 },
  energy: { color: appPalette.lime, fontSize: 44, lineHeight: 52, fontWeight: '800', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  energyUnit: { color: colors.inkMuted, fontSize: 11 },
  target: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 8 },
  ring: { width: 92, height: 92, flexShrink: 0 },
  ringCopy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ringValue: { color: colors.ink, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  macroRow: { flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  macro: { flex: 1, minWidth: 0 },
  macroValue: { color: colors.ink, fontSize: 16, fontWeight: '800', lineHeight: 22, marginTop: 3, fontVariant: ['tabular-nums'] },
  macroUnit: { fontSize: 10, color: colors.inkMuted },
  macroLabel: { color: colors.inkMuted, fontSize: 11 },
  macroReference: { color: colors.inkMuted, fontSize: 10, fontWeight: '500' },
  macroTrack: { height: 4, backgroundColor: colors.line, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', backgroundColor: colors.lime },
  action: { borderRadius: 14, minHeight: 44, backgroundColor: appPalette.raised, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 1 },
  actionBright: { backgroundColor: colors.lime, borderColor: colors.lime },
  actionSmall: { paddingHorizontal: 10, minHeight: 44, borderRadius: 12 },
  actionText: { fontSize: 12, color: colors.ink, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6, gap: 12 },
  sectionTitle: { ...progressPageLayout.sectionTitle, color: colors.ink },
  recordList: { gap: 10, paddingVertical: 12 },
  recordName: { color: colors.ink, fontSize: 16, fontWeight: '800', marginVertical: 8, lineHeight: 22 },
  estimateNote: { color: appPalette.warning, fontSize: 11, lineHeight: 18, marginTop: 8 },
  mealSection: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 22, marginBottom: 14 },
  sectionAccent: { width: 2, height: 35, backgroundColor: appPalette.lime, borderRadius: 1 },
  eyebrow: { fontSize: 10, color: appPalette.muted, letterSpacing: 1, marginBottom: 4 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  slot: { color: colors.green, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  mealMacros: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  body: { color: colors.inkMuted, fontSize: 12, lineHeight: 20, marginVertical: 6 },
  warning: { padding: 12, borderRadius: 12, backgroundColor: appPalette.warningBackground, marginTop: 7 },
  warningText: { color: appPalette.warning, fontSize: 12, lineHeight: 19 },
  notice: { marginTop: 16, gap: 9 },
  weightEditor: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 15, paddingTop: 9, gap: 10 },
  input: { flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: colors.line, padding: 12, borderRadius: 12, color: colors.ink, backgroundColor: colors.paper, fontSize: 13 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 21, marginVertical: 12 },
  backdrop: { flex: 1, padding: 16, backgroundColor: 'rgba(0,0,0,.72)', justifyContent: 'center', alignItems: 'center' },
  sheet: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 16, width: '100%', maxWidth: 440, maxHeight: '90%' }
});
