import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { defaultNutritionPreferences } from '../../nutrition/engine';
import { OBJECTIVE_EXPLANATIONS } from '../../nutrition/knowledge';
import { objectiveLabels, patternLabels } from '../../nutrition/labels';
import type { Allergen, NutritionObjective, NutritionPreferences, NutritionRisk } from '../../nutrition/types';
import { useAppStore } from '../../store/AppStore';
import { fitnessColors as colors, appPalette, radius, progressPageLayout } from '../../theme';
import type { Profile } from '../../types';

const objectives: NutritionObjective[] = ['fat_loss', 'muscle_gain', 'maintain', 'performance'];
const allergens: Array<{ key: Allergen; label: string }> = [
  { key: 'milk', label: '奶' }, { key: 'egg', label: '蛋' }, { key: 'soy', label: '大豆' }, { key: 'wheat', label: '小麦' },
  { key: 'peanut', label: '花生' }, { key: 'tree_nut', label: '坚果' }, { key: 'fish', label: '鱼' }, { key: 'shellfish', label: '甲壳 / 贝类' },
];
const risks: Array<{ key: NutritionRisk; label: string }> = [
  { key: 'pregnancy', label: '怀孕或哺乳中' },
  { key: 'medical_condition', label: '有需要饮食管理的疾病 / 正在接受治疗' },
  { key: 'glucose_medication', label: '使用胰岛素或其他降糖药' },
  { key: 'sglt2', label: '使用 SGLT2 类药物（如达格列净）' },
  { key: 'eating_disorder', label: '有进食障碍史或正在接受相关帮助' },
];
const numberFrom = (text: string) => text.trim() ? Number(text.trim().replace(',', '.')) : NaN;

