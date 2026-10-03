import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { createVoiceHold } from '../../nutrition/voiceHold';
import type { VoicePhase } from '../../nutrition/voiceSession';
import { appPalette as c } from '../../theme';
const webGestureStyle: ViewStyle & { touchAction: 'none'; userSelect: 'none' } = { touchAction: 'none', userSelect: 'none' };

export function HoldToTalkButton({ phase, disabled, onStart, onStop, onCancel }: {
  phase: VoicePhase; disabled: boolean; onStart: () => boolean; onStop: () => void; onCancel: () => void;
}) {
  const [state, setState] = useState({ held: false, cancelling: false });
  const callbacks = useRef({ disabled, onStart, onStop, onCancel, phase }); callbacks.current = { disabled, onStart, onStop, onCancel, phase };
  const alive = useRef(true), launched = useRef(false);
  const hold = useRef<ReturnType<typeof createVoiceHold> | null>(null);
  if (!hold.current) hold.current = createVoiceHold({
    start: () => { launched.current = callbacks.current.onStart(); },
    stop: () => { if (launched.current) callbacks.current.onStop(); launched.current = false; },
    cancel: () => { if (launched.current) callbacks.current.onCancel(); launched.current = false; },
    change: (held, cancelling) => { if (alive.current) setState({ held, cancelling }); },
  });
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !callbacks.current.disabled && callbacks.current.phase === 'idle',
    onPanResponderGrant: () => hold.current?.begin(),
    onPanResponderMove: (_, gesture) => hold.current?.move(gesture.dy),
    onPanResponderRelease: () => hold.current?.release(),
    onPanResponderTerminate: () => hold.current?.interrupt(),
    onPanResponderTerminationRequest: () => false,
  }), []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; hold.current?.dispose(); }; }, []);
  const label = state.cancelling ? '松开取消' : phase === 'stopping' ? '正在转文字…' : state.held ? '松开结束 · 上滑取消' : '按住说话';
  return <View {...responder.panHandlers} accessibilityRole="button" accessibilityLabel="按住语音输入"
    accessibilityHint="按住说话，松开结束，上滑取消；双击也可开始或结束识别。"
    accessibilityState={{ disabled }} onAccessibilityTap={() => {
      if (callbacks.current.disabled) return;
      if (callbacks.current.phase === 'idle') { launched.current = callbacks.current.onStart(); }
      else callbacks.current.onStop();
    }} style={[s.button, Platform.OS === 'web' && webGestureStyle, state.held && s.held, state.cancelling && s.cancel, disabled && s.disabled]}>
    {phase === 'starting' || phase === 'stopping' ? <ActivityIndicator color={state.held ? c.onLime : c.lime} size="small" /> : null}
    <Text style={[s.text, state.held && s.dark]}>{label}</Text>
  </View>;
}
const s = StyleSheet.create({ button: { flex: 1, minWidth: 0, height: 48, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, held: { backgroundColor: c.lime }, cancel: { backgroundColor: c.warning }, text: { color: c.text, fontWeight: '700', fontSize: 13 }, dark: { color: c.onLime }, disabled: { opacity: .4 } });
