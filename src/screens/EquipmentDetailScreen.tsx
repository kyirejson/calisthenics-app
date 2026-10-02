import { useState } from 'react';
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getEquipmentMovement } from '../data/equipment';
import { appPalette as p, progressPageLayout } from '../theme';
import { EquipmentPhoto } from '../components/EquipmentPhoto';
import { EquipmentMovementGuide } from '../components/EquipmentMovementGuide';
import { EquipmentTierBadge, EquipmentTierHelp } from '../components/EquipmentTier';
import { equipmentEvidenceLabels, equipmentFunctionalUses, equipmentRankingDate } from '../data/equipmentRecommendations';

export function EquipmentDetailScreen({ exerciseId, onBack }: { exerciseId: string; onBack: () => void }) {
  const exercise = getEquipmentMovement(exerciseId);
  const [showSources, setShowSources] = useState(false);
  const [linkError, setLinkError] = useState(false);
  async function openSource(url: string) {
    try { setLinkError(false); await Linking.openURL(url); } catch { setLinkError(true); }
  }
  return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
    <Pressable accessibilityRole="button" accessibilityLabel="返回器械动作库" onPress={onBack} style={s.back}><Text style={s.backText}>‹  器械动作库</Text></Pressable>
    {exercise ? <>
      <Text style={s.eyebrow}>{exercise.categoryLabel} · {exercise.equipment?.join(' / ')}</Text><Text style={s.title}>{exercise.name}</Text><Text style={s.subtitle}>{exercise.nameEn}</Text>
      <View style={s.rankRow}><EquipmentTierBadge tier={exercise.recommendation.tier} verbose /><EquipmentTierHelp /></View>
      <Text style={s.body}>{exercise.recommendation.reason}</Text>
      {equipmentFunctionalUses[exercise.id] ? <Text style={s.functional}>{equipmentFunctionalUses[exercise.id]}</Text> : null}
      <EquipmentPhoto key={exercise.id + '-photo'} exerciseId={exercise.id} name={exercise.name} />
      <Text style={s.section}>目标肌群</Text><Text style={s.body}>{exercise.targetMuscles}</Text>
      <Text style={[s.section, s.spaced]}>动作指导</Text>
      <EquipmentMovementGuide exerciseId={exercise.id} />
      <Pressable accessibilityRole="button" accessibilityLabel="展开或收起器械动作依据" aria-expanded={showSources} onPress={() => setShowSources(value => !value)} style={s.sourceHeading}><Text style={s.section}>指导与评级依据</Text><Text style={s.sourceToggle}>{showSources ? '−' : '＋'}</Text></Pressable>
      {showSources ? <View style={s.note}>
        <Text style={s.body}>{exercise.guide.basis}</Text>
        <Text style={s.sourceLabel}>技术与设置参考</Text>
        {exercise.guide.sources.map(source => <Pressable key={source.url} accessibilityRole="link" accessibilityLabel={'打开' + source.title} onPress={() => void openSource(source.url)} style={s.source}><Text style={s.sourceText}>{source.title} ↗</Text></Pressable>)}
        <Text style={s.sourceLabel}>推荐依据：{equipmentEvidenceLabels[exercise.recommendation.evidence]}</Text>
        <Text style={s.body}>等级由应用编审提出；相关研究或操作资料不直接产出S–C名次。</Text>
        {exercise.recommendation.sources.map(source => <Pressable key={source.url} accessibilityRole="link" accessibilityLabel={'打开评级依据' + source.title} onPress={() => void openSource(source.url)} style={s.source}><Text style={s.sourceText}>{source.title} ↗</Text></Pressable>)}
        <Text style={s.subtitle}>内容版本 {equipmentRankingDate} · 非康复处方</Text>
        {linkError ? <Text accessibilityRole="alert" style={s.stop}>暂时无法打开链接，请检查网络后重试。</Text> : null}
      </View> : null}
    </> : <Text style={s.body}>未找到该器械动作。</Text>}
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: p.background }, content: { ...progressPageLayout.content, paddingBottom: 40 }, back: { minHeight: 48, justifyContent: 'center' }, backText: { color: p.lime, fontSize: 14, fontWeight: '700' }, eyebrow: { color: p.lime, fontSize: 12, marginTop: 10 }, title: { ...progressPageLayout.title, color: p.text, marginTop: 8 }, subtitle: { color: p.muted, fontSize: 12, marginTop: 8, lineHeight: 18 }, note: { padding: 14, backgroundColor: p.card, borderRadius: 16, marginVertical: 8 }, body: { color: p.muted, fontSize: 13, lineHeight: 21 }, section: { color: p.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  rankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }, functional: { color: p.lime, fontSize: 12, lineHeight: 19, marginTop: 8 }, spaced: { marginTop: 20 }, stop: { color: p.faint, fontSize: 11, lineHeight: 18, marginVertical: 12 }, sourceHeading: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: p.border, marginTop: 8 }, sourceToggle: { color: p.lime, fontSize: 20 }, sourceLabel: { color: p.text, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 4 }, source: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 }, sourceText: { color: p.lime, fontSize: 12, lineHeight: 18 },
});
