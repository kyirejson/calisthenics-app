import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Header, Page, Pill, SectionTitle } from '../components/ui';
import { MultiLineChart } from '../components/MiniChart';
import {
  buildMonthGrid,
  buildSeriesCurve,
  compareWithPrevious,
  computeMonthStats,
  computeWeekStreak,
  formatDuration,
  groupHistoryByDay,
  type SessionComparisonRow,
} from '../data/trainingHistory';
import { getSeriesExercises } from '../data/progression';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import type { TrainingSession } from '../types';
import { confirmAction } from '../utils/confirm';

// 进步曲线的系列：六个用户主看动作 + 补全引体向上；颜色即图例，一个动作一种颜色。
const seriesOptions: Array<{ key: string; label: string; unit: string; color: string }> = [
  { key: 'push', label: '俯卧撑', unit: '次', color: '#9ABB31' },
  { key: 'squat', label: '深蹲', unit: '次', color: '#F06A3A' },
  { key: 'pull', label: '引体向上', unit: '次', color: '#3767E8' },
  { key: 'legRaise', label: '举腿', unit: '次', color: '#228B5A' },
  { key: 'bridge', label: '桥', unit: '次', color: '#8B5CF6' },
  { key: 'hspu', label: '倒立撑', unit: '秒', color: '#D84A3A' },
  { key: 'flag_clutch', label: '抓旗', unit: '秒', color: '#0FA6A6' },
];

const granularityOptions: Array<{ key: 'day' | 'week' | 'month'; label: string }> = [
  { key: 'day', label: '按日' },
  { key: 'week', label: '按周' },
  { key: 'month', label: '按月' },
];

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];
const unitChar: Record<string, string> = { reps: '次', seconds: '秒', steps: '步', meters: '米' };
// 范围随粒度自动适配：按日看近一个月的细节，按周看一年趋势，按月看全程。
const granularityRange: Record<'day' | 'week' | 'month', number | null> = { day: 31, week: 365, month: null };

