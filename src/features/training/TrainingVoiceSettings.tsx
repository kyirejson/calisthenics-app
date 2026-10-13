import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppGlyph } from '../../components/AppGlyph';
import { appPalette as c } from '../../theme';
import { useState } from 'react';

export function TrainingVoiceSettings({ visible, interval, onChange, onClose }: {
  visible: boolean; interval: number; onChange: (value: number) => Promise<void>; onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const change = async (value: number) => { if (saving) return; setSaving(true); try { await onChange(value); } finally { setSaving(false); } };
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <View style={s.shade}>
      <Pressable accessibilityRole="button" accessibilityLabel="关闭训练设置背景" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View testID="training-voice-settings" accessibilityViewIsModal style={s.sheet}>
        <View style={s.handle} /><View style={s.heading}><Text style={s.title}>设置</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭训练设置" onPress={onClose} style={s.hit}><Text style={s.close}>×</Text></Pressable></View>
        <View style={s.label}><AppGlyph name="speaker" color={c.lime} /><Text style={s.name}>喇叭设置</Text></View>
        <View style={s.row}><Text style={s.body}>报数间隔</Text><View style={s.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel="减小报数间隔" disabled={saving || interval <= 1} onPress={() => void change(interval - 1)} style={[s.hit, (saving || interval <= 1) && s.disabled]}><Text style={s.sign}>−</Text></Pressable>
          <Text testID="training-voice-interval" style={s.value}>{interval}<Text style={s.body}> 秒 / 次</Text></Text>
          <Pressable accessibilityRole="button" accessibilityLabel="增大报数间隔" disabled={saving || interval >= 30} onPress={() => void change(interval + 1)} style={[s.hit, (saving || interval >= 30) && s.disabled]}><Text style={s.sign}>＋</Text></Pressable>
        </View></View><Text style={s.note}>{saving ? '保存中…' : '更改后自动保存'}</Text>
      </View>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  shade: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,.65)' },
  sheet: { width: '100%', maxWidth: 440, padding: 20, paddingBottom: 28, backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.border },
  handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: c.faint, alignSelf: 'center', marginBottom: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, color: c.text, fontWeight: '800' },
  close: { color: c.muted, fontSize: 26 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  name: { fontSize: 16, color: c.text, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  body: { color: c.muted, fontSize: 12, fontWeight: '400' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  value: { color: c.text, fontSize: 23, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 84, textAlign: 'center' },
  sign: { color: c.text, fontSize: 24 },
  note: { color: c.muted, fontSize: 11, lineHeight: 18, marginTop: 8 },
  disabled: { opacity: .35 },
});
