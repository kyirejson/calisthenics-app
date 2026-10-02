import { useEffect, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appPalette as p } from '../theme';
const rowHeight = 28;
type Props = { value: number; values: number[]; onChange: (value: number) => void };
export function TrainingFrequencyWheel({ value, values, onChange }: Props) {
  const scroll = useRef<ScrollView>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offset = useRef(0);
  const dragging = useRef(false);
  const latest = useRef({ value, values, onChange }); latest.current = { value, values, onChange };
  const stopTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const commit = () => {
    stopTimer();
    const { values: current, onChange: change } = latest.current;
    const index = Math.max(0, Math.min(current.length - 1, Math.round(offset.current / rowHeight)));
    scroll.current?.scrollTo({ y: index * rowHeight, animated: false });
    if (current[index] !== latest.current.value) change(current[index]);
  };
  useEffect(() => {
    stopTimer();
    const frame = requestAnimationFrame(() => {
      offset.current = Math.max(0, values.indexOf(value)) * rowHeight;
      scroll.current?.scrollTo({ y: offset.current, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [value, values.join(',')]);
  useEffect(() => () => stopTimer(), []);
  const keyboard = Platform.OS === 'web' ? { role: 'spinbutton' as const, tabIndex: 0 as const, 'aria-valuenow': value, 'aria-valuemin': values[0], 'aria-valuemax': values[values.length - 1], 'aria-valuetext': `每周${value}次`, onKeyDown: (event: { key: string; preventDefault: () => void }) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); stopTimer();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : values.indexOf(value) + (event.key === 'ArrowUp' ? -1 : 1);
    onChange(values[Math.max(0, Math.min(values.length - 1, index))]);
  } } : {};
  return <View style={s.row}>
    <View testID="equipment-frequency-wheel" accessibilityRole="adjustable" accessibilityLabel="每周训练次数" accessibilityValue={{ min: values[0], max: values[values.length - 1], now: value, text: `每周${value}次` }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => onChange(values[Math.max(0, Math.min(values.length - 1, values.indexOf(value) + (event.nativeEvent.actionName === 'increment' ? 1 : -1)))])} {...keyboard} style={s.wheel}>
      <View pointerEvents="none" style={s.selection} />
      <ScrollView ref={scroll} testID="equipment-frequency-scroll" showsVerticalScrollIndicator={false} snapToInterval={rowHeight} decelerationRate="fast" scrollEventThrottle={16} onScrollBeginDrag={() => { dragging.current = true; stopTimer(); }} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; stopTimer(); if (!dragging.current) timer.current = setTimeout(commit, 160); }} onMomentumScrollEnd={commit} onScrollEndDrag={() => { dragging.current = false; stopTimer(); timer.current = setTimeout(commit, 160); }} contentContainerStyle={s.content}>
        {values.map(number => <View key={number} accessible={false} style={s.numberRow}><Text accessible={false} style={[s.number, number === value && s.selected]}>{number}</Text></View>)}
      </ScrollView>
    </View><Text style={s.unit}>次／周</Text>
  </View>;
}
const s = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, wheel: { width: 56, height: rowHeight * 3, overflow: 'hidden' }, selection: { position: 'absolute', left: 0, right: 0, top: rowHeight, height: rowHeight, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#FFFFFF24' }, content: { paddingVertical: rowHeight }, numberRow: { height: rowHeight, justifyContent: 'center', alignItems: 'center' }, number: { color: p.faint, fontSize: 17, lineHeight: 26, fontWeight: '600' }, selected: { color: p.lime, fontSize: 24, fontWeight: '900' }, unit: { color: p.muted, fontSize: 11 } });
