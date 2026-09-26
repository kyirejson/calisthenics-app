import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExerciseDetailedGuide, ExerciseInstructions, ExercisePhoto } from '../components/ExerciseResource';
import { Button, Card, SectionTitle } from '../components/ui';
import { categoryMatches, exercises } from '../data/catalog';
import { progressionSeries } from '../data/progression';
import { isSkillCategory, preferredSessionMinutes } from '../data/trainingPrescription';
import { useAppStore } from '../store/AppStore';
import { confirmAction, showMessage } from '../utils/confirm';
import { colors, radius } from '../theme';

export function ExerciseDetailScreen({ exerciseId, onBack, onStart }: { exerciseId: string; onBack: () => void; onStart: (exerciseId: string) => void }) {
  const { profile, saveProfile } = useAppStore();
  const exercise = exercises.find((item) => item.id === exerciseId);
  if (!exercise) return null;
  const highRisk = exercise.riskLevel === 'high';
  const neckPreparation = exercise.category === 'neck' || exercise.id === 'neck_handResistance';
  const singleLegCalf = exercise.id === 'aux_singleLegCalf';
  const skill = isSkillCategory(exercise.category);
  const skillEligible = !!profile && profile.experience !== 'beginner' && preferredSessionMinutes(profile) >= 45;

  const series = progressionSeries.find((s) => categoryMatches(exercise, s.key));
  const seriesKey = series?.key || exercise.category;

  const currentLevel = profile?.levels?.[seriesKey] ?? 1;
  const currentPlanLevel = profile?.planLevels?.[seriesKey] ?? currentLevel;
  const isCurrent = exercise.step ? (currentLevel === exercise.step && currentPlanLevel === exercise.step) : false;

  const chooseForPlan = () => {
    if (!profile || !exercise.step) return;
    const save = () => {
      const updatedLevels = { ...profile.levels, [seriesKey]: exercise.step! };
      const updatedPlanLevels = { ...(profile.planLevels || {}), [seriesKey]: exercise.step! };
      void saveProfile({
        ...profile,
        levels: updatedLevels,
        planLevels: updatedPlanLevels,
      }).then(() => {
        showMessage(
          '已设为当前训练阶',
          skill && !skillEligible
            ? `已将「${exercise.name}」设为当前第 ${exercise.step} 式。街头技巧会在基础达到中级且单次训练不少于 45 分钟后自动排入相关课程。`
            : `已将「${exercise.name}」设为当前第 ${exercise.step} 式。进阶状态与相关训练课已同步更新。`
        );
      }).catch(() => showMessage('保存失败', '请稍后重试。'));
    };
    if (highRisk) confirmAction('高风险动作', '请确认已有必要的教练指导、保护和防护垫。仅选择动作不代表已具备完成能力。', save);
    else save();
  };
  return <SafeAreaView style={styles.safe}><ScrollView showsVerticalScrollIndicator={false}>
    <View style={styles.hero}><ExercisePhoto exercise={exercise} /><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.heroText}><Text style={styles.kicker}>{exercise.categoryLabel || exercise.category} · {exercise.step ? `第 ${exercise.step} 式` : '专项动作'}</Text><Text style={styles.title}>{exercise.name}</Text>{exercise.nameEn ? <Text style={styles.en}>{exercise.nameEn}</Text> : null}</View></View>
    <View style={styles.content}>
      <Card><Text style={styles.purpose}>{exercise.purpose || '建立稳定、可控的自重力量。'}</Text><View style={styles.prescription}><Metric label="计划组数" value={singleLegCalf ? '2 组起步' : neckPreparation ? '1 组起步' : skill ? '2–3 组' : '2–4 组'} /><Metric label="组间休息" value={singleLegCalf ? '60 秒起' : `${Math.max(skill ? 150 : 90, profile?.trainingRestSeconds || 120)} 秒起`} /><Metric label="强度" value={`RIR ${exercise.defaultPrescription?.rirTarget ?? 2}`} /></View></Card>
      {exercise.riskLevel && exercise.riskLevel !== 'low' ? <View style={[styles.risk, highRisk && styles.riskHigh]}><Text style={[styles.riskTitle, highRisk && styles.riskTitleHigh]}>{riskLabel(exercise.riskLevel)}风险动作</Text><Text style={styles.riskText}>{highRisk ? '请在专业教练、保护者和合适防护垫的条件下练习；不要在疲劳或疼痛时尝试。' : '先熟悉动作轨迹，保留余力；如出现关节不适请立即停止。'}</Text></View> : null}
      {neckPreparation || singleLegCalf ? <ExerciseDetailedGuide exercise={exercise} /> : <ExerciseInstructions exercise={exercise} />}
      {exercise.standards ? <><SectionTitle title="进阶标准" /><Card>{Object.entries(exercise.standards).map(([key, value]) => <View key={key} style={styles.standard}><Text style={styles.standardKey}>{({ beginner: '初级', intermediate: '中级', upgrade: '升级' } as Record<string,string>)[key] || key}</Text><Text style={styles.standardValue}>{value}</Text></View>)}</Card></> : null}
      {skill ? <Text style={styles.skillNote}>街头技巧仅在中级或高阶、每次训练至少 45 分钟时自动安排，每课最多一项；初学者仍可先查看动作要求。</Text> : null}
      <View style={{ height: 22 }} />{exercise.step ? <Button label={isCurrent ? `当前已为第 ${exercise.step} 式` : `设为当前第 ${exercise.step} 式（同步当前阶与计划）`} variant="lime" disabled={isCurrent} onPress={chooseForPlan} /> : null}<View style={{ height: 10 }} /><Button label={neckPreparation ? '从起步剂量练习此动作' : '按升级标准训练此动作'} onPress={() => onStart(exercise.id)} /><View style={{ height: 34 }} />
    </View>
  </ScrollView></SafeAreaView>;
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function riskLabel(value: string) { return ({ low: '低', medium: '中', moderate: '中', high: '高' } as Record<string, string>)[value] || value; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, hero: { height: 290, backgroundColor: colors.ink }, back: { position: 'absolute', top: 14, left: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' }, backText: { color: '#FFFFFF', fontSize: 34, lineHeight: 36 }, heroText: { position: 'absolute', left: 22, right: 22, bottom: 26 }, kicker: { color: colors.lime, fontSize: 11, fontWeight: '900', letterSpacing: 1 }, title: { color: '#FFFFFF', fontSize: 35, fontWeight: '900', letterSpacing: -1, marginTop: 8 }, en: { color: '#D2D4CE', marginTop: 5, fontSize: 13 }, content: { padding: 20 }, purpose: { color: colors.ink, fontSize: 16, lineHeight: 25, fontWeight: '600' }, prescription: { flexDirection: 'row', marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.line }, metric: { flex: 1 }, metricValue: { color: colors.ink, fontSize: 15, fontWeight: '900' }, metricLabel: { color: colors.inkMuted, fontSize: 10, marginTop: 4 }, standard: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }, standardKey: { color: colors.inkMuted, fontSize: 13 }, standardValue: { color: colors.ink, fontSize: 13, fontWeight: '800', maxWidth: '70%', textAlign: 'right' },
  risk: { backgroundColor: '#FFF5DF', borderRadius: radius.md, borderWidth: 1, borderColor: '#ECD4A0', padding: 15, marginTop: 12 }, riskHigh: { backgroundColor: '#FCEAE7', borderColor: '#E8B2AA' }, riskTitle: { color: '#7B5714', fontSize: 13, fontWeight: '900' }, riskTitleHigh: { color: colors.danger }, riskText: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 5 },
  skillNote: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 18 },
});