export function DataScreen({ onOpenExercise }: { onOpenExercise: (exerciseId: string) => void }) {
  const { profile, sessions, deleteSession } = useAppStore();
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const dayCardRefs = useRef(new Map<string, View | null>());

  if (!profile) return null;
  const now = new Date();

  const monthStats = useMemo(() => computeMonthStats(sessions, now), [sessions]);
  const weekStreak = useMemo(() => computeWeekStreak(sessions, now), [sessions]);
  const dayGroups = useMemo(() => groupHistoryByDay(sessions), [sessions]);

  const calendarYear = now.getFullYear();
  const calendarMonth = now.getMonth() + monthOffset;
  const grid = buildMonthGrid(calendarYear, calendarMonth, sessions, now);
  const gridDays = grid.reduce((sum, cell) => sum + (cell?.state ? 1 : 0), 0);

  const rangeDays = granularityRange[granularity];

  // 每个系列 = 用户当前阶的动作（升级后自动跟随新阶）
  const chartSeries = useMemo(
    () =>
      seriesOptions
        .map((option) => {
          const steps = getSeriesExercises(option.key);
          if (!steps.length) return null;
          const level = Math.max(0, Math.min(steps.length - 1, (profile.levels?.[option.key] || 1) - 1));
          const exercise = steps[level];
          const curve = buildSeriesCurve(sessions, exercise.id, granularity, rangeDays, now);
          return { ...option, exercise, level, curve };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, profile.levels, granularity],
  );
  const chartSeriesPayload = chartSeries.map((item) => ({
    key: item.key,
    label: item.label,
    color: item.color,
    unit: item.unit,
    points: item.curve.points,
  }));

  const hasAnyData = sessions.length > 0;
  const requestDelete = (session: TrainingSession) => confirmAction('删除这条训练记录？', `将删除「${session.workoutName}」本次记录。统计、今日完成状态和倒立解锁条件会重新计算，其他记录保留。删除后无法撤销。`, () => {
    setDeleting(session.id); setDeleteError('');
    void deleteSession(session.id).catch(() => setDeleteError('删除失败，请重试。')).finally(() => setDeleting(null));
  }, { confirmLabel: '删除记录', destructive: true });

  return <Page scrollRef={scrollRef}>
    <Header eyebrow="做自己的教练" title="数据" />
    {deleteError ? <Text style={{ color: colors.danger, paddingVertical: 10 }}>{deleteError}</Text> : null}
    {!hasAnyData ? (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>你的曲线从这里开始</Text>
        <Text style={styles.emptyText}>完成第一次训练后，这里会出现打卡日历、各动作的每日进步曲线，以及你的每一个里程碑。</Text>
      </Card>
    ) : (
      <>
        {/* 深色总览卡 */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewLeft}>
            <Text style={styles.overviewStreak}>{weekStreak}</Text>
            <Text style={styles.overviewStreakLabel}>连续 {weekStreak} 周</Text>
          </View>
          <View style={styles.overviewRight}>
            <Text style={styles.overviewMonth}>本月 {monthStats.count} 练 · {monthStats.minutes} 分钟</Text>
            {monthStats.deltaPercent !== null ? (
              <Text style={[styles.overviewDelta, monthStats.deltaPercent >= 0 ? styles.deltaUp : styles.deltaDown]}>
                {monthStats.deltaPercent >= 0 ? '↑' : '↓'} 较上月 {Math.abs(monthStats.deltaPercent)}%
              </Text>
            ) : (
              <Text style={styles.overviewDelta}>上月无记录，本月从零开始</Text>
            )}
          </View>
        </View>

        {/* 打卡日历 */}
        <Card style={styles.calendarCard}>
          <View style={styles.calendarNav}>
            <Pressable accessibilityRole="button" accessibilityLabel="上一个月" onPress={() => setMonthOffset((value) => value - 1)} style={styles.calendarNavButton}><Text style={styles.calendarNavArrow}>‹</Text></Pressable>
            <Text style={styles.calendarTitle}>{calendarYear}年{calendarMonth + 1}月</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="下一个月" disabled={monthOffset >= 0} onPress={() => setMonthOffset((value) => Math.min(0, value + 1))} style={[styles.calendarNavButton, monthOffset >= 0 && styles.calendarNavButtonDisabled]}><Text style={styles.calendarNavArrow}>›</Text></Pressable>
          </View>
          <View style={styles.calendarWeekRow}>
            {weekdayLabels.map((label) => <Text key={label} style={styles.calendarWeekLabel}>{label}</Text>)}
          </View>
          <View style={styles.calendarGrid}>
            {grid.map((cell, index) => cell ? (
              <View key={cell.key} style={[styles.calendarCell, cell.isToday && styles.calendarCellToday]}>
                <Text style={[styles.calendarDay, cell.state === 'complete' && styles.calendarDayActive, cell.state === 'partial' && styles.calendarDayPartial, cell.isToday && styles.calendarDayTodayText]}>{cell.day}</Text>
                <View style={[styles.calendarDot, cell.state === 'complete' && styles.calendarDotComplete, cell.state === 'partial' && styles.calendarDotPartial]} />
              </View>
            ) : <View key={`blank-${index}`} style={styles.calendarCell} />)}
          </View>
          <View style={styles.calendarLegend}>
            <LegendDot style={styles.legendDotComplete} label="完成" />
            <LegendDot style={styles.legendDotPartial} label="部分完成" />
            <LegendDot style={styles.legendDotNone} label="无记录" />
            <Text style={styles.calendarLegendNote}>共 {gridDays} 天有训练</Text>
          </View>
        </Card>

        {/* 进步曲线：所有动作一图同览 */}
        <SectionTitle title="进步曲线" />
        <Card style={styles.curveCard}>
          <View style={styles.curveHead}>
            <Text style={styles.curveCaption}>左轴次数 · 右轴秒数</Text>
            <View style={styles.segmented}>
              {granularityOptions.map((option) => (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: granularity === option.key }}
                  onPress={() => setGranularity(option.key)}
                  style={[styles.segmentItem, granularity === option.key && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentText, granularity === option.key && styles.segmentTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <MultiLineChart series={chartSeriesPayload} />
        </Card>

        {/* 训练历史：一天一条，点开看当天全部记录 */}
        <SectionTitle title="训练历史" />
        {dayGroups.map((day) => {
          const dayExpanded = expandedDayKey === day.key;
          const totalMinutes = Math.round(day.sessions.reduce((sum, session) => sum + session.durationSeconds / 60, 0));
          const dayComplete = day.sessions.some((session) => session.completion !== 'partial');
          return (
            <View key={day.key} ref={(node) => { dayCardRefs.current.set(day.key, node); }} style={styles.historyCard}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: dayExpanded }} onPress={() => setExpandedDayKey(dayExpanded ? null : day.key)} style={styles.historyHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>{day.date.getMonth() + 1}月{day.date.getDate()}日 · 周{'日一二三四五六'[day.date.getDay()]}</Text>
                  <Text style={styles.historyMeta}>{day.sessions.length} 次训练 · 共 {totalMinutes} 分钟</Text>
                </View>
                <View style={[styles.completionBadge, !dayComplete && styles.completionBadgePartial]}>
                  <Text style={[styles.completionText, !dayComplete && styles.completionTextPartial]}>{dayComplete ? '完成' : '部分'}</Text>
                </View>
                <Text style={styles.historyArrow}>{dayExpanded ? '⌃' : '⌄'}</Text>
              </Pressable>
              {dayExpanded ? day.sessions.map((session) => {
                const sessionExpanded = expandedSessionId === session.id;
                const started = new Date(session.startedAt);
                return (
                  <View key={session.id} style={styles.daySessionBlock}>
                    <Pressable accessibilityRole="button" accessibilityState={{ expanded: sessionExpanded }} onPress={() => setExpandedSessionId(sessionExpanded ? null : session.id)} style={styles.daySessionHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.daySessionTitle}>{session.workoutName}</Text>
                        <Text style={styles.historyMeta}>{String(started.getHours()).padStart(2, '0')}:{String(started.getMinutes()).padStart(2, '0')} · {formatDuration(session.durationSeconds)}</Text>
                      </View>
                      <View style={[styles.completionBadge, session.completion === 'partial' && styles.completionBadgePartial]}>
                        <Text style={[styles.completionText, session.completion === 'partial' && styles.completionTextPartial]}>{session.completion === 'partial' ? '部分' : '完成'}</Text>
                      </View>
                      <Text style={styles.historyArrow}>{sessionExpanded ? '⌃' : '⌄'}</Text>
                    </Pressable>
                    <View style={styles.qualityRow}>
                      <QualityDot quality={session.quality} />
                      <Text style={styles.historyBest}>{sessionSummary(session)}</Text>
                    </View>
                    {sessionExpanded ? (
                      <View style={styles.historyDetail}>
                        {compareWithPrevious(session, sessions).map((row) => <ComparisonRow key={row.exercise.exerciseId} row={row} onOpenExercise={onOpenExercise} />)}
                        <Pressable accessibilityRole="button" disabled={deleting !== null} onPress={() => requestDelete(session)} style={styles.deleteButton}><Text style={styles.deleteText}>{deleting === session.id ? '删除中…' : '删除这条记录'}</Text></Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              }) : null}
            </View>
          );
        })}
        <Text style={styles.footNote}>记录永远保存在本机 · 曲线只和过去的自己比较</Text>
      </>
    )}
  </Page>;
}

function LegendDot({ style, label }: { style: object; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, style]} /><Text style={styles.legendText}>{label}</Text></View>;
}

function QualityDot({ quality }: { quality?: 'solid' | 'hard' | 'pain' }) {
  const tone = quality === 'pain' ? colors.danger : quality === 'hard' ? colors.orange : colors.green;
  return <View style={[styles.qualityDot, { backgroundColor: tone }]} />;
}

function sessionSummary(session: TrainingSession) {
  const parts: string[] = [];
  for (const exercise of session.exercises) {
    const values = exercise.sets.filter((set) => set.completed).map((set) => set.reps).filter((value) => value > 0);
    if (!values.length) continue;
    const unit = unitChar[exercise.sets.find((set) => set.unit)?.unit || 'reps'] || '';
    parts.push(`${exercise.name} ${values.join('·')} ${unit}`.trim());
  }
  return parts.join('　') || '未记录完成组';
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日 · 周${'日一二三四五六'[date.getDay()]}`;
}

function ComparisonRow({ row, onOpenExercise }: { row: SessionComparisonRow; onOpenExercise: (exerciseId: string) => void }) {
  const unit = unitChar[row.unit] || '';
  return (
    <View style={styles.comparisonRow}>
      <Pressable onPress={() => onOpenExercise(row.exercise.exerciseId)} style={styles.comparisonBody}>
        <Text style={styles.comparisonName}>{row.exercise.name}</Text>
        <Text style={styles.comparisonSets}>
          {row.exercise.sets.filter((set) => set.completed).map((set) => set.reps).join('·') || '—'} {unit}
        </Text>
      </Pressable>
      <View style={styles.comparisonDelta}>
        {row.delta != null && row.delta > 0 ? <Text style={styles.deltaUp}>↑ +{row.delta}</Text>
          : row.delta != null && row.delta < 0 ? <Text style={styles.deltaDown}>↓ {row.delta}</Text>
          : row.delta === 0 ? <Text style={styles.deltaFlat}>— 持平</Text>
          : <Text style={styles.deltaFlat}>首次记录</Text>}
        {row.prevBest != null ? <Text style={styles.comparisonPrev}>上次 {row.prevBest} {unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deleteButton: { paddingVertical: 13, alignItems: 'center', borderRadius: 12, backgroundColor: '#FAE8E4', marginTop: 12 }, deleteText: { fontSize: 12, fontWeight: '800', color: colors.danger },
  overviewCard: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 18 },
  overviewLeft: { alignItems: 'center', minWidth: 92 },
  overviewStreak: { color: colors.lime, fontSize: 44, fontWeight: '900', letterSpacing: -2, lineHeight: 50 },
  overviewStreakLabel: { color: '#AEB1A8', fontSize: 11, fontWeight: '800', marginTop: 2 },
  overviewRight: { flex: 1 },
  overviewMonth: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', lineHeight: 22 },
  overviewDelta: { fontSize: 12, fontWeight: '800', marginTop: 5 },
  deltaUp: { color: colors.lime },
  deltaDown: { color: '#FF9E8F' },
  calendarCard: { marginTop: 12, padding: 14 },
  calendarNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calendarTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  calendarNavButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  calendarNavButtonDisabled: { opacity: 0.25 },
  calendarNavArrow: { color: colors.lime, fontSize: 22, fontWeight: '800', lineHeight: 26 },
  calendarWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calendarWeekLabel: { width: '14.28%', textAlign: 'center', color: colors.inkMuted, fontSize: 10, fontWeight: '800' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.28%', height: 44, alignItems: 'center', justifyContent: 'center' },
  calendarCellToday: { backgroundColor: '#EFF5DC', borderRadius: 10 },
  calendarDay: { color: colors.ink, fontSize: 13, fontWeight: '700', lineHeight: 17 },
  calendarDayActive: { color: colors.ink, fontWeight: '900' },
  calendarDayPartial: { color: colors.inkMuted },
  calendarDayTodayText: { fontWeight: '900' },
  calendarDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  calendarDotComplete: { backgroundColor: colors.limeDark },
  calendarDotPartial: { backgroundColor: '#C5C7BF' },
  calendarLegend: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 9 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendDotComplete: { backgroundColor: colors.limeDark },
  legendDotPartial: { backgroundColor: '#C5C7BF' },
  legendDotNone: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  legendText: { color: colors.inkMuted, fontSize: 10 },
  calendarLegendNote: { marginLeft: 'auto', color: colors.inkMuted, fontSize: 10, fontWeight: '700' },
  curveCard: { padding: 15 },
  curveHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  curveCaption: { color: colors.inkMuted, fontSize: 10, fontWeight: '800' },
  segmented: { flexDirection: 'row', backgroundColor: '#ECEAE1', borderRadius: radius.pill, padding: 2 },
  segmentItem: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.pill },
  segmentItemActive: { backgroundColor: colors.ink },
  segmentText: { color: colors.inkMuted, fontSize: 11, fontWeight: '800' },
  segmentTextActive: { color: colors.lime },
  historyCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 9 },
  historyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  historyMeta: { color: colors.inkMuted, fontSize: 11, marginTop: 2 },
  completionBadge: { backgroundColor: '#EFF5DC', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  completionBadgePartial: { backgroundColor: '#FFF3DD' },
  completionText: { color: '#4F6114', fontSize: 10, fontWeight: '900' },
  completionTextPartial: { color: '#8A6A1F' },
  historyArrow: { color: colors.inkMuted, fontSize: 18 },
  daySessionBlock: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 10, paddingTop: 10 },
  daySessionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  daySessionTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  qualityDot: { width: 7, height: 7, borderRadius: 4 },
  historyBest: { flex: 1, color: colors.inkMuted, fontSize: 11, lineHeight: 16 },
  historyDetail: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 10, paddingTop: 4 },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, gap: 10 },
  comparisonBody: { flex: 1, minWidth: 0 },
  comparisonName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  comparisonSets: { color: colors.inkMuted, fontSize: 11, marginTop: 2 },
  comparisonDelta: { alignItems: 'flex-end' },
  deltaFlat: { color: colors.inkMuted, fontSize: 12, fontWeight: '800' },
  comparisonPrev: { color: colors.inkMuted, fontSize: 10, marginTop: 2 },
  emptyCard: { padding: 22, alignItems: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  emptyText: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  footNote: { color: colors.inkMuted, fontSize: 10, textAlign: 'center', marginTop: 16, lineHeight: 16 },
});
