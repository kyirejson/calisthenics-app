import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { getEquipmentMovement } from '../data/equipment';
import { appPalette as p } from '../theme';
import { EquipmentPhoto } from '../components/EquipmentPhoto';
import { EquipmentMovementGuide } from '../components/EquipmentMovementGuide';
import { EquipmentTierBadge, EquipmentTierHelp } from '../components/EquipmentTier';
import { DetailAction, DetailTabs, MovementDetail, detailStyles as d } from '../components/MovementDetail';
import { equipmentEvidenceLabels, equipmentFunctionalUses, equipmentRankingDate } from '../data/equipmentRecommendations';

export function EquipmentDetailScreen({ exerciseId, onBack }: { exerciseId: string; onBack: () => void }) {
  const exercise = getEquipmentMovement(exerciseId);
  const [tab, setTab] = useState('summary');
  const [linkError, setLinkError] = useState(false);
  useEffect(() => { setTab('summary'); setLinkError(false); }, [exerciseId]);
  async function openSource(url: string) {
    try { setLinkError(false); await Linking.openURL(url); } catch { setLinkError(true); }
  }
  return <MovementDetail title={exercise?.name || '动作未找到'} kicker={exercise ? `${exercise.categoryLabel} · ${exercise.equipment?.join(' / ') || '器械动作'}` : '器械动作库'} subtitle={exercise?.nameEn} backLabel="返回器械动作库" onBack={onBack} readingKey={exerciseId + tab} footer={<>
    {exercise ? <DetailAction label={tab === 'summary' ? '查看依据' : '返回指导'} accessibilityLabel="展开或收起器械动作依据" onPress={() => setTab(current => current === 'summary' ? 'sources' : 'summary')} /> : null}
    <DetailAction label="返回动作库" primary onPress={onBack} />
  </>}>
    {exercise ? <>
      {tab === 'summary' ? <>
        <EquipmentPhoto key={exercise.id + '-photo'} exerciseId={exercise.id} name={exercise.name} maxHeight={206} />
        <View style={s.rankRow}><EquipmentTierBadge tier={exercise.recommendation.tier} verbose /><EquipmentTierHelp /></View>
      </> : null}
      <DetailTabs selected={tab} onChange={setTab} tabs={[{ id: 'summary', label: '动作指导' }, { id: 'sources', label: '指导依据' }]} />
      {tab === 'summary' ? <>
        <View style={d.intro}><Text style={d.introTitle}>目标肌群</Text><Text style={d.body}>{exercise.targetMuscles}</Text><Text style={d.muted}>{exercise.recommendation.reason}</Text>{equipmentFunctionalUses[exercise.id] ? <Text style={s.functional}>{equipmentFunctionalUses[exercise.id]}</Text> : null}</View>
        <EquipmentMovementGuide key={exercise.id} exerciseId={exercise.id} />
      </> : <View>
        <View style={d.intro}><Text style={d.introTitle}>指导与评级依据</Text><Text style={d.body}>{exercise.guide.basis}</Text></View>
        <View style={d.section}><Text style={d.sectionTitle}>技术与设置参考</Text>{exercise.guide.sources.map(source => <Pressable key={source.url} accessibilityRole="link" accessibilityLabel={'打开' + source.title} onPress={() => void openSource(source.url)} style={s.source}><Text style={s.sourceText}>{source.title} ↗</Text></Pressable>)}</View>
        <View style={d.section}><Text style={d.sectionTitle}>推荐依据</Text><Text style={d.body}>{equipmentEvidenceLabels[exercise.recommendation.evidence]}</Text><Text style={[d.muted, s.spaced]}>等级由应用编审提出；相关研究或操作资料不直接产出S–C名次。</Text>{exercise.recommendation.sources.map(source => <Pressable key={source.url} accessibilityRole="link" accessibilityLabel={'打开评级依据' + source.title} onPress={() => void openSource(source.url)} style={s.source}><Text style={s.sourceText}>{source.title} ↗</Text></Pressable>)}</View>
        <Text style={[d.source, s.spaced]}>内容版本 {equipmentRankingDate} · 非康复处方</Text>
        {linkError ? <Text accessibilityRole="alert" style={s.error}>暂时无法打开链接，请检查网络后重试。</Text> : null}
      </View>}
    </> : <Text style={d.body}>未找到该器械动作。</Text>}
  </MovementDetail>;
}
const s = StyleSheet.create({
  rankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  functional: { color: p.lime, fontSize: 12, lineHeight: 20 }, spaced: { marginTop: 12 },
  error: { color: p.warning, fontSize: 12, lineHeight: 20, marginTop: 12 }, source: { minHeight: 44, justifyContent: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.border }, sourceText: { color: p.lime, fontSize: 13, lineHeight: 22 },
});
