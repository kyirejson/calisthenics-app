import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { getExerciseArtwork } from '../data/exerciseArtwork';
import type { Exercise } from '../types';
import { ExercisePhoto } from './ExerciseResource';
import { appPalette, progressPageLayout } from '../theme';

export function ProgressionArtworkViewer({ exercise, onClose, onOpen, reduceMotion = true }: {
  exercise: Exercise | null; onClose: () => void; onOpen?: (id: string) => void; reduceMotion?: boolean | null;
}) {
  const { width, height } = useWindowDimensions();
  const artwork = exercise ? getExerciseArtwork(exercise) : undefined;
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [ratios, setRatios] = useState<Record<string, number>>({});
  useEffect(() => { setSelected(artwork?.coverIndex || 0); setZoom(1); }, [exercise?.id, artwork?.coverIndex]);
  useEffect(() => {
    if (!exercise || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [exercise?.id, onClose]);
  const frame = artwork?.frames[selected];
  const canvasWidth = Math.min(width, progressPageLayout.content.maxWidth) - 32;
  const source = frame?.source;
  const dimensions = source && typeof source === 'object' && !Array.isArray(source) ? source : undefined;
  const ratio = (frame && ratios[frame.key]) || (dimensions?.width && dimensions?.height ? dimensions.width / dimensions.height : 4 / 3);
  const canvasHeight = Math.max(120, Math.min(430, height * 0.53, canvasWidth / ratio));
  return <Modal visible={Boolean(exercise)} animationType={reduceMotion === false ? 'fade' : 'none'} onRequestClose={onClose} presentationStyle="fullScreen">
    <SafeAreaView style={styles.safe}>
      {exercise ? <View style={styles.container} testID="progression-artwork-viewer">
        <View style={styles.header}><View style={styles.heading}><Text style={styles.title}>{exercise.name}</Text><Text style={styles.subtitle}>{frame?.kind === 'original' ? '资料原图' : frame ? '动作参考' : '动作配图'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="关闭动作配图" onPress={onClose} style={styles.iconButton}><Text style={styles.close}>×</Text></Pressable></View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={[styles.canvas, { height: canvasHeight }]}>
          {frame ? <ScrollView horizontal bounces={false} showsHorizontalScrollIndicator={zoom > 1}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={zoom > 1} style={{ width: canvasWidth * zoom }}>
              <View testID="progression-artwork-canvas" style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}><ExercisePhoto key={frame.key} exercise={exercise} frame={frame} resizeMode="contain" showShade={false} showTag={false} onDimensions={(imageWidth, imageHeight) => setRatios(current => current[frame.key] === imageWidth / imageHeight ? current : { ...current, [frame.key]: imageWidth / imageHeight })} /></View>
            </ScrollView>
          </ScrollView> : <View style={styles.missing}><Text style={styles.missingTitle}>配图待补</Text><Text style={styles.note}>{artwork?.missingReason || '暂无可核对的配图，请先查看动作指导。'}</Text></View>}
        </View>
        {frame ? <><View style={styles.controls}><Text testID="progression-artwork-page" style={styles.page}>{selected + 1} / {artwork?.frames.length}</Text><Pressable accessibilityRole="button" accessibilityLabel={zoom === 1 ? '放大动作原图' : '恢复完整原图'} onPress={() => setZoom(zoom === 1 ? 1.75 : 1)} style={styles.smallButton}><Text style={styles.smallText}>{zoom === 1 ? '放大' : '适应屏幕'}</Text></Pressable></View>
          <Text testID="progression-artwork-caption" style={styles.caption}>{frame.caption}</Text>
          {(artwork?.frames.length || 0) > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.frameScroll} contentContainerStyle={styles.frames}>{artwork?.frames.map((item, index) => <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: index === selected }} accessibilityLabel={`查看第${index + 1}张动作原图`} onPress={() => { setSelected(index); setZoom(1); }} style={[styles.frame, index === selected && styles.frameSelected]}><Text style={[styles.frameText, index === selected && styles.frameTextSelected]}>图 {index + 1}</Text></Pressable>)}</ScrollView> : null}</> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`查看${exercise.name}动作指导`} onPress={() => { onClose(); onOpen?.(exercise.id); }} style={styles.guide}><Text style={styles.guideText}>查看动作指导  ›</Text></Pressable>
        </ScrollView>
      </View> : null}
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: appPalette.background },
  container: { width: '100%', maxWidth: progressPageLayout.content.maxWidth, alignSelf: 'center', padding: 16, flex: 1 },
  body: { paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  heading: { flex: 1 }, title: { color: appPalette.text, ...progressPageLayout.title },
  subtitle: { color: '#9BA3B0', fontSize: 12, marginTop: 5 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#242931' },
  close: { color: '#E7EBF2', fontSize: 28 },
  canvas: { overflow: 'hidden', borderRadius: 18, backgroundColor: '#191D23' },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  page: { color: '#C7F548', fontSize: 13, fontWeight: '800' },
  smallButton: { minHeight: 44, paddingHorizontal: 15, borderRadius: 22, justifyContent: 'center', backgroundColor: '#20252D' },
  smallText: { color: '#DCE2EB', fontSize: 12, fontWeight: '700' },
  caption: { color: '#B4BCC8', fontSize: 12, lineHeight: 19, marginTop: 6 },
  frameScroll: { flexGrow: 0, marginTop: 12 }, frames: { gap: 8, paddingVertical: 4 },
  frame: { minHeight: 44, minWidth: 50, borderRadius: 14, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#242931' },
  frameSelected: { backgroundColor: '#C7F548' }, frameText: { color: '#BEC6D3', fontSize: 12, fontWeight: '800' }, frameTextSelected: { color: '#11160B' },
  missing: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  missingTitle: { color: '#C7F548', fontSize: 20, fontWeight: '800' }, note: { color: '#9BA3B0', fontSize: 13, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  guide: { backgroundColor: '#C7F548', borderRadius: 26, minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  guideText: { color: '#11160B', fontSize: 14, fontWeight: '900' },
});