export function NutritionSetupModal({ profile, preferences, onClose }: { profile: Profile; preferences: NutritionPreferences | null; onClose: () => void }) {
  const { saveProfile, saveNutritionPreferences } = useAppStore();
  const [draft, setDraft] = useState(preferences || defaultNutritionPreferences(profile));
  const [age, setAge] = useState(profile.age > 0 ? String(profile.age) : '');
  const [height, setHeight] = useState(profile.height > 0 ? String(profile.height) : '');
  const [weight, setWeight] = useState(profile.weight > 0 ? String(profile.weight) : '');
  const [sex, setSex] = useState(profile.sex);
  const [confirmed, setConfirmed] = useState(Boolean(preferences?.screeningCompletedAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const update = (patch: Partial<NutritionPreferences>) => { setConfirmed(false); setDraft(value => ({ ...value, ...patch })); };
  const save = async () => {
    if (lock.current) return;
    const nextAge = numberFrom(age), nextHeight = numberFrom(height), nextWeight = numberFrom(weight);
    if (!Number.isInteger(nextAge) || nextAge < 1 || nextAge > 100) { setError('年龄请输入 1–100 之间的整数；未成年人不生成成人食谱。'); return; }
    if (!Number.isFinite(nextHeight) || nextHeight < 120 || nextHeight > 230 || !Number.isFinite(nextWeight) || nextWeight < 30 || nextWeight > 300) { setError('请核对基础资料：身高 120–230 cm，体重 30–300 kg。'); return; }
    if (sex !== 'male' && sex !== 'female') { setError('请选择用于估算的生理性别公式，不会自动替你选择。'); return; }
    if (!confirmed) { setError('请核对资料与健康情况，再勾选下方确认。'); return; }
    if (draft.pattern !== 'balanced' && draft.pattern !== 'vegetarian') { setError('低碳与生酮尚未开放，请选择均衡饮食或蛋奶素。'); return; }
    lock.current = true; setSaving(true); setError('');
    let bodySaved = false;
    try {
      await saveProfile({ ...profile, age: nextAge, height: nextHeight, weight: Math.round(nextWeight * 10) / 10, sex });
      bodySaved = true;
      await saveNutritionPreferences({ ...draft, screeningCompletedAt: new Date().toISOString() });
      onClose();
    } catch { setError(bodySaved ? '基础资料已保存，但营养偏好保存失败。请重试；不要离开以免丢失本次选择。' : '保存失败，资料尚未更新。请稍后重试。'); }
    finally { lock.current = false; setSaving(false); }
  };
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!saving) onClose(); }}>
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View style={styles.sheet}>
      <View style={styles.header}><View style={styles.flex}><Text style={styles.title}>你的营养档案</Text><Text style={styles.subtitle}>独立于训练目标，按你的生活安排饮食</Text></View><Pressable accessibilityRole="button" accessibilityLabel="关闭营养设置" disabled={saving} onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View pointerEvents={saving ? 'none' : 'auto'}>
          <Heading title="我希望" />
          <View style={styles.objectives}>{objectives.map(key => <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: draft.objective === key }} aria-checked={draft.objective === key} onPress={() => update({ objective: key })} style={[styles.objective, draft.objective === key && styles.objectiveActive]}><Text style={styles.objectiveTitle}>{objectiveLabels[key]}</Text><Text style={styles.description}>{OBJECTIVE_EXPLANATIONS[key]}</Text></Pressable>)}</View>
          <Heading title="基础资料" hint="用于估算能量，保存后同步个人资料；保留已有体重记录。" />
          <View style={styles.fields}><Field label="年龄 · 岁" value={age} onChange={text => { setConfirmed(false); setAge(text); }} /><Field label="身高 · cm" value={height} onChange={text => { setConfirmed(false); setHeight(text); }} /><Field label="体重 · kg" value={weight} onChange={text => { setConfirmed(false); setWeight(text); }} /></View>
          <View style={styles.chips}><Choice label="男性公式" active={sex === 'male'} onPress={() => { setConfirmed(false); setSex('male'); }} /><Choice label="女性公式" active={sex === 'female'} onPress={() => { setConfirmed(false); setSex('female'); }} /></View>
          <Heading title="日常活动" hint="包含工作、通勤和日常训练；不会把训练消耗重复加回。" />
          <View style={styles.chips}>{([{ key: 'sedentary', label: '久坐为主' }, { key: 'light', label: '适量活动' }, { key: 'active', label: '经常活动' }] as const).map(item => <Choice key={item.key} label={item.label} active={draft.activity === item.key} onPress={() => update({ activity: item.key })} />)}</View>
          <Heading title="饮食方式" />
          <View style={styles.chips}><Choice label={patternLabels.balanced} active={draft.pattern === 'balanced'} onPress={() => update({ pattern: 'balanced' })} /><Choice label={patternLabels.vegetarian} active={draft.pattern === 'vegetarian'} onPress={() => update({ pattern: 'vegetarian' })} /><Choice label="低碳 · 后续开放" active={false} disabled /><Choice label="生酮 · 后续开放" active={false} disabled /></View>
          <Heading title="食物过敏" hint="当前支持下列 8 类；如有其他过敏或不确定，请勿使用自动菜谱，先咨询专业人员。仍须核对包装与交叉接触。" />
          <View style={styles.chips}>{allergens.map(item => <Choice key={item.key} label={item.label} active={draft.allergens.includes(item.key)} multi onPress={() => update({ allergens: draft.allergens.includes(item.key) ? draft.allergens.filter(value => value !== item.key) : [...draft.allergens, item.key] })} />)}</View>
          <Heading title="做饭时间与预算" />
          <View style={styles.chips}>{([15, 30, 45] as const).map(minutes => <Choice key={minutes} label={minutes + ' 分钟以内'} active={draft.maxCookingMinutes === minutes} onPress={() => update({ maxCookingMinutes: minutes })} />)}</View>
          <View style={styles.chips}><Choice label="经济实惠" active={draft.budget === 'economy'} onPress={() => update({ budget: 'economy' })} /><Choice label="日常标准" active={draft.budget === 'standard'} onPress={() => update({ budget: 'standard' })} /></View>
          <Heading title="健康情况" hint="如有以下情况请勾选；此筛查不能判断你是否适合某种饮食。" />
          {risks.map(item => <CheckRow key={item.key} label={item.label} checked={draft.riskFlags.includes(item.key)} onPress={() => update({ riskFlags: draft.riskFlags.includes(item.key) ? draft.riskFlags.filter(value => value !== item.key) : [...draft.riskFlags, item.key] })} />)}
          <View style={styles.consent}><CheckRow label="我已核对基础资料、过敏与上述健康情况，所选内容属实。" checked={confirmed} onPress={() => setConfirmed(value => !value)} /><Text style={styles.hint}>有相关情况也可以保存并记餐；个性化能量目标和食谱将暂停，建议咨询专业人员。</Text></View>
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => { void save(); }} style={[styles.save, saving && styles.disabled]}><Text style={styles.saveText}>{saving ? '保存中…' : '保存并查看饮食安排'}</Text></Pressable>
        <Text style={styles.footnote}>仅保存到当前设备。未连接云端模型。</Text>
      </ScrollView>
    </View></KeyboardAvoidingView>
  </Modal>;
}

