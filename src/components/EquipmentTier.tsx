import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appPalette as p } from '../theme';
import { equipmentRankingExplanation, recommendationTierLabels, recommendationTiers, type RecommendationTier } from '../data/equipmentRecommendations';
import { useReducedMotion } from './useProgressMotion';

export function EquipmentTierBadge({ tier, verbose = false, showPurpose = false }: { tier: RecommendationTier; verbose?: boolean; showPurpose?: boolean }) {
  return <View style={[s.badge, tier === 'S' && s.preferred]} accessibilityLabel={tier + '级增肌推荐：' + recommendationTierLabels[tier]}><Text style={[s.badgeText, tier === 'S' && s.preferredText]}>{showPurpose ? '增肌 ' : ''}{tier}{verbose ? ' · ' + recommendationTierLabels[tier] : ''}</Text></View>;
}
export function EquipmentTierHelp() {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="查看推荐等级说明" aria-expanded={open} onPress={() => setOpen(true)} style={s.help}><Text style={s.helpText}>等级说明 ⓘ</Text></Pressable>
    <Modal visible={open} transparent animationType={reduced === false ? 'fade' : 'none'} onRequestClose={() => setOpen(false)}>
      <View style={s.scrim}><Pressable accessibilityRole="button" accessibilityLabel="关闭推荐等级说明" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={s.sheet}><ScrollView contentContainerStyle={s.content}>
          <View style={s.heading}><Text style={s.title}>等级怎么用</Text><Pressable accessibilityRole="button" accessibilityLabel="完成推荐等级说明" onPress={() => setOpen(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
          <Text style={s.body}>{equipmentRankingExplanation}</Text>
          {recommendationTiers.map(tier => <View key={tier} style={s.row}><EquipmentTierBadge tier={tier} /><View style={s.copy}><Text style={s.label}>{recommendationTierLabels[tier]}</Text><Text style={s.body}>{{ S: '目标清楚、负荷便于追踪；合适设置下可优先考虑。', A: '很好的主练、替代或互补；结合技术与设备选择。', B: '用于特定偏好或功能目标，不等于增肌无效。', C: '默认不优先，但仍可按偏好和控制能力选择。' }[tier]}</Text></View></View>)}
          <Text style={s.body}>来源中的“对应研究、相关外推、实践判断”与等级独立。即使有训练研究，也不代表研究验证了字母名次。功能控制与力量专项另看用途；不要按字母自动排课。</Text>
        </ScrollView></SafeAreaView>
      </View>
    </Modal>
  </>;
}
const s = StyleSheet.create({
  badge: { alignSelf: 'flex-start', flexShrink: 0, borderRadius: 8, backgroundColor: p.raised, borderWidth: 1, borderColor: p.border, paddingHorizontal: 8, paddingVertical: 3 }, badgeText: { color: p.text, fontSize: 11, fontWeight: '900' }, preferred: { backgroundColor: p.lime, borderColor: p.lime }, preferredText: { color: p.onLime },
  help: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }, helpText: { color: p.muted, fontSize: 11 },
  scrim: { flex: 1, backgroundColor: '#000000A0', justifyContent: 'flex-end' }, sheet: { width: '100%', maxWidth: 440, alignSelf: 'center', maxHeight: '85%', backgroundColor: p.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: p.border }, content: { padding: 18, paddingBottom: 32 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, title: { color: p.text, fontSize: 20, fontWeight: '900' }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { color: p.muted, fontSize: 25 },
  body: { color: p.muted, fontSize: 12, lineHeight: 20, marginTop: 5 }, row: { flexDirection: 'row', gap: 12, marginVertical: 10 }, copy: { flex: 1, minWidth: 0 }, label: { color: p.text, fontSize: 14, fontWeight: '800' },
});
