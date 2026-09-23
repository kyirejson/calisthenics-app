import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, ProgressBar } from '../components/ui';
import { getPlanDay, getTrainingPlan, getWeekSchedule, recommendPlanId, trainingPlans } from '../data/trainingPlans';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function PlansScreen() {
  const { profile, saveProfile } = useAppStore();
  const [selected, setSelected] = useState(profile?.planId || 'balanced_3');
  if (!profile) return null;
  const today = getPlanDay(profile);
  const currentPlan = today.plan;
  const selectedPlan = getTrainingPlan(selected);
  const inContinuation = profile.planId === 'rebirth_7' && today.phase === 'continuation';
  const recommendedId = inContinuation ? 'balanced_3' : recommendPlanId(profile);
  const cycle = today.cycle;
  const changed = selected !== profile.planId;
  const previewProfile = useMemo(() => ({ ...profile, planId: selected, planStartedAt: changed ? new Date().toISOString() : profile.planStartedAt }), [profile, selected, changed]);
  const week = getWeekSchedule(previewProfile);
  const save = async () => {
    await saveProfile({
      ...profile,
      planId: selected,
      frequency: selectedPlan.frequency,
      planStartedAt: changed ? new Date().toISOString() : profile.planStartedAt,
    });
  };

  return <SafeAreaView style={styles.safe}>
    <View style={styles.top}><View style={styles.brandMark}><Text style={styles.brandMarkText}>涅</Text></View><Text style={styles.title}>训练计划</Text><View style={{ width: 42 }} /></View>
    <ScrollView contentContainerStyle={[styles.content, styles.tabContent]} showsVerticalScrollIndicator={false}>
      <Text style={styles.hero}>训练、恢复、{`\n`}再变得更强。</Text>
      <Text style={styles.sub}>计划基于小程序原有 A/B、上下肢和 PPL 体系，并加入 3 周递增、1 周减载。换计划后从新的适应周开始。</Text>

      {inContinuation ? <View style={styles.continuationCard}><Text style={styles.continuationTitle}>7 天起步已完成 · 自动续接基础三练</Text><Text style={styles.continuationText}>验收课后的第 8 天先恢复；此后隔天安排全身 A、B 与巩固课。当前课程会继续自动更新，也可以在下方选新计划。</Text></View> : null}

      <View style={styles.cycleCard}>
        <View style={styles.between}><View><Text style={styles.cycleKicker}>当前 · {currentPlan.shortName}</Text><Text style={styles.cycleTitle}>第 {cycle.week} 周 · {cycle.label}</Text></View><View style={[styles.phaseBadge, cycle.isDeload && { backgroundColor: '#DCE8FF' }]}><Text style={styles.phaseText}>RIR {cycle.rirTarget}</Text></View></View>
        <Text style={styles.cycleNote}>{cycle.note}</Text>
        <ProgressBar value={cycle.cycleWeek * 25} color={cycle.isDeload ? colors.blue : colors.lime} />
        <View style={styles.phaseLabels}>{['适应', '积累', '强化', '减载'].map((item, index) => <Text key={item} style={[styles.phaseLabel, index + 1 === cycle.cycleWeek && styles.phaseLabelActive]}>{item}</Text>)}</View>
      </View>

      <Text style={styles.sectionTitle}>选择方案</Text>
      {trainingPlans.map((plan) => {
        const active = selected === plan.id;
        const recommended = recommendedId === plan.id;
        return <Pressable key={plan.id} onPress={() => setSelected(plan.id)} style={[styles.plan, active && styles.planActive]}>
          <View style={styles.planTop}><View style={[styles.days, active && styles.daysActive]}><Text style={[styles.daysNum, active && styles.daysNumActive]}>{plan.frequency}</Text><Text style={[styles.daysText, active && styles.daysNumActive]}>练/周</Text></View><View style={{ flex: 1 }}><View style={styles.nameRow}><Text style={styles.planName}>{plan.name}</Text>{recommended ? <Text style={styles.recommended}>为你推荐</Text> : <Text style={styles.planBadge}>{plan.badge} · {plan.durationWeeks}周</Text>}</View><Text style={styles.planDesc}>{plan.description}</Text></View><View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View></View>
          <Text style={styles.suitable}>适合：{plan.suitableFor}</Text>
        </Pressable>;
      })}

      <Text style={styles.sectionTitle}>{selected === 'rebirth_7' ? '未来 7 天' : '本周预览'}</Text>
      <View style={styles.weekCard}>{week.map((day, index) => {
        const today = sameDate(day.date, new Date());
        return <View key={day.date.toISOString()} style={[styles.dayRow, index < 6 && styles.dayBorder]}><View style={[styles.dayDot, today && styles.dayDotToday]}><Text style={[styles.dayIndex, today && styles.dayIndexToday]}>{day.date.getDate()}</Text></View><View style={{ flex: 1 }}><Text style={styles.dayName}>{weekdays[day.date.getDay()]}{today ? ' · 今天' : ''}</Text><Text style={styles.dayTitle}>{day.title}</Text></View><Text style={[styles.dayType, day.type === 'recovery' && styles.dayRest]}>{day.type === 'strength' ? '力量' : day.type === 'cardio' ? '有氧' : '恢复'}</Text></View>;
      })}</View>
      <Button label={changed ? `启用「${selectedPlan.shortName}」` : inContinuation ? '自动衔接中' : '当前计划已启用'} variant="lime" disabled={!changed} onPress={() => void save()} />
    </ScrollView>
  </SafeAreaView>;
}

