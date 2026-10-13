import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useReducedMotion } from '../../components/useProgressMotion';
import {
  derivePerformanceHistory,
  deriveSeriesStaircase,
  groupHistoryByDay,
  validHistorySessions,
} from '../../domain/training/trainingHistory';
import { getSeriesExercises, parseMasteryCriteria } from '../../domain/training/progression';
import { type ProgressMetric, type ProgressRange } from '../../domain/training/progressChart';
import { useAppStore } from '../../store/AppStore';
import type { Profile } from '../../types';

export type DataViewPreferences = {
  series: string;
  level: number | null;
  metric: ProgressMetric;
  range: ProgressRange;
};
export type Props = {
  onOpenExercise: (exerciseId: string) => void;
  viewPreferences: DataViewPreferences;
  onViewPreferences: (view: DataViewPreferences) => void;
};

export function useTrainingHistoryData() {
  const { sessions } = useAppStore((state) => ({ sessions: state.sessions }));
  const [clock, setClock] = useState(() => new Date());
  const now = useMemo(() => new Date(), [clock, sessions]);

  useEffect(() => {
    const next = new Date(clock.getFullYear(), clock.getMonth(), clock.getDate() + 1);
    const timer = setTimeout(
      () => setClock(new Date()),
      Math.max(1000, next.getTime() - Date.now() + 100),
    );
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setClock(new Date());
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [clock]);

  const valid = useMemo(() => validHistorySessions(sessions, now), [sessions, now]);
  const allGroups = useMemo(() => groupHistoryByDay(valid, now), [valid, now]);
  return { sessions, now, valid, allGroups };
}

export function useTrainingHistory({ onOpenExercise, profile, viewPreferences, onViewPreferences }: Props & { profile: Profile }) {
  const { sessions, now, valid } = useTrainingHistoryData();
  // The app shell owns these choices: leaving to repeat a workout must not reset them.
  const { series: selectedSeries, level: selectedLevel, metric, range } = viewPreferences;
  const updateView = (patch: Partial<DataViewPreferences>) => onViewPreferences({ ...viewPreferences, ...patch });
  const setSelectedLevel = (level: number | null) => updateView({ level });
  const [showSteps, setShowSteps] = useState(false), [showMethods, setShowMethods] = useState(false);
  const reduced = useReducedMotion();
  const allSteps = useMemo(() => getSeriesExercises(selectedSeries), [selectedSeries]);
  const chosen = profile.planLevels?.[selectedSeries] ?? profile.levels?.[selectedSeries] ?? 1;
  const currentLevel = Math.max(
    1,
    Math.min(allSteps.length, Number.isFinite(chosen) ? Math.floor(chosen) : 1),
  );
  const activeLevel = Math.max(1, Math.min(allSteps.length, selectedLevel ?? currentLevel));
  const activeExercise = allSteps[activeLevel - 1];
  const criteria = useMemo(
    () => (activeExercise ? parseMasteryCriteria(activeExercise) : null),
    [activeExercise],
  );
  const staircase = useMemo(
    () => deriveSeriesStaircase(valid, selectedSeries, currentLevel, allSteps, activeLevel, now),
    [valid, selectedSeries, currentLevel, allSteps, activeLevel, now],
  );
  const performance = useMemo(
    () =>
      activeExercise && criteria
        ? derivePerformanceHistory(valid, activeExercise.id, criteria.unit, now)
        : { points: [], bestAllTime: 0, latest: null, hasData: false },
    [valid, activeExercise, criteria, now],
  );
  return {
    onOpenExercise,
    sessions,
    now,
    selectedSeries,
    metric,
    range,
    updateView,
    setSelectedLevel,
    showSteps,
    setShowSteps,
    showMethods,
    setShowMethods,
    reduced,
    valid,
    allSteps,
    activeLevel,
    activeExercise,
    criteria,
    staircase,
    performance,
  };
}
