import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { AppGlyph } from '../components/AppGlyph';
import { useUpdateBlock } from '../components/AppUpdates';
import { TrainingFrequencyWheel } from '../components/TrainingFrequencyWheel';
import { Button } from '../components/ui';
import { equipmentAvailableGear, equipmentFrequency, equipmentReplacementIds, equipmentSplitConfig, equipmentSplitFrequencies, equipmentSplitLabels, equipmentSplitNotes, equipmentTrainingDays, equipmentSessionPlan, equipmentRegionTargets } from '../data/equipmentTraining';
import { equipmentMuscleRegions } from '../data/equipmentLibrary';
import { trainingFunctionLabels } from '../data/equipmentExecution';
import { equipmentPlanReview } from '../data/equipmentPlanReview';
import { equipmentGear, equipmentGroups, type GearKey } from '../data/equipmentTaxonomy';
import { getEquipmentMovement } from '../data/equipment';
import { getWeekSchedule } from '../data/trainingPlans';
import { localDateKey } from '../data/planProgress';
import { appPalette as p } from '../theme';
import type { Profile } from '../types';

export type EquipmentPlanOptions = Pick<Profile, 'frequency' | 'equipmentSplit' | 'equipmentTrainingDays' | 'equipmentAvailableGear' | 'equipmentPriority' | 'equipmentMovementOverrides'>;
type Props = { profile: Profile; onClose: () => void; onSave: (options: EquipmentPlanOptions) => Promise<void> };
const splits = ['bro', 'ppl', 'upper_lower'] as const;
const subtitle = { bro: 'Bro Split', ppl: 'PPL', upper_lower: 'Upper / Lower' };
const weekday = ['日', '一', '二', '三', '四', '五', '六'];
export function EquipmentPlanEditor({ profile, onClose, onSave }: Props) {
  useUpdateBlock(true);
  const { height } = useWindowDimensions();
  const initialSplit = equipmentSplitConfig(profile);
  const [split, setSplit] = useState(initialSplit);
  const [frequency, setFrequency] = useState(() => equipmentFrequency(profile.frequency, initialSplit));
  const [days, setDays] = useState(() => equipmentTrainingDays({ ...profile, equipmentSplit: initialSplit }));
  const [gear, setGear] = useState<GearKey[]>(() => equipmentAvailableGear(profile));
  const [priority, setPriority] = useState<NonNullable<Profile['equipmentPriority']>>(profile.equipmentPriority || 'balanced');
  const [overrides, setOverrides] = useState(profile.equipmentMovementOverrides || {});
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [adjustDays, setAdjustDays] = useState(false);
  const [editing, setEditing] = useState(false);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [now] = useState(() => new Date());
  const options: EquipmentPlanOptions = { frequency, equipmentSplit: split, equipmentTrainingDays: days, equipmentAvailableGear: gear, equipmentPriority: priority, equipmentMovementOverrides: overrides };
  const restarted = frequency !== profile.frequency || split !== equipmentSplitConfig(profile) || days.slice().sort().join() !== equipmentTrainingDays(profile).join();
  const draft: Profile = { ...profile, ...options, planStartedAt: restarted ? now.toISOString() : profile.planStartedAt };
  const preview = useMemo(() => {
    const anchor = new Date(now); anchor.setDate(anchor.getDate() + weekOffset * 7);
    return getWeekSchedule(draft, anchor).map(day => {
      const plan = day.workoutId ? equipmentSessionPlan(day.workoutId, draft, day.date) : undefined;
      const items = plan?.items || [];
      return { ...day, plan, items, sets: items.reduce((sum, item) => sum + item.targetSets, 0) };
    });
  }, [profile, split, frequency, days, gear, priority, overrides, now, weekOffset]);
  const session = preview[selected] || preview[0];
  const weekSets = preview.reduce((sum, day) => sum + day.sets, 0);
  const review = useMemo(() => { const anchor = new Date(now); anchor.setDate(anchor.getDate() + weekOffset * 7); return equipmentPlanReview(draft, anchor); }, [profile, split, frequency, days, gear, priority, overrides, now, weekOffset]);
  const issues = review.issues;
  const hasUnavailable = review.status === 'infeasible';
  const selectFrequency = (value: number, nextSplit = split) => {
    const next = equipmentFrequency(value, nextSplit);
    setSplit(nextSplit); setFrequency(next);
    if (next !== frequency) setDays(equipmentTrainingDays({ ...profile, frequency: next, equipmentSplit: nextSplit, equipmentTrainingDays: undefined, planStartedAt: now.toISOString() }));
    setSelected(0); setWeekOffset(0); setReplacing(null); setExpanded(false); setEditing(false); setError('');
  };
  const save = async () => {
    if (saving || days.length !== frequency || hasUnavailable) return;
    setSaving(true); setError('');
    try { await onSave(options); } catch { setError('保存失败，请重试。'); } finally { setSaving(false); }
  };
  return <View testID="equipment-plan-editor" accessibilityViewIsModal style={[s.card, { height: Math.min(820, height - 40) }]}>
    <View style={s.header}><View style={s.flex}><Text style={s.brand}>UNCOVER</Text><Text style={s.title}>器械训练计划</Text></View><Pressable accessibilityRole="button" accessibilityLabel="关闭器械设置" disabled={saving} onPress={onClose} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
    <ScrollView testID="equipment-plan-scroll" showsVerticalScrollIndicator={false} style={s.scroll} contentContainerStyle={s.content}>
      <View accessibilityRole="radiogroup" accessibilityLabel="训练分化" style={s.tabs}>{splits.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={'选择' + equipmentSplitLabels[value]} accessibilityState={{ checked: split === value }} aria-checked={split === value} onPress={() => selectFrequency(frequency, value)} style={[s.tab, split === value && s.tabActive]}><Text style={s.tabText}>{{ bro: '传统五分化', ppl: '推拉腿', upper_lower: '上下肢' }[value]}</Text><Text style={s.subtitle}>{subtitle[value]}</Text>{split === value ? <View style={s.tabUnderline} /> : null}</Pressable>)}</View>
      <View style={s.frequencyRow}><View style={s.flex}><Text style={s.section}>每周次数</Text><Text style={s.note}>{equipmentSplitNotes[split]}</Text></View><TrainingFrequencyWheel value={frequency} values={equipmentSplitFrequencies[split]} onChange={selectFrequency} /></View>
      <Text style={s.note}>周内容与组数不随频率减少；低频合并，高频拆分。无单次时间限制。</Text>
      <View style={s.row}><Text style={[s.section, s.flex]}>每周安排</Text><Pressable accessibilityRole="button" accessibilityLabel="预览上一周" disabled={!weekOffset} onPress={() => setWeekOffset(Math.max(0, weekOffset - 1))} style={s.link}><Text style={[s.muted, !weekOffset && { opacity: .3 }]}>‹</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="预览下一周" onPress={() => setWeekOffset(weekOffset + 1)} style={s.link}><Text style={s.muted}>›</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="调整训练日" accessibilityState={{ expanded: adjustDays }} onPress={() => setAdjustDays(!adjustDays)} style={s.link}><Text style={s.muted}>{adjustDays ? '完成选择' : '调整'} ›</Text></Pressable></View>
      <View style={s.week} testID="equipment-plan-week">{(adjustDays ? [1, 2, 3, 4, 5, 6, 0].map(value => preview.find(day => day.date.getDay() === value)!) : preview).map(day => {
        const index = preview.indexOf(day);
        const training = adjustDays ? days.includes(day.date.getDay()) : day.type === 'strength';
        const active = adjustDays ? training : selected === index;
        const selectedText = active ? training ? s.onLime : s.restActiveText : undefined;
        const code = training ? day.type === 'strength' ? day.title.replace('下肢辅助训练', '腿辅').replace('部训练', '').replace('肢训练', '').replace('力训练', '').replace('训练', '').replace(' ', '') : '练' : '休';
        return <Pressable key={localDateKey(day.date)} testID={training ? 'equipment-plan-training-day' : 'equipment-plan-rest-day'} accessibilityRole={adjustDays ? 'checkbox' : 'tab'} accessibilityLabel={adjustDays ? '训练日周' + weekday[day.date.getDay()] : '预览周' + weekday[day.date.getDay()] + '训练'} accessibilityState={adjustDays ? { checked: training } : { selected: active }} aria-selected={!adjustDays ? active : undefined} aria-checked={adjustDays ? training : undefined} onPress={() => { if (adjustDays) setDays(old => old.includes(day.date.getDay()) ? old.filter(value => value !== day.date.getDay()) : old.length < frequency ? [...old, day.date.getDay()] : old); else { setSelected(index); setReplacing(null); setExpanded(false); setEditing(false); } }} style={[s.day, !training && s.dayRest, active && (training ? s.dayActive : s.dayRestActive)]}><Text style={[s.dayWeek, selectedText]}>{weekday[day.date.getDay()]}</Text><Text numberOfLines={1} style={[s.dayTitle, !training && s.restCode, selectedText]}>{code}</Text></Pressable>;
      })}</View>
      {adjustDays ? <Text style={[s.note, days.length !== frequency && s.error]}>已选 {days.length} 天，需要选择 {frequency} 天；先取消原训练日。</Text> : null}
      <Text style={s.summary} testID="equipment-week-summary">{frequency} 次训练  ·  {weekSets} 工作组  ·  {7 - frequency} 天恢复</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="查看每周肌群覆盖" accessibilityState={{ expanded: volumeOpen }} onPress={() => setVolumeOpen(!volumeOpen)} style={s.showAll}><Text style={s.muted}>每周肌群覆盖 {volumeOpen ? '−' : '+'}</Text></Pressable>
      {volumeOpen ? <View testID="equipment-volume-review" style={s.panel}><Text style={s.note}>当前计划周 · {equipmentMuscleRegions.length} 项细分方向与 {Object.keys(trainingFunctionLabels).length} 项动作功能逐周审核。以下是计划组数，不代表实际完成或效果保证。稳定参与不代表孤立增肌。</Text>{equipmentMuscleRegions.map(region => <View key={region.key} testID="equipment-region-row" style={s.row}><Text style={s.small}>{region.label}</Text><Text style={s.small}>{review.coverage.regions[region.key]} / {(equipmentRegionTargets as Record<string, { sets: number }>)[region.key]?.sets ?? '未配置'} {(equipmentRegionTargets as Record<string, { kind: string }>)[region.key]?.kind === 'control' ? '控制组' : (equipmentRegionTargets as Record<string, { kind: string }>)[region.key]?.kind === 'stabilization' ? '稳定参与组' : '针对组'}{review.coverage.regionDeficits.includes(region.key) ? ' · 不足' : ' · 已安排'}</Text></View>)}<Text style={s.note}>动作功能：{review.coverage.functionDeficits.length ? review.coverage.functionDeficits.map(key => trainingFunctionLabels[key]).join('、') + '不足' : '本周已完整安排'}。间接参与不代替针对性训练；区域组数有交叉，不能相加为总工作组。</Text></View> : null}
      {Object.values(overrides).some(course => Object.keys(course).length) ? <Pressable accessibilityRole="button" accessibilityLabel="恢复默认器械动作" onPress={() => { setOverrides({}); setReplacing(null); setError(''); }} style={s.showAll}><Text style={s.muted}>恢复默认动作</Text></Pressable> : null}
      <View style={s.session} testID="equipment-session-preview"><View style={s.row}><Text style={[s.section, s.flex]}>{session.type === 'strength' ? session.title : '休息恢复'}</Text>{session.items.length ? <Pressable accessibilityRole="button" accessibilityLabel="编辑预览动作" onPress={() => setEditing(!editing)} style={s.link}><Text style={s.muted}>{editing ? '完成' : '查看动作'} ›</Text></Pressable> : null}</View><Text testID="equipment-preview-estimate" style={s.small}>{session.plan ? `${session.items.length} 动作 · ${session.sets} 工作组 · 预计 ${session.plan.estimate.rangeMinutes.join('–')} 分钟` : '不安排工作组，不生成训练记录'}</Text>
        {session.plan ? <Text testID="equipment-preview-coverage" style={s.note}>{session.plan.notice}</Text> : null}
        {(expanded || editing ? session.items : session.items.slice(0, 2)).map(item => <View key={item.id}><View style={s.exercise}><AppGlyph name="dumbbell" size={18} color={p.muted} /><Text style={s.exerciseName}>{item.name}</Text><Text style={s.dose}>{item.targetSets} × {item.repRange?.join('–')}{item.perSide ? ' /侧' : ''}</Text>{editing ? <Pressable accessibilityRole="button" accessibilityLabel={'替换' + item.name} onPress={() => setReplacing(replacing === item.equipmentSourceId ? null : item.equipmentSourceId || item.id)} style={s.replace}><Text style={s.linkText}>换</Text></Pressable> : null}</View>{replacing === item.equipmentSourceId ? <View style={s.chips}>{equipmentReplacementIds(item.equipmentSourceId, draft).filter(id => !session.items.some(other => other.id === id && other.equipmentSourceId !== item.equipmentSourceId)).map(id => <Pressable key={id} accessibilityRole="button" accessibilityLabel={'替换为' + getEquipmentMovement(id)!.name} onPress={() => { setOverrides(old => ({ ...old, [session.workoutId!]: { ...old[session.workoutId!], [item.equipmentSourceId!]: id } })); setReplacing(null); }} style={[s.chip, item.id === id && s.chipActive]}><Text style={s.chipText}>{getEquipmentMovement(id)!.name}</Text></Pressable>)}</View> : null}</View>)}
        {session.items.length > 2 && !editing ? <Pressable accessibilityRole="button" accessibilityLabel="展开或收起预览动作" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} hitSlop={{ top: 10, bottom: 10 }} style={s.showAll}><Text style={s.muted}>{expanded ? '收起动作' : `查看全部 ${session.items.length} 个动作`} ›</Text></Pressable> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="器械与偏好" accessibilityState={{ expanded: preferencesOpen }} onPress={() => setPreferencesOpen(!preferencesOpen)} style={s.settingRow}><AppGlyph name="settings" size={20} color={p.text} /><Text style={s.settingTitle}>器械与偏好</Text><Text style={[s.small, s.flex]}>{gear.length === equipmentGear.length ? '商业健身房' : `${gear.length} 类器材`}</Text><Text style={s.chevron}>›</Text></Pressable>
      {preferencesOpen ? <View style={s.panel}><Text style={s.panelTitle}>可用器械</Text><View style={s.chips}>{equipmentGear.map(item => <Pressable key={item.key} accessibilityRole="checkbox" accessibilityLabel={'可用' + item.label} accessibilityState={{ checked: gear.includes(item.key) }} aria-checked={gear.includes(item.key)} onPress={() => setGear(old => old.includes(item.key) ? old.filter(key => key !== item.key) : [...old, item.key])} style={[s.chip, gear.includes(item.key) && s.chipActive]}><Text style={s.chipText}>{item.label}</Text></Pressable>)}</View><Text style={s.panelTitle}>动作顺序偏好</Text><View style={s.chips}>{(['balanced', ...equipmentGroups.map(group => group.key)] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={'优先' + (value === 'balanced' ? '均衡训练' : equipmentGroups.find(group => group.key === value)?.label)} accessibilityState={{ checked: priority === value }} aria-checked={priority === value} onPress={() => setPriority(value)} style={[s.chip, priority === value && s.chipActive]}><Text style={s.chipText}>{value === 'balanced' ? '均衡' : equipmentGroups.find(group => group.key === value)?.label}</Text></Pressable>)}</View><Text style={s.note}>仅调整动作顺序，不额外加量。先校准重量，动作变形或疼痛时停止。</Text></View> : null}
      <Text style={s.note}>以资深训练者均衡增肌为编排目标；未完成的组只记为未完成，不自动删减课表。</Text>
      {hasUnavailable ? <Text accessibilityRole="alert" style={s.error}>{issues.slice(0, 3).join('；')}。请调整替换或可用器械后保存。</Text> : null}
    </ScrollView>
    <View style={s.footer}>{error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}<Button label={saving ? '保存中…' : '保存计划'} variant="lime" disabled={saving || days.length !== frequency || hasUnavailable} onPress={() => void save()} /><Pressable accessibilityRole="button" accessibilityLabel="取消器械设置" disabled={saving} onPress={onClose} style={s.cancel}><Text style={s.small}>取消</Text></Pressable></View>
  </View>;
}
const s = StyleSheet.create({
  card: { width: '100%', maxWidth: 440, maxHeight: '100%', borderWidth: 1, borderColor: '#8995A466', borderRadius: 26, overflow: 'hidden', backgroundColor: '#1B2028DC', shadowColor: '#000', shadowOpacity: .4, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, ...(Platform.OS === 'web' ? { backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } : {}) } as ViewStyle,
  header: { padding: 14, paddingHorizontal: 18, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }, scroll: { flex: 1 }, content: { paddingHorizontal: 18, paddingBottom: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, flex: { flex: 1, minWidth: 0 }, brand: { color: p.muted, fontSize: 10, letterSpacing: 1.2, marginBottom: 4 }, title: { fontSize: 24, fontWeight: '900', color: p.text }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF30' }, closeText: { fontSize: 28, lineHeight: 32, color: p.text },
  tabs: { borderWidth: 1, borderColor: '#FFFFFF20', borderRadius: 15, flexDirection: 'row', overflow: 'hidden' }, tab: { flex: 1, paddingHorizontal: 2, paddingVertical: 12, alignItems: 'center', gap: 4 }, tabActive: { backgroundColor: '#C7F54816' }, tabUnderline: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 3, borderRadius: 2, backgroundColor: p.lime }, tabText: { color: p.text, fontSize: 13, fontWeight: '700' }, subtitle: { color: p.muted, fontSize: 9 }, frequencyRow: { paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, section: { color: p.text, fontSize: 15, fontWeight: '800' }, muted: { color: p.muted, fontSize: 11, lineHeight: 18 }, small: { color: p.faint, fontSize: 10, lineHeight: 17 }, note: { color: p.faint, fontSize: 10, lineHeight: 18, marginTop: 6 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, minHeight: 44, borderWidth: 1, borderColor: '#FFFFFF20', borderRadius: 14, marginTop: 8 }, settingTitle: { color: p.text, fontSize: 12, fontWeight: '700' }, chevron: { color: p.muted, fontSize: 21 }, panel: { paddingTop: 8 }, panelTitle: { color: p.text, fontSize: 12, fontWeight: '700', marginVertical: 8 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 6 }, chip: { padding: 9, minHeight: 44, justifyContent: 'center', backgroundColor: p.raised, borderRadius: 10, borderWidth: 1, borderColor: p.border }, chipActive: { backgroundColor: p.olive, borderColor: p.oliveBorder }, chipText: { color: p.text, fontSize: 11 },
  link: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, linkText: { color: p.lime, fontSize: 11, fontWeight: '700' }, week: { flexDirection: 'row', gap: 4 }, day: { flex: 1, minWidth: 0, minHeight: 55, paddingVertical: 9, borderWidth: 1, borderColor: '#FFFFFF20', borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 5 }, dayActive: { backgroundColor: p.lime, borderColor: p.lime }, dayRest: { backgroundColor: '#14191F70', borderColor: '#FFFFFF10' }, dayRestActive: { backgroundColor: p.raised, borderColor: p.muted }, dayWeek: { color: p.muted, fontSize: 11 }, dayTitle: { color: p.lime, fontSize: 10, fontWeight: '800' }, restCode: { color: p.faint }, restActiveText: { color: p.text }, onLime: { color: p.onLime }, summary: { color: p.muted, fontSize: 11, lineHeight: 18, marginTop: 8, paddingBottom: 10 },
  session: { borderTopWidth: 1, borderColor: '#FFFFFF18', paddingTop: 4 }, exercise: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 10, paddingVertical: 7, marginTop: 5, borderWidth: 1, borderColor: '#FFFFFF12', borderRadius: 10, backgroundColor: '#FFFFFF03' }, exerciseName: { color: p.text, flex: 1, minWidth: 0, fontSize: 11, lineHeight: 17 }, dose: { color: p.muted, fontSize: 10 }, replace: { width: 30, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, showAll: { minHeight: 24, alignItems: 'center', justifyContent: 'center' }, footer: { paddingHorizontal: 18, paddingTop: 10, backgroundColor: '#1B202850' }, cancel: { minHeight: 36, alignItems: 'center', justifyContent: 'center' }, error: { color: p.danger, fontSize: 11, lineHeight: 19, marginVertical: 8 },
});