function sameDate(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  top: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  title: { color: colors.ink, fontWeight: '900', fontSize: 17 },
  brandMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  content: { padding: 20, paddingBottom: 50 }, tabContent: { paddingBottom: 125 }, hero: { color: colors.ink, fontSize: 34, lineHeight: 41, fontWeight: '900', letterSpacing: -1.1 },
  sub: { color: colors.inkMuted, fontSize: 14, lineHeight: 22, marginTop: 10, marginBottom: 22 },
  continuationCard: { backgroundColor: '#EDF5D4', borderRadius: radius.md, padding: 16, marginBottom: 18 }, continuationTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' }, continuationText: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 7 },
  cycleCard: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: 19 }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cycleKicker: { color: colors.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, cycleTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', marginTop: 7 },
  phaseBadge: { backgroundColor: '#3B431F', paddingVertical: 8, paddingHorizontal: 11, borderRadius: radius.pill }, phaseText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  cycleNote: { color: '#BFC2B8', fontSize: 12, lineHeight: 19, marginVertical: 16 }, phaseLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }, phaseLabel: { color: '#73766E', fontSize: 9 }, phaseLabelActive: { color: colors.lime, fontWeight: '900' },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', marginTop: 27, marginBottom: 12 },
  plan: { padding: 15, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, marginBottom: 11 }, planActive: { borderColor: colors.ink, borderWidth: 2 }, planTop: { flexDirection: 'row', alignItems: 'center' },
  days: { width: 58, height: 64, borderRadius: 16, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginRight: 13 }, daysActive: { backgroundColor: colors.ink }, daysNum: { color: colors.ink, fontSize: 23, fontWeight: '900' }, daysText: { color: colors.inkMuted, fontSize: 9, fontWeight: '700' }, daysNumActive: { color: colors.lime },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 }, planName: { color: colors.ink, fontSize: 15, fontWeight: '900' }, recommended: { color: '#506316', backgroundColor: '#EDF5D4', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800' }, planBadge: { color: colors.inkMuted, backgroundColor: colors.paper, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '800' }, planDesc: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 5 }, suitable: { color: colors.blue, fontSize: 10, lineHeight: 16, marginTop: 11 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#C8C9C4', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }, radioActive: { borderColor: colors.ink }, radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.limeDark },
  weekCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 15, marginBottom: 20 }, dayRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center' }, dayBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, dayDot: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, dayDotToday: { backgroundColor: colors.lime }, dayIndex: { color: colors.inkMuted, fontWeight: '800' }, dayIndexToday: { color: colors.ink }, dayName: { color: colors.inkMuted, fontSize: 10, fontWeight: '700' }, dayTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 3 }, dayType: { color: colors.green, fontSize: 10, fontWeight: '800' }, dayRest: { color: colors.inkMuted },
});
