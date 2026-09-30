import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteSketch } from '../components/GpsTrailMap';
import { UnifiedProgressCard } from '../components/UnifiedProgressCard';
import { ProgressEvidenceCard } from '../components/ProgressEvidenceCard';
import { useReducedMotion } from '../components/useProgressMotion';
import {
  buildMonthGrid, compareWithPrevious, computeMonthStats, computeReviewedTrainingStreak, computeWeekStreak,
  derivePerformanceHistory, deriveSeriesStaircase, formatDuration, groupHistoryByDay, historyUnitLabels,
  setHistoryUnit, summarizeHistoryDuration, validCompletedSets, validHistorySessions,
  type DayGroup, type SessionComparisonRow,
} from '../data/trainingHistory';
import { getSeriesExercises, parseMasteryCriteria } from '../data/progression';
import { progressNumber, type ProgressMetric, type ProgressRange } from '../data/progressChart';
import { useAppStore } from '../store/AppStore';
import type { Profile, TrainingSession } from '../types';
import { confirmAction } from '../utils/confirm';
import { formatPace, formatRunClock } from '../utils/geo';
import { progressPageLayout } from '../theme';

type Props = { onOpenExercise: (exerciseId: string) => void };
const seriesOptions = [
  { key: 'push', label: '俯卧撑' }, { key: 'squat', label: '深蹲' }, { key: 'pull', label: '引体向上' },
  { key: 'hang_grip', label: '握力' }, { key: 'legRaise', label: '举腿' }, { key: 'bridge', label: '桥' },
  { key: 'hspu', label: '倒立撑' }, { key: 'flag_clutch', label: '抓旗' },
];
const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];

export function DataScreen(props: Props) {
  const { profile } = useAppStore();
  return profile ? <DataContent {...props} profile={profile} /> : null;
}

