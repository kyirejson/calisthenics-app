import { StyleSheet } from 'react-native';
import { appPalette as p } from '../theme';

export const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

/** Shared editorial Today template: dates → plan controls → course → numbered tasks → start. */
export const todayTrainingStyles = StyleSheet.create({
  calendarRow: { flexDirection: 'row', gap: 4, marginTop: 2, marginBottom: 2 },
  calendarDay: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 7, borderRightWidth: 1, borderColor: '#283430', alignItems: 'center', justifyContent: 'center' },
  calendarDayToday: { borderColor: '#4E602C' }, calendarDayActive: { backgroundColor: '#252F15', borderColor: 'transparent' },
  calendarWeek: { color: p.muted, fontSize: 12 }, calendarDate: { color: p.text, fontSize: 19, fontWeight: '800', marginTop: 2 }, calendarTextActive: { color: p.lime },
  calendarStatus: { width: 3, height: 3, borderRadius: 2, marginTop: 2 }, calendarStatusComplete: { backgroundColor: p.lime }, calendarStatusPartial: { backgroundColor: '#88A5B5' },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 44 }, scheduleTitle: { color: '#B9C2B7', fontSize: 14, fontWeight: '700' },
  scheduleActions: { flexDirection: 'row', alignItems: 'center', gap: 3 }, calendarDetails: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  frequencyTrigger: { minHeight: 44, borderRadius: 10, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#344137', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 1 }, frequencyTriggerText: { color: '#C5CEC3', fontSize: 12, fontWeight: '500' },
  course: { minHeight: 82, marginTop: 3, paddingTop: 2, paddingBottom: 2, position: 'relative', overflow: 'hidden' }, courseCompact: { minHeight: 74 },
  courseKickerRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3 }, courseAccent: { width: 3, height: 12, backgroundColor: p.lime }, courseKicker: { color: '#ABB6A8', fontSize: 13, lineHeight: 16, fontWeight: '700' },
  courseCopy: { borderLeftWidth: 1, borderLeftColor: '#7E952D', paddingLeft: 10, zIndex: 1 }, courseTitle: { color: '#F0F3E9', fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -1 }, courseTitleCompact: { fontSize: 28, lineHeight: 32 }, courseSubtitle: { color: '#A7B1A5', fontSize: 12, lineHeight: 16, marginTop: 2 }, courseRoute: { position: 'absolute', right: 0, bottom: 3, opacity: .5 },
  actionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }, todayWorkoutList: { gap: 8 },
  startDock: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 8, marginBottom: 80 }, startAction: { marginRight: 66 },
  startButton: { minHeight: 54, paddingHorizontal: 14, borderRadius: 14, backgroundColor: p.lime, alignItems: 'center', justifyContent: 'center' }, startButtonText: { color: p.onLime, fontSize: 20, lineHeight: 26, fontWeight: '900' },
  restCard: { padding: 18, borderRadius: 16, backgroundColor: p.card, borderWidth: 1, borderColor: p.border }, restTitle: { color: p.text, fontSize: 15, lineHeight: 22, fontWeight: '700' }, restText: { color: p.muted, fontSize: 12, lineHeight: 19, marginTop: 5 }, pressed: { opacity: .7 },
});
