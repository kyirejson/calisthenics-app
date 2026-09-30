import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { ExerciseMedia } from '../components/ExerciseResource';
import { ProgressionArtworkViewer } from '../components/ProgressionArtworkViewer';
import { useReducedMotion, useRouteReveal } from '../components/useProgressMotion';
import { exercises } from '../data/catalog';
import {
  applyProgressionUnlock, getAllProgressionStatuses, getFinalFormProgress, getProgressionStageState,
  getSeriesExercises, progressionGroups, type ProgressionStatus, type SeriesGroup,
} from '../data/progression';
import { useAppStore } from '../store/AppStore';
import type { Exercise } from '../types';
import { confirmAction, showMessage } from '../utils/confirm';
import { progressPageLayout } from '../theme';

const palette = { bg: progressPageLayout.background, card: '#1B2028', soft: '#222833', line: '#343C48', text: '#F4F6FA', muted: '#A8B1BF', faint: '#818D9F', lime: '#C7F548' };
const ringSize = progressPageLayout.summaryRingSize;
const ringCenter = ringSize / 2, ringRadius = ringCenter - 5, ringCircumference = 2 * Math.PI * ringRadius;
// Retain the retired ID for old logs; do not offer the replaced double-leg plan.
const auxiliaryExercises = exercises.filter(exercise => exercise.category === 'auxiliary' && exercise.id !== 'aux_calfBeginner');

function matches(exercise: Exercise, needle: string) {
  return [exercise.name, exercise.nameEn, exercise.categoryLabel, exercise.purpose, exercise.source]
    .some(value => value?.toLocaleLowerCase().includes(needle));
}

