import React, { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getCalendarMonths, getDisplayedSchedule, localDateKey, type ScheduledDay } from '../data/planProgress';
import { colors, radius } from '../theme';
import type { Profile, TrainingSession } from '../types';
import { ScheduleDayDetail } from './ScheduleDayDetail';

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

export function YearSchedule({ profile, sessions, anchor, onSelect, onOpenExercise, onClose }: {
  profile: Profile;
  sessions: TrainingSession[];
  anchor: Date;
  onSelect: (date: Date) => void;
  onOpenExercise: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const startKey = localDateKey(anchor);
  const horizon = 365;
  const months = useMemo(() => getCalendarMonths(getDisplayedSchedule(profile, anchor, horizon)), [profile, startKey, horizon]);
  const [monthIndex, setMonthIndex] = useState(0);
  const [activeDay, setActiveDay] = useState<ScheduledDay | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const detailTop = useRef(0);
  const jumpToDetail = useRef(false);
  const month = months[monthIndex];

  const changeMonth = (direction: number) => {
    const next = monthIndex + direction;
    if (next < 0 || next >= months.length) return;
    setMonthIndex(next);
    setActiveDay(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const selectDay = (day: ScheduledDay) => {
    jumpToDetail.current = true;
    const same = activeDay && localDateKey(activeDay.date) === localDateKey(day.date);
    setActiveDay(day);
    onSelect(day.date);
    if (same) {
      jumpToDetail.current = false;
      scrollRef.current?.scrollTo({ y: Math.max(0, detailTop.current - 8), animated: true });
    }
  };

  return <Modal visible animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>日程详情</Text><Text style={styles.title}>训练日历</Text><Text style={styles.subtitle}>未来 {horizon} 天 · 每月翻页，点日期查看课程</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭全年日程" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
        </View>
        <View style={styles.pager}>
          <Pressable accessibilityRole="button" accessibilityLabel="上一个月" disabled={monthIndex === 0} onPress={() => changeMonth(-1)} style={[styles.pageButton, monthIndex === 0 && styles.pageButtonDisabled]}><Text style={styles.pageArrow}>‹</Text></Pressable>
          <View style={styles.pagerCenter}><Text style={styles.monthTitle}>{month.title}</Text><Text style={styles.pageCount}>{monthIndex + 1} / {months.length} · {month.plannedCount} 天训练</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="下一个月" disabled={monthIndex === months.length - 1} onPress={() => changeMonth(1)} style={[styles.pageButton, monthIndex === months.length - 1 && styles.pageButtonDisabled]}><Text style={styles.pageArrow}>›</Text></Pressable>
        </View>
        <View style={styles.legend}><Legend color={colors.limeDark} label="力量 / 技术" />{profile.goal !== 'street_mastery' ? <Legend color={colors.blue} label="有氧" /> : null}<Legend color="#BDC2B7" label="恢复" /></View>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.monthCard}>
            <View style={styles.monthGrid}>
              {weekdays.map((label) => <Text key={`${month.key}-${label}`} style={styles.weekday}>{label}</Text>)}
              {month.cells.map((cell, index) => <View key={`${month.key}-${index}`} style={styles.cellSlot}>
                {cell?.day ? <Pressable accessibilityRole="button" accessibilityState={{ selected: activeDay ? localDateKey(cell.day.date) === localDateKey(activeDay.date) : false }} accessibilityLabel={`${month.title}${cell.number}日，${cell.day.title}`} onPress={() => selectDay(cell.day!)} style={[styles.dateCell, localDateKey(cell.day.date) === startKey && styles.todayCell, activeDay && localDateKey(cell.day.date) === localDateKey(activeDay.date) && styles.selectedCell]}>
                  <Text style={[styles.dateText, activeDay && localDateKey(cell.day.date) === localDateKey(activeDay.date) && styles.selectedDateText]}>{cell.number}</Text><View style={[styles.kindDot, cell.day.type === 'strength' ? styles.strengthDot : cell.day.type === 'cardio' ? styles.cardioDot : styles.recoveryDot]} />
                </Pressable> : cell ? <Text style={styles.outsideDate}>{cell.number}</Text> : null}
              </View>)}
            </View>
          </View>
          {activeDay ? <View key={localDateKey(activeDay.date)} onLayout={(event) => {
            detailTop.current = event.nativeEvent.layout.y;
            if (jumpToDetail.current) {
              jumpToDetail.current = false;
              requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, detailTop.current - 8), animated: true }));
            }
          }} style={styles.dayDetail}>
            <Pressable accessibilityRole="button" accessibilityLabel="返回本月日历" onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} style={styles.backToMonth}><Text style={styles.backToMonthText}>↑ 返回本月日历</Text></Pressable>
            <ScheduleDayDetail profile={profile} day={activeDay} sessions={sessions} onOpenExercise={onOpenExercise} />
          </View> : <Text style={styles.pickHint}>选择日期，查看当天训练动作、耗时与注意事项。</Text>}
          <Text style={styles.note}>日程按当前档案预测；动作阶数随训练记录更新，不会按日期自动解锁。</Text>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(12,15,10,0.62)', justifyContent: 'flex-end' },
  sheet: { height: '94%', backgroundColor: colors.paper, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden' },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#C7C7BE', alignSelf: 'center', marginTop: 9 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 17, paddingBottom: 12 },
  headerCopy: { flex: 1 }, eyebrow: { color: colors.green, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 3 },
  subtitle: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  close: { width: 35, height: 35, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 24, color: colors.inkMuted },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 10, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  pageButton: { width: 39, height: 39, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  pageButtonDisabled: { opacity: 0.28 },
  pageArrow: { color: colors.lime, fontSize: 26, lineHeight: 30, fontWeight: '800' },
  pagerCenter: { alignItems: 'center' },
  monthTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  pageCount: { color: colors.inkMuted, fontSize: 10, marginTop: 3 },
  legend: { flexDirection: 'row', gap: 17, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 }, legendText: { color: colors.inkMuted, fontSize: 10 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 38 },
  monthCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 12 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', color: colors.inkMuted, fontSize: 10, fontWeight: '800', marginBottom: 7 },
  cellSlot: { width: '14.2857%', height: 41, alignItems: 'center', justifyContent: 'center' },
  dateCell: { width: 33, height: 37, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  todayCell: { backgroundColor: '#EFF5DC' },
  selectedCell: { backgroundColor: colors.ink },
  dateText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  selectedDateText: { color: '#FFFFFF' },
  kindDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  strengthDot: { backgroundColor: colors.limeDark }, cardioDot: { backgroundColor: colors.blue }, recoveryDot: { backgroundColor: '#BDC2B7' },
  outsideDate: { color: '#C5C7BF', fontSize: 11 },
  dayDetail: { marginTop: 12 },
  backToMonth: { alignSelf: 'flex-start', minHeight: 30, justifyContent: 'center', marginBottom: 7 },
  backToMonthText: { color: colors.green, fontSize: 11, fontWeight: '900' },
  pickHint: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, textAlign: 'center', paddingVertical: 18 },
  note: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: 14 },
});
