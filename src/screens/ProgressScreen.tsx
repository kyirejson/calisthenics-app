import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ProgressBar } from '../components/ui';
import { exercises } from '../data/catalog';
import {
  getAllProgressionStatuses,
  getSeriesExercises,
  type ProgressionStatus,
  type SeriesGroup,
} from '../data/progression';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import type { Exercise } from '../types';
import { confirmAction } from '../utils/confirm';

type FilterKey = 'all' | SeriesGroup | 'auxiliary';
const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: '六艺基础', label: '六艺基础' },
  { key: '关节与支援', label: '关节支援' },
  { key: '爆发六功', label: '爆发动作' },
  { key: 'auxiliary', label: '辅助' },
];

function matches(exercise: Exercise, needle: string) {
  if (!needle) return true;
  return [exercise.name, exercise.nameEn, exercise.categoryLabel, exercise.purpose, exercise.source]
    .some((value) => value?.toLocaleLowerCase().includes(needle));
}

export function ProgressScreen({ onOpen }: { onOpen?: (exerciseId: string) => void }) {
  const { profile, sessions, saveProfile } = useAppStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const statuses = useMemo(
    () => (profile ? getAllProgressionStatuses(profile, sessions) : []),
    [profile, sessions],
  );
  const needle = query.trim().toLocaleLowerCase();
  const filteredStatuses = useMemo(() => statuses.filter((status) =>
    filter !== 'auxiliary'
    && (filter === 'all' || status.series.group === filter)
    && (!needle || status.series.label.toLocaleLowerCase().includes(needle)
      || getSeriesExercises(status.series.key).some((exercise) => matches(exercise, needle))),
  ), [statuses, filter, needle]);
  const auxiliary = useMemo(() => exercises
    .filter((exercise) => exercise.category === 'auxiliary')
    .filter((exercise) => (filter === 'all' || filter === 'auxiliary') && matches(exercise, needle)),
  [filter, needle]);

  if (!profile) return null;
  const mastered = statuses.reduce(
    (sum, status) => sum + (status.complete ? status.totalLevels : Math.max(0, status.level - 1)), 0,
  );
  const totalLevels = statuses.reduce((sum, status) => sum + status.totalLevels, 0);
  const readyCount = statuses.filter((status) => status.eligible).length;
  const percent = totalLevels ? Math.round((mastered / totalLevels) * 100) : 0;

  const unlockNext = (status: ProgressionStatus) => {
    if (!status.eligible) return;
    const completingRoute = !status.next;
    confirmAction(
      completingRoute ? '完成这条路线' : '解锁下一式',
      completingRoute
        ? `已连续 ${status.qualifiedSessions} 次专项达标。确认掌握「${status.current.name}」并完成路线？`
        : `已连续 ${status.qualifiedSessions} 次专项达标。确认进阶到「${status.next?.name}」？`,
      () => void saveProfile({
        ...profile,
        levels: { ...profile.levels, [status.series.key]: status.level + 1 },
      }),
      { cancelLabel: '再练一练', confirmLabel: completingRoute ? '确认完成' : '确认解锁' },
    );
  };

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <View><Text style={styles.eyebrow}>动作与进阶</Text><Text style={styles.title}>进阶</Text></View>
      <View style={styles.percentBadge}><Text style={styles.percentText}>{percent}%</Text></View>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <View style={styles.summaryLine}>
          <Text style={styles.summaryNumber}>{mastered}<Text style={styles.summaryTotal}> / {totalLevels} 式已掌握</Text></Text>
          {readyCount > 0 ? <Text style={styles.readyText}>{readyCount} 条可进阶</Text> : null}
        </View>
        <ProgressBar value={percent} color={colors.lime} />
        <Text style={styles.summaryHint}>当前动作需 2 次专项自评达标，间隔至少 24 小时；动作稳定且无疼痛，再解锁下一式。</Text>
      </View>
      <View style={styles.search}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜索路线或动作"
          placeholderTextColor="#969990"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query ? <Pressable onPress={() => setQuery('')} hitSlop={10}><Text style={styles.clear}>×</Text></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((item) => <Pressable
          key={item.key}
          onPress={() => setFilter(item.key)}
          style={[styles.filter, filter === item.key && styles.filterActive]}
        ><Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text></Pressable>)}
      </ScrollView>
      {filteredStatuses.length === 0 && auxiliary.length === 0
        ? <Text style={styles.empty}>没有找到相关路线或动作</Text>
        : null}
      {filteredStatuses.map((status, index) => {
        const expanded = expandedRoute === status.series.key || Boolean(needle);
        const showGroup = index === 0 || filteredStatuses[index - 1].series.group !== status.series.group;
        return <React.Fragment key={status.series.key}>
          {showGroup ? <Text style={styles.groupTitle}>{status.series.group}</Text> : null}
          <RouteCard
            status={status}
            expanded={expanded}
            needle={needle}
            onToggle={() => setExpandedRoute(expandedRoute === status.series.key ? null : status.series.key)}
            onOpen={onOpen}
            onUnlock={() => unlockNext(status)}
          />
        </React.Fragment>;
      })}
      {auxiliary.length > 0 ? <View>
        <Text style={styles.groupTitle}>辅助动作</Text>
        <View style={styles.auxCard}>
          {auxiliary.map((exercise) => <ActionRow
            key={exercise.id}
            exercise={exercise}
            badge="辅助"
            onPress={() => onOpen?.(exercise.id)}
          />)}
        </View>
      </View> : null}
    </ScrollView>
  </SafeAreaView>;
}

