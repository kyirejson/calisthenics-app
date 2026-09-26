import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ExercisePhoto } from '../components/ExerciseResource';
import { ProgressBar } from '../components/ui';
import { exercises } from '../data/catalog';
import {
  applyProgressionUnlock,
  getAllProgressionStatuses,
  getFinalFormProgress,
  getSeriesExercises,
  progressionGroups,
  type ProgressionStatus,
  type SeriesGroup,
} from '../data/progression';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import type { Exercise } from '../types';
import { confirmAction } from '../utils/confirm';

const auxiliaryExercises = exercises.filter((exercise) => exercise.category === 'auxiliary');

function matches(exercise: Exercise, needle: string) {
  return [exercise.name, exercise.nameEn, exercise.categoryLabel, exercise.purpose, exercise.source]
    .some((value) => value?.toLocaleLowerCase().includes(needle));
}

export function ProgressScreen({ onOpen }: { onOpen?: (exerciseId: string) => void }) {
  const { profile, sessions, saveProfile } = useAppStore();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<SeriesGroup>('六艺基础');
  const [activeSeries, setActiveSeries] = useState('push');
  const statuses = useMemo(() => profile ? getAllProgressionStatuses(profile, sessions) : [], [profile, sessions]);
  const finalProgress = getFinalFormProgress(statuses);
  const readyCount = statuses.filter((status) => status.eligible).length;
  const groups = useMemo(() => progressionGroups.map((definition) => {
    const routes = statuses.filter((status) => status.series.group === definition.key);
    return { definition, routes, finals: getFinalFormProgress(routes), auxiliary: definition.key === '关节与支援' ? auxiliaryExercises : [] };
  }), [statuses]);
  const needle = query.trim().toLocaleLowerCase();
  const group = groups.find((item) => item.definition.key === activeGroup) || groups[0];
  const wholeGroupMatches = activeGroup.toLocaleLowerCase().includes(needle);
  const visibleRoutes = !needle || wholeGroupMatches ? group.routes : group.routes.filter((status) =>
    status.series.label.toLocaleLowerCase().includes(needle)
    || getSeriesExercises(status.series.key).some((exercise) => matches(exercise, needle)),
  );
  const visibleAuxiliary = !needle || wholeGroupMatches ? group.auxiliary : group.auxiliary.filter((exercise) => matches(exercise, needle));
  const visibleKeys = [...visibleRoutes.map((status) => status.series.key), ...(visibleAuxiliary.length ? ['auxiliary'] : [])];
  const selectedKey = visibleKeys.includes(activeSeries) ? activeSeries : visibleKeys[0];
  const selectedStatus = visibleRoutes.find((status) => status.series.key === selectedKey);

  if (!profile) return null;

  const search = (value: string) => {
    setQuery(value);
    const term = value.trim().toLocaleLowerCase();
    if (!term) return;
    for (const item of groups) {
      const groupMatches = item.definition.key.toLocaleLowerCase().includes(term);
      const route = item.routes.find((status) => groupMatches || status.series.label.toLocaleLowerCase().includes(term)
        || getSeriesExercises(status.series.key).some((exercise) => matches(exercise, term)));
      if (route) { setActiveGroup(item.definition.key); setActiveSeries(route.series.key); return; }
      if (item.auxiliary.some((exercise) => matches(exercise, term))) { setActiveGroup(item.definition.key); setActiveSeries('auxiliary'); return; }
    }
  };
  const chooseGroup = (key: SeriesGroup) => {
    const next = groups.find((item) => item.definition.key === key);
    setQuery('');
    setActiveGroup(key);
    setActiveSeries(next?.routes[0]?.series.key || 'auxiliary');
  };
  const unlockNext = (status: ProgressionStatus) => {
    if (!status.eligible) return;
    const finishing = !status.next;
    confirmAction(
      finishing ? '解锁最终动作' : '解锁下一式',
      finishing
        ? `已完成 ${status.qualifiedSessions} 次专项达标。确认掌握「${status.current.name}」并解锁这条路线的终式？`
        : `已完成 ${status.qualifiedSessions} 次专项达标。确认进阶到「${status.next?.name}」？`,
      () => void saveProfile(applyProgressionUnlock(profile, status)),
      { cancelLabel: '再练一练', confirmLabel: finishing ? '确认解锁' : '确认进阶' },
    );
  };

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <View><Text style={styles.eyebrow}>动作与进阶</Text><Text style={styles.title}>进阶</Text></View>
      <View style={styles.percentBadge}><Text style={styles.percentText}>{finalProgress.percent}%</Text></View>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <View style={styles.summaryLine}><Text style={styles.summaryNumber}>{finalProgress.unlocked}<Text style={styles.summaryTotal}> / {finalProgress.total} 个终式已解锁</Text></Text>{readyCount ? <Text style={styles.readyText}>{readyCount} 条可进阶</Text> : null}</View>
        <ProgressBar value={finalProgress.percent} color={colors.lime} />
        <Text style={styles.summaryHint}>六艺以第十式为终式，其他路线以最终形态为终式；中间阶数是练习过程，不计入总解锁数。</Text>
      </View>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>动作分类</Text><Pressable accessibilityRole="button" accessibilityLabel={searchOpen ? '收起动作搜索' : '搜索动作'} onPress={() => { setSearchOpen(!searchOpen); if (searchOpen) setQuery(''); }} style={styles.searchToggle}><Text style={styles.searchToggleText}>{searchOpen ? '收起搜索' : '⌕ 搜索'}</Text></Pressable></View>
      {searchOpen ? <View style={styles.search}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput value={query} onChangeText={search} placeholder="搜索小类或动作" placeholderTextColor="#969990" style={styles.searchInput} returnKeyType="search" />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="清空搜索" onPress={() => setQuery('')} hitSlop={10}><Text style={styles.clear}>×</Text></Pressable> : null}
      </View> : null}
      <View style={styles.groupTabs}>
        {groups.map((item) => {
          const active = item.definition.key === activeGroup;
          return <Pressable key={item.definition.key} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${item.definition.key}，${item.finals.unlocked}个终式已解锁，共${item.finals.total}个`} onPress={() => chooseGroup(item.definition.key)} style={[styles.groupTab, active && styles.groupTabActive]}>
            <Text style={[styles.groupIcon, active && styles.groupTextActive]}>{item.definition.icon}</Text>
            <Text style={[styles.groupName, active && styles.groupTextActive]} numberOfLines={1}>{item.definition.key}</Text>
            <Text style={[styles.groupCount, active && styles.groupCountActive]}>{item.finals.unlocked}/{item.finals.total}</Text>
          </Pressable>;
        })}
      </View>
      <View style={styles.seriesHeading}><Text style={styles.seriesHeadingTitle}>动作方向</Text><Text style={styles.seriesHint}>左右滑动</Text></View>
      {visibleKeys.length ? <View style={styles.seriesWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seriesRow}>
          {visibleRoutes.map((status) => <Pressable key={status.series.key} accessibilityRole="button" accessibilityState={{ selected: selectedKey === status.series.key }} onPress={() => setActiveSeries(status.series.key)} style={[styles.seriesChip, selectedKey === status.series.key && styles.seriesChipActive]}><Text style={[styles.seriesChipText, selectedKey === status.series.key && styles.seriesChipTextActive]}>{status.series.label}</Text>{status.complete ? <Text style={styles.seriesDone}>✓</Text> : null}</Pressable>)}
          {visibleAuxiliary.length ? <Pressable accessibilityRole="button" accessibilityState={{ selected: selectedKey === 'auxiliary' }} onPress={() => setActiveSeries('auxiliary')} style={[styles.seriesChip, selectedKey === 'auxiliary' && styles.seriesChipActive]}><Text style={[styles.seriesChipText, selectedKey === 'auxiliary' && styles.seriesChipTextActive]}>辅助训练</Text></Pressable> : null}
        </ScrollView>
        <LinearGradient pointerEvents="none" colors={['rgba(245,243,237,0)', colors.paper]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.seriesFade} />
      </View> : <Text style={styles.empty}>没有找到相关动作</Text>}
      {selectedStatus ? <RouteDetail status={selectedStatus} onOpen={onOpen} onUnlock={() => unlockNext(selectedStatus)} /> : selectedKey === 'auxiliary' ? <View style={styles.routeCard}>
        <Text style={styles.routeTitle}>辅助训练</Text><Text style={styles.auxNote}>用于支撑基础训练，不计入终式解锁。</Text>
        <View style={styles.stageList}>{visibleAuxiliary.map((exercise, index) => <ActionRow key={exercise.id} exercise={exercise} index={index + 1} badge="辅助" onPress={() => onOpen?.(exercise.id)} />)}</View>
      </View> : null}
    </ScrollView>
  </SafeAreaView>;
}

function RouteDetail({ status, onOpen, onUnlock }: {
  status: ProgressionStatus;
  onOpen?: (exerciseId: string) => void;
  onUnlock: () => void;
}) {
  const sequence = getSeriesExercises(status.series.key);
  const finalAction = sequence[status.totalLevels - 1];
  const routeStages = sequence.slice(0, status.totalLevels);
  const extensions = sequence.slice(status.totalLevels);
  return <View style={styles.routeCard}>
    <View style={styles.routeHead}><Text style={styles.routeTitle}>{status.series.label}</Text><Text style={[styles.routeState, status.complete && styles.routeStateDone]}>{status.complete ? '终式已解锁' : `当前第 ${status.level}/${status.totalLevels} 式`}</Text></View>
    <View style={styles.finalCard}><View style={styles.finalCopy}><Text style={styles.finalLabel}>最终解锁动作</Text><Text style={styles.finalName}>{finalAction.name}</Text></View><Text style={[styles.finalMark, status.complete && styles.finalMarkDone]}>{status.complete ? '已解锁' : '待解锁'}</Text></View>
    <View style={styles.listHeader}><Text style={styles.listTitle}>阶数动作</Text><Text style={styles.listCount}>{routeStages.length} 式</Text></View>
    <View style={styles.stageList}>{routeStages.map((exercise, index) => {
      const isFinal = index === routeStages.length - 1;
      const badge = status.complete && isFinal ? '终式已解锁'
        : status.complete || index < status.level - 1 ? '已通过'
        : index === status.level - 1 ? isFinal ? '终式待验收' : '当前阶' : '待解锁';
      return <ActionRow key={exercise.id} exercise={exercise} index={index + 1} badge={badge} current={!status.complete && index === status.level - 1} final={isFinal} onPress={() => onOpen?.(exercise.id)} />;
    })}</View>
    {!status.complete ? <View style={styles.currentCard}>
      <View style={styles.currentTop}><Text style={styles.currentLabel}>当前验收 · {status.current.name}</Text><Text style={styles.currentCount}>{status.qualifiedSessions}/{status.requiredSessions}</Text></View>
      <Text style={styles.criteria}>{status.criteria.display}</Text>
      <Text style={styles.currentNote}>需两次专项无痛达标，间隔至少 24 小时；通过后可确认进阶。点击上方任一动作也可直接设为当前训练阶。</Text>
      {status.eligible ? <Pressable accessibilityRole="button" onPress={onUnlock} style={styles.unlockButton}><Text style={styles.unlockText}>{status.next ? '解锁下一式' : '解锁最终动作'}  ›</Text></Pressable> : null}
    </View> : null}
    {extensions.length ? <><View style={styles.extensionHeader}><Text style={styles.extensionTitle}>拓展动作</Text><Text style={styles.extensionHint}>不计入终式解锁 · 可自行选练</Text></View><View style={styles.stageList}>{extensions.map((exercise) => <ActionRow key={exercise.id} exercise={exercise} index={exercise.step || 0} badge="拓展" onPress={() => onOpen?.(exercise.id)} />)}</View></> : null}
  </View>;
}

function ActionRow({ exercise, index, badge, current = false, final = false, onPress }: {
  exercise: Exercise;
  index: number;
  badge: string;
  current?: boolean;
  final?: boolean;
  onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`第${index}式${exercise.name}，${badge}`} onPress={onPress} style={[styles.actionRow, current && styles.actionRowCurrent]}>
    <Text style={styles.actionStep}>{String(index).padStart(2, '0')}</Text>
    <View style={styles.actionPhotoWrap}><ExercisePhoto exercise={exercise} resizeMode="contain" showShade={false} showTag={false} compact style={styles.actionPhoto} /></View>
    <Text style={[styles.actionName, final && styles.actionNameFinal]} numberOfLines={2}>{exercise.name}</Text>
    <Text style={[styles.actionBadge, current && styles.actionBadgeCurrent, badge === '终式已解锁' && styles.actionBadgeDone]}>{badge}</Text>
    <Text style={styles.actionArrow}>›</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 20, paddingTop: 13, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: colors.inkMuted, fontSize: 11, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', marginTop: 3 },
  percentBadge: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  percentText: { color: colors.lime, fontSize: 16, fontWeight: '900' },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  summary: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: 18 },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  summaryNumber: { color: '#FFFFFF', fontSize: 27, fontWeight: '900' },
  summaryTotal: { color: '#B8BDB2', fontSize: 12, fontWeight: '600' },
  readyText: { color: colors.lime, fontSize: 11, fontWeight: '800' },
  summaryHint: { color: '#B8BDB2', fontSize: 11, lineHeight: 17, marginTop: 11 },
  search: { height: 48, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12 },
  searchIcon: { color: colors.inkMuted, fontSize: 24, marginRight: 8 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14 },
  clear: { color: colors.inkMuted, fontSize: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 25, marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  searchToggle: { minHeight: 30, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  searchToggleText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  groupTabs: { flexDirection: 'row', gap: 6 },
  groupTab: { flex: 1, minWidth: 0, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, paddingVertical: 10, paddingHorizontal: 2 },
  groupTabActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  groupIcon: { color: colors.green, fontSize: 19, fontWeight: '900' },
  groupName: { color: colors.ink, fontSize: 10, fontWeight: '900', marginTop: 4 },
  groupTextActive: { color: colors.lime },
  groupCount: { color: colors.inkMuted, fontSize: 9, marginTop: 4 },
  groupCountActive: { color: '#CDD9AC' },
  seriesHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 23, marginBottom: 10 },
  seriesHeadingTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  seriesHint: { color: colors.inkMuted, fontSize: 10 },
  seriesRow: { gap: 8, paddingRight: 20, paddingBottom: 4 },
  seriesWrap: { position: 'relative' },
  seriesFade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 26 },
  seriesChip: { minHeight: 34, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  seriesChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  seriesChipText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  seriesChipTextActive: { color: '#FFFFFF' },
  seriesDone: { color: colors.lime, fontSize: 11, fontWeight: '900' },
  empty: { color: colors.inkMuted, textAlign: 'center', paddingVertical: 32 },
  routeCard: { marginTop: 17, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 15 },
  routeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  routeTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  routeState: { color: colors.green, fontSize: 10, fontWeight: '900' },
  routeStateDone: { color: colors.limeDark },
  finalCard: { backgroundColor: '#EEF3DB', borderRadius: radius.md, padding: 13, marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  finalCopy: { flex: 1 },
  finalLabel: { color: colors.green, fontSize: 10, fontWeight: '900' },
  finalName: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 3 },
  finalMark: { color: colors.inkMuted, fontSize: 10, fontWeight: '800' },
  finalMarkDone: { color: colors.green },
  currentCard: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 15 },
  currentTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  currentLabel: { color: colors.ink, fontSize: 12, fontWeight: '900', flex: 1 },
  currentCount: { color: colors.limeDark, fontSize: 12, fontWeight: '900' },
  criteria: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 6 },
  currentNote: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: 7 },
  unlockButton: { backgroundColor: colors.lime, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start', marginTop: 11 },
  unlockText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 7 },
  listTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  listCount: { color: colors.inkMuted, fontSize: 10 },
  stageList: { borderTopWidth: 1, borderTopColor: colors.line },
  actionRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, paddingVertical: 7 },
  actionRowCurrent: { backgroundColor: '#F4F8EA' },
  actionStep: { color: colors.limeDark, fontSize: 11, fontWeight: '900', width: 23 },
  actionPhotoWrap: { width: 48, height: 48, borderRadius: 9, overflow: 'hidden', backgroundColor: '#F0F0EA' },
  actionPhoto: { backgroundColor: '#F0F0EA' },
  actionName: { color: colors.ink, fontSize: 12, fontWeight: '800', flex: 1 },
  actionNameFinal: { fontWeight: '900' },
  actionBadge: { color: colors.inkMuted, fontSize: 9, fontWeight: '800' },
  actionBadgeCurrent: { color: colors.green },
  actionBadgeDone: { color: colors.green },
  actionArrow: { color: colors.inkMuted, fontSize: 19 },
  auxNote: { color: colors.inkMuted, fontSize: 11, marginTop: 7, marginBottom: 14 },
  extensionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 19, marginBottom: 7 },
  extensionTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  extensionHint: { color: colors.inkMuted, fontSize: 9, flexShrink: 1 },
});
