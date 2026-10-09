import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { appPalette as c } from '../theme';
import { fitRoute, mapTiles, metresPerPixel, project, screenPoint, unproject, type Coordinate } from './mapGeometry';
import type { RunPoint } from './model';
import { MapTiles } from './MapTiles';

type Props = { position: RunPoint | null; segments: readonly Coordinate[][]; splits?: Array<Coordinate & { km: number }>; status: string; good: boolean; onLocate?: () => void; interactive?: boolean };
const overview: Coordinate = { latitude: 0, longitude: 0 }; // Neutral world view, never a claimed user location.
const positionZoom = (position: RunPoint) => Math.max(3, Math.min(16, Math.floor(Math.log2(156543 * Math.cos(position.latitude * Math.PI / 180) * 60 / Math.max(35, position.accuracy)))));
export const RunMap = memo(function RunMap({ position, segments, splits = [], status, good, onLocate, interactive = true }: Props) {
  const [viewport, setViewport] = useState({ width: 360, height: 320 }), [center, setCenter] = useState<Coordinate>(position || segments[0]?.[0] || overview), [zoom, setZoom] = useState(position ? positionZoom(position) : segments.length ? 16 : 3), [following, setFollowing] = useState(true), [failures, setFailures] = useState<Record<string, boolean>>({}), [attempt, setAttempt] = useState(0);
  const positionedQuality = useRef<boolean | null>(null);
  const control = useRef({ center, zoom, following }), drag = useRef(project(center, zoom));
  control.current = { center, zoom, following };
  const tileRequests = useMemo(() => mapTiles(center, zoom, viewport.width, viewport.height), [center, zoom, viewport]);
  const current = position ? screenPoint(position, center, zoom, viewport.width, viewport.height) : null;
  useEffect(() => {
    if (!position) { positionedQuality.current = null; return; }
    if (!following) return;
    setCenter({ latitude: position.latitude, longitude: position.longitude });
    if (positionedQuality.current !== good) { setZoom(positionZoom(position)); positionedQuality.current = good; }
  }, [position?.latitude, position?.longitude, following, good]);
  useEffect(() => {
    if (position || interactive) return;
    const fit = fitRoute(segments, viewport.width, viewport.height);
    if (fit) { setCenter(fit.center); setZoom(fit.zoom); }
  }, [segments, viewport.width, viewport.height, interactive, !!position]);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => interactive && (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5),
    onPanResponderGrant: () => { const state = control.current; drag.current = project(state.center, state.zoom); setFollowing(false); },
    onPanResponderMove: (_event, gesture) => { const state = control.current; setCenter(unproject(drag.current.x - gesture.dx, drag.current.y - gesture.dy, state.zoom)); },
    onPanResponderTerminationRequest: () => false,
  }), [interactive]);
  const metres = metresPerPixel(center.latitude, zoom), scale = [20, 50, 100, 200, 500, 1000, 2000].find(value => value / metres >= 40) || 5000;
  const allFailed = tileRequests.length > 0 && tileRequests.every(tile => failures[tile.key]);
  return <View testID="run-map" style={s.root} onLayout={event => { const { width, height } = event.nativeEvent.layout; if (width > 0 && height > 0) setViewport(previous => previous.width === width && previous.height === height ? previous : { width, height }); }}>
    <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
      <MapTiles tiles={tileRequests} attempt={attempt} onError={key => setFailures(previous => previous[key] ? previous : { ...previous, [key]: true })} onLoad={key => setFailures(previous => !previous[key] ? previous : { ...previous, [key]: false })} />
      <Svg pointerEvents="none" width={viewport.width} height={viewport.height} style={StyleSheet.absoluteFill}>
        {segments.filter(segment => segment.length > 1).map((segment, index) => {
          // Only simplify the rendering; distance calculations retain every accepted fix.
          const stride = Math.max(1, Math.floor(segment.length / 1500)), points = segment.filter((_point, i) => i % stride === 0 || i === segment.length - 1).map(point => screenPoint(point, center, zoom, viewport.width, viewport.height));
          return <Path key={index} d={points.map((point, i) => `${i ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')} stroke={c.lime} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
        })}
        {segments[0]?.[0] ? (() => { const point = screenPoint(segments[0][0], center, zoom, viewport.width, viewport.height); return <Circle cx={point.x} cy={point.y} r={5} fill="#142022" stroke="#FFFFFF" strokeWidth={2} />; })() : null}
        {splits.map(marker => { const point = screenPoint(marker, center, zoom, viewport.width, viewport.height); return <Svg key={marker.km} x={point.x - 11} y={point.y - 11} width={22} height={22}><Circle cx={11} cy={11} r={10} fill="#12191C" stroke="#E6EBDD" strokeWidth={1.5} /><SvgText x={11} y={15} fill="#FFFFFF" fontSize={11} textAnchor="middle">{marker.km}</SvgText></Svg>; })}
        {current ? <><Circle cx={current.x} cy={current.y} r={Math.max(10, Math.min(100, (position?.accuracy || 0) / metres))} fill={good ? c.lime : '#BBA66A'} fillOpacity={0.15} stroke={good ? c.lime : '#BBA66A'} strokeOpacity={0.35} /><Circle cx={current.x} cy={current.y} r={6} fill={good ? c.lime : '#BBA66A'} stroke="#F6FCE7" strokeWidth={2} /></> : null}
      </Svg>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="检查跑步定位" onPress={onLocate} disabled={!onLocate} style={s.status}><View style={[s.dot, { backgroundColor: good ? c.lime : '#BBA66A' }]} /><Text numberOfLines={1} style={s.statusText}>{status}</Text></Pressable>
    <View style={s.compass} pointerEvents="none"><Text style={s.north}>N</Text><Text style={s.arrow}>▲</Text></View>
    {interactive ? <View style={[s.zoom, viewport.height < 240 && s.compactZoom]}><Pressable accessibilityRole="button" accessibilityLabel="放大跑步地图" onPress={() => setZoom(value => Math.min(18, value + 1))} style={s.smallButton}><Text style={s.symbol}>＋</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="缩小跑步地图" onPress={() => setZoom(value => Math.max(3, value - 1))} style={s.smallButton}><Text style={s.symbol}>−</Text></Pressable></View> : null}
    {allFailed ? <View style={s.failure}><Text style={s.failureText}>地图暂时无法加载</Text><Text style={s.failureHint}>GPS 记录不依赖地图网络</Text><Pressable accessibilityRole="button" accessibilityLabel="重新加载跑步地图" onPress={() => { setFailures({}); setAttempt(value => value + 1); }} style={s.retry}><Text style={s.retryText}>重试地图</Text></Pressable></View> : null}
    {!position && !segments.length && !allFailed ? <View pointerEvents="none" style={s.locateHint}><Text style={s.statusText}>地图可浏览 · 尚无当前位置</Text></View> : null}
    <View style={s.scale} pointerEvents="none"><Text style={s.scaleText}>{scale >= 1000 ? scale / 1000 + ' km' : scale + ' m'}</Text><View style={[s.scaleLine, { width: Math.min(100, scale / metres) }]} /></View>
    {interactive ? <Pressable accessibilityRole="button" accessibilityLabel="地图回到当前位置" onPress={() => { setFollowing(true); if (position) { setCenter(position); setZoom(positionZoom(position)); } else onLocate?.(); }} style={s.recenter}><Text style={s.cross}>⊙</Text></Pressable> : null}
    <Pressable accessibilityRole="link" accessibilityLabel="OpenStreetMap 地图版权" onPress={() => { void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => undefined); }} style={s.credit}><Text style={s.creditText}>© OpenStreetMap</Text></Pressable>
  </View>;
});
const s = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: '#1B2527', overflow: 'hidden' },
  status: { position: 'absolute', top: 12, left: 12, maxWidth: '79%', minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#111B20EE', borderRadius: 20, borderWidth: 1, borderColor: '#566362', paddingHorizontal: 11 }, dot: { width: 6, height: 6, borderRadius: 3 }, statusText: { color: '#EEF3E5', fontSize: 11, lineHeight: 17 },
  compass: { position: 'absolute', right: 12, top: 12, width: 28, height: 40, backgroundColor: '#111B20E8', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, north: { color: c.text, fontSize: 10 }, arrow: { color: '#F3F5E8', fontSize: 12 },
  zoom: { position: 'absolute', right: 10, top: 64, borderRadius: 10, backgroundColor: '#111B20EE', overflow: 'hidden' }, compactZoom: { top: 'auto', bottom: 30, right: 68, width: 76, height: 38, flexDirection: 'row' }, smallButton: { width: 38, minHeight: 38, alignItems: 'center', justifyContent: 'center' }, symbol: { color: c.text, fontSize: 20 },
  scale: { position: 'absolute', bottom: 22, left: 12 }, scaleText: { color: '#EFF3E8', fontSize: 9, textShadowColor: '#000', textShadowRadius: 2 }, scaleLine: { height: 5, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: '#EFF3E8' },
  recenter: { position: 'absolute', bottom: 27, right: 12, width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#687976', backgroundColor: '#111B20EE', alignItems: 'center', justifyContent: 'center' }, cross: { color: c.text, fontSize: 30, lineHeight: 34 },
  credit: { position: 'absolute', bottom: 0, right: 0, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: '#111B20D9' }, creditText: { fontSize: 9, color: '#C4CBC6' },
  locateHint: { position: 'absolute', alignSelf: 'center', top: '50%', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#111B20DD', borderRadius: 8 },
  failure: { position: 'absolute', alignSelf: 'center', top: '37%', backgroundColor: '#111B20EF', padding: 14, borderRadius: 10, alignItems: 'center', gap: 4 }, failureText: { color: c.text, fontSize: 13, fontWeight: '700' }, failureHint: { color: c.muted, fontSize: 11 }, retry: { padding: 8 }, retryText: { color: c.lime, fontSize: 12, fontWeight: '700' },
});
