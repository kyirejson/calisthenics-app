import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FoodLabelDraft } from '../../nutrition/types';
import { FoodCaptureCamera } from './FoodCaptureCamera';
import { AppGlyph } from '../AppGlyph';

type Props = { mode: 'label' | 'barcode'; onClose: () => void; onDraft: (draft: FoodLabelDraft, photo?: { dataUrl: string; capturedAt: number }) => void };
// Manual food creation uses the very same capture view as meal photography.
export function FoodImportModal({ mode, onClose, onDraft }: Props) {
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.sheet} accessibilityViewIsModal>
        <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="关闭食品导入" onPress={onClose} style={s.back}><AppGlyph name="back" color="#F4F6FA" /></Pressable><Text style={s.title}>拍照记餐</Text><View style={s.back} /></View>
        <FoodCaptureCamera initialMode={mode} packagingOnly onResult={result => { if (result.kind === 'label') onDraft(result.draft, result.frame); }} />
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.76)', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: Platform.OS === 'web' ? 8 : 0 },
  sheet: { width: '100%', maxWidth: 440, height: '96%', backgroundColor: '#0D1114', borderRadius: 20, overflow: 'hidden' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }, back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, title: { color: '#F4F6FA', fontSize: 19, fontWeight: '800', flex: 1, textAlign: 'center' },
});
