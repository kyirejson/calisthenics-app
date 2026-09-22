import React from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, SectionTitle } from '../components/ui';
import { exercises, workouts } from '../data/catalog';
import { colors, radius } from '../theme';

export function ExerciseDetailScreen({ exerciseId, onBack, onStart }: { exerciseId: string; onBack: () => void; onStart: (workoutId: string) => void }) {
  const exercise = exercises.find((item) => item.id === exerciseId);
  if (!exercise) return null;
  const matchingWorkout = Object.values(workouts).find((workout) => workout.slots.some((slot) => slot.category === exercise.category)) || workouts.fullA;
  return <SafeAreaView style={styles.safe}><ScrollView showsVerticalScrollIndicator={false}>
    <View style={styles.hero}><Image source={{ uri: exercise.realImage || exercise.image }} style={styles.image} /><View style={styles.shade} /><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.heroText}><Text style={styles.kicker}>{exercise.categoryLabel || exercise.category} · {exercise.step ? `第 ${exercise.step} 式` : '专项动作'}</Text><Text style={styles.title}>{exercise.name}</Text><Text style={styles.en}>{exercise.nameEn || exercise.source}</Text></View></View>
    <View style={styles.content}>
      <Card><Text style={styles.purpose}>{exercise.purpose || '建立稳定、可控的自重力量。'}</Text><View style={styles.prescription}><Metric label="建议组数" value={`${exercise.defaultPrescription?.sets || 3} 组`} /><Metric label="组间休息" value={`${exercise.defaultPrescription?.restSeconds || 60} 秒`} /><Metric label="强度" value={`RIR ${exercise.defaultPrescription?.rirTarget || 2}`} /></View></Card>
      <SectionTitle title="动作要点" />
      <Card>{(exercise.keyPoints || []).map((point, index) => <View key={index} style={styles.point}><View style={styles.pointNum}><Text style={styles.pointNumText}>{index + 1}</Text></View><Text style={styles.pointText}>{point}</Text></View>)}</Card>
      {exercise.commonIssues?.length ? <><SectionTitle title="常见问题" /><Card>{exercise.commonIssues.map((issue, index) => <View key={index} style={[styles.issue, index > 0 && { marginTop: 16 }]}><Text style={styles.issueTitle}>{issue.problem}</Text><Text style={styles.issueFix}>{issue.fix}</Text></View>)}</Card></> : null}
      {exercise.standards ? <><SectionTitle title="进阶标准" /><Card>{Object.entries(exercise.standards).map(([key, value]) => <View key={key} style={styles.standard}><Text style={styles.standardKey}>{({ beginner: '初级', intermediate: '中级', upgrade: '升级' } as Record<string,string>)[key] || key}</Text><Text style={styles.standardValue}>{value}</Text></View>)}</Card></> : null}
      <View style={{ height: 22 }} /><Button label="加入一次训练" variant="lime" onPress={() => onStart(matchingWorkout.id)} /><View style={{ height: 34 }} />
    </View>
  </ScrollView></SafeAreaView>;
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, hero: { height: 330, backgroundColor: colors.ink }, image: { position: 'absolute', inset: 0, width: '100%', height: '100%' }, shade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(13,15,11,0.58)' }, back: { position: 'absolute', top: 14, left: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' }, backText: { color: '#FFFFFF', fontSize: 34, lineHeight: 36 }, heroText: { position: 'absolute', left: 22, right: 22, bottom: 26 }, kicker: { color: colors.lime, fontSize: 11, fontWeight: '900', letterSpacing: 1 }, title: { color: '#FFFFFF', fontSize: 35, fontWeight: '900', letterSpacing: -1, marginTop: 8 }, en: { color: '#D2D4CE', marginTop: 5, fontSize: 13 }, content: { padding: 20 }, purpose: { color: colors.ink, fontSize: 16, lineHeight: 25, fontWeight: '600' }, prescription: { flexDirection: 'row', marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.line }, metric: { flex: 1 }, metricValue: { color: colors.ink, fontSize: 15, fontWeight: '900' }, metricLabel: { color: colors.inkMuted, fontSize: 10, marginTop: 4 }, point: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }, pointNum: { width: 25, height: 25, borderRadius: 9, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, pointNumText: { color: colors.ink, fontWeight: '900', fontSize: 11 }, pointText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 22 }, issue: { borderLeftWidth: 3, borderLeftColor: colors.orange, paddingLeft: 13 }, issueTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 }, issueFix: { color: colors.inkMuted, fontSize: 13, lineHeight: 20, marginTop: 5 }, standard: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }, standardKey: { color: colors.inkMuted, fontSize: 13 }, standardValue: { color: colors.ink, fontSize: 13, fontWeight: '800' },
});