function Heading({ title, hint }: { title: string; hint?: string }) { return <View style={styles.heading}><Text style={styles.headingTitle}>{title}</Text>{hint ? <Text style={styles.hint}>{hint}</Text> : null}</View>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (text: string) => void }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType="decimal-pad" selectTextOnFocus style={styles.input} /></View>; }
function Choice({ label, active, onPress, disabled = false, multi = false }: { label: string; active: boolean; onPress?: () => void; disabled?: boolean; multi?: boolean }) { return <Pressable accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={{ checked: active, disabled }} aria-checked={active} aria-disabled={disabled} onPress={onPress} disabled={disabled} style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}><Text style={[styles.chipText, active && styles.chipActiveText, disabled && styles.chipDisabledText]}>{label}</Text></Pressable>; }
function CheckRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) { return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} aria-checked={checked} onPress={onPress} style={styles.checkRow}><View style={[styles.checkbox, checked && styles.checkboxActive]}><Text style={styles.checkboxText}>{checked ? '✓' : ''}</Text></View><Text style={styles.checkLabel}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(14,20,12,0.5)', justifyContent: 'center', alignItems: 'center', padding: 14 },
  sheet: { width: '100%', maxWidth: progressPageLayout.content.maxWidth, maxHeight: '94%', backgroundColor: colors.paper, borderRadius: radius.lg, overflow: 'hidden', flexShrink: 1 },
  header: { padding: 16, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 }, title: { color: colors.ink, fontSize: 22, fontWeight: '900' }, subtitle: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, closeText: { color: colors.ink, fontSize: 26 },
  content: { padding: 16, paddingTop: 4, paddingBottom: 28 }, heading: { marginTop: 22, marginBottom: 11 }, headingTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, hint: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 5 },
  objectives: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, objective: { flexGrow: 1, flexBasis: 200, borderRadius: radius.sm, padding: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }, objectiveActive: { borderColor: colors.limeDark, backgroundColor: appPalette.olive }, objectiveTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' }, description: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, field: { flex: 1, minWidth: 80 }, fieldLabel: { color: colors.inkMuted, fontSize: 11, marginBottom: 7 }, input: { minHeight: 46, color: colors.ink, fontSize: 15, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 }, chip: { minHeight: 44, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' }, chipActive: { backgroundColor: appPalette.olive, borderColor: colors.limeDark }, chipText: { color: colors.inkMuted, fontSize: 12, fontWeight: '600' }, chipActiveText: { color: colors.lime }, chipDisabled: { backgroundColor: appPalette.raised, borderColor: colors.line }, chipDisabledText: { color: '#868980' },
  checkRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8 }, checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' }, checkboxActive: { borderColor: colors.limeDark, backgroundColor: appPalette.olive }, checkboxText: { color: colors.lime, fontSize: 15, fontWeight: '900' }, checkLabel: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 19 },
  consent: { backgroundColor: appPalette.olive, padding: 14, borderRadius: radius.sm, marginTop: 15, marginBottom: 12 }, error: { color: colors.danger, backgroundColor: appPalette.warningBackground, padding: 12, fontSize: 12, lineHeight: 19, borderRadius: 10, marginVertical: 10 },
  save: { backgroundColor: colors.lime, minHeight: 48, borderRadius: radius.sm, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, saveText: { color: appPalette.onLime, fontSize: 13, fontWeight: '900' }, disabled: { opacity: 0.5 }, footnote: { color: colors.inkMuted, fontSize: 10, textAlign: 'center', marginTop: 12 },
});
