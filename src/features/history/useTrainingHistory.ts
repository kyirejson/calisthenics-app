import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList } from 'react-native';

import { useReducedMotion } from '../../components/useProgressMotion';
import {
  buildMonthGrid,
  derivePerformanceHistory,
  deriveSeriesStaircase,
  groupHistoryByDay,
  validHistorySessions,
  type DayGroup,
} from '../../domain/training/trainingHistory';
import { getSeriesExercises, parseMasteryCriteria } from '../../domain/training/progression';
import { type ProgressMetric, type ProgressRange } from '../../domain/training/progressChart';
import { useAppStore } from '../../store/AppStore';
import type { Profile, TrainingSession } from '../../types';
import { confirmAction } from '../../utils/confirm';

export type DataViewPreferences = {
  series: string;
  level: number | null;
  metric: ProgressMetric;
  range: ProgressRange;
};
export type Props = {
  onOpenExercise: (exerciseId: string) => void;
  savedSessionId?: string;
  viewPreferences: DataViewPreferences;
  onViewPreferences: (view: DataViewPreferences) => void;
};

export function useTrainingHistory({
  onOpenExercise,
  profile,
  savedSessionId,
  viewPreferences,
  onViewPreferences,
}: Props & { profile: Profile }) {
  const { sessions, deleteSession, resetTrainingDay } = useAppStore((state) => ({
    sessions: state.sessions,
    deleteSession: state.deleteSession,
    resetTrainingDay: state.resetTrainingDay,
  }));
  const [clock, setClock] = useState(() => new Date());
  const now = useMemo(() => new Date(), [clock, sessions]);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  // The app shell owns these choices: leaving to repeat a workout must not reset them.
  const { series: selectedSeries, level: selectedLevel, metric, range } = viewPreferences;
  const updateView = (patch: Partial<DataViewPreferences>) =>
    onViewPreferences({ ...viewPreferences, ...patch });
  const setSelectedLevel = (level: number | null) => updateView({ level });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [detailsDay, setDetailsDay] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [showMethods, setShowMethods] = useState(false);
  const list = useRef<FlatList<DayGroup>>(null);
  const headerHeight = useRef(0);
  const reduced = useReducedMotion();

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
  const dayGroups = useMemo(
    () => (selectedDate ? allGroups.filter((day) => day.key === selectedDate) : allGroups),
    [allGroups, selectedDate],
  );
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
  const calendarDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const grid = buildMonthGrid(calendarDate.getFullYear(), calendarDate.getMonth(), valid, now);
  const monthDays = grid.filter((cell) => cell?.state).length;

  const selectDate = (date: string, toggle = false) => {
    const key = toggle && selectedDate === date ? null : date;
    setSelectedDate(key);
    if (key) {
      setExpandedDay(key);
      setDetailsDay(key);
      setExpandedSession(null);
      const [year, month] = key.split('-').map(Number);
      setMonthOffset((year - now.getFullYear()) * 12 + month - 1 - now.getMonth());
    }
    requestAnimationFrame(() =>
      list.current?.scrollToOffset({
        offset: Math.max(0, headerHeight.current - 70),
        animated: reduced === false,
      }),
    );
  };
  const requestDelete = (session: TrainingSession) => {
    if (deleting) return;
    confirmAction(
      '删除这条训练记录？',
      '将删除「' +
        session.workoutName +
        '」本次记录。成绩、出勤与验收证据会同步重算；其他记录保留。删除后无法撤销。',
      () => {
        setDeleting(session.id);
        setDeleteError('');
        void deleteSession(session.id)
          .catch(() => setDeleteError('删除失败，原记录保留，请重试。'))
          .finally(() => setDeleting(null));
      },
      { confirmLabel: '删除记录', destructive: true },
    );
  };
  const requestDeleteDay = (date: string) => {
    if (deleting) return;
    confirmAction('删除这一天的全部训练？', '这一天的力量、跑步记录、续练进度和自加动作将全部移除，图表与日历同步重算。其他日期保留。', () => {
      setDeleting(date); setDeleteError('');
      void resetTrainingDay(date).then(() => {
        setExpandedDay(null); setDetailsDay(null); setExpandedSession(null);
        if (selectedDate === date) setSelectedDate(null);
      }).catch(() => setDeleteError('删除未完成，请重试。')).finally(() => setDeleting(null));
    }, { confirmLabel: '删除当日全部记录', destructive: true });
  };

  return {
    onOpenExercise,
    savedSessionId,
    sessions,
    now,
    deleteError,
    deleting,
    monthOffset,
    setMonthOffset,
    selectedSeries,
    metric,
    range,
    updateView,
    setSelectedLevel,
    selectedDate,
    setSelectedDate,
    expandedDay,
    setExpandedDay,
    detailsDay,
    setDetailsDay,
    expandedSession,
    setExpandedSession,
    showSteps,
    setShowSteps,
    showMethods,
    setShowMethods,
    list,
    headerHeight,
    reduced,
    valid,
    allGroups,
    dayGroups,
    allSteps,
    activeLevel,
    activeExercise,
    criteria,
    staircase,
    performance,
    calendarDate,
    grid,
    monthDays,
    selectDate,
    requestDelete,
    requestDeleteDay,
  };
}
