import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Card, SectionTitle } from './ui';
import { colors, radius } from '../theme';
import type { Exercise } from '../types';

// These archive entries reuse another movement's photo. Identify them as
// reference images rather than presenting them as exact demonstrations.
const ILLUSTRATIVE_IMAGE_IDS = new Set([
  'aux_hang', 'aux_towelHang',
  'bridge_demon_01', 'bridge_demon_02', 'bridge_demon_04', 'bridge_demon_05',
  'hspu_demon_05', 'legRaise_demon_02', 'legRaise_demon_05',
  'pBFlip_09', 'pKip_06', 'pKip_07', 'pPush_10', 'pull_demon_02',
  'push_demon_02', 'push_demon_04', 'push_demon_06',
  'squat_demon_02', 'squat_demon_03',
]);

export function ExercisePhoto({ exercise }: { exercise: Exercise }) {
  const uri = exercise.realImage || exercise.image || '';
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [exercise.id, uri]);
  const canLoad = /^https?:\/\//i.test(uri) && !failed;

  return <View style={styles.photo}>
    <View style={styles.placeholder}>
      <View style={styles.placeholderShape} />
      <Text style={styles.placeholderMark}>↗</Text>
    </View>
    {canLoad ? <Image key={exercise.id} source={{ uri }} style={styles.image} resizeMode="cover" onError={() => setFailed(true)} /> : null}
    <View style={styles.photoShade} />
    {!canLoad ? <View style={styles.noticeBox}><Text style={styles.placeholderNotice}>图片暂不可用 · 请按文字指导练习</Text></View> : null}
    {canLoad && ILLUSTRATIVE_IMAGE_IDS.has(exercise.id) ? <View style={styles.referenceTag}><Text style={styles.referenceText}>参考图</Text></View> : null}
  </View>;
}

export function ExerciseInstructions({ exercise }: { exercise: Exercise }) {
  const points = (exercise.keyPoints || []).filter(Boolean);
  const issues = (exercise.commonIssues || []).filter((issue) => issue.problem && issue.fix);

  return <>
    {points.length > 0 ? <><SectionTitle title="动作流程" /><Card>
      {points.map((point, index) => <View key={`${exercise.id}-step-${index}`} style={[styles.point, index > 0 && styles.spaced]}>
        <View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View>
        <Text style={styles.pointText}>{point}</Text>
      </View>)}
    </Card></> : null}
    {issues.length > 0 ? <><SectionTitle title="易错与纠正" /><Card>
      {issues.map((issue, index) => <View key={`${exercise.id}-issue-${index}`} style={[styles.issue, index > 0 && styles.spaced]}>
        <Text style={styles.issueTitle}>{issue.problem}</Text>
        <Text style={styles.issueFix}>{issue.fix}</Text>
      </View>)}
    </Card></> : null}
    {exercise.source ? <View style={styles.source}><Text style={styles.sourceLabel}>来源章节</Text><Text style={styles.sourceText}>{exercise.source}</Text></View> : null}
  </>;
}

const styles = StyleSheet.create({
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', backgroundColor: '#20261E' },
  placeholder: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  placeholderShape: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: '#4A5540', transform: [{ scaleX: 1.55 }] },
  placeholderMark: { color: '#A8D258', fontSize: 74, fontWeight: '900', opacity: 0.48 },
  placeholderNotice: { color: '#C9D2C2', fontSize: 11, marginTop: 9 },
  image: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  photoShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(13,15,11,0.56)' },
  noticeBox: { position: 'absolute', top: 64, left: 20, right: 20 },
  referenceTag: { position: 'absolute', top: 14, right: 14, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(13,15,11,0.72)' },
  referenceText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  point: { flexDirection: 'row', alignItems: 'flex-start' },
  spaced: { marginTop: 14 },
  number: { width: 25, height: 25, borderRadius: 9, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  numberText: { color: colors.ink, fontWeight: '900', fontSize: 11 },
  pointText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 22 },
  issue: { borderLeftWidth: 3, borderLeftColor: colors.orange, paddingLeft: 13 },
  issueTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  issueFix: { color: colors.inkMuted, fontSize: 13, lineHeight: 20, marginTop: 5 },
  source: { marginTop: 24, paddingHorizontal: 4 },
  sourceLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  sourceText: { color: colors.ink, fontSize: 12, fontWeight: '700', marginTop: 3 },
});
