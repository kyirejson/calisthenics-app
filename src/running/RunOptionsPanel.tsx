import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRunRecorder } from './RunRecorderHost';
import { defaultRunOptions, type RunOptions } from './model';
import { appPalette as c } from '../theme';
import { prepareWebRunVoice } from './webVoice';

export function RunOptionsPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const run = useRunRecorder();
  const [draft, setDraft] = useState<RunOptions>(defaultRunOptions), [length, setLength] = useState(''), [validation, setValidation] = useState('');
  useEffect(() => { if (visible) { const options = run.snapshot.options ?? defaultRunOptions(); setDraft(options); setLength(options.stepLengthM === undefined ? '' : String(options.stepLengthM)); setValidation(''); } }, [visible]);
  const save = async () => {
    const raw = length.trim(), stepLengthM = raw ? Number(raw) : undefined;
    if (raw && (!/^\d+(?:\.\d+)?$/.test(raw) || !Number.isFinite(stepLengthM) || stepLengthM! < .3 || stepLengthM! > 2)) { setValidation('请输入 0.3–2 米/步；不校准可留空，仅计步。'); return; }
    if (await run.configure({ ...draft, voice: run.snapshot.options?.voice ?? draft.voice, voiceStyle: run.snapshot.options?.voiceStyle ?? 'female', stepLengthM })) onClose();
  };
  const disabled = run.busy || run.snapshot.phase !== 'idle';
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={() => { if (!run.busy) onClose(); }}>
    <KeyboardAvoidingView style={s.shade} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><View style={s.sheet}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <View style={s.head}><Text style={s.title}>跑步设置</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭跑步设置" disabled={run.busy} onPress={onClose} style={s.close}><Text style={s.text}>×</Text></Pressable></View>
      {([
        { key: 'autoPause', title: '自动暂停', detail: '仅户外：可靠速度连续低于阈值才暂停，重新跑动自动继续；信号变差不会误暂停。' },
        { key: 'voice', title: '语音播报', detail: '默认开启，每公里汇报距离和用时。内置离线声音，Android 锁屏也可播报。' },
        { key: 'stepTracking', title: '室内计步', detail: run.snapshot.stepAvailable ? '使用手机计步传感器。校准步长后可估算距离，不依赖 GPS。' : '当前设备无可用计步传感器；仍可计时并填写跑步机距离。' },
      ] as const).map(item => <View key={item.key} style={s.row}><View style={s.copy}><Text style={s.text}>{item.title}</Text><Text style={s.caption}>{item.detail}</Text></View><Switch accessibilityLabel={item.title} value={item.key === 'voice' ? run.snapshot.options?.voice ?? draft.voice : draft[item.key]} disabled={item.key === 'voice' ? run.busy : disabled || item.key === 'stepTracking' && !run.snapshot.stepAvailable} onValueChange={value => { if (item.key === 'voice') { if (value) prepareWebRunVoice(run.snapshot.options?.voiceStyle ?? 'female'); void run.setVoice(value); } else setDraft(previous => ({ ...previous, [item.key]: value })); }} trackColor={{ true: c.lime, false: c.border }} thumbColor={c.background} /></View>)}
      <View style={s.voiceSection}><Text style={s.text}>播报音色</Text><View accessibilityRole="radiogroup" accessibilityLabel="跑步播报音色" style={s.voiceChoices}>{(['female', 'male'] as const).map(style => {
        const selected = (run.snapshot.options?.voiceStyle ?? 'female') === style;
        return <Pressable key={style} accessibilityRole="radio" accessibilityLabel={style === 'female' ? '女声' : '男声'} aria-checked={selected} accessibilityState={{ checked: selected, disabled: run.busy || !run.ready }} disabled={run.busy || !run.ready} onPress={() => { if (run.snapshot.options?.voice !== false) prepareWebRunVoice(style); void run.setVoiceStyle(style); }} style={[s.voiceChoice, selected && s.voiceSelected]}><Text style={[s.text, selected && { color: c.lime }]}>{style === 'female' ? '女声' : '男声'}{selected ? ' ✓' : ''}</Text></Pressable>;
      })}</View><Text style={s.caption}>选择后自动保存，跑步中也可切换，不影响计时。</Text></View>
      {draft.stepTracking ? <View style={s.calibration}><Text style={s.text}>校准步长 · 米/步</Text><Text style={s.caption}>在已知距离按日常跑姿跑动，用“距离（米）÷ 实际步数”计算。不要使用身高推算；每一步按一次落脚计。手机需随身携带。</Text><TextInput accessibilityLabel="室内跑校准步长（米每步）" keyboardType="decimal-pad" placeholder="例如 0.85；留空只计步" placeholderTextColor={c.muted} value={length} editable={!disabled} onChangeText={value => { setLength(value); setValidation(''); }} style={s.input} /><Text style={s.caption}>距离和配速均标注估算；步幅变化、手机放置和传感器漏计会带来误差。跑步机上手机放在架上无法计步。</Text></View> : null}
      {validation || run.error ? <Text accessibilityRole="alert" style={s.error}>{validation || run.error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="保存跑步设置" disabled={disabled} onPress={() => { void save(); }} style={[s.save, disabled && { opacity: .5 }]}>{run.busy ? <ActivityIndicator color={c.onLime} /> : <Text style={s.saveText}>保存设置</Text>}</Pressable>
    </ScrollView></View></KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  voiceSection: { gap: 8 }, voiceChoices: { flexDirection: 'row', gap: 10 }, voiceChoice: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }, voiceSelected: { borderColor: c.lime, backgroundColor: '#252F1D' },
  shade: { flex: 1, backgroundColor: '#000A', justifyContent: 'center', padding: 20 }, sheet: { backgroundColor: c.card, borderRadius: 22, maxHeight: '90%', width: '100%', maxWidth: 440, alignSelf: 'center' }, content: { padding: 20, gap: 18 }, head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: c.text, fontSize: 23, fontWeight: '800' }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, copy: { flex: 1 }, text: { color: c.text, fontSize: 15, fontWeight: '700' }, caption: { color: c.muted, fontSize: 12, lineHeight: 20, marginTop: 6 }, calibration: { gap: 8, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16 }, input: { minHeight: 48, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12, color: c.text, fontSize: 16 }, error: { color: c.warning, fontSize: 12, lineHeight: 20 }, save: { minHeight: 54, backgroundColor: c.lime, borderRadius: 27, alignItems: 'center', justifyContent: 'center' }, saveText: { color: c.onLime, fontSize: 17, fontWeight: '800' },
});
