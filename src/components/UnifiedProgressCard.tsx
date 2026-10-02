import { useEffect, useId, useMemo, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import type { HistoryUnit, PerformancePoint, StaircaseStep } from '../data/trainingHistory';
import { historyUnitLabels } from '../data/trainingHistory';
import { progressGeometry, progressNumber, visibleProgressPoints, type ProgressMetric, type ProgressRange } from '../data/progressChart';
import { useProgressMotion } from './useProgressMotion';

type Props = {
  seriesKey: string; exerciseId: string; staircase: StaircaseStep[]; activeLevel: number;
  points: PerformancePoint[]; targetBenchmark: number | null; unit: HistoryUnit;
  metric: ProgressMetric; range: ProgressRange; now: Date;
  onMetric: (value: ProgressMetric) => void; onRange: (value: ProgressRange) => void;
  onSelectStep: (level: number) => void; onSelectRecord: (date: string) => void;
};

const STAIR_HEIGHT = 168, PLOT_HEIGHT = 166, PLOT_TOP = 14, LEFT = 34, RIGHT = 18;
// Let the browser scroll vertically, but leave horizontal inspection to PanResponder.
const webTouchStyle: ViewStyle & { touchAction?: 'pan-y' } = Platform.OS === 'web' ? { touchAction: 'pan-y' } : {};

function shieldPath(): string { return 'M 22 4 L 38 12 L 38 30 L 22 43 L 6 30 L 6 12 Z'; }

function feedbackText(point: PerformancePoint): string {
  if (point.feedback.pain) return '含不适反馈';
  if (point.feedback.hard) return '含勉强反馈';
  if (point.feedback.unrated) return '含未填写反馈';
  return '稳定反馈';
}

export function UnifiedProgressCard(props: Props) {
  const { staircase, activeLevel, targetBenchmark, unit, metric, range, now, onSelectStep } = props;
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const visible = useMemo(() => visibleProgressPoints(props.points, range, now), [props.points, range, now]);
  const plotWidth = Math.max(1, width - LEFT - RIGHT);
  const benchmark = metric === 'best' ? targetBenchmark : null;
  const geometry = useMemo(() => progressGeometry(visible, metric, benchmark, plotWidth, PLOT_HEIGHT), [visible, metric, benchmark, plotWidth]);
  const revealKey = [props.seriesKey, props.exerciseId, metric, range, ...visible.map(point => point.id + ':' + point[metric])].join('|');
  const motion = useProgressMotion(revealKey, width > 0);
  useEffect(() => { setSelectedId(null); }, [props.exerciseId, metric, range]);
  const requestedIndex = selectedId ? visible.findIndex(point => point.id === selectedId) : -1;
  const activeIndex = requestedIndex >= 0 ? requestedIndex : visible.length - 1;
  const active = visible[activeIndex] || visible.at(-1);
  const activeCoordinate = active ? geometry.coordinate(active) : null;
  const stride = Math.max(1, (width - 32) / Math.max(1, staircase.length));
  const positions = staircase.map((step, index) => ({ step, x: 16 + index * stride, end: 16 + (index + 1) * stride, y: 126 - index * 34 }));
  let stairPath = positions.length ? 'M 8 156 L 16 156' : '';
  positions.forEach(position => { stairPath += ' L ' + position.x + ' ' + position.y + ' L ' + position.end + ' ' + position.y; });
  const stairFill = stairPath ? stairPath + ' L ' + (width - 16) + ' 164 L 8 164 Z' : '';
  const curveTranslate = motion.curve.interpolate({ inputRange: [0, 1], outputRange: [PLOT_HEIGHT / 2, 0] });
  const stairTranslate = motion.stairs.interpolate({ inputRange: [0, 1], outputRange: [STAIR_HEIGHT / 2, 0] });
  const tooltipOpacity = motion.curve.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
  const selectAt = (locationX: number) => {
    if (!visible.length) return;
    const local = locationX - LEFT;
    let low = 0, high = visible.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (geometry.coordinate(visible[middle]).x < local) low = middle + 1; else high = middle;
    }
    const previous = Math.max(0, low - 1);
    const index = Math.abs(geometry.coordinate(visible[previous]).x - local) < Math.abs(geometry.coordinate(visible[low]).x - local) ? previous : low;
    setSelectedId(visible[index].id);
  };
  const gestures = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderGrant: event => selectAt(event.nativeEvent.locationX),
    onPanResponderMove: (event, gesture) => { if (Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2) selectAt(event.nativeEvent.locationX); },
    onPanResponderTerminationRequest: () => true,
    onShouldBlockNativeResponder: () => false,
  }), [visible, geometry]);
  const tooltipWidth = Math.min(148, Math.max(120, plotWidth));
  const tooltipAlignment = activeCoordinate ? Math.max(0, Math.min(1, (LEFT + activeCoordinate.x - tooltipWidth / 2 - 8) / Math.max(1, width - tooltipWidth - 16))) : 0;
  const tooltipTop = activeCoordinate ? Math.max(1, Math.min(112, PLOT_TOP + activeCoordinate.y - 78)) : 0;
  const dateLabelLeft = (point: PerformancePoint) => Math.max(0, Math.min(width - 58, LEFT + geometry.coordinate(point).x - 29));
  const middleLabel = visible[Math.floor((visible.length - 1) / 2)];
  const labelPoints = visible.length <= 2 ? visible : [visible[0],
    ...(dateLabelLeft(middleLabel) - dateLabelLeft(visible[0]) >= 64 && dateLabelLeft(visible.at(-1)!) - dateLabelLeft(middleLabel) >= 64 ? [middleLabel] : []), visible.at(-1)!];

  return <View style={styles.card} testID="unified-progress-card">
    <View style={styles.sectionRow}><Text style={styles.sectionTitle}>动作路线</Text><Text style={styles.legend}>○ 当前选择　✓ 验收达标</Text></View>
    <View style={styles.stairStage} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? <Animated.View pointerEvents="none" testID="progress-stair-rise" style={[StyleSheet.absoluteFill, { opacity: motion.stairs, transform: [{ translateY: stairTranslate }, { scaleY: motion.stairs }] }]}>
        <Svg width={width} height={STAIR_HEIGHT}><Defs><LinearGradient id={gradientId + 'stairs'} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#C8F04D" stopOpacity={0.22} /><Stop offset="1" stopColor="#C8F04D" stopOpacity={0} /></LinearGradient></Defs>
          <Path d={stairFill} fill={'url(#' + gradientId + 'stairs)'} />
          <Path d={stairPath} fill="none" stroke="#C8F04D" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      </Animated.View> : null}
      {positions.map(({ step, x, y }) => {
        const chosen = activeLevel === step.level;
        return <Pressable key={step.exerciseId} accessibilityRole="button" accessibilityLabel={'查看第' + step.step + '阶' + step.name + '记录'} accessibilityState={{ selected: chosen }}
          onPress={() => onSelectStep(step.level)} style={[styles.stepButton, { left: x, width: stride, top: Math.max(0, y - 60), height: 94 }]}>
          <Animated.View pointerEvents="none" style={{ alignItems: 'center', opacity: motion.stairs, transform: [{ translateY: motion.stairs.interpolate({ inputRange: [0, 1], outputRange: [156 - y, 0] }) }] }}>
            <Svg width={44} height={48}><Path d={shieldPath()} fill="#191E24" stroke={chosen ? '#F4FFD7' : step.isCompleted ? '#C8F04D' : '#56636E'} strokeWidth={chosen ? 2.4 : 1.6} />
              {step.isCompleted ? <Path d="M 14 23 L 20 29 L 31 17" fill="none" stroke="#C8F04D" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                : <Circle cx={22} cy={23} r={chosen ? 4 : 2.5} fill={chosen ? '#C8F04D' : '#67747E'} />}
            </Svg>
          </Animated.View>
          <Text style={[styles.stepLabel, chosen && styles.chosen]}>第 {step.step} 阶</Text>
          <Text numberOfLines={1} style={styles.stepCaption}>{step.isCompleted ? '验收达标' : step.isCurrent ? '当前计划' : step.hasRecord ? '已有记录' : '尚无记录'}</Text>
        </Pressable>;
      })}
    </View>

    <View style={styles.performanceHeading}>
      <View style={styles.segment}>{(['best', 'total'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={value === 'best' ? '查看单组最佳曲线' : '查看当日总量曲线'} accessibilityState={{ selected: value === metric }} onPress={() => props.onMetric(value)} style={[styles.segmentButton, value === metric && styles.segmentActive]}><Text style={[styles.segmentText, value === metric && styles.chosen]}>{value === 'best' ? '单组最佳' : '当日总量'}</Text></Pressable>)}</View>
      <Text style={styles.unit}>{historyUnitLabels[unit]}</Text>
    </View>
    <View style={styles.rangeRow}>{([30, 90, 'all'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={'查看' + (value === 'all' ? '全部' : '近' + value + '天') + '训练曲线'} accessibilityState={{ selected: range === value }} onPress={() => props.onRange(value)} style={[styles.rangeButton, range === value && styles.rangeActive]}><Text style={[styles.rangeText, range === value && styles.rangeSelected]}>{value === 'all' ? '全部' : value + ' 天'}</Text></Pressable>)}<Text style={styles.rangeNote}>{visible.length} 个记录日</Text></View>

    <View style={styles.plot} testID="progress-plot">
      {width > 0 ? <>
        <Svg width={width} height={204} pointerEvents="none">
          {geometry.ticks.map(tick => <Line key={tick.value} x1={LEFT} x2={width - RIGHT} y1={PLOT_TOP + tick.y} y2={PLOT_TOP + tick.y} stroke="#343D43" strokeWidth={1} opacity={0.55} />)}
          {geometry.benchmarkY !== null ? <Line x1={LEFT} x2={width - RIGHT} y1={PLOT_TOP + geometry.benchmarkY} y2={PLOT_TOP + geometry.benchmarkY} stroke="#EAB55F" strokeDasharray="4 5" strokeWidth={1.2} /> : null}
        </Svg>
        {geometry.ticks.map(tick => <Text key={tick.value} pointerEvents="none" style={[styles.axis, { top: PLOT_TOP + tick.y - 7 }]}>{progressNumber(tick.value)}</Text>)}
        {geometry.benchmarkY !== null ? <Text pointerEvents="none" style={[styles.benchmark, { top: Math.max(0, PLOT_TOP + geometry.benchmarkY - 18), left: LEFT + 3 }]}>单组参考 {progressNumber(benchmark!)} {historyUnitLabels[unit]}</Text> : null}
        <Animated.View pointerEvents="none" testID="progress-curve-rise" style={[styles.curveLayer, { left: LEFT, width: plotWidth, opacity: motion.curve, transform: [{ translateY: curveTranslate }, { scaleY: motion.curve }] }]}>
          <Svg width={plotWidth} height={PLOT_HEIGHT}><Defs><LinearGradient id={gradientId + 'curve'} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#C8F04D" stopOpacity={0.23} /><Stop offset="1" stopColor="#C8F04D" stopOpacity={0.01} /></LinearGradient></Defs>
            {geometry.fill ? <Path d={geometry.fill} fill={'url(#' + gradientId + 'curve)'} /> : null}
            {visible.length > 1 ? <Path testID="performance-series-line" d={geometry.path} fill="none" stroke="#C8F04D" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" /> : null}
            {geometry.sampled.map(point => { const coordinate = geometry.coordinate(point); return <Circle testID="performance-record-dot" key={point.id} cx={coordinate.x} cy={coordinate.y} r={2.8} fill="#C8F04D" />; })}
            {activeCoordinate ? <>
              <Line x1={activeCoordinate.x} x2={activeCoordinate.x} y1={0} y2={PLOT_HEIGHT} stroke="#C8F04D" opacity={0.4} strokeDasharray="3 5" />
              <Circle cx={activeCoordinate.x} cy={activeCoordinate.y} r={12} fill="#C8F04D" opacity={0.18} /><Circle cx={activeCoordinate.x} cy={activeCoordinate.y} r={4.5} fill="#FFFFFF" stroke="#C8F04D" strokeWidth={2} />
            </> : null}
          </Svg>
        </Animated.View>
        {labelPoints.map(point => <Text key={point.id} pointerEvents="none" style={[styles.dateLabel, { left: dateLabelLeft(point) }]}>{point.formattedDate}</Text>)}
        <View style={[StyleSheet.absoluteFill, webTouchStyle]} testID="performance-touch-surface" {...gestures.panHandlers} accessible accessibilityRole="image" accessibilityLabel={visible.length ? '真实训练成绩曲线，' + visible.length + '个记录日；可使用下方前后按钮查看。' : '暂无真实训练成绩'} />
        {active && activeCoordinate ? <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 8, right: 8, top: tooltipTop, opacity: tooltipOpacity, flexDirection: 'row' }}>
          <View style={{ flex: tooltipAlignment }} />
          <View testID="performance-tooltip" style={[styles.tooltip, { width: tooltipWidth, maxWidth: '100%', flexShrink: 1 }]}>
            <Text style={styles.tooltipDate}>{active.dayKey}</Text><Text style={styles.tooltipValue}>{progressNumber(active[metric])} <Text style={styles.tooltipUnit}>{historyUnitLabels[unit]}</Text></Text>
            <Text style={[styles.tooltipFeedback, active.feedback.unrated > 0 && styles.unrated, active.feedback.hard > 0 && styles.hard, active.feedback.pain > 0 && styles.pain]}>{feedbackText(active)}</Text>
          </View>
          <View style={{ flex: 1 - tooltipAlignment }} />
        </Animated.View> : null}
      </> : null}
      {!visible.length ? <View pointerEvents="none" style={styles.empty}><Text style={styles.emptyTitle}>{props.points.length ? '这个时段没有训练记录' : '你的曲线，从第一组开始'}</Text><Text style={styles.emptyText}>{props.points.length ? '切换到更长时间范围查看' : '勾选实际完成的组后，成绩会出现在这里'}</Text></View> : null}
    </View>

    {active ? <View style={styles.inspection}>
      <Pressable accessibilityRole="button" accessibilityLabel="查看上一条成绩" disabled={activeIndex <= 0} onPress={() => setSelectedId(visible[activeIndex - 1].id)} style={[styles.arrow, activeIndex <= 0 && styles.disabled]}><Text style={styles.arrowText}>‹</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={'查看' + active.dayKey + '的训练记录'} onPress={() => props.onSelectRecord(active.dayKey)} style={styles.inspectBody}>
        <Text style={styles.inspectTitle}>{active.formattedDate} · {active.sessionIds.length} 次训练 · {active.sets.length} 个有效组</Text>
        <Text numberOfLines={1} style={styles.inspectSets}>{active.sets.map(progressNumber).join(' · ')} {historyUnitLabels[unit]}　查看记录 ›</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="查看下一条成绩" disabled={activeIndex >= visible.length - 1} onPress={() => setSelectedId(visible[activeIndex + 1].id)} style={[styles.arrow, activeIndex >= visible.length - 1 && styles.disabled]}><Text style={styles.arrowText}>›</Text></Pressable>
    </View> : <Text style={styles.emptyFoot}>仅统计已勾选记录，不预测成绩</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#191D22', borderWidth: 1, borderColor: '#2A3036', borderRadius: 24, overflow: 'hidden', paddingTop: 14 },
  sectionRow: { paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  sectionTitle: { color: '#E5EAF0', fontSize: 12, fontWeight: '700' }, legend: { color: '#9CA8B1', fontSize: 10 },
  stairStage: { height: STAIR_HEIGHT, marginHorizontal: 4, overflow: 'hidden' },
  stepButton: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6 },
  stepLabel: { color: '#A6B0B8', fontSize: 12, fontWeight: '800', marginTop: 8 }, chosen: { color: '#C8F04D' }, stepCaption: { color: '#82909A', fontSize: 9, marginTop: 3 },
  performanceHeading: { paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: '#101519' },
  segmentButton: { minHeight: 44, paddingHorizontal: 13, justifyContent: 'center', borderRadius: 10 }, segmentActive: { backgroundColor: '#2A3432' },
  segmentText: { color: '#9FAAB3', fontSize: 11, fontWeight: '800' }, unit: { marginLeft: 'auto', color: '#8F9CA5', fontSize: 11 },
  rangeRow: { paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, marginBottom: 4 },
  rangeButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10 }, rangeActive: { backgroundColor: '#283130' },
  rangeText: { color: '#8C9BA6', fontSize: 10, fontWeight: '700' }, rangeSelected: { color: '#E4F4C6' }, rangeNote: { marginLeft: 'auto', color: '#8C9BA6', fontSize: 10 },
  plot: { height: 204, marginHorizontal: 4 }, curveLayer: { position: 'absolute', top: PLOT_TOP, height: PLOT_HEIGHT },
  axis: { position: 'absolute', left: 2, width: 25, color: '#8C9BA6', textAlign: 'right', fontSize: 10, fontVariant: ['tabular-nums'] },
  benchmark: { position: 'absolute', color: '#EAB55F', fontSize: 9, fontWeight: '600' },
  dateLabel: { position: 'absolute', top: 188, width: 58, textAlign: 'center', color: '#8C9BA6', fontSize: 9 },
  tooltip: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(43,52,57,0.96)', borderWidth: 1, borderColor: '#53624F', borderRadius: 12 },
  tooltipDate: { color: '#ABB5BE', fontSize: 9 }, tooltipValue: { color: '#F8FFE7', fontSize: 21, fontWeight: '900', marginTop: 2, fontVariant: ['tabular-nums'] },
  tooltipUnit: { fontSize: 11, fontWeight: '600' }, tooltipFeedback: { fontSize: 9, color: '#C8F04D', marginTop: 2 }, pain: { color: '#FFAA9B' }, unrated: { color: '#A8B4BF' }, hard: { color: '#EAB55F' },
  empty: { position: 'absolute', left: 36, right: 14, top: 74, alignItems: 'center', gap: 8 }, emptyTitle: { color: '#D1D9CF', fontSize: 13, fontWeight: '700' }, emptyText: { color: '#87949E', fontSize: 10, textAlign: 'center', lineHeight: 16 },
  inspection: { flexDirection: 'row', alignItems: 'center', gap: 4, borderTopWidth: 1, borderTopColor: '#2A3036', paddingHorizontal: 10, paddingVertical: 7, marginTop: 6 },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, arrowText: { color: '#C8F04D', fontSize: 24 },
  disabled: { opacity: 0.25 }, inspectBody: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  inspectTitle: { color: '#E2E8DF', fontSize: 10, fontWeight: '700' }, inspectSets: { color: '#93A18A', fontSize: 9, marginTop: 5 },
  emptyFoot: { color: '#7D8B95', fontSize: 10, textAlign: 'center', paddingVertical: 16 },
});
