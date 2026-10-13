import { useMemo, useState } from 'react';
import { buildMonthGrid } from '../../domain/training/trainingHistory';
import { useAppStore } from '../../store/AppStore';
import type { TrainingSession } from '../../types';
import { confirmAction } from '../../utils/confirm';
import { useTrainingHistoryData } from './useTrainingHistory';

export type RecordsProps = { onOpenExercise: (exerciseId: string) => void; savedSessionId?: string };
export function useTrainingRecords({ onOpenExercise, savedSessionId }: RecordsProps) {
  const { now, valid, allGroups } = useTrainingHistoryData();
  const { deleteSession, resetTrainingDay } = useAppStore(state => ({ deleteSession: state.deleteSession, resetTrainingDay: state.resetTrainingDay }));
  const [deleteError, setDeleteError] = useState(''), [deleting, setDeleting] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0), [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null), [detailsDay, setDetailsDay] = useState<string | null>(null), [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const calendarDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const grid = buildMonthGrid(calendarDate.getFullYear(), calendarDate.getMonth(), valid, now);
  const monthDays = grid.filter(cell => cell?.state).length;
  const dayGroups = useMemo(() => selectedDate ? allGroups.filter(day => day.key === selectedDate) : allGroups, [allGroups, selectedDate]);
  const latest = allGroups[0];
  const selectDate = (date: string) => {
    setSelectedDate(date); setExpandedDay(date); setDetailsDay(date); setExpandedSession(null); setAllOpen(true);
  };
  const openAll = () => { setSelectedDate(null); setAllOpen(true); };
  const requestDelete = (session: TrainingSession) => {
    if (deleting) return;
    confirmAction('删除这条训练记录？', `将删除「${session.workoutName}」本次记录。成绩、出勤与里程碑会同步重算；其他记录保留。删除后无法撤销。`, () => {
      setDeleting(session.id); setDeleteError('');
      void deleteSession(session.id).catch(() => setDeleteError('删除失败，原记录保留，请重试。')).finally(() => setDeleting(null));
    }, { confirmLabel: '删除记录', destructive: true });
  };
  const requestDeleteDay = (date: string) => {
    if (deleting) return;
    confirmAction('删除这一天的全部训练？', '这一天的力量、跑步记录、续练进度和自加动作将全部移除，图表与日历同步重算。其他日期保留。', () => {
      setDeleting(date); setDeleteError('');
      void resetTrainingDay(date).then(() => { setExpandedDay(null); setDetailsDay(null); setExpandedSession(null); if (selectedDate === date) setSelectedDate(null); })
        .catch(() => setDeleteError('删除未完成，请重试。')).finally(() => setDeleting(null));
    }, { confirmLabel: '删除当日全部记录', destructive: true });
  };
  return { onOpenExercise, savedSessionId, now, valid, allGroups, latest, deleteError, deleting, monthOffset, setMonthOffset, calendarDate, grid, monthDays,
    selectedDate, setSelectedDate, expandedDay, setExpandedDay, detailsDay, setDetailsDay, expandedSession, setExpandedSession, dayGroups, allOpen, setAllOpen, selectDate, openAll, requestDelete, requestDeleteDay };
}
