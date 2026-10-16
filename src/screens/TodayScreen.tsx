import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { appPalette } from '../theme';
import { weekdayLabels } from '../components/todayTrainingStyles';
import { TodayTrainingScreen, type TodayTrainingProps } from './TodayTrainingScreen';
import { NutritionScreen } from './NutritionScreen';
import { useHideAgentDock } from '../integrations/AgentChatHost';
import { RunScreen } from './RunScreen';
import { useRunRecorder } from '../running/RunRecorderHost';

export function TodayScreen(props: TodayTrainingProps) {
  const { width, height } = useWindowDimensions();
  const compact = height < 820 || width < 350;
  const run = useRunRecorder();
  const pager = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [selectedPage, setSelectedPage] = useState<0 | 1 | 2>(run.snapshot.phase === 'idle' ? 0 : 2);
  useHideAgentDock(selectedPage === 2 && run.snapshot.phase !== 'idle');
  const selectedRef = useRef<0 | 1 | 2>(selectedPage);
  const scrollTarget = useRef<0 | 1 | 2 | null>(null);
  const resizing = useRef(false);
  const restoredRun = useRef(false);

  useEffect(() => {
    if (!run.ready || restoredRun.current) return;
    restoredRun.current = true;
    if (run.snapshot.phase !== 'idle') {
      selectedRef.current = 2; setSelectedPage(2); scrollTarget.current = null;
      pager.current?.scrollTo({ x: pageWidth * 2, animated: false });
    }
  }, [run.ready, run.snapshot.phase, pageWidth]);

  useEffect(() => {
    if (!pageWidth) return;
    let restoreFrame = 0;
    const layoutFrame = requestAnimationFrame(() => {
      pager.current?.scrollTo({ x: selectedRef.current * pageWidth, animated: false });
      restoreFrame = requestAnimationFrame(() => { resizing.current = false; });
    });
    return () => { cancelAnimationFrame(layoutFrame); cancelAnimationFrame(restoreFrame); };
  }, [pageWidth]);

  const selectPage = (page: 0 | 1 | 2) => {
    scrollTarget.current = page === selectedRef.current ? null : page;
    selectedRef.current = page;
    setSelectedPage(page);
    pager.current?.scrollTo({ x: page * pageWidth, animated: true });
  };
  const readPage = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth || resizing.current) return;
    const offset = event?.nativeEvent?.contentOffset?.x;
    if (typeof offset !== 'number') return;
    if (scrollTarget.current !== null) {
      if (Math.abs(offset - scrollTarget.current * pageWidth) > 2) return;
      scrollTarget.current = null;
    }
    const page = Math.max(0, Math.min(2, Math.round(offset / pageWidth))) as 0 | 1 | 2;
    selectedRef.current = page;
    setSelectedPage(page);
  };

  return <View style={styles.todayRoot}>
    <View style={styles.todayHeader}>
      <View style={styles.todayHeading}>
        <View style={styles.headingCopy}><Text style={[styles.todayTitle, compact && styles.todayTitleCompact]}>今日</Text><Text style={styles.todayDate}>{new Date().getMonth() + 1}月{new Date().getDate()}日 · 星期{weekdayLabels[new Date().getDay()]}</Text></View>
        <View style={styles.headingControls}><Text style={styles.wordmark}>Uncover</Text>
          <View accessibilityRole="tablist" style={styles.todayTabs}>
            {(['训练', '饮食', '跑步'] as const).map((label, index) => <Pressable key={label} accessibilityRole="tab" accessibilityLabel={'切换到' + label} accessibilityState={{ selected: selectedPage === index }} aria-selected={selectedPage === index} onPress={() => selectPage(index as 0 | 1 | 2)} style={[styles.todayTab, selectedPage === index && styles.todayTabActive]}><Text style={[styles.todayTabText, selectedPage === index && styles.todayTabTextActive]}>{label}</Text></Pressable>)}
          </View>
        </View>
      </View>
    </View>
    <View style={styles.todayPagerFrame} onLayout={event => {
      const width = event?.nativeEvent?.layout?.width;
      if (typeof width === 'number' && width > 0 && width !== pageWidth) { resizing.current = true; scrollTarget.current = null; setPageWidth(width); }
    }}>
      {pageWidth > 0 ? <ScrollView ref={pager} horizontal pagingEnabled keyboardShouldPersistTaps="handled" scrollEnabled={selectedPage !== 2} directionalLockEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={readPage} onMomentumScrollEnd={readPage} onScrollBeginDrag={() => { scrollTarget.current = null; }} onTouchStart={() => { scrollTarget.current = null; }} style={styles.todayPager} contentContainerStyle={styles.todayPagerContent}>
        <View testID="today-training-page" accessibilityElementsHidden={selectedPage !== 0} importantForAccessibility={selectedPage === 0 ? 'auto' : 'no-hide-descendants'} aria-hidden={selectedPage !== 0} style={[styles.todayPage, { width: pageWidth }]}><TodayTrainingScreen {...props} /></View>
        <View testID="today-nutrition-page" accessibilityElementsHidden={selectedPage !== 1} importantForAccessibility={selectedPage === 1 ? 'auto' : 'no-hide-descendants'} aria-hidden={selectedPage !== 1} style={[styles.todayPage, { width: pageWidth }]}><NutritionScreen embedded onBack={() => selectPage(0)} /></View>
        <View testID="today-running-page" accessibilityElementsHidden={selectedPage !== 2} importantForAccessibility={selectedPage === 2 ? 'auto' : 'no-hide-descendants'} aria-hidden={selectedPage !== 2} style={[styles.todayPage, { width: pageWidth }]}><RunScreen visible={selectedPage === 2} /></View>
      </ScrollView> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  todayDate: { color: '#B7BDBD', fontSize: 12, lineHeight: 18, marginTop: 1 },
  todayRoot: { flex: 1, minWidth: 0, backgroundColor: appPalette.background },
  todayHeader: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4, maxWidth: 440, width: '100%', alignSelf: 'center' },
  todayHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headingCopy: { flexShrink: 1 },
  headingControls: { alignItems: 'flex-end', gap: 4 },
  todayTitle: { color: '#F0F3E9', fontSize: 42, lineHeight: 48, fontWeight: '900', letterSpacing: -1.8 },
  todayTitleCompact: { fontSize: 38, lineHeight: 44 },
  wordmark: { color: '#DFE4DE', fontSize: 17, lineHeight: 20, fontWeight: '900', letterSpacing: -.6 },
  todayTabs: { width: 186, flexDirection: 'row', borderRadius: 9, borderWidth: 1, borderColor: '#323D36', backgroundColor: '#151B1C', overflow: 'hidden' },
  todayTab: { flex: 1, minHeight: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  todayTabActive: { backgroundColor: '#313E18' },
  todayTabText: { color: '#A5AEAA', fontSize: 14, fontWeight: '700' },
  todayTabTextActive: { color: appPalette.lime },
  todayPagerFrame: { flex: 1, minWidth: 0, overflow: 'hidden', maxWidth: 440, width: '100%', alignSelf: 'center' },
  todayPager: { flex: 1, minWidth: 0 },
  todayPagerContent: { alignItems: 'stretch' },
  todayPage: { height: '100%', minWidth: 0, flexShrink: 0, overflow: 'hidden' }
});
