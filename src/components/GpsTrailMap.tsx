import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { appPalette, fitnessColors as colors } from '../theme';
import { useReducedMotion } from './useProgressMotion';
import type { GeoPoint } from '../utils/geo';
import { fitTrackViewport, MAP_MAX_ZOOM as MAX_ZOOM, MAP_MIN_ZOOM as MIN_ZOOM, MAP_TILE_SIZE as TILE, validGeoPoint, worldX, worldY, wrappedWorldX } from '../utils/mapViewport';

// 轻量瓦片地图（无原生依赖，Web 与 Android 通用）：
// Web 墨卡托投影把 GPS 点换算为世界像素坐标，按当前缩放铺一圈底图瓦片，
// 上面叠 SVG 轨迹线和当前位置标记。地图始终跟随用户，不做拖拽手势，
// 避免与今日页的横向滑动分页冲突。
// 当前开发图源：Esri World Dark Gray Base；上线前需核对供应商许可与地区覆盖。
// 不把可请求到的瓦片误当成商用授权；保留来源标注与真实加载失败状态。
const BASE_MAP = (zoom: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${zoom}/${y}/${x}`;
const ATTRIBUTION = 'Esri · HERE · Garmin · © OpenStreetMap contributors';
export function GpsTrailMap({
  trail,
  current,
  height,
  zoom = MAX_ZOOM,
  style,
  fitTrack = false,
  placeholderTitle,
  placeholderHint,
  placeholderAction,
}: {
  trail: GeoPoint[];
  current: GeoPoint | null;
  /** 固定高度；不传时铺满父容器，按实测尺寸铺瓦片 */
  height?: number;
  zoom?: number;
  style?: StyleProp<ViewStyle>;
  fitTrack?: boolean;
  placeholderTitle?: string;
  placeholderHint?: string;
  placeholderAction?: { label: string; onPress: () => void; disabled?: boolean };
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoomLevel, setZoomLevel] = useState(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)));
  const [manualZoom, setManualZoom] = useState(false);
  const [tileAttempt, setTileAttempt] = useState(0);
  const [tileStates, setTileStates] = useState<Record<string, 'loaded' | 'error'>>({});
  const pulse = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const hasPosition = validGeoPoint(current) || trail.some(validGeoPoint);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setBox((prev) => (Math.abs(prev.w - w) > 0.5 || Math.abs(prev.h - h) > 0.5 ? { w, h } : prev));
  };
  const width = box.w;
  const viewHeight = box.h || height || 0;
  useEffect(() => { if (!trail.length) setManualZoom(false); }, [trail.length]);

  // "正在记录"的呼吸光环：一个从中心扩散淡出的圆，只在有定位点时出现
  useEffect(() => {
    if (!hasPosition || reduced !== false) {
      pulse.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 500, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, hasPosition, reduced]);

  const fitted = fitTrack ? fitTrackViewport(trail, current, width, viewHeight) : null;
  const center = fitted?.center || (validGeoPoint(current) ? current : [...trail].reverse().find(validGeoPoint) || null);
  const displayZoom = fitTrack && !manualZoom ? fitted!.zoom : zoomLevel;
  const tiles: React.ReactNode[] = [];
  const tileIds: string[] = [];
  let trailPath = '';
  let marker: { x: number; y: number } | null = null;
  let start: { x: number; y: number } | null = null;

  if (center && width > 0 && viewHeight > 0) {
    const centerX = worldX(center.longitude, displayZoom);
    const originX = centerX - width / 2;
    const originY = worldY(center.latitude, displayZoom) - viewHeight / 2;
    const tileCount = 2 ** displayZoom;
    for (let ty = Math.floor(originY / TILE); ty <= Math.floor((originY + viewHeight) / TILE); ty++) {
      if (ty < 0 || ty >= tileCount) continue;
      for (let tx = Math.floor(originX / TILE); tx <= Math.floor((originX + width) / TILE); tx++) {
        const wrapped = ((tx % tileCount) + tileCount) % tileCount;
        const tileId = `${displayZoom}/${ty}/${wrapped}`;
        tileIds.push(tileId);
        const updateTile = (state: 'loaded' | 'error') => setTileStates(previous => previous[tileId] === state ? previous : { ...previous, [tileId]: state });
        tiles.push(
          <Image
            key={`tile-${displayZoom}-${tx}-${ty}-${tileAttempt}`}
            source={{ uri: BASE_MAP(displayZoom, wrapped, ty) + (tileAttempt ? `?retry=${tileAttempt}` : '') }}
            onLoad={() => updateTile('loaded')}
            onError={() => updateTile('error')}
            style={[styles.tile, { left: tx * TILE - originX, top: ty * TILE - originY }]}
          />,
        );
      }
    }
    const project = (point: GeoPoint) => ({
      x: wrappedWorldX(point.longitude, displayZoom, centerX) - originX,
      y: worldY(point.latitude, displayZoom) - originY,
    });
    const validTrail = trail.filter(validGeoPoint);
    trailPath = validTrail.map((point) => {
      const p = project(point);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');
    marker = project(validGeoPoint(current) ? current : validTrail.at(-1) || center);
    if (validTrail.length > 1) start = project(validTrail[0]);
  }

  const visibleTileKey = tileIds.join(',');
  useEffect(() => {
    // Keep reusable visible tiles, but do not retain a whole run's tile-status cache.
    setTileStates(previous => {
      const next = Object.fromEntries(visibleTileKey.split(',').filter(id => previous[id]).map(id => [id, previous[id]]));
      return Object.keys(next).length === Object.keys(previous).length ? previous : next;
    });
  }, [visibleTileKey]);
  const allTilesFailed = tileIds.length > 0 && tileIds.every(id => tileStates[id] === 'error');
  const retryTiles = () => { setTileStates({}); setTileAttempt(value => value + 1); };

  return (
    <View style={[styles.wrap, style, height != null && { height }]} onLayout={onLayout}>
      {tiles.length ? (
        <View style={StyleSheet.absoluteFill}><MapGrid />{tiles}</View>
      ) : (
        <View style={styles.placeholder}>
          <MapGrid />
          <View style={styles.placeholderCopy}><Text style={styles.placeholderText}>{placeholderTitle || (center ? '正在定位…' : '等待 GPS 信号')}</Text>{placeholderHint ? <Text style={styles.placeholderHint}>{placeholderHint}</Text> : null}{placeholderAction ? <Pressable accessibilityRole="button" accessibilityLabel={placeholderAction.label} disabled={placeholderAction.disabled} onPress={placeholderAction.onPress} style={[styles.locateButton, placeholderAction.disabled && { opacity: .5 }]}><Text style={styles.locateText}>{placeholderAction.label}</Text></Pressable> : null}</View>
        </View>
      )}
      {trailPath ? (
        // react-native-svg 在 Web 上不会从 absoluteFill 拉伸：不给显式宽高会落到 300×150 默认视口，
        // 轨迹下半段全部被裁掉。必须把量到的 width 和容器 height 显式传给 Svg。
        <Svg width={width} height={viewHeight} style={StyleSheet.absoluteFill}>
          {/* 三层线：最底下淡 lime 光晕，中间白色衬边把路线从道路里剥出来，最上面 lime 主线 */}
          <Polyline points={trailPath} fill="none" stroke={colors.lime} strokeWidth={9} strokeOpacity={0.22} strokeLinecap="round" strokeLinejoin="round" />
          <Polyline points={trailPath} fill="none" stroke="#FFFFFF" strokeWidth={6.5} strokeOpacity={0.75} strokeLinecap="round" strokeLinejoin="round" />
          <Polyline points={trailPath} fill="none" stroke={colors.lime} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          {start ? <Circle cx={start.x} cy={start.y} r={4.5} fill="#FFFFFF" stroke={colors.ink} strokeWidth={1.5} /> : null}
        </Svg>
      ) : null}
      {marker && tiles.length ? (
        <View style={[styles.marker, { left: marker.x - 22, top: marker.y - 22 }]} pointerEvents="none">
          <Animated.View
            style={[styles.markerPulse, {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.15] }) }],
            }]}
          />
          <View style={styles.markerCore} />
        </View>
      ) : null}
      {tiles.length ? (
        <View style={styles.zoomControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="放大地图"
            disabled={displayZoom >= MAX_ZOOM}
            onPress={() => { setZoomLevel(Math.min(MAX_ZOOM, displayZoom + 1)); setManualZoom(true); }}
            style={[styles.zoomButton, displayZoom >= MAX_ZOOM && styles.zoomButtonDisabled]}
          >
            <Text style={styles.zoomText}>＋</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="缩小地图"
            disabled={displayZoom <= MIN_ZOOM}
            onPress={() => { setZoomLevel(Math.max(MIN_ZOOM, displayZoom - 1)); setManualZoom(true); }}
            style={[styles.zoomButton, displayZoom <= MIN_ZOOM && styles.zoomButtonDisabled]}
          >
            <Text style={styles.zoomText}>－</Text>
          </Pressable>
          {fitTrack && manualZoom ? <Pressable accessibilityRole="button" accessibilityLabel="显示完整跑步路线" onPress={() => setManualZoom(false)} style={styles.zoomButton}><Text style={styles.zoomText}>◎</Text></Pressable> : null}
        </View>
      ) : null}
      {allTilesFailed ? <View testID="running-map-error" style={styles.tileError}><Text style={styles.tileErrorText}>底图暂不可用</Text><Pressable accessibilityRole="button" accessibilityLabel="重试地图加载" onPress={retryTiles} style={styles.tileRetry}><Text style={styles.locateText}>重试</Text></Pressable></View> : null}
      {tiles.length ? <Text style={styles.attribution}>{ATTRIBUTION}</Text> : null}
    </View>
  );
}

function MapGrid() {
  return <Svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill} pointerEvents="none"><Path d="M0 60h400M0 120h400M0 180h400M0 240h400M80 0v300M160 0v300M240 0v300M320 0v300" stroke={appPalette.border} strokeWidth={.6} strokeOpacity={.4} /><Circle cx={200} cy={150} r={92} fill="none" stroke={appPalette.border} strokeWidth={1} /><Circle cx={200} cy={150} r={124} fill="none" stroke={appPalette.border} strokeWidth={1} strokeOpacity={.5} /></Svg>;
}

// 跑步记录卡里的轨迹缩略图：按 GPS 点的外接框等比缩进，画一块墨色小图。
export function RouteSketch({ route, height = 60, style }: { route: GeoPoint[]; height?: number; style?: StyleProp<ViewStyle> }) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 0.5) setWidth(w);
  };
  const shape = width > 0 ? fitRoute(route, width, height) : [];
  if (!route.length) return null;
  return (
    <View style={[styles.sketch, style, { height }]} onLayout={onLayout}>
      {shape.length ? (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {shape.length > 1 ? (
            <Polyline
              points={shape.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
              fill="none"
              stroke={colors.lime}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          <Circle cx={shape[0].x} cy={shape[0].y} r={2.8} fill="#FFFFFF" />
          {shape.length > 1 ? <Circle cx={shape[shape.length - 1].x} cy={shape[shape.length - 1].y} r={3.2} fill={colors.lime} stroke="#FFFFFF" strokeWidth={1.2} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

function fitRoute(route: GeoPoint[], width: number, height: number) {
  const pad = 7;
  const xs = route.map((p) => worldX(p.longitude, 16));
  const ys = route.map((p) => worldY(p.latitude, 16));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 0.001);
  const spanY = Math.max(maxY - minY, 0.001);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  return route.map((_, index) => ({ x: (xs[index] - minX) * scale + offsetX, y: (ys[index] - minY) * scale + offsetY }));
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: appPalette.card, overflow: 'hidden', minWidth: 0 },
  tile: { position: 'absolute', width: TILE, height: TILE },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: appPalette.card },
  placeholderCopy: { alignItems: 'center', gap: 10, padding: 16, backgroundColor: 'rgba(27,32,40,.9)', borderRadius: 16 }, placeholderText: { color: appPalette.muted, fontSize: 12, fontWeight: '700' }, placeholderHint: { color: appPalette.faint, fontSize: 11 }, locateButton: { minHeight: 44, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: appPalette.oliveBorder, backgroundColor: appPalette.olive, borderRadius: 12 }, locateText: { color: appPalette.lime, fontSize: 12, fontWeight: '800' },
  marker: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  markerPulse: { position: 'absolute', top: 0, left: 0, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime },
  markerCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.lime, borderWidth: 2, borderColor: '#FFFFFF' },
  zoomControls: { position: 'absolute', top: 12, right: 12, gap: 6 },
  zoomButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(13,17,20,0.88)', borderWidth: 1, borderColor: appPalette.border, alignItems: 'center', justifyContent: 'center' },
  zoomButtonDisabled: { opacity: 0.35 },
  zoomText: { color: '#F0F2E6', fontSize: 15, fontWeight: '800', lineHeight: 18, marginTop: -1 },
  attribution: { position: 'absolute', right: 5, bottom: 3, color: appPalette.muted, fontSize: 9, fontWeight: '600' },
  tileError: { position: 'absolute', left: 10, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 10, backgroundColor: 'rgba(13,17,20,.94)', borderRadius: 10, borderWidth: 1, borderColor: appPalette.border }, tileErrorText: { color: appPalette.muted, fontSize: 11 }, tileRetry: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  sketch: { backgroundColor: appPalette.card, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: appPalette.border, minWidth: 0 },
});
