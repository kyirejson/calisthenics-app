import { StyleSheet, Text, View } from 'react-native';
import { getEquipmentMovement } from '../data/equipment';
import { appPalette as p } from '../theme';
import { DetailDisclosures, DetailSteps, detailStyles as d } from './MovementDetail';

export function EquipmentMovementGuide({ exerciseId }: { exerciseId: string }) {
  const exercise = getEquipmentMovement(exerciseId);
  if (!exercise) return null;
  return <View testID="equipment-modern-guide">
    <View style={d.section}><Text style={d.sectionTitle}>动作要点</Text><DetailSteps items={[{ title: '准备与设置', text: exercise.guide.setup }, { title: '动作过程', text: exercise.guide.execution }, { title: '呼吸与收尾', text: exercise.guide.control }]} /></View>
    <View style={d.section}><Text style={d.sectionTitle}>易错与纠正</Text><DetailDisclosures key={exercise.id} warning initialOpen="issue-0" items={exercise.guide.issues.map((issue, index) => ({ id: `issue-${index}`, title: issue.problem, content: <Text style={d.body}>{issue.fix}</Text> }))} /></View>
    <Text style={s.stop}>从能控制的负荷开始。出现疼痛、麻木或眩晕时停止并评估，等级不替代个体指导。</Text>
  </View>;
}
const s = StyleSheet.create({ stop: { color: p.muted, fontSize: 12, lineHeight: 20, marginTop: 14 } });
