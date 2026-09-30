import React, { useId, useMemo, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { buildWeightChart, nearestWeightPoint, shortWeightDate } from '../../data/weightChart';
import { weightTrendWindow, type WeightPeriod } from '../../data/weightTrend';
import type { Profile } from '../../types';
import { appPalette } from '../../theme';
import { AppGlyph } from '../AppGlyph';
import { useReducedMotion, useRouteReveal } from '../useProgressMotion';

export function WeightTrendChart({ history, today }: { history: Profile['weightHistory']; today: string }) {
  const [period, setPeriod] = useState<WeightPeriod>(30);
  const [width, setWidth] = useState(300);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const gradientId = 'weight-fill-' + useId().replace(/:/g, '');
  const window = useMemo(() => weightTrendWindow(history, period, new Date(today + 'T12:00:00')), [history, period, today]);
  const chart = useMemo(() => buildWeightChart(window, width), [window, width]);
  const selected = chart.points.find(point => point.date === selectedDate) || chart.points.at(-1);
  const selectedIndex = selected ? chart.points.findIndex(point => point.date === selected.date) : -1;
  const reduced = useReducedMotion();
  const revealKey = period + ':' + window.records.map(record => record.date + '=' + record.kg).join(',');
  const reveal = useRouteReveal(revealKey, reduced);
  const selectPoint = (event: GestureResponderEvent) => {
    let x = event.nativeEvent.locationX;
    if (Platform.OS === 'web') {
      // React Native Web's onPress receives a DOM click, not responder coordinates.
      const click = event.nativeEvent as unknown as { clientX?: number; detail?: number };
      const target = event.currentTarget as unknown as { getBoundingClientRect?: () => { left: number; width: number } };
      const bounds = target.getBoundingClientRect?.();
      if (!click.detail || !Number.isFinite(click.clientX) || !bounds?.width) return;
      x = (click.clientX! - bounds.left) / bounds.width * chart.width;
    }
    const nearest = nearestWeightPoint(chart.points, x);
    if (nearest) setSelectedDate(nearest.date);
  };
  return <View testID="weight-trend-chart" style={styles.container}>
    <View style={styles.header}><View style={styles.flex}><Text style={styles.label}>近 {period} 天均重</Text><Text testID="weight-window-average" style={styles.average}>{window.average === undefined ? '—' : window.average.toFixed(1)}<Text style={styles.unit}> kg</Text></Text></View><Text testID="weight-window-count" style={styles.label}>{window.records.length} 天记录</Text></View>
    <View style={styles.periods}>{([7, 30, 90] as const).map(days => <Pressable key={days} accessibilityRole="button" accessibilityLabel={'查看近' + days + '天体重趋势'} accessibilityState={{ selected: period === days }} onPress={() => setPeriod(days)} style={[styles.period, period === days && styles.periodActive]}><Text style={[styles.periodLabel, period === days && styles.periodLabelActive]}>{days} 天</Text></Pressable>)}</View>
    {!chart.points.length ? <View testID="weight-trend-empty" style={styles.empty}><AppGlyph name="calendar" color={appPalette.faint} size={28} /><Text style={styles.emptyTitle}>{history?.length ? '这个时段暂无记录' : '还没有体重记录'}</Text><Text style={styles.label}>记录体重后显示趋势</Text></View> : <Animated.View style={{ opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>
      <Pressable testID="weight-trend-plot" accessibilityRole="button" accessibilityLabel={'近' + period + '天体重折线图，' + chart.points.length + '天实测记录，当前' + selected?.date + '，' + selected?.kg + '千克'} onLayout={event => { const nextWidth = event.nativeEvent.layout.width; if (nextWidth > 0 && Math.abs(nextWidth - width) > 1) setWidth(nextWidth); }} onPress={selectPoint} style={styles.plot}>
        <Svg width="100%" height={chart.height} viewBox={`0 0 ${chart.width} ${chart.height}`} pointerEvents="none" accessible={false}>
          <Defs><LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={appPalette.lime} stopOpacity={.18} /><Stop offset="1" stopColor={appPalette.lime} stopOpacity={0} /></LinearGradient></Defs>
          {chart.ticks.map(tick => <React.Fragment key={tick.kg}><Line x1={chart.left} x2={chart.right} y1={tick.y} y2={tick.y} stroke={appPalette.border} strokeWidth={1} strokeDasharray="3 5" /><SvgText x={chart.left - 8} y={tick.y + 3} textAnchor="end" fontSize={10} fill={appPalette.faint}>{tick.label}</SvgText></React.Fragment>)}
          {chart.area ? <Path d={chart.area} fill={`url(#${gradientId})`} /> : null}
          {chart.line ? <Path testID="weight-trend-line" d={chart.line} stroke={appPalette.lime} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
          {selected ? <Line x1={selected.x} x2={selected.x} y1={chart.top} y2={chart.bottom} stroke={appPalette.oliveBorder} strokeWidth={1} strokeDasharray="3 4" /> : null}
          {chart.points.map(point => <Circle testID={'weight-point-' + point.date} key={point.date} cx={point.x} cy={point.y} r={3} stroke={appPalette.card} strokeWidth={1.5} fill={appPalette.lime} />)}
          {selected ? <><Circle cx={selected.x} cy={selected.y} r={8} fill={appPalette.lime} fillOpacity={.18} /><Circle cx={selected.x} cy={selected.y} r={4} fill={appPalette.lime} stroke={appPalette.card} strokeWidth={2} /></> : null}
          {chart.dates.map((tick, index) => <SvgText key={tick.date} x={tick.x} y={chart.height - 6} textAnchor={index === 0 ? 'start' : index === chart.dates.length - 1 ? 'end' : 'middle'} fontSize={10} fill={appPalette.faint}>{shortWeightDate(tick.date)}</SvgText>)}
        </Svg>
      </Pressable>
      <View style={styles.selection}><View style={styles.flex}><Text style={styles.label}>实测记录</Text><Text testID="weight-selected-record" style={styles.record}>{selected ? shortWeightDate(selected.date) + ' · ' + selected.kg.toFixed(1) + ' kg' : '—'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="上一条体重记录" disabled={selectedIndex <= 0} accessibilityState={{ disabled: selectedIndex <= 0 }} onPress={() => setSelectedDate(chart.points[selectedIndex - 1].date)} style={[styles.arrow, selectedIndex <= 0 && styles.disabled]}><AppGlyph name="back" size={17} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="下一条体重记录" disabled={selectedIndex >= chart.points.length - 1} accessibilityState={{ disabled: selectedIndex >= chart.points.length - 1 }} onPress={() => setSelectedDate(chart.points[selectedIndex + 1].date)} style={[styles.arrow, selectedIndex >= chart.points.length - 1 && styles.disabled]}><AppGlyph name="chevron" size={17} /></Pressable></View>
      <Text style={styles.hint}>{chart.points.length === 1 ? '已记录 1 天，继续记录可查看变化' : '圆点为实测 · 点选查看'}</Text>
    </Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 12 }, flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 11, lineHeight: 18, color: appPalette.muted },
  average: { fontSize: 26, lineHeight: 34, fontWeight: '900', color: appPalette.text, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 11, color: appPalette.muted, fontWeight: '600' },
  periods: { flexDirection: 'row', gap: 4, padding: 3, backgroundColor: appPalette.background, borderRadius: 13 },
  period: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  periodActive: { backgroundColor: appPalette.olive }, periodLabel: { color: appPalette.muted, fontSize: 12, fontWeight: '700' }, periodLabelActive: { color: appPalette.lime },
  plot: { width: '100%', minHeight: 180 },
  selection: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  record: { color: appPalette.text, fontSize: 13, fontWeight: '800', lineHeight: 20, fontVariant: ['tabular-nums'] },
  arrow: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: appPalette.raised, borderRadius: 11 }, disabled: { opacity: .35 },
  hint: { color: appPalette.faint, fontSize: 10, lineHeight: 17, marginTop: 6 },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8 }, emptyTitle: { color: appPalette.text, fontSize: 13, fontWeight: '700' },
});