export function ProgressScreen({ onOpen }: { onOpen?: (exerciseId: string) => void }) {
  const { profile, sessions, saveProfile } = useAppStore();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<SeriesGroup>('六艺基础');
  const [activeSeries, setActiveSeries] = useState('push');
  const [artwork, setArtwork] = useState<Exercise | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const reduced = useReducedMotion();
  const statuses = useMemo(() => profile ? getAllProgressionStatuses(profile, sessions) : [], [profile, sessions]);
  const live = useRef({ profile, statuses });
  live.current = { profile, statuses };
  const finalProgress = getFinalFormProgress(statuses);
  const groups = useMemo(() => progressionGroups.map(definition => {
    const routes = statuses.filter(status => status.series.group === definition.key);
    return { definition, routes, finals: getFinalFormProgress(routes), auxiliary: definition.key === '关节与支援' ? auxiliaryExercises : [] };
  }), [statuses]);
  const needle = query.trim().toLocaleLowerCase();
  const group = groups.find(item => item.definition.key === activeGroup) || groups[0];
  const wholeGroupMatches = activeGroup.toLocaleLowerCase().includes(needle);
  const visibleRoutes = !needle || wholeGroupMatches ? group.routes : group.routes.filter(status =>
    status.series.label.toLocaleLowerCase().includes(needle) || getSeriesExercises(status.series.key).some(exercise => matches(exercise, needle)));
  const visibleAuxiliary = !needle || wholeGroupMatches ? group.auxiliary : group.auxiliary.filter(exercise => matches(exercise, needle));
  const visibleKeys = [...visibleRoutes.map(status => status.series.key), ...(visibleAuxiliary.length ? ['auxiliary'] : [])];
  const selectedKey = visibleKeys.includes(activeSeries) ? activeSeries : visibleKeys[0];
  const selectedStatus = visibleRoutes.find(status => status.series.key === selectedKey);
  const reveal = useRouteReveal((selectedKey || 'empty') + ':' + (selectedStatus?.level || 0), reduced);

  if (!profile) return null;

  const search = (value: string) => {
    setQuery(value);
    const term = value.trim().toLocaleLowerCase();
    if (!term) return;
    for (const item of groups) {
      const route = item.routes.find(status => item.definition.key.toLocaleLowerCase().includes(term)
        || status.series.label.toLocaleLowerCase().includes(term)
        || getSeriesExercises(status.series.key).some(exercise => matches(exercise, term)));
      if (route) { setActiveGroup(item.definition.key); setActiveSeries(route.series.key); return; }
      if (item.auxiliary.some(exercise => matches(exercise, term))) { setActiveGroup(item.definition.key); setActiveSeries('auxiliary'); return; }
    }
  };
  const chooseGroup = (key: SeriesGroup) => {
    const next = groups.find(item => item.definition.key === key);
    setQuery(''); setActiveGroup(key); setActiveSeries(next?.routes[0]?.series.key || 'auxiliary');
    // Selection is intentional; no delayed automatic jump while scrolling.
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const unlockNext = (status: ProgressionStatus) => {
    if (!status.eligible || savingRef.current) return;
    const finishing = !status.next;
    confirmAction(finishing ? '解锁最终动作' : '解锁下一式',
      finishing ? '两次专项验收已达标，确认掌握「' + status.current.name + '」？'
        : '两次专项验收已达标，确认进阶到「' + status.next?.name + '」？',
      () => {
        const current = live.current.statuses.find(item => item.series.key === status.series.key);
        const latestProfile = live.current.profile;
        if (savingRef.current || !latestProfile || !current?.eligible || current.current.id !== status.current.id) return;
        savingRef.current = true; setSaving(true);
        void saveProfile(applyProgressionUnlock(latestProfile, current))
          .then(() => showMessage('已更新进阶', finishing ? '终式已解锁' : '下一式已解锁'))
          .catch(() => showMessage('保存失败', '进阶未保存，请重试。'))
          .finally(() => { savingRef.current = false; setSaving(false); });
      }, { cancelLabel: '再练一练', confirmLabel: finishing ? '确认解锁' : '确认进阶' });
  };

  return <SafeAreaView style={styles.safe} testID="progression-screen">
    <ScrollView ref={scroll} testID="progression-list" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headingCopy}><Text style={styles.title}>进阶路线</Text><Text style={styles.subtitle}><Text style={styles.subtitleCount}>{finalProgress.unlocked}</Text> / {finalProgress.total} 个终式已解锁</Text></View>
        <View accessibilityRole="progressbar" accessibilityLabel={'终式解锁进度，' + finalProgress.unlocked + '个，共' + finalProgress.total + '个'} accessibilityValue={{ min: 0, max: 100, now: finalProgress.percent }} testID="progression-final-ring" style={styles.ring}>
          <Svg width={ringSize} height={ringSize} viewBox={'0 0 ' + ringSize + ' ' + ringSize} pointerEvents="none"><Circle cx={ringCenter} cy={ringCenter} r={ringRadius} fill="none" stroke="#33411F" strokeWidth={5} />{finalProgress.unlocked > 0 ? <Circle cx={ringCenter} cy={ringCenter} r={ringRadius} fill="none" stroke={palette.lime} strokeWidth={5} strokeLinecap="round" strokeDasharray={ringCircumference} strokeDashoffset={ringCircumference * (1 - finalProgress.unlocked / finalProgress.total)} rotation={-90} origin={ringCenter + ',' + ringCenter} /> : null}</Svg>
          <View pointerEvents="none" style={styles.ringCopy}><Text style={styles.percent}>{finalProgress.percent}%</Text><Text style={styles.ringLabel}>终式解锁</Text></View>
        </View>
      </View>

      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>动作分类</Text><View style={styles.tools}><Pressable accessibilityRole="button" accessibilityLabel="查看进阶规则" accessibilityState={{ expanded: rulesOpen }} onPress={() => setRulesOpen(!rulesOpen)} style={styles.tool}><Text style={styles.toolText}>?</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={searchOpen ? '收起动作搜索' : '搜索动作'} onPress={() => { setSearchOpen(!searchOpen); if (searchOpen) setQuery(''); }} style={styles.tool}><Glyph name="search" color={searchOpen ? palette.lime : palette.muted} size={20} /></Pressable></View></View>
      {rulesOpen ? <View style={styles.rules} testID="progression-rules"><Text style={styles.rulesTitle}>设阶确认 · 记录验收</Text><Text style={styles.rulesText}>选择较高阶，低阶即视为已通过。当前阶需两次专项达标，间隔至少24小时，才会点亮记录验收与进阶按钮。</Text><Text style={styles.rulesText}>六艺以第十式为终式；拓展动作不增加终式数量。设阶不生成训练记录，也不代替动作安全评估。</Text></View> : null}
      {searchOpen ? <View style={styles.search}><Glyph name="search" color={palette.faint} size={19} /><TextInput testID="progression-search" accessibilityLabel="搜索小类或动作" value={query} onChangeText={search} placeholder="搜索小类或动作" placeholderTextColor={palette.faint} style={styles.searchInput} returnKeyType="search" />{query ? <Pressable accessibilityRole="button" accessibilityLabel="清空动作搜索" onPress={() => setQuery('')} style={styles.tool}><Text style={styles.close}>×</Text></Pressable> : null}</View> : null}
      <View style={styles.groupTabs}>
        {groups.map(item => {
          const active = item.definition.key === activeGroup;
          return <Pressable key={item.definition.key} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={'查看' + item.definition.key + '分类'} onPress={() => chooseGroup(item.definition.key)} style={({ pressed }) => [styles.groupTab, active && styles.groupActive, pressed && styles.pressed]}><Text style={[styles.groupName, active && styles.groupNameActive]} numberOfLines={1}>{item.definition.key}</Text><Text style={[styles.groupCount, active && styles.groupCountActive]}>{item.finals.unlocked} / {item.finals.total}</Text></Pressable>;
        })}
      </View>
      {visibleKeys.length ? <View style={styles.seriesWrap}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seriesRow}>
        {visibleRoutes.map(status => <Pressable key={status.series.key} accessibilityRole="button" accessibilityState={{ selected: selectedKey === status.series.key }} accessibilityLabel={'选择' + status.series.label + '进阶路线'} onPress={() => setActiveSeries(status.series.key)} style={({ pressed }) => [styles.seriesChip, selectedKey === status.series.key && styles.seriesActive, pressed && styles.pressed]}><Text style={[styles.seriesText, selectedKey === status.series.key && styles.seriesTextActive]}>{status.series.label}</Text>{status.complete ? <Glyph name="check" color={selectedKey === status.series.key ? palette.lime : palette.muted} size={13} /> : null}</Pressable>)}
        {visibleAuxiliary.length ? <Pressable accessibilityRole="button" accessibilityState={{ selected: selectedKey === 'auxiliary' }} accessibilityLabel="选择辅助训练分类" onPress={() => setActiveSeries('auxiliary')} style={[styles.seriesChip, selectedKey === 'auxiliary' && styles.seriesActive]}><Text style={[styles.seriesText, selectedKey === 'auxiliary' && styles.seriesTextActive]}>辅助训练</Text></Pressable> : null}
      </ScrollView><LinearGradient pointerEvents="none" colors={['rgba(13,15,18,0)', palette.bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.seriesFade} /></View> : <View style={styles.empty}><Text style={styles.emptyTitle}>没有找到相关动作</Text><Text style={styles.emptyNote}>换个名称，或清空搜索查看路线。</Text></View>}

      <Animated.View testID="progression-route-reveal" style={{ opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
        {selectedStatus ? <RouteDetail key={selectedKey} status={selectedStatus} onOpen={onOpen} onArtwork={setArtwork} onUnlock={() => unlockNext(selectedStatus)} saving={saving} /> : selectedKey === 'auxiliary' ? <View style={styles.route}>
          <View style={styles.routeHead}><Text style={styles.routeTitle}>辅助训练</Text><Text style={styles.routeState}>不计入终式</Text></View>
          {visibleAuxiliary.map((exercise, index) => <ActionRow key={exercise.id} exercise={exercise} index={index} badge="辅助" state="upcoming" rail={false} onOpen={onOpen} onArtwork={setArtwork} />)}
        </View> : null}
      </Animated.View>
    </ScrollView>
    <ProgressionArtworkViewer exercise={artwork} onClose={() => setArtwork(null)} onOpen={onOpen} reduceMotion={reduced} />
  </SafeAreaView>;
}

function RouteDetail({ status, onOpen, onArtwork, onUnlock, saving }: {
  status: ProgressionStatus; onOpen?: (id: string) => void; onArtwork: (exercise: Exercise) => void; onUnlock: () => void; saving: boolean;
}) {
  const [passedExpanded, setPassedExpanded] = useState(false);
  const [extensionsOpen, setExtensionsOpen] = useState(false);
  const [examHelp, setExamHelp] = useState(false);
  const sequence = getSeriesExercises(status.series.key);
  const stages = sequence.slice(0, status.totalLevels);
  const finalAction = stages[stages.length - 1];
  const extensions = sequence.slice(status.totalLevels);
  const passedCount = status.complete ? stages.length : status.level - 1;
  const visibleFrom = passedExpanded ? 0 : status.complete ? Math.max(0, passedCount - 2) : passedCount;
  const currentStage = (exercise: Exercise, index: number) => <View key={exercise.id} style={styles.routeRow} testID="progression-current-stage">
    <View style={styles.rail}><View style={styles.railLine} /><View style={[styles.node, styles.nodeCurrent]}><View style={styles.nodeDot} /></View></View>
    <View style={styles.currentCard}>
      <LinearGradient pointerEvents="none" colors={['rgba(199,245,72,0.10)', 'rgba(199,245,72,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.currentTop}><Text style={styles.currentKicker}>第 {index + 1} 式 · {index + 1 === stages.length ? '终式待验收' : '当前阶'}</Text><Glyph name={index + 1 === stages.length ? 'crown' : 'shield'} color={palette.lime} size={21} /></View>
      <View style={styles.currentMain}><PhotoButton exercise={exercise} size="large" onArtwork={onArtwork} /><Pressable accessibilityRole="button" accessibilityLabel={'查看第' + (index + 1) + '式' + exercise.name + '动作指导'} onPress={() => onOpen?.(exercise.id)} style={styles.currentCopy}><Text style={styles.currentName}>{exercise.name}</Text><Text style={styles.guideLink}>动作指导  ›</Text></Pressable></View>
      <Text testID="progression-current-standard" style={styles.criteria}>{status.criteria.display}</Text>
      <View style={styles.examRow}><Pressable accessibilityRole="button" accessibilityLabel="查看当前阶验收条件" accessibilityState={{ expanded: examHelp }} onPress={() => setExamHelp(!examHelp)} style={styles.examHelp}><View style={styles.pips}>{Array.from({ length: status.requiredSessions }, (_, pip) => <View key={pip} style={[styles.pip, pip < status.qualifiedSessions && styles.pipDone]}>{pip < status.qualifiedSessions ? <Glyph name="check" color={palette.bg} size={11} /> : null}</View>)}</View><Text testID="progression-exam-count" style={styles.examCount}>专项验收 {status.qualifiedSessions}/{status.requiredSessions}</Text><Text style={styles.helpMark}>?</Text></Pressable>{status.eligible ? <Text style={styles.ready}>可进阶</Text> : null}</View>
      {examHelp ? <View style={styles.examNote}><Text style={styles.examNoteText}>两次按升级标准完成的专项课，间隔至少24小时，反馈为动作扎实且无痛；未完成或未反馈不算验收。</Text>{status.criteria.manual ? <Text style={styles.examNoteText}>{status.criteria.confirmationHint || '还需确认侧别、负重或其他动作条件均已满足。'}</Text> : null}</View> : null}
      <Pressable testID="progression-current-action" accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} accessibilityLabel={status.eligible ? status.next ? '解锁下一式' : '解锁最终动作' : '查看当前阶练习与验收'} disabled={saving} onPress={status.eligible ? onUnlock : () => onOpen?.(exercise.id)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, saving && styles.disabled]}>{saving ? <ActivityIndicator color={palette.bg} size="small" /> : <Text style={styles.primaryText}>{status.eligible ? status.next ? '解锁下一式' : '解锁最终动作' : '练习与验收'}  ›</Text>}</Pressable>
    </View>
  </View>;

  return <View style={styles.route}>
    <View style={styles.routeHead}><Text style={styles.routeTitle}>{status.series.label}</Text><Text style={styles.routeState}>{status.complete ? '终式已解锁' : '第 ' + status.level + ' / ' + status.totalLevels + ' 式'}</Text></View>
    <View style={styles.goalRow}><View style={styles.goalRail}><Glyph name="crown" size={26} color={palette.lime} /></View><View style={[styles.goalCard, status.complete && styles.goalComplete]}><PhotoButton exercise={finalAction} size="goal" onArtwork={onArtwork} /><Pressable accessibilityRole="button" accessibilityLabel={'查看终式' + finalAction.name + '动作指导'} onPress={() => onOpen?.(finalAction.id)} style={styles.goalCopy}><Text style={styles.goalLabel}>{status.complete ? '终式 · 已解锁' : '终式目标 · 第 ' + status.totalLevels + ' 式'}</Text><Text style={styles.goalName}>{finalAction.name}</Text></Pressable><Glyph name={status.complete ? 'shield' : 'chevron'} color={status.complete ? palette.lime : palette.faint} size={21} /></View></View>
    <View style={styles.listHeading}><Text style={styles.listTitle}>阶数动作</Text>{passedCount ? <Pressable accessibilityRole="button" accessibilityLabel={passedExpanded ? '收起已通过阶数' : '展开全部已通过阶数'} accessibilityState={{ expanded: passedExpanded }} onPress={() => setPassedExpanded(!passedExpanded)} style={styles.fold}><Text style={styles.foldText}>{passedCount} 式已通过</Text><Text style={styles.foldArrow}>{passedExpanded ? '⌃' : '⌄'}</Text></Pressable> : <Text style={styles.listCount}>从当前阶开始</Text>}</View>
    {stages.slice(visibleFrom).map((exercise, offset) => {
      const index = offset + visibleFrom;
      const state = getProgressionStageState(status, index);
      return state === 'current' ? currentStage(exercise, index) : <ActionRow key={exercise.id} exercise={exercise} index={index} state={state} badge={status.complete && index === stages.length - 1 ? '终式已解锁' : state === 'passed' ? '已通过' : '待解锁'} onOpen={onOpen} onArtwork={onArtwork} />;
    })}
    {extensions.length ? <View style={styles.extensions}><Pressable accessibilityRole="button" accessibilityLabel={extensionsOpen ? '收起拓展动作' : '展开拓展动作'} accessibilityState={{ expanded: extensionsOpen }} onPress={() => setExtensionsOpen(!extensionsOpen)} style={styles.extensionToggle}><View><Text style={styles.listTitle}>拓展动作</Text><Text style={styles.extensionNote}>不计入终式解锁</Text></View><Text style={styles.extensionCount}>{extensions.length} 个  {extensionsOpen ? '⌃' : '⌄'}</Text></Pressable>{extensionsOpen ? extensions.map(exercise => <ActionRow key={exercise.id} exercise={exercise} index={(exercise.step || 1) - 1} state="upcoming" badge="拓展" rail={false} onOpen={onOpen} onArtwork={onArtwork} />) : null}</View> : null}
  </View>;
}

function ActionRow({ exercise, index, badge, state, rail = true, onOpen, onArtwork }: {
  exercise: Exercise; index: number; badge: string; state: 'passed' | 'upcoming'; rail?: boolean;
  onOpen?: (id: string) => void; onArtwork: (exercise: Exercise) => void;
}) {
  const passed = state === 'passed';
  return <View style={styles.routeRow} testID={'progression-stage-' + exercise.id}>
    {rail ? <View style={styles.rail}><View style={styles.railLine} /><View style={[styles.node, passed && styles.nodePassed]}><Glyph name={passed ? 'shield' : 'lock'} size={19} color={passed ? palette.lime : palette.faint} /></View></View> : null}
    <View style={[styles.actionCard, !rail && styles.auxCard]}><PhotoButton exercise={exercise} size="small" onArtwork={onArtwork} /><Pressable accessibilityRole="button" accessibilityLabel={(rail ? '查看第' + (index + 1) + '式' : '查看') + exercise.name + '动作指导，' + badge} onPress={() => onOpen?.(exercise.id)} style={styles.actionCopy}><Text style={styles.stepLabel}>{rail ? '第 ' + (index + 1) + ' 式' : badge}</Text><Text style={styles.actionName}>{exercise.name}</Text><Text style={[styles.stageBadge, passed && styles.stageBadgePassed]}>{badge}</Text></Pressable><Glyph name={passed ? 'check' : 'chevron'} color={passed ? palette.lime : palette.faint} size={17} /></View>
  </View>;
}

function PhotoButton({ exercise, size, onArtwork }: { exercise: Exercise; size: 'small' | 'large' | 'goal'; onArtwork: (exercise: Exercise) => void }) {
  const width = size === 'large' ? 104 : size === 'goal' ? 68 : 82;
  return <Pressable accessibilityRole="button" accessibilityLabel={'放大查看' + exercise.name + '动作配图'} onPress={() => onArtwork(exercise)} style={styles.photo}><ExerciseMedia exercise={exercise} width={width} minHeight={size === 'goal' ? 44 : 56} maxHeight={size === 'large' ? 126 : 98} /><View pointerEvents="none" style={styles.photoZoom}><Glyph name="expand" size={11} color="#F2F5F9" /></View></Pressable>;
}

function Glyph({ name, color, size = 20 }: { name: 'crown' | 'shield' | 'lock' | 'check' | 'chevron' | 'expand' | 'search'; color: string; size?: number }) {
  const paths = {
    crown: 'M3 7l4 4 5-7 5 7 4-4-2 11H5L3 7zm3 14h12',
    shield: 'M12 2l8 4v7c0 4-5 7-8 9-3-2-8-5-8-9V6l8-4zm-4 10 3 3 5-6',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M6 10h12v11H6V10zm6 5v2',
    check: 'M4 12l5 5L20 6',
    chevron: 'M9 5l7 7-7 7',
    expand: 'M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6',
    search: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none"><Path d={paths[name]} stroke={color} fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg }, content: progressPageLayout.content,
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#292F38', gap: 12 },
  headingCopy: { flex: 1 }, title: { ...progressPageLayout.title, color: palette.text }, subtitle: { color: palette.muted, fontSize: 11, marginTop: 4 }, subtitleCount: { color: palette.lime, fontWeight: '900' },
  ring: { width: ringSize, height: ringSize }, ringCopy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' }, percent: { color: palette.text, fontSize: 18, fontWeight: '800' }, ringLabel: { color: palette.muted, fontSize: 9, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 7 }, sectionTitle: { ...progressPageLayout.sectionTitle, color: palette.text },
  tools: { flexDirection: 'row', gap: 2 }, tool: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, toolText: { color: palette.muted, borderColor: palette.faint, borderWidth: 1, borderRadius: 10, width: 18, height: 18, textAlign: 'center', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  rules: { backgroundColor: palette.card, borderRadius: 16, padding: 15, marginBottom: 13 }, rulesTitle: { color: palette.lime, fontSize: 13, fontWeight: '800' }, rulesText: { color: palette.muted, fontSize: 12, lineHeight: 20, marginTop: 7 },
  search: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card, flexDirection: 'row', alignItems: 'center', paddingLeft: 12, marginBottom: 12, gap: 8 },
  searchInput: { flex: 1, color: palette.text, fontSize: 14, minWidth: 0, paddingVertical: 12 }, close: { color: palette.muted, fontSize: 24 },
  groupTabs: { flexDirection: 'row', gap: 6 }, groupTab: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: palette.line, borderRadius: 16, backgroundColor: palette.card, paddingVertical: 10, alignItems: 'center', minHeight: 54 },
  groupActive: { backgroundColor: palette.lime, borderColor: palette.lime }, groupName: { color: '#BAC3D0', fontSize: 12, fontWeight: '800' }, groupNameActive: { color: '#151A0A' }, groupCount: { color: palette.faint, fontSize: 10, marginTop: 4, fontWeight: '600' }, groupCountActive: { color: '#4D601B' },
  seriesWrap: { position: 'relative', marginTop: 12 }, seriesRow: { gap: 7, paddingRight: 23, paddingVertical: 3 }, seriesChip: { minHeight: 44, paddingHorizontal: 15, borderRadius: 24, backgroundColor: '#171C23', borderWidth: 1, borderColor: '#292F38', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  seriesActive: { backgroundColor: '#29351C', borderColor: '#697F36' }, seriesText: { ...progressPageLayout.controlText, color: palette.muted }, seriesTextActive: { color: palette.lime }, seriesFade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 21 },
  empty: { paddingVertical: 45, alignItems: 'center' }, emptyTitle: { color: palette.text, fontSize: 16, fontWeight: '700' }, emptyNote: { color: palette.muted, fontSize: 12, marginTop: 8 },
  route: { marginTop: 20 }, routeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 13 }, routeTitle: { ...progressPageLayout.sectionTitle, color: palette.text }, routeState: { color: palette.muted, fontSize: 11 },
  goalRow: { flexDirection: 'row', gap: 10, alignItems: 'center' }, goalRail: { width: 26, alignItems: 'center' }, goalCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 92, backgroundColor: '#1C222A', borderRadius: progressPageLayout.cardRadius, borderWidth: 1, borderColor: '#3E4B36', padding: 12 },
  goalComplete: { borderColor: '#738A3E', backgroundColor: '#202A19' }, goalCopy: { flex: 1, minHeight: 48, justifyContent: 'center' }, goalLabel: { color: '#A9C47B', fontSize: 10, fontWeight: '600' }, goalName: { ...progressPageLayout.actionTitle, color: palette.text, marginTop: 6 },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 5, minHeight: 44 }, listTitle: { ...progressPageLayout.sectionTitle, color: palette.text }, listCount: { color: palette.faint, fontSize: 11 },
  fold: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 7, paddingHorizontal: 10 }, foldText: { color: '#B9D888', fontSize: 11 }, foldArrow: { color: palette.lime, fontSize: 16 },
  routeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 }, rail: { width: 26, alignItems: 'center' }, railLine: { position: 'absolute', width: 2, top: 0, bottom: -12, backgroundColor: '#343B45' },
  node: { width: 26, height: 34, borderRadius: 12, marginTop: 25, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }, nodePassed: { backgroundColor: '#172017' }, nodeCurrent: { backgroundColor: '#263A17', borderWidth: 1, borderColor: '#667F32', height: 26 }, nodeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.lime },
  actionCard: { flex: 1, minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: palette.card, borderRadius: progressPageLayout.cardRadius, borderWidth: 1, borderColor: palette.line, padding: 11 }, auxCard: { minHeight: 100 },
  actionCopy: { flex: 1, minHeight: 70, justifyContent: 'center' }, stepLabel: { color: palette.faint, fontSize: 10 }, actionName: { ...progressPageLayout.actionTitle, color: palette.text, marginTop: 5 }, stageBadge: { color: palette.faint, fontSize: 10, marginTop: 6 }, stageBadgePassed: { color: '#B5D386' },
  photo: { position: 'relative', borderRadius: 12, overflow: 'hidden', backgroundColor: '#171C22', flexShrink: 0 }, photoZoom: { position: 'absolute', right: 4, bottom: 4, borderRadius: 5, backgroundColor: 'rgba(13,15,18,0.58)', padding: 3 },
  currentCard: { flex: 1, overflow: 'hidden', padding: 14, borderRadius: progressPageLayout.cardRadius, borderWidth: 1.5, borderColor: palette.lime, backgroundColor: '#1F2721', shadowColor: palette.lime, shadowOpacity: 0.13, shadowOffset: { width: 0, height: 0 }, shadowRadius: 10 },
  currentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 13 }, currentKicker: { color: palette.lime, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  currentMain: { flexDirection: 'row', alignItems: 'center', gap: 13 }, currentCopy: { flex: 1, minHeight: 74, justifyContent: 'center' }, currentName: { ...progressPageLayout.actionTitle, color: palette.text }, guideLink: { color: '#AAC87A', fontSize: 11, marginTop: 9 },
  criteria: { color: '#DAE5C8', fontSize: 12, lineHeight: 20, marginTop: 14 }, examRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 1 },
  examHelp: { flexDirection: 'row', minHeight: 44, alignItems: 'center', gap: 6, flexShrink: 1 }, pips: { flexDirection: 'row', gap: 4 }, pip: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: '#66734F', alignItems: 'center', justifyContent: 'center' }, pipDone: { backgroundColor: palette.lime, borderColor: palette.lime },
  examCount: { color: palette.muted, fontSize: 10 }, helpMark: { color: palette.faint, fontSize: 10 }, ready: { color: palette.lime, fontSize: 10, fontWeight: '800' }, examNote: { backgroundColor: '#171E18', borderRadius: 12, padding: 11, marginBottom: 12 }, examNoteText: { color: palette.muted, fontSize: 11, lineHeight: 18, marginVertical: 2 },
  primaryButton: { minHeight: progressPageLayout.minTouchHeight, backgroundColor: palette.lime, borderRadius: 25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, primaryText: { ...progressPageLayout.controlText, color: '#151A0B', fontWeight: '900' }, pressed: { opacity: 0.78 }, disabled: { opacity: 0.55 },
  extensions: { marginTop: 13, borderTopWidth: 1, borderTopColor: '#29313B', paddingTop: 10 }, extensionToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56, marginBottom: 8 }, extensionNote: { color: palette.faint, fontSize: 10, marginTop: 5 }, extensionCount: { color: palette.muted, fontSize: 11 },
});