function DataContent({ onOpenExercise, profile }: Props & { profile: Profile }) {
  const { sessions, deleteSession } = useAppStore();
  const [clock, setClock] = useState(() => new Date());
  const now = useMemo(() => new Date(), [clock, sessions]);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedSeries, setSelectedSeries] = useState('push');
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [metric, setMetric] = useState<ProgressMetric>('best');
  const [range, setRange] = useState<ProgressRange>(90);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [showMethods, setShowMethods] = useState(false);
  const list = useRef<FlatList<DayGroup>>(null);
  const headerHeight = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const next = new Date(clock.getFullYear(), clock.getMonth(), clock.getDate() + 1);
    const timer = setTimeout(() => setClock(new Date()), Math.max(1000, next.getTime() - Date.now() + 100));
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') setClock(new Date()); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [clock]);

  const valid = useMemo(() => validHistorySessions(sessions, now), [sessions, now]);
  const monthStats = useMemo(() => computeMonthStats(valid, now), [valid, now]);
  const weekStreak = useMemo(() => computeWeekStreak(valid, now), [valid, now]);
  const allGroups = useMemo(() => groupHistoryByDay(valid, now), [valid, now]);
  const dayGroups = useMemo(() => selectedDate ? allGroups.filter(day => day.key === selectedDate) : allGroups, [allGroups, selectedDate]);
  const allSteps = useMemo(() => getSeriesExercises(selectedSeries), [selectedSeries]);
  const chosen = profile.planLevels?.[selectedSeries] ?? profile.levels?.[selectedSeries] ?? 1;
  const currentLevel = Math.max(1, Math.min(allSteps.length, Number.isFinite(chosen) ? Math.floor(chosen) : 1));
  const activeLevel = Math.max(1, Math.min(allSteps.length, selectedLevel ?? currentLevel));
  const activeExercise = allSteps[activeLevel - 1];
  const criteria = useMemo(() => activeExercise ? parseMasteryCriteria(activeExercise) : null, [activeExercise]);
  const staircase = useMemo(() => deriveSeriesStaircase(valid, selectedSeries, currentLevel, allSteps, activeLevel, now), [valid, selectedSeries, currentLevel, allSteps, activeLevel, now]);
  const performance = useMemo(() => activeExercise && criteria ? derivePerformanceHistory(valid, activeExercise.id, criteria.unit, now) : { points: [], bestAllTime: 0, latest: null, hasData: false }, [valid, activeExercise, criteria, now]);
  const reviewed = useMemo(() => computeReviewedTrainingStreak(valid, now), [valid, now]);
  const calendarDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const grid = buildMonthGrid(calendarDate.getFullYear(), calendarDate.getMonth(), valid, now);
  const monthDays = grid.filter(cell => cell?.state).length;

  const selectDate = (date: string, toggle = false) => {
    const key = toggle && selectedDate === date ? null : date;
    setSelectedDate(key);
    if (key) {
      setExpandedDay(key);
      const [year, month] = key.split('-').map(Number);
      setMonthOffset((year - now.getFullYear()) * 12 + month - 1 - now.getMonth());
    }
    requestAnimationFrame(() => list.current?.scrollToOffset({ offset: Math.max(0, headerHeight.current - 70), animated: reduced === false }));
  };
  const requestDelete = (session: TrainingSession) => {
    if (deleting) return;
    confirmAction('删除这条训练记录？', '将删除「' + session.workoutName + '」本次记录。成绩、出勤与验收证据会同步重算；其他记录保留。删除后无法撤销。', () => {
      setDeleting(session.id); setDeleteError('');
      void deleteSession(session.id).catch(() => setDeleteError('删除失败，原记录保留，请重试。')).finally(() => setDeleting(null));
    }, { confirmLabel: '删除记录', destructive: true });
  };
  const header = <View onLayout={event => { headerHeight.current = event.nativeEvent.layout.height; }}>
    <View style={styles.header}><Text style={styles.title}>进步记录</Text><Pressable accessibilityRole="button" accessibilityLabel="查看数据统计口径" onPress={() => setShowMethods(true)} style={styles.methodButton}><Text style={styles.methodText}>统计口径 ⓘ</Text></Pressable></View>
    {deleteError ? <Text accessibilityRole="alert" style={styles.error}>{deleteError}</Text> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
      {seriesOptions.map(option => <Pressable key={option.key} accessibilityRole="button" accessibilityLabel={'查看' + option.label + '进步记录'} accessibilityState={{ selected: selectedSeries === option.key }} onPress={() => { setSelectedSeries(option.key); setSelectedLevel(null); }}
        style={[styles.pill, selectedSeries === option.key && styles.pillActive]}><Text style={[styles.pillText, selectedSeries === option.key && styles.pillSelected]}>{option.label}</Text></Pressable>)}
    </ScrollView>

    {activeExercise && criteria ? <>
      <View style={styles.exerciseHeading}>
        <Pressable accessibilityRole="button" accessibilityLabel={'查看' + activeExercise.name + '动作指导'} onPress={() => onOpenExercise(activeExercise.id)} style={styles.exerciseTitleArea}><Text style={styles.exerciseName}>{activeExercise.name} ›</Text><Text style={styles.exerciseStandard}>{criteria.display}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="选择查看的动作阶数" onPress={() => setShowSteps(true)} style={styles.levelButton}><Text style={styles.levelText}>第 {activeExercise.step || activeLevel} 阶 ⌄</Text></Pressable>
      </View>
      <UnifiedProgressCard seriesKey={selectedSeries} exerciseId={activeExercise.id} staircase={staircase} activeLevel={activeLevel} points={performance.points}
        targetBenchmark={/\d/.test(criteria.display) ? criteria.value : null} unit={criteria.unit} metric={metric} range={range} now={now}
        onMetric={setMetric} onRange={setRange} onSelectStep={setSelectedLevel} onSelectRecord={date => selectDate(date)} />
      <ProgressEvidenceCard best={performance.hasData ? performance.bestAllTime : null} unit={historyUnitLabels[criteria.unit]} streak={reviewed} />
    </> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>此路线暂无可查看动作</Text></View>}

    <View style={styles.overview}>
      <View style={styles.streakArea}><Text style={styles.streakValue} testID="weekly-training-streak">{weekStreak}<Text style={styles.smallUnit}> 周</Text></Text><Text style={styles.caption}>连续有训练</Text></View>
      <View style={styles.overviewBody}><Text style={styles.overviewTitle} testID="month-training-count">本月 {monthStats.count} 次 · {monthStats.count > 0 && monthStats.unmeasuredCount === monthStats.count ? '时长未记录' : formatDuration(monthStats.seconds)}</Text>
        <Text style={styles.overviewDetail}>{monthStats.activeDays} 个训练日 · {monthStats.unmeasuredCount ? monthStats.unmeasuredCount + ' 次未记时' : '时长含休息'}</Text>
        <Text style={styles.overviewComparison}>{monthStats.deltaPercent === null ? '上月同期无有效训练' : '较上月同期 ' + (monthStats.deltaPercent >= 0 ? '+' : '') + monthStats.deltaPercent + '% · 仅对比练次'}</Text>
      </View>
    </View>

    <View style={styles.calendar}>
      <View style={styles.calendarNav}>
        <Pressable accessibilityRole="button" accessibilityLabel="上一个月" onPress={() => setMonthOffset(value => value - 1)} style={styles.calendarNavButton}><Text style={styles.calendarArrow}>‹</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="回到本月训练日历" onPress={() => setMonthOffset(0)} style={styles.calendarTitleButton}><Text style={styles.calendarTitle} testID="training-calendar-month">{calendarDate.getFullYear()}年{calendarDate.getMonth() + 1}月</Text><Text style={styles.caption}>{monthDays} 天有训练</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="下一个月" disabled={monthOffset >= 0} onPress={() => setMonthOffset(value => Math.min(0, value + 1))} style={[styles.calendarNavButton, monthOffset >= 0 && styles.disabled]}><Text style={styles.calendarArrow}>›</Text></Pressable>
      </View>
      <View style={styles.calendarWeekRow}>{weekdayLabels.map(label => <Text key={label} style={styles.calendarWeekLabel}>{label}</Text>)}</View>
      <View style={styles.calendarGrid}>{grid.map((cell, index) => cell ? <Pressable key={cell.key} accessibilityRole="button" accessibilityLabel={'查看' + cell.key + '训练记录'} accessibilityState={{ selected: selectedDate === cell.key }}
        onPress={() => selectDate(cell.key, true)} style={[styles.calendarCell, cell.isToday && styles.calendarToday, selectedDate === cell.key && styles.calendarSelected]}>
        <Text style={[styles.calendarDay, cell.isToday && styles.green, selectedDate === cell.key && styles.selectedDay]}>{cell.day}</Text>
        <View style={[styles.calendarDot, cell.state === 'complete' && styles.completeDot, cell.state === 'partial' && styles.partialDot]} />
      </Pressable> : <View key={'blank-' + index} style={styles.calendarCell} />)}</View>
      <View style={styles.legendRow}><LegendDot complete label="完成" /><LegendDot label="部分完成" /><Text style={styles.caption}>点日期查看记录</Text></View>
    </View>
    <View style={styles.historyTitleRow}><Text style={styles.sectionTitle}>{selectedDate ? selectedDate + ' 记录' : '训练历史'}</Text>{selectedDate ? <Pressable accessibilityRole="button" accessibilityLabel="查看全部训练历史" onPress={() => { setSelectedDate(null); setExpandedDay(null); }} style={styles.clearButton}><Text style={styles.clearText}>全部记录</Text></Pressable> : <Text style={styles.caption}>{allGroups.length} 个训练日</Text>}</View>
  </View>;

  return <SafeAreaView style={styles.root}>
    <FlatList ref={list} testID="training-data-list" data={dayGroups} keyExtractor={day => day.key} ListHeaderComponent={header} showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content} initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7}
      extraData={[expandedDay, expandedSession, deleting]}
      ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyTitle}>{selectedDate ? '这天没有有效训练记录' : '还没有训练历史'}</Text><Text style={styles.emptyBody}>仅打开训练不会产生记录；完成并勾选一组后再回来。</Text></View>}
      ListFooterComponent={<Text style={styles.footnote}>记录保存在本机 · 删除后图表同步重算</Text>}
      renderItem={({ item: day }) => {
        const dayExpanded = expandedDay === day.key;
        const duration = summarizeHistoryDuration(day.sessions);
        const durationText = duration.unmeasuredCount === day.sessions.length ? '时长未记录'
          : (duration.unmeasuredCount ? '已记录 ' : '共 ') + formatDuration(duration.seconds) + (duration.unmeasuredCount ? ' · ' + duration.unmeasuredCount + ' 次未记时' : '');
        const complete = day.sessions.some(session => session.completion === 'complete');
        return <View style={styles.historyCard} testID={'history-day-' + day.key}>
          <Pressable accessibilityRole="button" accessibilityLabel={'展开' + day.key + '训练历史'} accessibilityState={{ expanded: dayExpanded }} onPress={() => setExpandedDay(dayExpanded ? null : day.key)} style={styles.historyHead}>
            <View style={styles.flex}><Text style={styles.historyDay}>{day.date.getFullYear()}年{day.date.getMonth() + 1}月{day.date.getDate()}日 · 周{'日一二三四五六'[day.date.getDay()]}</Text><Text style={styles.historyMeta}>{day.sessions.length} 次训练 · {durationText}</Text></View>
            <CompletionBadge complete={complete} /><Text style={styles.historyArrow}>{dayExpanded ? '⌃' : '⌄'}</Text>
          </Pressable>
          {dayExpanded ? day.sessions.map(session => {
            const sessionExpanded = expandedSession === session.id;
            const started = new Date(session.startedAt);
            return <View key={session.id} style={styles.session}>
              <Pressable accessibilityRole="button" accessibilityLabel={'展开训练记录' + session.id} accessibilityState={{ expanded: sessionExpanded }} onPress={() => setExpandedSession(sessionExpanded ? null : session.id)} style={styles.historyHead}>
                <View style={styles.flex}><Text style={styles.sessionName}>{session.workoutName}</Text><Text style={styles.historyMeta}>{String(started.getHours()).padStart(2, '0')}:{String(started.getMinutes()).padStart(2, '0')} · {Number.isFinite(session.durationSeconds) && session.durationSeconds > 0 ? formatDuration(session.durationSeconds) : '时长未记录'}</Text></View>
                <CompletionBadge complete={session.completion === 'complete'} /><Text style={styles.historyArrow}>{sessionExpanded ? '⌃' : '⌄'}</Text>
              </Pressable>
              <View style={styles.summaryRow}><View style={[styles.qualityDot, { backgroundColor: session.quality === 'solid' ? '#C8F04D' : session.quality === 'hard' ? '#EAB55F' : session.quality === 'pain' ? '#FFAA9B' : '#687680' }]} /><Text style={styles.summary}>{session.kind === 'running' ? runSummaryText(session) : sessionSummary(session)}</Text></View>
              {sessionExpanded ? <View style={styles.detail}>
                {session.kind === 'running' ? <RunDetail session={session} /> : compareWithPrevious(session, valid, now).map(row => <ComparisonRow key={row.exercise.exerciseId + ':' + row.unit} row={row} onOpenExercise={onOpenExercise} />)}
                <Pressable accessibilityRole="button" accessibilityLabel={'删除训练记录' + session.id} disabled={deleting !== null} onPress={() => requestDelete(session)} style={styles.deleteButton}><Text style={styles.deleteText}>{deleting === session.id ? '删除中…' : '删除这条记录'}</Text></Pressable>
              </View> : null}
            </View>;
          }) : null}
        </View>;
      }} />
    <Modal visible={showSteps} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setShowSteps(false)}>
      <View style={styles.backdrop}><View style={styles.sheet}>
        <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>选择动作阶数</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭动作阶数选择" onPress={() => setShowSteps(false)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
        <Text style={styles.sheetHint}>只切换查看的动作，不修改训练计划。</Text>
        <ScrollView contentContainerStyle={styles.sheetContent}>{allSteps.map((exercise, index) => <Pressable key={exercise.id} accessibilityRole="button" accessibilityLabel={'选择第' + (exercise.step || index + 1) + '阶' + exercise.name}
          accessibilityState={{ selected: activeLevel === index + 1 }} onPress={() => { setSelectedLevel(index + 1); setShowSteps(false); }} style={[styles.stepChoice, activeLevel === index + 1 && styles.stepChoiceSelected]}><Text style={styles.choiceStep}>第 {exercise.step || index + 1} 阶</Text><Text style={styles.choiceName}>{exercise.name}</Text>{activeLevel === index + 1 ? <Text style={styles.green}>✓</Text> : null}</Pressable>)}</ScrollView>
      </View></View>
    </Modal>
    <Modal visible={showMethods} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setShowMethods(false)}>
      <View style={styles.backdrop}><View style={styles.sheet}><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>数据怎样计算</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭统计口径" onPress={() => setShowMethods(false)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.sheetContent}>
          <Method title="只认真实完成" text="未勾选、无效、重复或未来日期的记录不计入统计。单组最佳取当日最大值；当日总量累加同动作、同单位的全部有效组。" />
          <Method title="参考线不是升级证明" text="参考线只表示当前动作的单组参考值。阶梯勋章复用进阶页的专项验收规则；手动设阶不会制造验收记录或解锁日期。" />
          <Method title="不混单位，不补成绩" text="次数、秒、步、米分开统计。曲线按真实日期间隔连接；休息日不补值，一次记录只画一个点。未采集的左右比、RIR 不显示。" />
          <Method title="反馈不是医学判断" text="无不适反馈按明确填写反馈的力量训练日计数，不把没有填写当作无痛，也不按自然日猜测。" />
          <Method title="出勤与时长" text="每周至少一次有效训练才算连续训练周，本周尚未练不会立即中断。上月对比截止相同日期；记录时长包含组间休息，不等于纯动作时间。缺失或异常时长单独注明，不按零分钟训练处理。" />
          {sessions.length !== valid.length ? <Text style={styles.sheetHint}>当前有 {sessions.length - valid.length} 条空记录、重复或异常记录未计入。原始记录未被删除。</Text> : null}
        </ScrollView>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

