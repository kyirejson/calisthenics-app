import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExerciseDetailedGuide, ExerciseMedia } from '../components/ExerciseResource';
import { Button, Card, UITheme } from '../components/ui';
import { AppGlyph } from '../components/AppGlyph';
import { categoryMatches, exercises } from '../data/catalog';
import { progressionSeries } from '../data/progression';
import { useAppStore } from '../store/AppStore';
import { confirmAction, showMessage } from '../utils/confirm';
import { appPalette, fitnessColors as colors, progressPageLayout, radius } from '../theme';

export function ExerciseDetailScreen({ exerciseId, onBack, onStart }: { exerciseId: string; onBack: () => void; onStart: (exerciseId: string) => void }) {
  const { profile, patchProfile } = useAppStore();
  const exercise = exercises.find((item) => item.id === exerciseId);
  if (!exercise) return null;
  const highRisk = exercise.riskLevel === 'high';
  const neckPreparation = exercise.category === 'neck' || exercise.id === 'neck_handResistance';
  const singleLegCalf = exercise.id === 'aux_singleLegCalf';

  const series = progressionSeries.find((s) => categoryMatches(exercise, s.key));
  const seriesKey = series?.key || exercise.category;

  const currentLevel = profile?.levels?.[seriesKey] ?? 1;
  const currentPlanLevel = profile?.planLevels?.[seriesKey] ?? currentLevel;
  const isCurrent = exercise.step ? (currentLevel === exercise.step && currentPlanLevel === exercise.step) : false;

  const chooseForPlan = () => {
    if (!profile || !exercise.step) return;
    const save = () => {
      void patchProfile(current => ({
        levels: { ...current.levels, [seriesKey]: exercise.step! },
        planLevels: { ...(current.planLevels || {}), [seriesKey]: exercise.step! },
      })).then(() => {
        showMessage(
          '已设为当前训练阶',
          `已将「${exercise.name}」设为当前第 ${exercise.step} 式。进阶状态与相关训练课已同步更新。`
        );
      }).catch(() => showMessage('保存失败', '请稍后重试。'));
    };
    if (highRisk) confirmAction('高风险动作', '请确认已有必要的教练指导、保护和防护垫。仅选择动作不代表已具备完成能力。', save);
    else save();
  };
  return <UITheme><SafeAreaView style={styles.safe}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.canvas}>
    <View style={styles.hero}><View style={styles.heroHeading}><Pressable accessibilityRole="button" accessibilityLabel="返回动作列表" onPress={onBack} style={styles.back}><AppGlyph name="back" color={colors.ink} /></Pressable><View style={styles.heroText}><Text style={styles.kicker}>{exercise.categoryLabel || exercise.category} · {exercise.step ? `第 ${exercise.step} 式` : '专项动作'}</Text><Text style={styles.title}>{exercise.name}</Text></View></View><ExerciseMedia exercise={exercise} framing="full" minHeight={120} maxHeight={290} testID="exercise-detail-original-photo" /></View>
    <View style={styles.content}>
      <Card><View style={styles.prescription}><Metric label="计划组数" value={singleLegCalf ? '2 组起步' : neckPreparation ? '1 组起步' : '2–4 组'} /><Metric label="组间休息" value={singleLegCalf ? '60 秒起' : `${Math.max(90, profile?.trainingRestSeconds || 120)} 秒起`} /><Metric label="强度" value={`RIR ${exercise.defaultPrescription?.rirTarget ?? 2}`} /></View></Card>
      {exercise.riskLevel && exercise.riskLevel !== 'low' ? <View style={[styles.risk, highRisk && styles.riskHigh]}><Text style={[styles.riskTitle, highRisk && styles.riskTitleHigh]}>{riskLabel(exercise.riskLevel)}风险动作</Text><Text style={styles.riskText}>{highRisk ? '请在专业教练、保护者和合适防护垫的条件下练习；不要在疲劳或疼痛时尝试。' : '先熟悉动作轨迹，保留余力；如出现关节不适请立即停止。'}</Text></View> : null}
      <ExerciseDetailedGuide exercise={exercise} />
      <View style={{ height: 22 }} />{exercise.step ? <Button label={isCurrent ? `当前已为第 ${exercise.step} 式` : `设为当前第 ${exercise.step} 式（同步当前阶与计划）`} variant="lime" disabled={isCurrent} onPress={chooseForPlan} /> : null}<View style={{ height: 10 }} /><Button label={neckPreparation ? '从起步剂量练习此动作' : '按升级标准训练此动作'} onPress={() => onStart(exercise.id)} /><View style={{ height: 34 }} />
    </View>
  </ScrollView></SafeAreaView></UITheme>;
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function riskLabel(value: string) { return ({ low: '低', medium: '中', moderate: '中', high: '高' } as Record<string, string>)[value] || value; }
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, canvas: { maxWidth: 440, width: '100%', alignSelf: 'center' },
  hero: { paddingHorizontal: 16, paddingTop: 8, gap: 12 }, heroHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }, heroText: { flex: 1, minWidth: 0 }, kicker: { color: colors.lime, fontSize: 11, fontWeight: '700' }, title: { ...progressPageLayout.title, color: colors.ink, marginTop: 4, lineHeight: 29 },
  content: { padding: 16 }, prescription: { flexDirection: 'row', gap: 8 }, metric: { flex: 1 }, metricValue: { color: colors.ink, fontSize: 14, fontWeight: '800' }, metricLabel: { color: colors.inkMuted, fontSize: 10, marginTop: 5 },
  risk: { backgroundColor: appPalette.warningBackground, borderRadius: radius.md, borderWidth: 1, borderColor: '#6E5838', padding: 14, marginTop: 12, marginBottom: 12 }, riskHigh: { backgroundColor: '#302322', borderColor: '#72463D' }, riskTitle: { color: appPalette.warning, fontSize: 13, fontWeight: '800' }, riskTitleHigh: { color: colors.danger }, riskText: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 5 },
});
