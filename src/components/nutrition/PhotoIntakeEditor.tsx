import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { IntakeEntry, MealSlot, NutritionPhoto } from '../../nutrition/types';
import { applyPhotoCorrection, normalizePhotoEstimate, photoUsesOnlyLabels, summarizePhotoEstimate, type PhotoEstimate } from '../../nutrition/vision';
import { withCapturedPhoto, type CapturedNutritionPhoto } from '../../nutrition/photoStorage';
import { useAppStore } from '../../store/AppStore';
import { fitnessColors as colors, appPalette, progressPageLayout } from '../../theme';
import { PhotoFoodEditor } from './PhotoFoodEditor';
import { FoodCameraModal } from './FoodCameraModal';
import { NutritionPhotoView } from './NutritionPhotoView';

export function PhotoIntakeEditor({ entry, onClose }: { entry: IntakeEntry; onClose: () => void }) {
  const { saveIntakeEntry } = useAppStore();
  const [estimate, setEstimate] = useState(() => normalizePhotoEstimate(entry.photoEstimate));
  const [slot, setSlot] = useState<MealSlot>(entry.slot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState<NutritionPhoto[]>(entry.photos ?? []);
  const [captureIndex, setCaptureIndex] = useState<number | null>(null);
  const saving = useRef(false);
  const recordId = useRef(entry.id);
  const recordDate = useRef(entry.date);
  if (!estimate) return null;
  const summary = estimate.items.length ? summarizePhotoEstimate(estimate) : null;
  const labelBased = photoUsesOnlyLabels(estimate);
  const commit = (updated: PhotoEstimate, updatedSlot: MealSlot, attachments: NutritionPhoto[]) => saveIntakeEntry({ id: recordId.current, date: recordDate.current,
    name: updated.dishName ?? updated.items.map(item => item.name).join('、').slice(0, 180), slot: updatedSlot, source: 'photo_estimate', portions: [], photoEstimate: updated, photos: attachments });
  const save = async () => {
    if (saving.current || !estimate.items.length) return;
    saving.current = true; setBusy(true); setError('');
    try { await commit(estimate, slot, photos); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败，请重试。'); }
    finally { saving.current = false; setBusy(false); }
  };
  const correct = async (correction: PhotoEstimate, correctedSlot: MealSlot, frame?: CapturedNutritionPhoto, retain = false) => {
    if (saving.current || captureIndex === null) throw new Error('请等待当前保存完成后再修正。');
    const updated = applyPhotoCorrection(estimate, captureIndex, correction);
    if (retain && frame?.dataUrl && photos.length >= 3) throw new Error('一条记录最多保存三张照片，请先返回并移除一张。');
    saving.current = true; setBusy(true); setError('');
    try {
      let attachments = photos;
      await withCapturedPhoto(frame, retain, async photo => {
        attachments = photo ? [...photos, photo] : photos;
        await commit(updated, correctedSlot, attachments);
      });
      setEstimate(updated); setPhotos(attachments); setSlot(correctedSlot);
    } finally { saving.current = false; setBusy(false); }
  };
  if (captureIndex !== null) return <FoodCameraModal visible initialSlot={slot} saveLabel="保存并应用这项更正" onClose={() => setCaptureIndex(null)} onSave={correct} />;
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!saving.current) onClose(); }}><KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View style={styles.card} accessibilityViewIsModal><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text style={styles.title}>核对饮食记录</Text><Text style={styles.body}>{recordDate.current} · 改名和份量在本机修改；补拍识别另行征求联网同意。</Text>
    {summary ? <><Text style={styles.energy}>{labelBased ? '标签计算 ' : estimate.calculation === 'ingredients' ? '食材计算约 ' : '约 '}{summary.nutrients.calories} kcal</Text><Text style={styles.body}>{labelBased || estimate.calculation === 'ingredients' ? '' : `参考区间 ${summary.calorieRange.min}–${summary.calorieRange.max} kcal · 不是置信区间\n`}蛋白 {summary.nutrients.protein}g · 碳水 {summary.nutrients.carbs}g · 脂肪 {summary.nutrients.fat}g</Text></> : null}
    {photos.length ? <><Text style={styles.label}>保存的照片</Text><View style={styles.row}>{photos.map(photo => <View key={photo.id}><NutritionPhotoView photo={photo} size={76} /><Pressable accessibilityRole="button" accessibilityLabel={'移除保存的' + (photo.kind === 'label' ? '标签照片' : '食品照片')} disabled={busy} onPress={() => setPhotos(current => current.filter(item => item.id !== photo.id))} style={styles.cancel}><Text style={styles.body}>移除照片</Text></Pressable></View>)}</View><Text style={styles.body}>移除后保存更正才生效；其他收藏仍使用的照片会保留。</Text></> : <Text style={styles.body}>这条记录未保存照片，无法恢复旧照片；可补拍标签修正数值。</Text>}
    <PhotoFoodEditor estimate={estimate} disabled={busy} onChange={next => { if (!saving.current) { setEstimate(next); setError(''); } }} />
    {estimate.items.map((item, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={'补拍标签修正' + item.name} disabled={busy} onPress={() => setCaptureIndex(index)} style={styles.chip}><Text style={styles.chipText}>补拍标签修正：{item.name} ›</Text></Pressable>)}
    <Text style={styles.label}>餐次</Text><View style={styles.row}>{([['breakfast', '早餐'], ['lunch', '午餐'], ['snack', '加餐'], ['dinner', '晚餐']] as const).map(([key, label]) => <Pressable key={key} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: slot === key }} onPress={() => setSlot(key)} style={[styles.chip, slot === key && styles.selected]}><Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
    <Text style={styles.body}>{labelBased ? '营养数值按标签与所选重量计算；计算值不代表称重实测。' : '最初识别来源：' + estimate.model + '\n修正某项不改动其他食物；各项计算依据可单独查看。'}</Text>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !summary }} disabled={busy || !summary} onPress={() => void save()} style={[styles.save, (busy || !summary) && styles.disabled]}><Text style={styles.saveText}>{busy ? '保存中…' : '保存本地纠正'}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={styles.cancel}><Text style={styles.body}>取消</Text></Pressable>
  </ScrollView></View></KeyboardAvoidingView></Modal>;
}
const styles = StyleSheet.create({ backdrop: { flex: 1, padding: 18, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'center', alignItems: 'center' }, card: { width: '100%', maxWidth: progressPageLayout.content.maxWidth, maxHeight: '88%', borderRadius: 26, backgroundColor: colors.paper }, content: { padding: 16, gap: 12 }, title: { color: colors.ink, fontSize: progressPageLayout.title.fontSize, fontWeight: '900' }, energy: { color: colors.green, fontSize: 26, fontWeight: '900' }, body: { color: colors.inkMuted, fontSize: 12, lineHeight: 21, marginTop: 12 }, label: { color: colors.ink, fontWeight: '700', marginTop: 22, marginBottom: 12 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, borderRadius: 12, backgroundColor: appPalette.raised }, selected: { backgroundColor: appPalette.olive, borderWidth: 1, borderColor: colors.limeDark }, saveText: { color: appPalette.onLime, fontWeight: '800', fontSize: 13 }, chipText: { color: colors.ink, fontWeight: '800', fontSize: 13 }, error: { color: colors.danger, marginTop: 12 }, save: { backgroundColor: colors.lime, padding: 16, borderRadius: 15, marginTop: 20, alignItems: 'center' }, disabled: { opacity: 0.45 }, cancel: { minHeight: 44, alignItems: 'center', padding: 8 } });
