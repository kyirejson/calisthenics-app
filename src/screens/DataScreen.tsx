import { Method } from '../features/history/TrainingHistoryDay';
import { styles } from '../features/history/styles';
import { useTrainingHistory, type Props } from '../features/history/useTrainingHistory';

import { Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { UnifiedProgressCard } from '../components/UnifiedProgressCard';
import { RunningMileageCard } from '../running/RunningMileageCard';

import { useAppStore } from '../store/AppStore';
import type { Profile } from '../types';

const seriesOptions = [
  { key: 'push', label: '俯卧撑' },
  { key: 'squat', label: '深蹲' },
  { key: 'pull', label: '引体向上' },
  { key: 'hang_grip', label: '握力' },
  { key: 'legRaise', label: '举腿' },
  { key: 'bridge', label: '桥' },
  { key: 'hspu', label: '倒立撑' },
  { key: 'flag_clutch', label: '抓旗' },
];

export function DataScreen(props: Props) {
  const { profile } = useAppStore((state) => ({ profile: state.profile }));
  return profile ? <DataContent {...props} profile={profile} /> : null;
}

function DataContent(props: Props & { profile: Profile }) {
  const {
    onOpenExercise,
    sessions,
    now,
    selectedSeries,
    metric,
    range,
    updateView,
    setSelectedLevel,
    showSteps,
    setShowSteps,
    showMethods,
    setShowMethods,
    reduced,
    valid,
    allSteps,
    activeLevel,
    activeExercise,
    criteria,
    staircase,
    performance,
  } = useTrainingHistory(props);
  const header = (
    <View testID="training-data-header">
      <View style={styles.header}>
        <Text style={styles.title}>进步记录</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看数据统计口径"
          onPress={() => setShowMethods(true)}
          style={styles.methodButton}
        >
          <Text style={styles.methodText}>统计口径 ⓘ</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}
      >
        {seriesOptions.map((option) => (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityLabel={'查看' + option.label + '进步记录'}
            accessibilityState={{ selected: selectedSeries === option.key }}
            aria-pressed={selectedSeries === option.key}
            onPress={() => updateView({ series: option.key, level: null })}
            style={[styles.pill, selectedSeries === option.key && styles.pillActive]}
          >
            <Text style={[styles.pillText, selectedSeries === option.key && styles.pillSelected]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {activeExercise && criteria ? (
        <>
          <View style={styles.exerciseHeading}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={'查看' + activeExercise.name + '动作指导'}
              onPress={() => onOpenExercise(activeExercise.id)}
              style={styles.exerciseTitleArea}
            >
              <Text style={styles.exerciseName}>{activeExercise.name} ›</Text>
              <Text style={styles.exerciseStandard}>{criteria.display}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="选择查看的动作阶数"
              onPress={() => setShowSteps(true)}
              style={styles.levelButton}
            >
              <Text style={styles.levelText}>第 {activeExercise.step || activeLevel} 阶 ⌄</Text>
            </Pressable>
          </View>
          <UnifiedProgressCard
            seriesKey={selectedSeries}
            exerciseId={activeExercise.id}
            staircase={staircase}
            activeLevel={activeLevel}
            points={performance.points}
            targetBenchmark={/\d/.test(criteria.display) ? criteria.value : null}
            unit={criteria.unit}
            metric={metric}
            range={range}
            now={now}
            onMetric={(metric) => updateView({ metric })}
            onRange={(range) => updateView({ range })}
            onSelectStep={setSelectedLevel}
          />
        </>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>此路线暂无可查看动作</Text>
        </View>
      )}

      <RunningMileageCard sessions={sessions} now={now} />
    </View>
  );

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView testID="training-data-list" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>{header}</ScrollView>
      <Modal
        visible={showSteps}
        transparent
        animationType={reduced ? 'none' : 'fade'}
        onRequestClose={() => setShowSteps(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>选择动作阶数</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭动作阶数选择"
                onPress={() => setShowSteps(false)}
                style={styles.close}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.sheetHint}>只切换查看的动作，不修改训练计划。</Text>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              {allSteps.map((exercise, index) => (
                <Pressable
                  key={exercise.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    '选择第' + (exercise.step || index + 1) + '阶' + exercise.name
                  }
                  accessibilityState={{ selected: activeLevel === index + 1 }}
                  onPress={() => {
                    setSelectedLevel(index + 1);
                    setShowSteps(false);
                  }}
                  style={[
                    styles.stepChoice,
                    activeLevel === index + 1 && styles.stepChoiceSelected,
                  ]}
                >
                  <Text style={styles.choiceStep}>第 {exercise.step || index + 1} 阶</Text>
                  <Text style={styles.choiceName}>{exercise.name}</Text>
                  {activeLevel === index + 1 ? <Text style={styles.green}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showMethods}
        transparent
        animationType={reduced ? 'none' : 'fade'}
        onRequestClose={() => setShowMethods(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>数据怎样计算</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭统计口径"
                onPress={() => setShowMethods(false)}
                style={styles.close}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              <Method
                title="只认真实完成"
                text="未完成、无效、重复或未来日期的记录不计入统计。单组最佳取当日最大值；当日总量累加同动作、同单位的全部有效组。"
              />
              <Method
                title="参考线不是升级证明"
                text="参考线只表示当前动作的单组参考值。阶梯勋章复用进阶页的专项验收规则；手动设阶不会制造验收记录或解锁日期。"
              />
              <Method
                title="不混单位，不补成绩"
                text="次数、秒、步、米分开统计。曲线按真实日期间隔连接；休息日不补值，一次记录只画一个点。未采集的左右比、RIR 不显示。"
              />
              <Method
                title="反馈不是医学判断"
                text="曲线只展示实际填写的训练反馈，不把没有填写当作无痛，也不据此判断身体健康。"
              />
              <Method
                title="记录用时"
                text="记录时长包含组间休息，不等于纯动作时间。缺失或异常时长单独注明，不按零分钟训练处理。"
              />
              {sessions.length !== valid.length ? (
                <Text style={styles.sheetHint}>
                  当前有 {sessions.length - valid.length}{' '}
                  条空记录、重复或异常记录未计入。原始记录未被删除。
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export type { DataViewPreferences } from '../features/history/useTrainingHistory';
