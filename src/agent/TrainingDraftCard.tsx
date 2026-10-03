import { Pressable, Text, View } from 'react-native';
import type { TrainingDraft } from './trainingActions';
import { appPalette as c } from '../theme';
export function TrainingDraftCard({ draft, busy, onConfirm }: { draft: TrainingDraft; busy: boolean; onConfirm: () => void }) {
  return <View testID="assistant-training-draft" style={{ gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: c.border }}><Text style={{ color: c.text, fontWeight: '800' }}>训练调整草案</Text><Text style={{ color: c.text, lineHeight: 22 }}>{draft.summary}</Text>{draft.notices.map(note => <Text key={note} style={{ color: c.muted, fontSize: 12 }}>{note}</Text>)}<Pressable accessibilityRole="button" accessibilityLabel="确认训练调整" disabled={busy} onPress={onConfirm} style={{ padding: 12, borderRadius: 12, backgroundColor: c.lime, alignItems: 'center' }}><Text style={{ color: c.onLime, fontWeight: '800' }}>确认调整</Text></Pressable></View>;
}
