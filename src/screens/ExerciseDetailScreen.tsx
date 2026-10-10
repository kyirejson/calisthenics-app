import { useEffect, useState } from 'react';
import { ExerciseDetailedGuide, ExerciseMedia } from '../components/ExerciseResource';
import { UITheme } from '../components/ui';
import { DetailAction, DetailMetrics, MovementDetail } from '../components/MovementDetail';
import { categoryMatches, exercises } from '../domain/training/catalog';
import { progressionSeries } from '../domain/training/progression';
import { useAppStore } from '../store/AppStore';
import { confirmAction, showMessage } from '../utils/confirm';

export function ExerciseDetailScreen({ exerciseId, onBack, onStart }: { exerciseId: string; onBack: () => void; onStart: (exerciseId: string) => void }) {
  const { profile, patchProfile } = useAppStore(state => ({ profile: state.profile, patchProfile: state.patchProfile }));
  const [guideTab, setGuideTab] = useState<'summary' | 'original'>('summary');
  useEffect(() => setGuideTab('summary'), [exerciseId]);
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
  return <UITheme><MovementDetail title={exercise.name} kicker={`${exercise.categoryLabel || exercise.category} · ${exercise.step ? `第 ${exercise.step} 式` : '专项动作'}`} ordinal={exercise.step} backLabel="返回动作列表" onBack={onBack} readingKey={exercise.id + guideTab} footer={<>
    {exercise.step ? <DetailAction label={isCurrent ? `当前第 ${exercise.step} 式` : '设为当前阶'} accessibilityLabel={isCurrent ? `当前已为第 ${exercise.step} 式` : `设为当前第 ${exercise.step} 式（同步当前阶与计划）`} disabled={isCurrent} onPress={chooseForPlan} /> : null}
    <DetailAction label="练习此动作" accessibilityLabel={neckPreparation ? '从起步剂量练习此动作' : '按升级标准训练此动作'} primary onPress={() => onStart(exercise.id)} />
  </>}>
    {guideTab === 'summary' ? <><ExerciseMedia exercise={exercise} framing="full" minHeight={140} maxHeight={206} testID="exercise-detail-original-photo" />
    <DetailMetrics items={[
      { label: '计划组数', value: singleLegCalf ? '2 组起步' : neckPreparation ? '1 组起步' : '2–4 组' },
      { label: '组间休息', value: singleLegCalf ? '60 秒起' : `${Math.max(90, profile?.trainingRestSeconds || 120)} 秒起` },
      { label: '保留余力', value: `RIR ${exercise.defaultPrescription?.rirTarget ?? 2}` },
    ]} /></> : null}
    <ExerciseDetailedGuide key={exercise.id} exercise={exercise} selectedTab={guideTab} onTabChange={setGuideTab} />
  </MovementDetail></UITheme>;
}
