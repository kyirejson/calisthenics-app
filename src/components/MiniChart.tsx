import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import { colors } from '../theme';

export type MultiSeries = {
  key: string;
  label: string;
  color: string;
  unit: string; // '次' | '秒'
  points: Array<{ t: number; value: number }>;
};

// 平滑曲线（三次贝塞尔）。张力收敛到 0.7，控制点 x 收进半段宽、y 夹在绘图区内：
// 否则远处的点（跨年平台）会把陡跳段拉出 S 形打弯。
function smoothPath(points: Array<{ x: number; y: number }>, top: number, bottom: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  const clampY = (y: number) => Math.min(bottom, Math.max(top, y));
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const xLim = Math.abs(p2.x - p1.x) / 2;
    const clampX = (v: number) => Math.min(xLim, Math.max(-xLim, v));
    const c1x = p1.x + clampX((p2.x - p0.x) / 6);
    const c1y = clampY(p1.y + ((p2.y - p0.y) / 6) * 0.7);
    const c2x = p2.x - clampX((p3.x - p1.x) / 6);
    const c2y = clampY(p2.y - ((p3.y - p1.y) / 6) * 0.7);
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

// 多系列进步曲线（SVG）。设计原则：
// - 只画有数据的系列（全 0 的不画线不画点），图例里以空心灰点标注"暂无数据"，底部不再堆一团零值线；
// - 双轴：次 = 左轴，秒 = 右轴，各自归一化；无秒数据时右轴整体隐藏；
// - 每条线加白色描边光晕分离交叉线，替代旧版"逐条下移"的伪偏移。
export function MultiLineChart({ series, height = 232 }: { series: MultiSeries[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const active = series.filter((item) => item.points.some((point) => point.value > 0));

  if (!active.length) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>曲线等第一次训练</Text>
        <Text style={styles.emptyText}>完成训练后，这里会画出每个动作的每日最佳成绩。</Text>
      </View>
    );
  }

  let tMin = Infinity;
  let tMax = -Infinity;
  let leftMax = 0;
  let rightMax = 0;
  let hasLeft = false;
  let hasRight = false;
  for (const item of active) {
    for (const point of item.points) {
      tMin = Math.min(tMin, point.t);
      tMax = Math.max(tMax, point.t);
    }
    const max = Math.max(...item.points.map((point) => point.value));
    if (item.unit === '秒') {
      rightMax = Math.max(rightMax, max);
      hasRight = true;
    } else {
      leftMax = Math.max(leftMax, max);
      hasLeft = true;
    }
  }
  if (tMax === tMin) tMax = tMin + 86400000;
  // 刻度取偶数整数，保证"最大/半值/0"三档都是整数
  const leftScale = hasLeft ? Math.max(2, Math.ceil(leftMax / 2) * 2) : 0;
  const rightScale = hasRight ? Math.max(2, Math.ceil(rightMax / 2) * 2) : 0;

  const padLeft = 32;
  const padRight = hasRight ? 36 : 16;
  const padTop = 26;
  const padBottom = 26;
  const plotH = height - padTop - padBottom;
  const baseline = padTop + plotH;
  const px = (t: number) => padLeft + ((t - tMin) / (tMax - tMin)) * (width - padLeft - padRight);
  const py = (value: number, unit: string) => padTop + (1 - value / (unit === '秒' ? rightScale : leftScale)) * plotH;

  // 网格：三条实线（最大 / 半值 / 基线），基线略深
  const levels: Array<{ value: number; strong: boolean }> = [
    { value: 1, strong: false },
    { value: 0.5, strong: false },
    { value: 0, strong: true },
  ];

  // 主角系列 = 有效点最多的那条，只有它带渐变填充，避免多色填充糊成一团
  const hero = [...active].sort(
    (a, b) => b.points.filter((point) => point.value > 0).length - a.points.filter((point) => point.value > 0).length,
  )[0];

  const curves: React.ReactNode[] = [];
  active.forEach((item) => {
    const sorted = [...item.points].sort((a, b) => a.t - b.t);
    const xy = sorted.map((point) => ({ x: px(point.t), y: py(point.value, item.unit) }));
    const lineD = smoothPath(xy, padTop, baseline);
    const isHero = item.key === hero.key;
    const last = xy[xy.length - 1];
    // 数据点标记：只在"数值发生变化"的日子打点（即真实训练日）；
    // 起点为 0 时不打点，避免把范围起点误读成一次训练
    const changeDots = xy.filter(
      (point, index) => sorted[index].value > 0 && (index === 0 || sorted[index].value !== sorted[index - 1].value),
    );
    curves.push(
      <React.Fragment key={`curve-${item.key}`}>
        {isHero ? (
          <Defs>
            <LinearGradient id={`grad-${item.key}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={item.color} stopOpacity={0.14} />
              <Stop offset="1" stopColor={item.color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
        ) : null}
        {isHero ? (
          <Path
            d={`${lineD} L ${last.x.toFixed(2)} ${baseline} L ${xy[0].x.toFixed(2)} ${baseline} Z`}
            fill={`url(#grad-${item.key})`}
            stroke="none"
          />
        ) : null}
        {/* 白色描边光晕：线与线交叉处形成分离 */}
        <Path d={lineD} fill="none" stroke="#FFFFFF" strokeOpacity={0.65} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={lineD} fill="none" stroke={item.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {changeDots.map((point, index) => (
          <Circle key={`dot-${index}`} cx={point.x} cy={point.y} r={3} fill="#FFFFFF" stroke={item.color} strokeWidth={2} />
        ))}
        {last.y >= padTop && last.y <= baseline ? (
          <>
            <Circle cx={last.x} cy={last.y} r={8} fill="none" stroke={item.color} strokeOpacity={0.22} strokeWidth={2} />
            <Circle cx={last.x} cy={last.y} r={4.5} fill={item.color} stroke="#FFFFFF" strokeWidth={2} />
          </>
        ) : null}
      </React.Fragment>,
    );
  });

  // 当前成绩角标：贴在每条曲线最新点左侧，自上而下顺序排开互不遮挡
  const chipPitch = 18;
  const chipRight = (hasRight ? 36 : 16) + 12;
  const latestBadges: Array<{ key: string; color: string; unit: string; value: number; y: number; chipTop: number }> = active
    .map((item) => {
      const sorted = [...item.points].sort((a, b) => a.t - b.t);
      const lastPoint = sorted[sorted.length - 1];
      return { key: item.key, color: item.color, unit: item.unit, value: lastPoint.value, y: py(lastPoint.value, item.unit), chipTop: 0 };
    })
    .sort((a, b) => a.y - b.y);
  let previousBottom = -Infinity;
  for (const badge of latestBadges) {
    const top = Math.max(padTop - 6, Math.min(badge.y - 9, baseline - 20));
    badge.chipTop = Math.min(Math.max(top, previousBottom + chipPitch), baseline - 20);
    previousBottom = badge.chipTop;
  }

  // 横轴日期：按时间均分四档（与数据压缩无关，保证时间刻度均匀）。
  // 跨度 120 天以上带年份避免跨年误读；中等跨度用 M/D（同月重复的 YYYY/M 没有信息量）。
  const spanDays = (tMax - tMin) / 86400000;
  const ticks: Array<{ x: number; label: string }> = [];
  for (let i = 0; i < 4; i++) {
    const t = tMin + ((tMax - tMin) * i) / 3;
    const x = px(t);
    if (ticks.some((tick) => Math.abs(tick.x - x) < 34)) continue;
    const date = new Date(t);
    ticks.push({
      x,
      label: spanDays > 120 ? `${date.getFullYear()}/${date.getMonth() + 1}` : `${date.getMonth() + 1}/${date.getDate()}`,
    });
  }

  return (
    <View>
      <View style={{ height, width: '100%' }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {levels.map((level, index) => {
              const y = padTop + (1 - level.value) * plotH;
              return (
                <Line
                  key={`gl-${index}`}
                  x1={padLeft - 4}
                  x2={width - padRight + 4}
                  y1={y}
                  y2={y}
                  stroke={level.strong ? '#D9D6CA' : '#EBE9E0'}
                  strokeWidth={1}
                />
              );
            })}
            {curves}
          </Svg>
        ) : null}
        {hasLeft ? <Text style={[styles.axisHeader, { left: 2 }]}>次数</Text> : null}
        {hasRight ? <Text style={[styles.axisHeader, { right: 2 }]}>秒</Text> : null}
        {hasLeft
          ? [1, 0.5, 0].map((level) => {
              const value = leftScale * level;
              const y = py(value, '次');
              return (
                <Text key={`yl-${level}`} style={[styles.yTickLeft, { top: y - 6 }]}>
                  {Math.round(value)}
                </Text>
              );
            })
          : null}
        {hasRight
          ? [1, 0.5, 0].map((level) => {
              const value = rightScale * level;
              const y = py(value, '秒');
              return (
                <Text key={`yr-${level}`} style={[styles.yTickRight, { top: y - 6 }]}>
                  {Math.round(value)}
                </Text>
              );
            })
          : null}
        {ticks.map((tick, index) => (
          <Text
            key={`xt-${index}`}
            style={[styles.xTick, { left: Math.min(Math.max(tick.x - 30, 0), Math.max(width - 60, 0)), top: baseline + 7 }]}
          >
            {tick.label}
          </Text>
        ))}
        {latestBadges.map((badge) => (
          <View key={`chip-${badge.key}`} style={[styles.valueChip, { top: badge.chipTop, right: chipRight }]}>
            <View style={[styles.chipDot, { backgroundColor: badge.color }]} />
            <Text style={styles.chipText}>
              {Math.round(badge.value)} {badge.unit}
            </Text>
          </View>
        ))}
      </View>
      {/* 图例：有数据的亮色实心点，暂无数据的空心灰点 */}
      <View style={styles.legendWrap}>
        {series.map((item) => {
          const on = item.points.some((point) => point.value > 0);
          return (
            <View key={item.key} style={styles.legendItem}>
              <View style={[styles.legendDot, on ? { backgroundColor: item.color } : styles.legendDotOff]} />
              <Text style={[styles.legendText, !on && styles.legendTextOff]}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axisHeader: { position: 'absolute', top: 2, color: '#9BA093', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  yTickLeft: {
    position: 'absolute',
    left: 0,
    width: 24,
    textAlign: 'right',
    color: colors.inkMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  yTickRight: { position: 'absolute', right: 0, color: colors.inkMuted, fontSize: 10, fontWeight: '700' },
  xTick: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    color: colors.inkMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  valueChip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E0D5',
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 7, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendDotOff: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#C9CBC1' },
  legendText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  legendTextOff: { color: '#A9ACA1' },
  emptyBox: {
    borderWidth: 1.5,
    borderColor: '#DDD9CC',
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: '#FAF9F3',
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  emptyText: { color: colors.inkMuted, fontSize: 11, marginTop: 6 },
});
