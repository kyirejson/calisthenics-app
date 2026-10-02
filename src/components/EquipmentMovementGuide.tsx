import { StyleSheet, Text, View } from 'react-native';
import { getEquipmentMovement } from '../data/equipment';
import { appPalette as p } from '../theme';

export function EquipmentMovementGuide({ exerciseId }: { exerciseId: string }) {
  const exercise = getEquipmentMovement(exerciseId);
  if (!exercise) return null;
  return <View testID="equipment-modern-guide">
    <View style={s.guide}>{[{ title: '准备与设置', text: exercise.guide.setup }, { title: '动作过程', text: exercise.guide.execution }, { title: '呼吸与收尾', text: exercise.guide.control }].map((item, index) => <View key={item.title} style={s.step}><Text style={s.number}>{String(index + 1).padStart(2, '0')}</Text><View style={s.copy}><Text style={s.title}>{item.title}</Text><Text style={s.body}>{item.text}</Text></View></View>)}</View>
    <Text style={s.heading}>易错与纠正</Text>{exercise.guide.issues.map(issue => <View key={issue.problem} style={s.issue}><Text style={s.title}>{issue.problem}</Text><Text style={s.body}>{issue.fix}</Text></View>)}
    <Text style={s.stop}>从能控制的负荷开始。出现疼痛、麻木或眩晕时停止并评估，等级不替代个体指导。</Text>
  </View>;
}
const s = StyleSheet.create({ guide: { backgroundColor: p.card, borderWidth: 1, borderColor: p.border, borderRadius: 18, paddingHorizontal: 14 }, step: { flexDirection: 'row', gap: 12, paddingVertical: 14 }, number: { color: p.lime, fontWeight: '900', fontSize: 15 }, copy: { flex: 1, minWidth: 0 }, title: { color: p.text, fontSize: 12, fontWeight: '700', marginBottom: 6 }, body: { color: p.muted, fontSize: 13, lineHeight: 21 }, heading: { color: p.text, fontSize: 16, fontWeight: '800', marginTop: 20, marginBottom: 8 }, issue: { backgroundColor: p.card, borderRadius: 14, padding: 12, marginBottom: 8 }, stop: { color: p.faint, fontSize: 11, lineHeight: 18, marginVertical: 12 } });
