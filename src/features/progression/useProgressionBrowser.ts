import { useMemo, useRef, useState } from 'react';
import { ScrollView } from 'react-native';

import { useReducedMotion, useRouteReveal } from '../../components/useProgressMotion';
import { exercises } from '../../domain/training/catalog';
import {
  applyProgressionUnlock,
  getAllProgressionStatuses,
  getFinalFormProgress,
  getSeriesExercises,
  progressionGroups,
  type ProgressionStatus,
  type SeriesGroup,
} from '../../domain/training/progression';
import { useAppStore } from '../../store/AppStore';
import type { Exercise } from '../../types';
import { confirmAction, showMessage } from '../../utils/confirm';
import { useUpdateBlock } from '../../components/AppUpdates';
const auxiliaryExercises = exercises.filter(
  (exercise) => exercise.category === 'auxiliary' && exercise.id !== 'aux_calfBeginner',
);
function matches(exercise: Exercise, needle: string) {
  return [
    exercise.name,
    exercise.nameEn,
    exercise.categoryLabel,
    exercise.purpose,
    exercise.source,
  ].some((value) => value?.toLocaleLowerCase().includes(needle));
}
export type ProgressViewPreferences = {
  group: SeriesGroup;
  series: string;
  query: string;
  searchOpen: boolean;
  scrollOffset: number;
};
export type Props = {
  onOpen?: (exerciseId: string) => void;
  viewPreferences: ProgressViewPreferences;
  onViewPreferences: (patch: Partial<ProgressViewPreferences>) => void;
};
export function useProgressionBrowser({
  onOpen,
  viewPreferences,
  onViewPreferences: updateView,
}: Props) {
  const { profile, sessions, patchProfile } = useAppStore((state) => ({
    profile: state.profile,
    sessions: state.sessions,
    patchProfile: state.patchProfile,
  }));
  const { query, searchOpen, group: activeGroup, series: activeSeries } = viewPreferences;
  const setQuery = (query: string) => updateView({ query });
  const setActiveSeries = (series: string) => updateView({ series });
  const [rulesOpen, setRulesOpen] = useState(false);
  const [artwork, setArtwork] = useState<Exercise | null>(null);
  const [saving, setSaving] = useState(false);
  useUpdateBlock(saving);
  const savingRef = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const initialScroll = useRef(viewPreferences.scrollOffset);
  const scrollRestored = useRef(false);
  const reduced = useReducedMotion();
  const statuses = useMemo(
    () => (profile ? getAllProgressionStatuses(profile, sessions) : []),
    [profile, sessions],
  );
  const live = useRef({ profile, statuses });
  live.current = { profile, statuses };
  const finalProgress = getFinalFormProgress(statuses);
  const groups = useMemo(
    () =>
      progressionGroups.map((definition) => {
        const routes = statuses.filter((status) => status.series.group === definition.key);
        return {
          definition,
          routes,
          finals: getFinalFormProgress(routes),
          auxiliary: definition.key === '关节与支援' ? auxiliaryExercises : [],
        };
      }),
    [statuses],
  );
  const needle = query.trim().toLocaleLowerCase();
  const group = groups.find((item) => item.definition.key === activeGroup) || groups[0];
  const wholeGroupMatches = activeGroup.toLocaleLowerCase().includes(needle);
  const visibleRoutes =
    !needle || wholeGroupMatches
      ? group.routes
      : group.routes.filter(
          (status) =>
            status.series.label.toLocaleLowerCase().includes(needle) ||
            getSeriesExercises(status.series.key).some((exercise) => matches(exercise, needle)),
        );
  const visibleAuxiliary =
    !needle || wholeGroupMatches
      ? group.auxiliary
      : group.auxiliary.filter((exercise) => matches(exercise, needle));
  const visibleKeys = [
    ...visibleRoutes.map((status) => status.series.key),
    ...(visibleAuxiliary.length ? ['auxiliary'] : []),
  ];
  const selectedKey = visibleKeys.includes(activeSeries) ? activeSeries : visibleKeys[0];
  const selectedStatus = visibleRoutes.find((status) => status.series.key === selectedKey);
  const reveal = useRouteReveal(
    (selectedKey || 'empty') + ':' + (selectedStatus?.level || 0),
    reduced,
  );

  const search = (value: string) => {
    setQuery(value);
    const term = value.trim().toLocaleLowerCase();
    if (!term) return;
    for (const item of groups) {
      const route = item.routes.find(
        (status) =>
          item.definition.key.toLocaleLowerCase().includes(term) ||
          status.series.label.toLocaleLowerCase().includes(term) ||
          getSeriesExercises(status.series.key).some((exercise) => matches(exercise, term)),
      );
      if (route) {
        updateView({ group: item.definition.key, series: route.series.key });
        return;
      }
      if (item.auxiliary.some((exercise) => matches(exercise, term))) {
        updateView({ group: item.definition.key, series: 'auxiliary' });
        return;
      }
    }
  };
  const chooseGroup = (key: SeriesGroup) => {
    const next = groups.find((item) => item.definition.key === key);
    updateView({
      query: '',
      group: key,
      series: next?.routes[0]?.series.key || 'auxiliary',
      scrollOffset: 0,
    });
    // Selection is intentional; no delayed automatic jump while scrolling.
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const unlockNext = (status: ProgressionStatus) => {
    if (!status.eligible || savingRef.current) return;
    const finishing = !status.next;
    confirmAction(
      finishing ? '解锁最终动作' : '解锁下一式',
      finishing
        ? '两次专项验收已达标，确认掌握「' + status.current.name + '」？'
        : '两次专项验收已达标，确认进阶到「' + status.next?.name + '」？',
      () => {
        const current = live.current.statuses.find((item) => item.series.key === status.series.key);
        const latestProfile = live.current.profile;
        if (
          savingRef.current ||
          !latestProfile ||
          !current?.eligible ||
          current.current.id !== status.current.id
        )
          return;
        savingRef.current = true;
        setSaving(true);
        void patchProfile((profile) => {
          const next = applyProgressionUnlock(profile, current);
          return { levels: next.levels, planLevels: next.planLevels };
        })
          .then(() => showMessage('已更新进阶', finishing ? '终式已解锁' : '下一式已解锁'))
          .catch(() => showMessage('保存失败', '进阶未保存，请重试。'))
          .finally(() => {
            savingRef.current = false;
            setSaving(false);
          });
      },
      { cancelLabel: '再练一练', confirmLabel: finishing ? '确认解锁' : '确认进阶' },
    );
  };

  return {
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
  };
}
