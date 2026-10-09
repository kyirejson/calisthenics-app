import { RouteDetail, ActionRow, Glyph } from '../features/progression/RouteViews';
import { styles, palette } from '../features/progression/styles';
import { useProgressionBrowser, type Props } from '../features/progression/useProgressionBrowser';

import { Animated, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { ProgressionArtworkViewer } from '../components/ProgressionArtworkViewer';

import { useAppStore } from '../store/AppStore';

import { progressPageLayout } from '../theme';
import { EquipmentProgressScreen } from './EquipmentProgressScreen';

const ringSize = progressPageLayout.summaryRingSize;
const ringCenter = ringSize / 2,
  ringRadius = ringCenter - 5,
  ringCircumference = 2 * Math.PI * ringRadius;

export function ProgressScreen(props: Props) {
  const { profile } = useAppStore((state) => ({ profile: state.profile }));
  return profile?.goal === 'equipment' ? (
    <EquipmentProgressScreen onOpen={props.onOpen} />
  ) : (
    <CalisthenicsProgressScreen {...props} />
  );
}

function CalisthenicsProgressScreen(props: Props) {
  const {
    profile,
    onOpen,
    updateView,
    query,
    searchOpen,
    activeGroup,
    setQuery,
    setActiveSeries,
    rulesOpen,
    setRulesOpen,
    artwork,
    setArtwork,
    saving,
    scroll,
    initialScroll,
    scrollRestored,
    reduced,
    finalProgress,
    groups,
    visibleRoutes,
    visibleAuxiliary,
    visibleKeys,
    selectedKey,
    selectedStatus,
    reveal,
    search,
    chooseGroup,
    unlockNext,
  } = useProgressionBrowser(props);
  if (!profile) return null;
  return (
    <SafeAreaView style={styles.safe} testID="progression-screen">
      <ScrollView
        ref={scroll}
        testID="progression-list"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        scrollEventThrottle={64}
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y;
          if (scrollRestored.current && Number.isFinite(y))
            updateView({ scrollOffset: Math.max(0, y) });
        }}
        onContentSizeChange={() => {
          if (!scrollRestored.current) {
            scrollRestored.current = true;
            scroll.current?.scrollTo({ y: initialScroll.current, animated: false });
          }
        }}
      >
        <View style={styles.header}>
          <View style={styles.headingCopy}>
            <Text style={styles.title}>进阶路线</Text>
            <Text style={styles.subtitle}>
              <Text style={styles.subtitleCount}>{finalProgress.unlocked}</Text> /{' '}
              {finalProgress.total} 个终式已解锁
            </Text>
          </View>
          <View style={styles.progressSummary}>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={
                '终式解锁进度，' + finalProgress.unlocked + '个，共' + finalProgress.total + '个'
              }
              accessibilityValue={{ min: 0, max: 100, now: finalProgress.percent }}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={finalProgress.percent}
              testID="progression-final-ring"
              style={styles.ring}
            >
              <Svg
                width={ringSize}
                height={ringSize}
                viewBox={'0 0 ' + ringSize + ' ' + ringSize}
                pointerEvents="none"
              >
                <Circle cx={ringCenter} cy={ringCenter} r={ringRadius - 7} fill={palette.card} />
                <Circle
                  cx={ringCenter}
                  cy={ringCenter}
                  r={ringRadius}
                  fill="none"
                  stroke={palette.line}
                  strokeWidth={4}
                />
                {finalProgress.unlocked > 0 ? (
                  <Circle
                    cx={ringCenter}
                    cy={ringCenter}
                    r={ringRadius}
                    fill="none"
                    stroke={palette.lime}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={
                      ringCircumference * (1 - finalProgress.unlocked / finalProgress.total)
                    }
                    rotation={-90}
                    origin={ringCenter + ',' + ringCenter}
                  />
                ) : null}
              </Svg>
              <View pointerEvents="none" style={styles.ringCopy}>
                <Text style={styles.percent}>
                  {finalProgress.percent}
                  <Text style={styles.percentUnit}>%</Text>
                </Text>
              </View>
            </View>
            <Text style={styles.ringLabel}>终式解锁</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>动作分类</Text>
          <View style={styles.tools}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看进阶规则"
              accessibilityState={{ expanded: rulesOpen }}
              onPress={() => setRulesOpen(!rulesOpen)}
              style={styles.tool}
            >
              <Text style={styles.toolText}>?</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={searchOpen ? '收起动作搜索' : '搜索动作'}
              onPress={() =>
                updateView({ searchOpen: !searchOpen, ...(searchOpen ? { query: '' } : {}) })
              }
              style={styles.tool}
            >
              <Glyph name="search" color={searchOpen ? palette.lime : palette.muted} size={20} />
            </Pressable>
          </View>
        </View>
        {rulesOpen ? (
          <View style={styles.rules} testID="progression-rules">
            <Text style={styles.rulesTitle}>设阶确认 · 记录验收</Text>
            <Text style={styles.rulesText}>
              选择较高阶，低阶即视为已通过。当前阶需两次专项达标，间隔至少24小时，才会点亮记录验收与进阶按钮。
            </Text>
            <Text style={styles.rulesText}>
              六艺以第十式为终式；拓展动作不增加终式数量。设阶不生成训练记录，也不代替动作安全评估。
            </Text>
          </View>
        ) : null}
        {searchOpen ? (
          <View style={styles.search}>
            <Glyph name="search" color={palette.faint} size={19} />
            <TextInput
              testID="progression-search"
              accessibilityLabel="搜索小类或动作"
              value={query}
              onChangeText={search}
              placeholder="搜索小类或动作"
              placeholderTextColor={palette.faint}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="清空动作搜索"
                onPress={() => setQuery('')}
                style={styles.tool}
              >
                <Text style={styles.close}>×</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={styles.groupTabs}>
          {groups.map((item) => {
            const active = item.definition.key === activeGroup;
            return (
              <Pressable
                key={item.definition.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={'查看' + item.definition.key + '分类'}
                onPress={() => chooseGroup(item.definition.key)}
                style={({ pressed }) => [
                  styles.groupTab,
                  active && styles.groupActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.groupName, active && styles.groupNameActive]}
                  numberOfLines={1}
                >
                  {item.definition.key}
                </Text>
                <Text style={[styles.groupCount, active && styles.groupCountActive]}>
                  {item.finals.unlocked} / {item.finals.total}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {visibleKeys.length ? (
          <View style={styles.seriesWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.seriesRow}
            >
              {visibleRoutes.map((status) => (
                <Pressable
                  key={status.series.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedKey === status.series.key }}
                  accessibilityLabel={'选择' + status.series.label + '进阶路线'}
                  onPress={() => setActiveSeries(status.series.key)}
                  style={({ pressed }) => [
                    styles.seriesChip,
                    selectedKey === status.series.key && styles.seriesActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.seriesText,
                      selectedKey === status.series.key && styles.seriesTextActive,
                    ]}
                  >
                    {status.series.label}
                  </Text>
                  {status.complete ? (
                    <Glyph
                      name="check"
                      color={selectedKey === status.series.key ? palette.lime : palette.muted}
                      size={13}
                    />
                  ) : null}
                </Pressable>
              ))}
              {visibleAuxiliary.length ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedKey === 'auxiliary' }}
                  accessibilityLabel="选择辅助训练分类"
                  onPress={() => setActiveSeries('auxiliary')}
                  style={[styles.seriesChip, selectedKey === 'auxiliary' && styles.seriesActive]}
                >
                  <Text
                    style={[
                      styles.seriesText,
                      selectedKey === 'auxiliary' && styles.seriesTextActive,
                    ]}
                  >
                    辅助训练
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(13,15,18,0)', palette.bg]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.seriesFade}
            />
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>没有找到相关动作</Text>
            <Text style={styles.emptyNote}>换个名称，或清空搜索查看路线。</Text>
          </View>
        )}

        <Animated.View
          testID="progression-route-reveal"
          style={{
            opacity: reveal,
            transform: [
              { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            ],
          }}
        >
          {selectedStatus ? (
            <RouteDetail
              key={selectedKey}
              status={selectedStatus}
              onOpen={onOpen}
              onArtwork={setArtwork}
              onUnlock={() => unlockNext(selectedStatus)}
              saving={saving}
            />
          ) : selectedKey === 'auxiliary' ? (
            <View style={styles.route}>
              <View style={styles.routeHead}>
                <Text style={styles.routeTitle}>辅助训练</Text>
                <Text style={styles.routeState}>不计入终式</Text>
              </View>
              {visibleAuxiliary.map((exercise, index) => (
                <ActionRow
                  key={exercise.id}
                  exercise={exercise}
                  index={index}
                  badge="辅助"
                  state="upcoming"
                  rail={false}
                  onOpen={onOpen}
                  onArtwork={setArtwork}
                />
              ))}
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
      <ProgressionArtworkViewer
        exercise={artwork}
        onClose={() => setArtwork(null)}
        onOpen={onOpen}
        reduceMotion={reduced}
      />
    </SafeAreaView>
  );
}

export type { ProgressViewPreferences } from '../features/progression/useProgressionBrowser';
