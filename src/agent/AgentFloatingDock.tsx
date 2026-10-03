import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, SafeAreaView, StatusBar, Text, useWindowDimensions, View } from 'react-native';
import { DOCK_SIZE, dockBounds, dockPoint, snapDock, type DockAnchor } from './floatingDock';

/** One compact movable entry. No large unsolicited card obscures the page. */
export function AgentFloatingDock({ anchor, onAnchor, onOpen, nudge, onDismiss, error }: {
  anchor?: DockAnchor; onAnchor: (value: DockAnchor) => Promise<void>; onOpen: (question?: string) => void;
  nudge: { title: string; question: string } | null; onDismiss: () => Promise<void>; error: string;
}) {
  const window = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: window.width, height: window.height });
  const bounds = useMemo(() => dockBounds(viewport.width, viewport.height, Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0), [viewport.width, viewport.height]);
  const [position, setPosition] = useState<DockAnchor>(anchor || { edge: 'right', ratio: .9 });
  const [expanded, setExpanded] = useState(false), [saveError, setSaveError] = useState('');
  const point = useRef(dockPoint(position, bounds)), start = useRef(point.current), dragged = useRef(false);
  const animated = useRef(new Animated.ValueXY(point.current)).current;
  const latest = useRef({ bounds, onAnchor, onOpen }); latest.current = { bounds, onAnchor, onOpen };
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { const at = dockPoint(position, bounds); point.current = at; animated.setValue(at); }, [position, bounds, animated]);
  useEffect(() => { if (!nudge) setExpanded(false); }, [nudge]);
  const move = (next: DockAnchor) => {
    setPosition(next); setExpanded(false); setSaveError('');
    void latest.current.onAnchor(next).catch(() => { if (alive.current) setSaveError('位置暂未保存'); });
  };
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => true,
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 6,
    onPanResponderGrant: () => { start.current = point.current; dragged.current = false; },
    onPanResponderMove: (_, g) => {
      if (Math.hypot(g.dx, g.dy) <= 6 && !dragged.current) return;
      dragged.current = true; setExpanded(false);
      const b = latest.current.bounds;
      const next = { x: Math.max(b.left, Math.min(b.right, start.current.x + g.dx)), y: Math.max(b.top, Math.min(b.bottom, start.current.y + g.dy)) };
      point.current = next; animated.setValue(next);
    },
    onPanResponderRelease: () => { if (dragged.current) move(snapDock(point.current.x, point.current.y, latest.current.bounds)); else { dragged.current = true; latest.current.onOpen(); } },
    onPanResponderTerminate: () => { move(snapDock(point.current.x, point.current.y, latest.current.bounds)); },
  }), [animated]);
  const at = dockPoint(position, bounds);
  const cardWidth = Math.min(270, viewport.width - 24), cardTop = Math.max(bounds.top, Math.min(at.y - 160 >= bounds.top ? at.y - 160 : at.y + 60, bounds.bottom - 100));
  return <SafeAreaView pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}><View pointerEvents="box-none" style={{ flex: 1 }} onLayout={e => { const { width, height } = e.nativeEvent.layout; setViewport(current => current.width === width && current.height === height ? current : { width, height }); }}>
    {expanded && nudge ? <View testID="agent-proactive-card" style={{ position: 'absolute', top: cardTop, ...(position.edge === 'left' ? { left: 12 } : { right: 12 }), width: cardWidth, borderRadius: 16, padding: 14, backgroundColor: '#202630', borderWidth: 1, borderColor: '#465038', elevation: 8 }}>
      <Text style={{ color: '#F1F3F7', lineHeight: 21 }}>{nudge.title}</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: '#E3BB73' }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 18 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="查看个人助手关怀" onPress={() => { void onDismiss(); onOpen(nudge.question); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: '#CBF445' }}>查看</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="忽略这条关怀" onPress={() => void onDismiss()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: '#A6ADB8' }}>忽略</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="收起关怀" onPress={() => setExpanded(false)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: '#A6ADB8' }}>收起</Text></Pressable>
      </View>
    </View> : null}
    <Animated.View {...responder.panHandlers} style={{ position: 'absolute', left: animated.x, top: animated.y, width: DOCK_SIZE, height: DOCK_SIZE }}>
      <Pressable accessibilityRole="button" accessibilityLabel="打开全局个人助手" accessibilityHint="可以拖动到屏幕两侧" accessibilityActions={[{ name: 'moveLeft', label: '移到左侧' }, { name: 'moveRight', label: '移到右侧' }]} onAccessibilityAction={e => move({ ...position, edge: e.nativeEvent.actionName === 'moveLeft' ? 'left' : 'right' })} onPressIn={() => { dragged.current = false; }} onPress={() => { if (!dragged.current) onOpen(); }} style={{ width: DOCK_SIZE, height: DOCK_SIZE, borderRadius: 24, backgroundColor: '#CBF445', borderWidth: 1, borderColor: '#78922F', alignItems: 'center', justifyContent: 'center', elevation: 8 }}><Text style={{ color: '#12160E', fontWeight: '900' }}>AI</Text></Pressable>
      {saveError ? <Text accessibilityRole="alert" style={{ color: '#E3BB73', fontSize: 10 }}>{saveError}</Text> : null}
    </Animated.View>
    {nudge ? <Animated.View style={{ position: 'absolute', left: animated.x, top: Animated.add(animated.y, at.y < bounds.top + 44 ? DOCK_SIZE : -44), width: DOCK_SIZE, height: 44 }}><Pressable accessibilityRole="button" accessibilityLabel="展开个人助手关怀" onPress={() => setExpanded(v => !v)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#E3BB73', borderWidth: 2, borderColor: '#202630' }} /></Pressable></Animated.View> : null}
  </View></SafeAreaView>;
}
