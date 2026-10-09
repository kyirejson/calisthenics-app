import { styles } from './styles';
import type { useTrainingHistory, Props } from './useTrainingHistory';
import { Pressable, Text, View } from 'react-native';
import { RunRecordDetail } from '../../running/RunRecordDetail';
import { TrainingDaySummary } from '../../components/TrainingDaySummary';
import { buildTrainingDay } from '../../domain/training/dayTraining';

import {
  compareWithPrevious,
  formatDuration,
  historyUnitLabels,
  localDayKey,
  type SessionComparisonRow,
} from '../../domain/training/trainingHistory';
import { progressNumber } from '../../domain/training/progressChart';

import type { SessionExercise } from '../../types';

import type { DayGroup } from '../../domain/training/trainingHistory';
export function TrainingHistoryDay({
  day,
  model,
}: {
  day: DayGroup;
  model: Pick<
    ReturnType<typeof useTrainingHistory>,
    | 'onOpenExercise'
    | 'savedSessionId'
    | 'now'
    | 'deleting'
    | 'expandedDay'
    | 'setExpandedDay'
    | 'detailsDay'
    | 'setDetailsDay'
    | 'expandedSession'
    | 'setExpandedSession'
    | 'valid'
    | 'requestDelete'
    | 'requestDeleteDay'
  >;
}) {
  const {
    onOpenExercise,
    savedSessionId,
    now,
    deleting,
    expandedDay,
    setExpandedDay,
    detailsDay,
    setDetailsDay,
    expandedSession,
    setExpandedSession,
    valid,
    requestDelete,
    requestDeleteDay,
  } = model;

  const dayExpanded = expandedDay === day.key;
  const strengthDay = buildTrainingDay(day.sessions, now, day.key),
    runs = day.sessions.filter((session) => session.kind === 'running');
  const toggleDay = () => {
    setExpandedDay(dayExpanded ? null : day.key);
    setDetailsDay(null);
    setExpandedSession(null);
  };
  return (
    <View style={styles.historyCard} testID={'history-day-' + day.key}>
      {strengthDay.records.length ? (
        <TrainingDaySummary
          day={strengthDay}
          isToday={day.key === localDayKey(now)}
          savedSessionId={savedSessionId}
          expanded={dayExpanded}
          onToggle={toggleDay}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={(dayExpanded ? '收起' : '展开') + day.key + '训练历史'}
          accessibilityState={{ expanded: dayExpanded }}
          aria-expanded={dayExpanded}
          onPress={toggleDay}
          style={styles.historyHead}
        >
          <View style={styles.flex}>
            <Text style={styles.sectionTitle}>
              {day.key === localDayKey(now) ? '今日跑步' : day.key + ' 跑步'}
            </Text>
            <Text style={styles.historyMeta}>
              {runs.some(run => Number.isFinite(run.distanceKm)) ? `${runs.reduce((sum, run) => sum + (run.distanceKm || 0), 0).toFixed(2)} 公里${runs.some(run => run.distanceKm === undefined || run.runDistancePartial) ? ' · 部分距离未测' : ''}` : '仅记录用时'} ·{' '}
              {runs.length} 次跑步
            </Text>
          </View>
          <Text style={styles.historyArrow}>{dayExpanded ? '⌃' : '⌄'}</Text>
        </Pressable>
      )}
      {dayExpanded
        ? runs.map((session) => (
            <View
              key={'run-' + session.id}
              style={styles.session}
              testID={'history-run-' + session.id}
            >
              <Text style={styles.sessionName}>
                {new Date(session.startedAt).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · {session.runMode === 'indoor' ? '室内跑' : '户外跑'}
              </Text>
              <RunRecordDetail session={session} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={'删除跑步记录' + session.id}
                disabled={deleting !== null}
                onPress={() => requestDelete(session)}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteText}>
                  {deleting === session.id ? '删除中…' : '删除这条记录'}
                </Text>
              </Pressable>
            </View>
          ))
        : null}
      {dayExpanded && detailsDay === day.key
        ? day.sessions
            .filter((session) => session.kind !== 'running')
            .map((session) => {
              const sessionExpanded = expandedSession === session.id;
              const started = new Date(session.startedAt);
              return (
                <View key={session.id} style={styles.session}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={'展开训练记录' + session.id}
                    accessibilityState={{ expanded: sessionExpanded }}
                    onPress={() => setExpandedSession(sessionExpanded ? null : session.id)}
                    style={styles.historyHead}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.sessionName}>{session.workoutName}</Text>
                      <Text style={styles.historyMeta}>
                        {String(started.getHours()).padStart(2, '0')}:
                        {String(started.getMinutes()).padStart(2, '0')} ·{' '}
                        {Number.isFinite(session.durationSeconds) && session.durationSeconds > 0
                          ? formatDuration(session.durationSeconds)
                          : '时长未记录'}
                      </Text>
                    </View>
                    <CompletionBadge complete={session.completion === 'complete'} />
                    <Text style={styles.historyArrow}>{sessionExpanded ? '⌃' : '⌄'}</Text>
                  </Pressable>
                  {sessionExpanded ? (
                    <View style={styles.detail}>
                      {compareWithPrevious(session, valid, now).map((row) => (
                        <ComparisonRow
                          key={row.exercise.exerciseId + ':' + row.unit}
                          row={row}
                          onOpenExercise={onOpenExercise}
                        />
                      ))}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={'删除训练记录' + session.id}
                        disabled={deleting !== null}
                        onPress={() => requestDelete(session)}
                        style={styles.deleteButton}
                      >
                        <Text style={styles.deleteText}>
                          {deleting === session.id ? '删除中…' : '删除这条记录'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
        : null}
      {dayExpanded ? <View style={styles.historyHead}>
        {strengthDay.records.length && detailsDay !== day.key ? <Pressable accessibilityRole="button" accessibilityLabel={'管理' + day.key + '单次训练记录'} onPress={() => setDetailsDay(day.key)} style={styles.deleteButton}><Text style={styles.caption}>管理单次记录</Text></Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={'删除' + day.key + '全部训练记录'} disabled={deleting !== null} onPress={() => requestDeleteDay(day.key)} style={styles.deleteButton}><Text style={styles.deleteText}>{deleting === day.key ? '删除中…' : '删除当日全部记录'}</Text></Pressable>
      </View> : null}
    </View>
  );
}
export function Method({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.method}>
      <Text style={styles.methodTitle}>{title}</Text>
      <Text style={styles.methodBody}>{text}</Text>
    </View>
  );
}
function CompletionBadge({ complete }: { complete: boolean }) {
  return (
    <View style={[styles.badge, complete && styles.badgeComplete]}>
      <Text style={[styles.badgeText, complete && styles.green]}>{complete ? '完成' : '部分'}</Text>
    </View>
  );
}
export function LegendDot({ complete = false, label }: { complete?: boolean; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.calendarDot, complete ? styles.completeDot : styles.partialDot]} />
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}
function equipmentSetText(exercise: SessionExercise, set: SessionExercise['sets'][number]) {
  const load = Number.isFinite(set.loadKg) ? `${progressNumber(set.loadKg!)} kg × ` : '';
  return (
    load +
    progressNumber(set.reps) +
    (exercise.targetSnapshot?.perSide ? ' 次/侧' : ' 次') +
    (Number.isFinite(set.rir) ? ` · RIR ${set.rir}` : '')
  );
}
function ComparisonRow({
  row,
  onOpenExercise,
}: {
  row: SessionComparisonRow;
  onOpenExercise: Props['onOpenExercise'];
}) {
  const equipment = row.exercise.exerciseId.startsWith('equipment_');
  return (
    <View style={styles.comparison}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={'查看' + row.exercise.name + '指导'}
        onPress={() => onOpenExercise(row.exercise.exerciseId)}
        style={styles.flex}
      >
        <Text style={styles.sessionName}>{row.exercise.name}</Text>
        <Text style={styles.historyMeta}>
          {row.exercise.sets
            .map((set) =>
              equipment
                ? equipmentSetText(row.exercise, set)
                : progressNumber(set.reps) + historyUnitLabels[row.unit],
            )
            .join(' · ')}
        </Text>
      </Pressable>
      <View style={styles.comparisonResult}>
        <Text style={[styles.delta, row.delta !== null && row.delta > 0 && styles.green]}>
          {equipment
            ? '实际记录'
            : row.delta === null
              ? '首次记录'
              : row.delta === 0
                ? '持平'
                : (row.delta > 0 ? '+' : '') +
                  progressNumber(row.delta) +
                  historyUnitLabels[row.unit]}
        </Text>
        {row.prevBest !== null ? (
          <Text style={styles.caption}>
            上次最佳 {progressNumber(row.prevBest)} {historyUnitLabels[row.unit]}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
