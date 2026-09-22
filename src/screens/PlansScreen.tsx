import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/ui';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';

const plans = [
  { frequency: 2, name: '稳妥起步', desc: 'A/B 全身轮替，恢复充分', days: '周一 · 周四' },
  { frequency: 3, name: '黄金频率', desc: '力量与恢复的推荐平衡', days: '周一 · 周三 · 周五' },
  { frequency: 4, name: '上下肢分化', desc: '上肢/下肢各训练两次', days: '周一 · 周二 · 周四 · 周五' },
  { frequency: 5, name: 'PPL 进阶', desc: '推拉腿配合上下肢训练', days: '工作日训练' },
  { frequency: 6, name: '高频 PPL', desc: '推拉腿双循环，适合老手', days: '周一至周六' },
];

export function PlansScreen({ onBack }: { onBack: () => void }) {
  const { profile, saveProfile } = useAppStore();
  const [selected, setSelected] = React.useState(profile?.frequency || 3);
  if (!profile) return null;
  const save = async () => { await saveProfile({ ...profile, frequency: selected }); onBack(); };
  return <SafeAreaView style={styles.safe}><View style={styles.top}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.title}>训练计划</Text><View style={{ width: 42 }} /></View><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><Text style={styles.hero}>选择能长期{`\n`}坚持的节奏</Text><Text style={styles.sub}>训练频率越高不一定越好。恢复、睡眠和稳定执行同样重要。</Text>{plans.map((plan) => { const active = selected === plan.frequency; return <Pressable key={plan.frequency} onPress={() => setSelected(plan.frequency)} style={[styles.plan, active && styles.planActive]}><View style={[styles.days, active && styles.daysActive]}><Text style={[styles.daysNum, active && styles.daysNumActive]}>{plan.frequency}</Text><Text style={[styles.daysText, active && styles.daysNumActive]}>天/周</Text></View><View style={{ flex: 1 }}><Text style={styles.planName}>{plan.name}</Text><Text style={styles.planDesc}>{plan.desc}</Text><Text style={styles.planDays}>{plan.days}</Text></View><View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View></Pressable>; })}<View style={{ height: 22 }} /><Button label="应用此计划" variant="lime" onPress={() => void save()} /></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, top: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }, back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, backText: { color: colors.ink, fontSize: 34, lineHeight: 37 }, title: { color: colors.ink, fontWeight: '900', fontSize: 17 }, content: { padding: 20, paddingBottom: 50 }, hero: { color: colors.ink, fontSize: 34, lineHeight: 41, fontWeight: '900', letterSpacing: -1.1 }, sub: { color: colors.inkMuted, fontSize: 14, lineHeight: 22, marginTop: 10, marginBottom: 24 }, plan: { minHeight: 105, padding: 15, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }, planActive: { borderColor: colors.ink, borderWidth: 2 }, days: { width: 62, height: 70, borderRadius: 16, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginRight: 14 }, daysActive: { backgroundColor: colors.ink }, daysNum: { color: colors.ink, fontSize: 25, fontWeight: '900' }, daysText: { color: colors.inkMuted, fontSize: 9, fontWeight: '700' }, daysNumActive: { color: colors.lime }, planName: { color: colors.ink, fontSize: 16, fontWeight: '900' }, planDesc: { color: colors.inkMuted, fontSize: 12, marginTop: 4 }, planDays: { color: colors.blue, fontSize: 10, fontWeight: '800', marginTop: 7 }, radio: { width: 23, height: 23, borderRadius: 12, borderWidth: 2, borderColor: '#C8C9C4', alignItems: 'center', justifyContent: 'center' }, radioActive: { borderColor: colors.ink }, radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.limeDark },
});
