import { createContext, ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppGlyph } from '../components/AppGlyph';
import { useUpdateBlock } from '../components/AppUpdates';
import { AgentChat } from './AgentChat';
import { AGENT_NAME } from '../agent/identity.mjs';

const DockContext = createContext<(hidden: boolean) => void>(() => {});
/** Focused screens such as training can suppress the floating chat entry. */
export function useHideAgentDock(hidden = true) {
  const setHidden = useContext(DockContext);
  useLayoutEffect(() => { if (!hidden) return; setHidden(true); return () => setHidden(false); }, [setHidden, hidden]);
}
const ChatContext = createContext<() => void>(() => {});
export function useOpenAgentChat() { return useContext(ChatContext); }
const size = 54, margin = 16;
export function AgentChatHost({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const [dockHidden, setDockHidden] = useState(false);
  const [open, setOpen] = useState(false);
  // Same baseline as Today's 54px action, with 80px navigation + 8px breathing room.
  const [position, setPosition] = useState({ x: width - size - margin, y: height - size - 88 });
  const origin = useRef(position), moved = useRef(false);
  const dockRef = useRef<View>(null);
  const latestPosition = useRef(position);
  latestPosition.current = position;
  const bounds = (x: number, y: number) => ({ x: Math.max(margin, Math.min(width - size - margin, x)), y: Math.max(56, Math.min(height - size - 24, y)) });
  useEffect(() => { setPosition(p => bounds(p.x, p.y)); }, [width, height]);
  useUpdateBlock(open);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
    onPanResponderGrant: () => { origin.current = latestPosition.current; moved.current = false; },
    onPanResponderMove: (_, g) => { if (Math.abs(g.dx) + Math.abs(g.dy) > 8) moved.current = true; setPosition(bounds(origin.current.x + g.dx, origin.current.y + g.dy)); },
    onPanResponderRelease: (_, g) => {
      if (!moved.current) { setOpen(true); return; }
      const next = bounds(origin.current.x + g.dx, origin.current.y + g.dy);
      setPosition({ ...next, x: next.x + size / 2 < width / 2 ? margin : width - size - margin });
    },
    onPanResponderTerminate: () => setPosition(p => bounds(p.x, p.y)),
    onPanResponderTerminationRequest: () => false,
  }), [width, height]);
  useEffect(() => {
    if (Platform.OS !== 'web' || open || dockHidden) return;
    const element = dockRef.current as unknown as HTMLElement | null;
    if (!element) return;
    element.style.touchAction = 'none';
    element.style.userSelect = 'none';
    element.style.cursor = 'grab';
    let pointer: { id: number; x: number; y: number } | null = null;
    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || pointer) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      origin.current = latestPosition.current; moved.current = false;
      element.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (pointer?.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 8) moved.current = true;
      if (moved.current) { event.preventDefault(); setPosition(bounds(origin.current.x + dx, origin.current.y + dy)); }
    };
    const finish = (event: PointerEvent) => {
      if (pointer?.id !== event.pointerId) return;
      const next = bounds(origin.current.x + event.clientX - pointer.x, origin.current.y + event.clientY - pointer.y);
      pointer = null;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      if (event.type !== 'pointerup') { setPosition(p => bounds(p.x, p.y)); return; }
      if (!moved.current) setOpen(true);
      else setPosition({ ...next, x: next.x + size / 2 < width / 2 ? margin : width - size - margin });
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(true); }
    };
    const click = (event: MouseEvent) => { if (event.detail === 0) setOpen(true); };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', finish);
    element.addEventListener('pointercancel', finish);
    element.addEventListener('lostpointercapture', finish);
    element.addEventListener('keydown', key);
    element.addEventListener('click', click);
    return () => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', finish);
      element.removeEventListener('pointercancel', finish);
      element.removeEventListener('lostpointercapture', finish);
      element.removeEventListener('keydown', key);
      element.removeEventListener('click', click);
    };
  }, [width, height, open, dockHidden]);
  return <DockContext.Provider value={setDockHidden}><ChatContext.Provider value={() => setOpen(true)}>
    <View style={s.root}>{children}
      {!open && !dockHidden ? <View ref={dockRef} {...(Platform.OS === 'web' ? {} : pan.panHandlers)} accessible focusable accessibilityRole="button" accessibilityLabel={`打开 ${AGENT_NAME} 聊天`} onAccessibilityTap={() => setOpen(true)} style={[s.float, { left: position.x, top: position.y }]}>
        <View pointerEvents="none" style={s.button}>
          <AppGlyph name="chat" size={24} color="#C8F545" />
        </View>
      </View> : null}
      <AgentChat visible={open} onClose={() => setOpen(false)} />
    </View>
  </ChatContext.Provider></DockContext.Provider>;
}
const s = StyleSheet.create({
  root: { flex: 1 },
  float: { position: 'absolute', width: size, height: size, zIndex: 100, elevation: 12 },
  button: {
    flex: 1,
    borderRadius: size / 2,
    backgroundColor: '#0D1114',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#C8F545',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
