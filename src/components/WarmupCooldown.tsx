import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius } from '../theme';
import type { Exercise } from '../types';
import { getWarmupActions } from '../data/trainingWarmup';
import { ExercisePhoto } from './ExerciseResource';

type Phase = { title: string; minutes: number; details: string };

function Guide({ title, subtitle, phases, action, onAction, secondary, onSecondary }: {
  title: string;
  subtitle: string;
  phases: Phase[];
  action: string;
  onAction: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return <View style={styles.container}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {phases.filter((phase) => phase.minutes > 0).map((phase) => <View key={phase.title} style={styles.card}>
        <View style={styles.accent} />
        <View style={styles.cardBody}>
          <View style={styles.cardHead}><Text style={styles.phaseTitle}>{phase.title}</Text><Text style={styles.duration}>{phase.minutes} 分钟</Text></View>
          <Text style={styles.details}>{phase.details}</Text>
        </View>
      </View>)}
    </ScrollView>
    <View style={styles.footer}>
      {secondary && onSecondary ? <TouchableOpacity style={styles.secondary} onPress={onSecondary}><Text style={styles.secondaryText}>{secondary}</Text></TouchableOpacity> : null}
      <TouchableOpacity style={styles.primary} onPress={onAction}><Text style={styles.primaryText}>{action}</Text></TouchableOpacity>
    </View>
  </View>;
}

export function WarmupGuide({ minutes, items = [], onSkip, onComplete }: { minutes: number; items?: Exercise[]; onSkip: () => void; onComplete: () => void }) {
  const actions = getWarmupActions(items);
  return <View style={styles.container}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>训练前热身</Text><Text style={styles.subtitle}>约 {Math.ceil(minutes)} 分钟 · 已计入课程估时；热身不计入正式训练量</Text>
    {actions.map((action, index) => <View key={action.id} style={styles.warmupCard}>
      {action.exercise ? <View style={styles.warmupPhoto}><ExercisePhoto exercise={action.exercise} resizeMode="contain" showShade={false} showTag={false} compact /></View> : null}
      <View style={styles.cardBody}><Text style={styles.duration}>{String(index + 1).padStart(2, '0')} · {action.dose}</Text><Text style={[styles.phaseTitle, { marginTop: 8 }]}>{action.title}</Text><Text style={[styles.details, { marginTop: 8 }]}>{action.detail}</Text></View>
    </View>)}
    <Text style={styles.details}>热身次数为轻量起点，可按当天状态减少；不要把热身做成力竭测试。</Text>
  </ScrollView><View style={styles.footer}><TouchableOpacity style={styles.secondary} onPress={onSkip}><Text style={styles.secondaryText}>返回训练</Text></TouchableOpacity><TouchableOpacity style={styles.primary} onPress={onComplete}><Text style={styles.primaryText}>已完成热身</Text></TouchableOpacity></View></View>;
}

export function CooldownGuide({ minutes, onComplete }: { minutes: number; onComplete: () => void }) {
  const duration = Math.max(1, minutes);
  const walkTime = Math.min(1, duration / 2);
  const phases: Phase[] = [
    { title: '放慢脚步与呼吸', minutes: walkTime, details: '轻松走动，让呼吸逐步平稳，不需要额外冲刺或加练。' },
    { title: '舒适活动与状态检查', minutes: duration - walkTime, details: '在舒适范围内活动肩、髋与踝。可选已经掌握的轻松保持式，不强行全桥或直腿支撑；持续疼痛时停止并寻求专业帮助。' },
  ];
  return <Guide title="训练后整理" subtitle={`约 ${duration} 分钟 · 可按实际状态调整，不强制完成`} phases={phases} action="返回训练" onAction={onComplete} />;
}

const styles = StyleSheet.create({
  warmupCard: { backgroundColor: colors.ink, borderRadius: radius.md, marginBottom: 12, overflow: 'hidden' }, warmupPhoto: { height: 150, backgroundColor: '#E9EDE1' },
  container: { flex: 1, backgroundColor: '#0F1109' },
  content: { padding: 20, paddingTop: 36, paddingBottom: 30, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '900', color: colors.paper },
  subtitle: { fontSize: 13, color: '#AAB59D', lineHeight: 20, marginTop: 8, marginBottom: 22 },
  card: { flexDirection: 'row', backgroundColor: colors.ink, borderRadius: radius.md, marginBottom: 12, overflow: 'hidden' },
  accent: { width: 4, backgroundColor: colors.lime },
  cardBody: { flex: 1, padding: 16 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
  phaseTitle: { fontSize: 16, fontWeight: '800', color: colors.paper },
  duration: { fontSize: 13, fontWeight: '800', color: colors.lime },
  details: { fontSize: 13, lineHeight: 20, color: '#C9CBC5' },
  footer: { flexDirection: 'row', padding: 18, paddingBottom: 34, gap: 10, borderTopWidth: 1, borderTopColor: '#34372F' },
  secondary: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: '#56594D', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.paper, fontSize: 13, fontWeight: '700' },
  primary: { flex: 2, height: 48, borderRadius: radius.md, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#0F1109', fontSize: 14, fontWeight: '900' },
});
