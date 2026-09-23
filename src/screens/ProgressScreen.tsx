import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ProgressBar } from '../components/ui';
import { categoryMatches, exercises } from '../data/catalog';
import {
  getAllProgressionStatuses,
  progressionSeries,
  type ProgressionStatus,
  type SeriesGroup,
} from '../data/progression';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import type { Exercise } from '../types';
import { confirmAction } from '../utils/confirm';

type ScreenMode = 'routes' | 'library';

const groups: SeriesGroup[] = ['六艺基础', '关节与支援', '爆发六功'];
const libraryCategories = [
  { key: 'all', label: '全部', icon: '◉' },
  ...progressionSeries.map(({ key, label, icon }) => ({ key, label, icon })),
  { key: 'auxiliary', label: '辅助', icon: '+' },
];

export function ProgressScreen({ onOpen }: { onOpen?: (exerciseId: string) => void }) {
  const { profile, sessions, saveProfile } = useAppStore();
  const [mode, setMode] = useState<ScreenMode>('routes');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const statuses = useMemo(
    () => (profile ? getAllProgressionStatuses(profile, sessions) : []),
    [profile, sessions],
  );
  const statusBySeries = useMemo(
    () => new Map(statuses.map((status) => [status.series.key, status])),
    [statuses],
  );
  const filteredExercises = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return exercises
      .filter((exercise) => categoryMatches(exercise, category))
      .filter((exercise) => {
        if (!needle) return true;
        return `${exercise.name} ${exercise.nameEn || ''} ${exercise.categoryLabel || ''} ${exercise.purpose || ''}`
          .toLocaleLowerCase()
          .includes(needle);
      })
      .sort((left, right) => {
        const leftSeries = progressionSeries.findIndex((item) => item.key === left.category);
        const rightSeries = progressionSeries.findIndex((item) => item.key === right.category);
        const categoryOrder = (leftSeries < 0 ? 999 : leftSeries) - (rightSeries < 0 ? 999 : rightSeries);
        return categoryOrder || (left.step || 999) - (right.step || 999);
      });
  }, [category, query]);

  if (!profile) return null;

  const mastered = statuses.reduce((sum, status) => sum + (status.complete ? status.totalLevels : Math.max(0, status.level - 1)), 0);
  const totalLevels = statuses.reduce((sum, status) => sum + status.totalLevels, 0);
  const readyCount = statuses.filter((status) => status.eligible).length;
  const overallPercent = totalLevels ? Math.round((mastered / totalLevels) * 100) : 0;

  const unlockNext = (status: ProgressionStatus) => {
    if (!status.eligible) return;
    const completingRoute = !status.next;
    confirmAction(
      completingRoute ? '完成这条路线' : '解锁下一式',
      completingRoute
        ? `你已连续有 ${status.qualifiedSessions} 次合格记录。确认已掌握「${status.current.name}」并完成「${status.series.label}」路线吗？`
        : `你已连续有 ${status.qualifiedSessions} 次合格记录。确认从「${status.current.name}」进阶到「${status.next?.name}」吗？`,
      () => {
        void saveProfile({
          ...profile,
          levels: { ...profile.levels, [status.series.key]: status.level + 1 },
        });
      },
      { cancelLabel: '再练一练', confirmLabel: completingRoute ? '确认完成' : '确认解锁' },
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>184 式进阶体系 · 188 个动作</Text>
          <Text style={styles.title}>进阶与动作</Text>
        </View>
        <View style={styles.percentBadge}><Text style={styles.percentValue}>{overallPercent}%</Text></View>
      </View>

      <View style={styles.segmented}>
        <ModeButton label="进阶路线" active={mode === 'routes'} onPress={() => setMode('routes')} />
        <ModeButton label="动作库" active={mode === 'library'} onPress={() => setMode('library')} />
      </View>

      {mode === 'routes' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.routeContent}>
          <View style={styles.summary}>
            <View style={styles.summaryTop}>
              <View><Text style={styles.summaryKicker}>已掌握</Text><Text style={styles.summaryValue}>{mastered}<Text style={styles.summaryUnit}> / {totalLevels} 式</Text></Text></View>
              <View style={styles.readyBox}><Text style={styles.readyValue}>{readyCount}</Text><Text style={styles.readyLabel}>条路线可进阶</Text></View>
            </View>
            <ProgressBar value={overallPercent} color={colors.lime} />
            <Text style={styles.summaryHint}>打开当前动作并完成专项验收；连续 2 次达到完整升级标准、动作稳定且无疼痛，才可解锁下一式。</Text>
          </View>

          {groups.map((group) => {
            const groupStatuses = statuses.filter((status) => status.series.group === group);
            return (
              <View key={group}>
                <View style={styles.groupHeading}>
                  <Text style={styles.groupTitle}>{group}</Text>
                  <Text style={styles.groupCount}>{groupStatuses.length} 条路线</Text>
                </View>
                {groupStatuses.map((status) => (
                  <RouteCard
                    key={status.series.key}
                    status={status}
                    onOpen={onOpen}
                    onUnlock={() => unlockNext(status)}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.libraryContent}
          ListHeaderComponent={(
            <View>
              <View style={styles.search}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="搜索动作、目标或训练部位"
                  placeholderTextColor="#969990"
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                {query ? <Pressable onPress={() => setQuery('')} hitSlop={10}><Text style={styles.clear}>×</Text></Pressable> : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
                {libraryCategories.map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => setCategory(item.key)}
                    style={[styles.category, category === item.key && styles.categoryActive]}
                  >
                    <Text style={[styles.categoryIcon, category === item.key && styles.categoryTextActive]}>{item.icon}</Text>
                    <Text style={[styles.categoryText, category === item.key && styles.categoryTextActive]}>{item.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.resultRow}>
                <Text style={styles.resultText}>{filteredExercises.length} 个动作</Text>
                <Text style={styles.resultSub}>按进阶顺序排列</Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => (
            <ExerciseRow
              exercise={item}
              status={statusBySeries.get(item.category)}
              onPress={() => onOpen?.(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 11 }} />}
          ListEmptyComponent={<Text style={styles.empty}>没有找到相关动作</Text>}
        />
      )}
    </SafeAreaView>
  );
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
    </Pressable>
  );
}

function RouteCard({
  status,
  onOpen,
  onUnlock,
}: {
  status: ProgressionStatus;
  onOpen?: (exerciseId: string) => void;
  onUnlock: () => void;
}) {
  const masteredLevels = status.complete ? status.totalLevels : Math.max(0, status.level - 1);
  const progress = status.totalLevels ? (masteredLevels / status.totalLevels) * 100 : 0;
  const atFinalLevel = !status.next && !status.complete;
  return (
    <View style={[styles.routeCard, status.eligible && styles.routeCardReady]}>
      <View style={styles.routeTop}>
        <View style={[styles.routeIcon, status.eligible && styles.routeIconReady]}><Text style={styles.routeIconText}>{status.series.icon}</Text></View>
        <View style={{ flex: 1 }}>
          <View style={styles.routeNameRow}>
            <Text style={styles.routeName}>{status.series.label}</Text>
          <Text style={styles.routeLevel}>{status.complete ? '路线已完成' : `第 ${status.level} / ${status.totalLevels} 式`}</Text>
          </View>
          <View style={{ marginTop: 9 }}><ProgressBar value={progress} color={status.eligible ? colors.limeDark : colors.ink} /></View>
        </View>
      </View>

      <Pressable onPress={() => onOpen?.(status.current.id)} style={styles.currentExercise}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseLabel}>当前动作</Text>
          <Text style={styles.currentName}>{status.current.name}</Text>
          <Text style={styles.criteria}>升级标准 · {status.criteria.display}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <View style={styles.routeFooter}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nextLabel}>{status.complete ? '路线状态' : atFinalLevel ? '最高阶验收' : '下一式'}</Text>
          <Text numberOfLines={1} style={styles.nextName}>{status.complete ? '已掌握本路线全部动作' : atFinalLevel ? '连续 2 次达标后完成路线' : status.next?.name}</Text>
        </View>
        {status.complete ? (
          <View style={styles.completeBadge}><Text style={styles.completeText}>已完成</Text></View>
        ) : status.eligible ? (
          <Pressable onPress={onUnlock} style={styles.unlockButton}><Text style={styles.unlockText}>{atFinalLevel ? '完成路线' : '解锁下一式'}</Text></Pressable>
        ) : (
          <View style={styles.qualification}>
            <Text style={styles.qualificationValue}>{status.qualifiedSessions}/{status.requiredSessions}</Text>
            <Text style={styles.qualificationLabel}>连续合格</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ExerciseRow({ exercise, status, onPress }: { exercise: Exercise; status?: ProgressionStatus; onPress: () => void }) {
  const step = exercise.step || 0;
  let badge = step ? `第 ${step} 式` : '专项';
  let badgeStyle = styles.libraryBadge;
  if (status && step) {
    if (status.complete || step < status.level) { badge = '已掌握'; badgeStyle = styles.libraryBadgeMastered; }
    else if (step === status.level) { badge = '当前'; badgeStyle = styles.libraryBadgeCurrent; }
    else if (step === status.level + 1 && status.eligible) { badge = '可解锁'; badgeStyle = styles.libraryBadgeReady; }
    else if (step > status.level) { badge = '未解锁'; }
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.exerciseRow, pressed && { opacity: 0.78 }]}>
      <Image source={{ uri: exercise.realImage || exercise.image }} style={styles.exerciseImage} />
      <View style={styles.exerciseShade} />
      <View style={badgeStyle}><Text style={styles.libraryBadgeText}>{badge}</Text></View>
      <View style={styles.exerciseContent}>
        <Text style={styles.exerciseCategory}>{exercise.categoryLabel || exercise.category}</Text>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text numberOfLines={1} style={styles.exerciseSub}>{exercise.nameEn || exercise.purpose || exercise.source || 'Calisthenics'}</Text>
      </View>
      <Text style={styles.exerciseArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 20, paddingTop: 13, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: colors.inkMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', letterSpacing: -1.2, marginTop: 4 },
  percentBadge: { width: 55, height: 55, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  percentValue: { color: colors.lime, fontSize: 16, fontWeight: '900' },
  segmented: { marginHorizontal: 20, marginBottom: 16, padding: 4, borderRadius: radius.pill, backgroundColor: '#E6E5DF', flexDirection: 'row' },
  modeButton: { flex: 1, minHeight: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  modeButtonActive: { backgroundColor: colors.ink },
  modeText: { color: colors.inkMuted, fontSize: 13, fontWeight: '800' },
  modeTextActive: { color: '#FFFFFF' },
  routeContent: { paddingHorizontal: 20, paddingBottom: 120 },
  summary: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: 20 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  summaryKicker: { color: '#AEB1A8', fontSize: 11, fontWeight: '700' },
  summaryValue: { color: '#FFFFFF', fontSize: 31, fontWeight: '900', marginTop: 3 },
  summaryUnit: { color: '#AEB1A8', fontSize: 13 },
  readyBox: { alignItems: 'flex-end' },
  readyValue: { color: colors.lime, fontSize: 27, fontWeight: '900' },
  readyLabel: { color: '#AEB1A8', fontSize: 10, marginTop: 2 },
  summaryHint: { color: '#AEB1A8', fontSize: 11, lineHeight: 17, marginTop: 14 },
  groupHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 11 },
  groupTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  groupCount: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  routeCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 17, marginBottom: 12 },
  routeCardReady: { borderColor: '#A9C93F', backgroundColor: '#FAFDEE' },
  routeTop: { flexDirection: 'row', alignItems: 'center' },
  routeIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  routeIconReady: { backgroundColor: colors.lime },
  routeIconText: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  routeNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeName: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  routeLevel: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  currentExercise: { marginTop: 15, paddingVertical: 13, paddingHorizontal: 14, backgroundColor: colors.paper, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center' },
  exerciseLabel: { color: colors.inkMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  currentName: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 4 },
  criteria: { color: colors.inkMuted, fontSize: 10, marginTop: 4 },
  chevron: { color: colors.inkMuted, fontSize: 28, marginLeft: 8 },
  routeFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  nextLabel: { color: colors.inkMuted, fontSize: 9, fontWeight: '800' },
  nextName: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 3, paddingRight: 8 },
  qualification: { minWidth: 72, alignItems: 'center', paddingVertical: 7, paddingHorizontal: 9, borderRadius: 13, backgroundColor: colors.paper },
  qualificationValue: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  qualificationLabel: { color: colors.inkMuted, fontSize: 8, marginTop: 1 },
  unlockButton: { minHeight: 38, borderRadius: radius.pill, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  unlockText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  completeBadge: { borderRadius: radius.pill, backgroundColor: colors.ink, paddingVertical: 8, paddingHorizontal: 12 },
  completeText: { color: colors.lime, fontSize: 10, fontWeight: '900' },
  libraryContent: { paddingHorizontal: 20, paddingBottom: 120 },
  search: { height: 52, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  searchIcon: { color: colors.inkMuted, fontSize: 24, marginRight: 9 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14 },
  clear: { color: colors.inkMuted, fontSize: 24 },
  categories: { paddingVertical: 15 },
  category: { minWidth: 67, height: 59, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginRight: 8, paddingHorizontal: 10 },
  categoryActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  categoryIcon: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  categoryText: { color: colors.inkMuted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  categoryTextActive: { color: '#FFFFFF' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  resultText: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  resultSub: { color: colors.inkMuted, fontSize: 11 },
  exerciseRow: { height: 116, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#282B25', flexDirection: 'row', alignItems: 'center' },
  exerciseImage: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  exerciseShade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(15,17,13,0.70)' },
  libraryBadge: { position: 'absolute', right: 13, top: 12, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 9, paddingVertical: 5 },
  libraryBadgeMastered: { position: 'absolute', right: 13, top: 12, borderRadius: radius.pill, backgroundColor: 'rgba(168,201,63,0.82)', paddingHorizontal: 9, paddingVertical: 5 },
  libraryBadgeCurrent: { position: 'absolute', right: 13, top: 12, borderRadius: radius.pill, backgroundColor: colors.blue, paddingHorizontal: 9, paddingVertical: 5 },
  libraryBadgeReady: { position: 'absolute', right: 13, top: 12, borderRadius: radius.pill, backgroundColor: colors.orange, paddingHorizontal: 9, paddingVertical: 5 },
  libraryBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  exerciseContent: { paddingHorizontal: 17, flex: 1 },
  exerciseCategory: { color: colors.lime, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  exerciseName: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', marginTop: 5 },
  exerciseSub: { color: '#C0C3B9', fontSize: 10, marginTop: 3, maxWidth: '78%' },
  exerciseArrow: { color: '#FFFFFF', fontSize: 27, marginRight: 15 },
  empty: { textAlign: 'center', color: colors.inkMuted, paddingTop: 60 },
});
