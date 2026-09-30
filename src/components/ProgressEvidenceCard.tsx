import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReviewedTrainingStreak } from '../data/trainingHistory';
import { progressNumber } from '../data/progressChart';

export function ProgressEvidenceCard({ best, unit, streak }: { best: number | null; unit: string; streak: ReviewedTrainingStreak }) {
  const [explain, setExplain] = useState(false);
  return <View style={styles.card}>
    <View style={styles.row}>
      <View style={styles.column}><Text style={styles.label}>历史单组最佳</Text><Text style={styles.value} testID="history-personal-best">{best === null ? '—' : progressNumber(best)}<Text style={styles.unit}>{best === null ? '' : ' ' + unit}</Text></Text><Text style={styles.caption}>{best === null ? '尚无有效记录' : '该动作 · 全部历史'}</Text></View>
      <View style={styles.divider} />
      <Pressable accessibilityRole="button" accessibilityLabel="查看训练反馈统计口径" accessibilityState={{ expanded: explain }} onPress={() => setExplain(value => !value)} style={styles.column}>
        <Text style={styles.label}>无不适反馈 ⓘ</Text><Text style={[styles.value, styles.green]} testID="reviewed-training-streak">{streak.days === null ? '—' : streak.days}<Text style={styles.unit}>{streak.days === null ? '' : ' 天'}</Text></Text>
        <Text style={styles.caption}>{streak.status === 'empty' ? '尚无训练反馈' : streak.status === 'unreviewed' ? '最近训练未反馈' : streak.status === 'pain' ? '最近训练有不适' : '连续已评训练日'}</Text>
      </Pressable>
    </View>
    {explain ? <Text style={styles.explain}>仅统计明确填写“动作稳定”或“有些勉强”的力量训练日。未反馈或出现不适则中断；休息日不计数。不是自然日连续无痛，也不是医学评估。</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#191D22', borderWidth: 1, borderColor: '#2A3036', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 13, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center' }, column: { flex: 1, minHeight: 68, justifyContent: 'center', alignItems: 'center' },
  label: { color: '#A3ABB5', fontSize: 11, marginBottom: 5 }, value: { color: '#F8FAFC', fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 12, fontWeight: '600', color: '#9AA4AB' }, green: { color: '#C8F04D' }, caption: { color: '#87929C', fontSize: 10, marginTop: 5 },
  divider: { width: 1, height: 48, backgroundColor: '#30363B' }, explain: { color: '#A3ABB5', fontSize: 11, lineHeight: 18, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2A3036' },
});