function RouteCard({ status, expanded, needle, onToggle, onOpen, onUnlock }: {
  status: ProgressionStatus;
  expanded: boolean;
  needle: string;
  onToggle: () => void;
  onOpen?: (exerciseId: string) => void;
  onUnlock: () => void;
}) {
  const mastered = status.complete ? status.totalLevels : Math.max(0, status.level - 1);
  const sequence = getSeriesExercises(status.series.key);
  const visibleSequence = needle && !status.series.label.toLocaleLowerCase().includes(needle)
    ? sequence.filter((exercise) => matches(exercise, needle))
    : sequence;
  return <View style={[styles.routeCard, status.eligible && styles.routeReady]}>
    <Pressable onPress={onToggle} style={styles.routeHeading}>
      <View style={styles.routeIcon}><Text style={styles.routeIconText}>{status.series.icon}</Text></View>
      <View style={styles.routeHeadingText}>
        <Text style={styles.routeName}>{status.series.label}</Text>
        <Text style={styles.routeMeta}>{status.complete ? '路线已完成' : `第 ${status.level} / ${status.totalLevels} 式`} · 已掌握 {mastered} 式</Text>
      </View>
      <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
    </Pressable>
    <ProgressBar value={status.totalLevels ? mastered / status.totalLevels * 100 : 0} color={status.eligible ? colors.limeDark : colors.ink} />
    <Pressable onPress={() => onOpen?.(status.current.id)} style={styles.current}>
      <View style={{ flex: 1 }}>
        <Text style={styles.currentLabel}>{status.complete ? '最高阶动作' : '当前动作'}</Text>
        <Text style={styles.currentName}>{status.current.name}</Text>
        <Text style={styles.criteria}>升级标准：{status.criteria.display}</Text>
      </View>
      <Text style={styles.openArrow}>›</Text>
    </Pressable>
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        {status.complete ? '已完成全部动作'
          : status.eligible ? '已达到解锁条件'
          : `专项达标 ${status.qualifiedSessions}/${status.requiredSessions} 次`}
      </Text>
      {status.eligible
        ? <Pressable onPress={onUnlock} style={styles.unlockButton}><Text style={styles.unlockText}>{status.next ? '解锁下一式' : '完成路线'}</Text></Pressable>
        : <Pressable onPress={onToggle}><Text style={styles.sequenceLink}>{expanded ? '收起动作' : '查看动作路线'}</Text></Pressable>}
    </View>
    {expanded ? <View style={styles.sequence}>
      {visibleSequence.map((exercise) => {
        const step = exercise.step || 0;
        const badge = status.complete || step < status.level ? '已掌握'
          : step === status.level ? '当前'
          : step === status.level + 1 && status.eligible ? '可解锁' : `第 ${step} 式`;
        return <ActionRow key={exercise.id} exercise={exercise} badge={badge} onPress={() => onOpen?.(exercise.id)} />;
      })}
    </View> : null}
  </View>;
}

function ActionRow({ exercise, badge, onPress }: { exercise: Exercise; badge: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.actionRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.actionName}>{exercise.name}</Text>
      {exercise.source ? <Text style={styles.actionSource}>{exercise.source}</Text> : null}
    </View>
    <Text style={[styles.actionBadge, badge === '当前' && styles.actionBadgeCurrent]}>{badge}</Text>
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
  search: { marginTop: 17, height: 48, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  searchIcon: { color: colors.inkMuted, fontSize: 24, marginRight: 8 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14 },
  clear: { color: colors.inkMuted, fontSize: 24 },
  filters: { paddingVertical: 13, paddingRight: 12 },
  filter: { borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8 },
  filterActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { color: colors.inkMuted, fontSize: 12, fontWeight: '800' },
  filterTextActive: { color: '#FFFFFF' },
  groupTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 14, marginBottom: 10 },
  routeCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 11 },
  routeReady: { borderColor: '#A9C93F' },
  routeHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  routeIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  routeIconText: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  routeHeadingText: { flex: 1 },
  routeName: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  routeMeta: { color: colors.inkMuted, fontSize: 11, marginTop: 4 },
  chevron: { color: colors.inkMuted, fontSize: 22 },
  current: { backgroundColor: colors.paper, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 12, marginTop: 13, flexDirection: 'row', alignItems: 'center' },
  currentLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: '800' },
  currentName: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 3 },
  criteria: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  openArrow: { color: colors.inkMuted, fontSize: 26, marginLeft: 8 },
  footer: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerText: { color: colors.inkMuted, fontSize: 11, flex: 1 },
  sequenceLink: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  unlockButton: { backgroundColor: colors.lime, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 9 },
  unlockText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  sequence: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  actionRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, paddingVertical: 10 },
  actionName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  actionSource: { color: colors.inkMuted, fontSize: 10, marginTop: 3 },
  actionBadge: { color: colors.inkMuted, fontSize: 10, fontWeight: '800', marginLeft: 8 },
  actionBadgeCurrent: { color: colors.limeDark },
  actionArrow: { color: colors.inkMuted, fontSize: 23, marginLeft: 8 },
  auxCard: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line },
  empty: { color: colors.inkMuted, textAlign: 'center', paddingVertical: 32 },
});