function Method({ title, text }: { title: string; text: string }) {
  return <View style={styles.method}><Text style={styles.methodTitle}>{title}</Text><Text style={styles.methodBody}>{text}</Text></View>;
}
function CompletionBadge({ complete }: { complete: boolean }) {
  return <View style={[styles.badge, complete && styles.badgeComplete]}><Text style={[styles.badgeText, complete && styles.green]}>{complete ? '完成' : '部分'}</Text></View>;
}
function LegendDot({ complete = false, label }: { complete?: boolean; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.calendarDot, complete ? styles.completeDot : styles.partialDot]} /><Text style={styles.caption}>{label}</Text></View>;
}
function sessionSummary(session: TrainingSession): string {
  const parts: string[] = [];
  for (const exercise of session.exercises || []) {
    const sets = validCompletedSets(exercise);
    for (const unit of [...new Set(sets.map(set => setHistoryUnit(exercise, set)))]) {
      const values = sets.filter(set => setHistoryUnit(exercise, set) === unit).map(set => progressNumber(set.reps));
      parts.push(exercise.name + ' ' + values.join('·') + ' ' + historyUnitLabels[unit]);
    }
  }
  return parts.join('　') || '无有效完成组';
}
function runSummaryText(session: TrainingSession): string {
  const km = Number.isFinite(session.distanceKm) ? Math.max(0, session.distanceKm!) : null;
  const pace = km && km > 0 ? session.durationSeconds / km : null;
  return (km === null ? '未记录距离' : km.toFixed(2) + ' 公里') + ' · ' + formatRunClock(session.durationSeconds) + (pace ? ' · ' + formatPace(pace) : '');
}
function RunDetail({ session }: { session: TrainingSession }) {
  const km = Number.isFinite(session.distanceKm) ? Math.max(0, session.distanceKm!) : null;
  const pace = km && km > 0 ? session.durationSeconds / km : null;
  const calories = Number.isFinite(session.calories) && session.calories! >= 0 ? Math.round(session.calories!) : null;
  return <View>
    <View style={styles.runStats}>{[
      { value: km === null ? '—' : km.toFixed(2), label: '公里' },
      { value: formatRunClock(session.durationSeconds), label: '记录用时' },
      { value: pace ? formatPace(pace) : '—', label: '平均配速' },
      { value: calories === null ? '—' : String(calories), label: '估算千卡' },
    ].map(item => <View key={item.label} style={styles.runStat}><Text style={styles.runValue}>{item.value}</Text><Text style={styles.caption}>{item.label}</Text></View>)}</View>
    {(session.route || []).length >= 2 ? <View style={styles.route}><RouteSketch route={session.route!} height={140} /></View> : null}
  </View>;
}
function ComparisonRow({ row, onOpenExercise }: { row: SessionComparisonRow; onOpenExercise: Props['onOpenExercise'] }) {
  return <View style={styles.comparison}>
    <Pressable accessibilityRole="button" accessibilityLabel={'查看' + row.exercise.name + '指导'} onPress={() => onOpenExercise(row.exercise.exerciseId)} style={styles.flex}>
      <Text style={styles.sessionName}>{row.exercise.name}</Text><Text style={styles.historyMeta}>{row.exercise.sets.map(set => progressNumber(set.reps) + historyUnitLabels[row.unit]).join(' · ')}</Text>
    </Pressable>
    <View style={styles.comparisonResult}><Text style={[styles.delta, row.delta !== null && row.delta > 0 && styles.green]}>{row.delta === null ? '首次记录' : row.delta === 0 ? '持平' : (row.delta > 0 ? '+' : '') + progressNumber(row.delta) + historyUnitLabels[row.unit]}</Text>
      {row.prevBest !== null ? <Text style={styles.caption}>上次最佳 {progressNumber(row.prevBest)} {historyUnitLabels[row.unit]}</Text> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: progressPageLayout.background }, content: progressPageLayout.content,
  flex: { flex: 1, minWidth: 0 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { ...progressPageLayout.title, color: '#EFF4E8' }, methodButton: { minHeight: progressPageLayout.minTouchHeight, paddingHorizontal: 7, justifyContent: 'center' }, methodText: { color: '#99A5AD', fontSize: 11 },
  pills: { gap: 7, paddingVertical: 5, paddingRight: 6 }, pill: { minHeight: 44, paddingHorizontal: 17, borderRadius: 24, backgroundColor: '#22282E', alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: '#C8F04D' }, pillText: { ...progressPageLayout.controlText, color: '#9CA8AF' }, pillSelected: { color: '#151A14', fontWeight: '900' },
  exerciseHeading: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 13, marginBottom: 12 },
  exerciseTitleArea: { flex: 1, minHeight: progressPageLayout.minTouchHeight, justifyContent: 'center' }, exerciseName: { ...progressPageLayout.actionTitle, color: '#F0F4EC' }, exerciseStandard: { color: '#8E9AA3', fontSize: 10, lineHeight: 16, marginTop: 3 },
  levelButton: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#242C2B', justifyContent: 'center' }, levelText: { color: '#DFF0C8', fontSize: 11, fontWeight: '700' },
  overview: { flexDirection: 'row', gap: 16, padding: 16, backgroundColor: '#191D22', borderRadius: 20, borderWidth: 1, borderColor: '#2A3036', marginTop: 12, alignItems: 'center' },
  streakArea: { minWidth: 76, alignItems: 'center' }, streakValue: { color: '#C8F04D', fontSize: 32, fontWeight: '900', fontVariant: ['tabular-nums'] }, smallUnit: { fontSize: 12, color: '#A4B38A' },
  overviewBody: { flex: 1 }, overviewTitle: { color: '#EBF1E4', fontSize: 12, lineHeight: 19, fontWeight: '800' },
  overviewDetail: { color: '#8D9AA4', fontSize: 10, marginTop: 3 }, overviewComparison: { color: '#ADBAA0', fontSize: 10, lineHeight: 16, marginTop: 4 },
  caption: { color: '#8998A2', fontSize: 10, lineHeight: 16 }, green: { color: '#C8F04D' },
  calendar: { backgroundColor: '#191D22', borderRadius: 20, borderWidth: 1, borderColor: '#2A3036', padding: 12, marginTop: 12 },
  calendarNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, calendarNavButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#242C31' },
  calendarArrow: { fontSize: 22, color: '#C8F04D' }, calendarTitleButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, calendarTitle: { color: '#ECF1E8', fontSize: 14, fontWeight: '800' },
  calendarWeekRow: { flexDirection: 'row', marginBottom: 4 }, calendarWeekLabel: { width: '14.2857%', textAlign: 'center', fontSize: 10, color: '#8998A2' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' }, calendarCell: { width: '14.2857%', height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  calendarToday: { backgroundColor: '#273127' }, calendarSelected: { backgroundColor: '#C8F04D' }, calendarDay: { color: '#C7D0D5', fontSize: 12, fontWeight: '700' }, selectedDay: { color: '#182013' },
  calendarDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 }, completeDot: { backgroundColor: '#C8F04D' }, partialDot: { backgroundColor: '#9AABC0' },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5, borderTopWidth: 1, borderTopColor: '#2A3036', paddingTop: 9, marginTop: 8 }, legendItem: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 54, marginTop: 10 },
  sectionTitle: { ...progressPageLayout.sectionTitle, color: '#F0F4EB' }, clearButton: { minHeight: progressPageLayout.minTouchHeight, justifyContent: 'center', paddingHorizontal: 8 }, clearText: { color: '#C8F04D', fontSize: 11, fontWeight: '700' },
  historyCard: { padding: 14, borderRadius: 18, backgroundColor: '#191D22', borderWidth: 1, borderColor: '#2A3036', marginBottom: 9 },
  historyHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }, historyDay: { color: '#F0F4EB', fontSize: 12, fontWeight: '800' },
  historyMeta: { color: '#95A1AA', fontSize: 10, lineHeight: 17, marginTop: 3 }, historyArrow: { color: '#8C9AA3', fontSize: 16 },
  badge: { backgroundColor: '#303132', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }, badgeComplete: { backgroundColor: '#2E3924' }, badgeText: { color: '#B8C4CE', fontSize: 9, fontWeight: '700' },
  session: { paddingTop: 10, marginTop: 9, borderTopWidth: 1, borderTopColor: '#30373D' }, sessionName: { color: '#E9F0E5', fontSize: 12, fontWeight: '700', lineHeight: 19 },
  summaryRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 8 }, qualityDot: { width: 6, height: 6, borderRadius: 3 }, summary: { color: '#96A5AF', fontSize: 10, lineHeight: 17, flex: 1 },
  detail: { paddingTop: 8, marginTop: 10, borderTopWidth: 1, borderTopColor: '#30373D' },
  comparison: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }, comparisonResult: { alignItems: 'flex-end' }, delta: { color: '#A0ABB2', fontSize: 11, fontWeight: '700' },
  deleteButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#3A2828', marginTop: 10 }, deleteText: { color: '#FFAA9B', fontSize: 11, fontWeight: '700' },
  runStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, runStat: { minWidth: 92, flexGrow: 1, padding: 10, borderRadius: 10, backgroundColor: '#252C32' }, runValue: { color: '#F0F4E8', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  route: { borderRadius: 12, overflow: 'hidden', marginTop: 10 }, disabled: { opacity: 0.25 }, error: { color: '#FFAA9B', fontSize: 12, paddingVertical: 10 },
  emptyCard: { padding: 22, borderRadius: 18, backgroundColor: '#191D22', marginBottom: 10 }, emptyTitle: { color: '#DDE7D4', fontSize: 14, fontWeight: '700' }, emptyBody: { color: '#99A7AF', fontSize: 11, lineHeight: 19, marginTop: 8 },
  footnote: { textAlign: 'center', color: '#82919C', fontSize: 10, paddingVertical: 18 },
  backdrop: { flex: 1, padding: 16, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 410, maxHeight: '86%', backgroundColor: '#191F24', borderWidth: 1, borderColor: '#3A464D', borderRadius: 24, overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 8, paddingTop: 8 }, sheetTitle: { color: '#F0F5E6', fontSize: 18, fontWeight: '800', flex: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { color: '#DDE8D3', fontSize: 24 }, sheetHint: { color: '#9EADB4', fontSize: 11, lineHeight: 18, paddingHorizontal: 18, marginBottom: 12 },
  sheetContent: { paddingHorizontal: 18, paddingBottom: 20 }, stepChoice: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderRadius: 12, paddingHorizontal: 12, marginBottom: 5, backgroundColor: '#242C32' },
  stepChoiceSelected: { backgroundColor: '#35432A' }, choiceStep: { color: '#A1B08C', fontSize: 11 }, choiceName: { color: '#EAF2E3', fontSize: 12, flex: 1, fontWeight: '700' },
  method: { marginBottom: 16 }, methodTitle: { color: '#DFF4BA', fontSize: 13, fontWeight: '800', marginBottom: 6 }, methodBody: { color: '#A7B4BC', fontSize: 12, lineHeight: 21 },
});
