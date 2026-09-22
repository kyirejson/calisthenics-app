import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Header, Page, ProgressBar, SectionTitle, commonStyles } from '../components/ui';
import { categories } from '../data/catalog';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';

export function ProgressScreen() {
  const { profile, sessions } = useAppStore();
  if (!profile) return null;
  const strengthSessions = sessions.filter((item) => item.kind !== 'running');
  const totalReps = strengthSessions.reduce((sum, item) => sum + item.totalReps, 0);
  const totalMinutes = Math.round(sessions.reduce((sum, item) => sum + item.durationSeconds, 0) / 60);
  const thisMonth = sessions.filter((item) => { const d = new Date(item.completedAt); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).length;
  const weeks = useMemo(() => Array.from({ length: 7 }, (_, reverse) => { const d = new Date(); d.setDate(d.getDate() - (6 - reverse)); const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; const count = sessions.filter((s) => { const sd = new Date(s.completedAt); return `${sd.getFullYear()}-${sd.getMonth()}-${sd.getDate()}` === key; }).length; return { label: ['日','一','二','三','四','五','六'][d.getDay()], count }; }), [sessions]);
  const max = Math.max(1, ...weeks.map((item) => item.count));
  const levelCategories = categories.filter((item) => !['all', 'power'].includes(item.key));

  return <Page><Header eyebrow="你的训练档案" title="进阶" />
    <View style={styles.summary}>
      <View style={styles.summaryMain}><Text style={styles.summaryLabel}>累计训练</Text><Text style={styles.summaryValue}>{strengthSessions.length}</Text><Text style={styles.summaryUnit}>次完整训练</Text></View>
      <View style={styles.summarySide}><MiniMetric label="总动作次数" value={totalReps.toLocaleString()} /><View style={styles.divider} /><MiniMetric label="训练时长" value={`${totalMinutes} 分`} /></View>
    </View>
    <SectionTitle title="近 7 天" />
    <Card><View style={styles.chart}>{weeks.map((item, index) => <View key={index} style={styles.barSlot}><View style={styles.barArea}><View style={[styles.bar, { height: Math.max(5, (item.count / max) * 88), backgroundColor: item.count ? colors.lime : '#ECEAE3' }]} /></View><Text style={styles.barLabel}>{item.label}</Text></View>)}</View><View style={styles.chartFooter}><Text style={styles.chartFooterText}>本月已完成 {thisMonth} 次</Text><Text style={styles.chartFooterStrong}>{sessions.length ? '保持节奏' : '从第一次训练开始'}</Text></View></Card>
    <SectionTitle title="六艺等级" />
    <Card style={{ paddingVertical: 8 }}>{levelCategories.map((item, index) => { const level = profile.levels[item.key] || 1; return <View key={item.key} style={[styles.levelRow, index < levelCategories.length - 1 && styles.levelBorder]}><View style={styles.levelIcon}><Text style={styles.levelIconText}>{item.icon}</Text></View><View style={{ flex: 1 }}><View style={commonStyles.between}><Text style={styles.levelName}>{item.label}</Text><Text style={styles.levelNum}>第 {level} 式</Text></View><View style={{ marginTop: 9 }}><ProgressBar value={level * 10} color={colors.ink} /></View></View></View>; })}</Card>
  </Page>;
}

function MiniMetric({ label, value }: { label: string; value: string }) { return <View><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue}>{value}</Text></View>; }
const styles = StyleSheet.create({
  summary: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: 22, flexDirection: 'row' }, summaryMain: { flex: 1.1 }, summaryLabel: { color: '#AEB1A8', fontSize: 12, fontWeight: '700' }, summaryValue: { color: colors.lime, fontSize: 55, lineHeight: 61, fontWeight: '900', marginTop: 4 }, summaryUnit: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' }, summarySide: { flex: 1, justifyContent: 'center', paddingLeft: 20, borderLeftWidth: 1, borderLeftColor: '#3B3E36' }, divider: { height: 1, backgroundColor: '#3B3E36', marginVertical: 15 }, miniLabel: { color: '#9DA097', fontSize: 11 }, miniValue: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', marginTop: 4 },
  chart: { height: 125, flexDirection: 'row', alignItems: 'flex-end' }, barSlot: { flex: 1, alignItems: 'center' }, barArea: { height: 94, justifyContent: 'flex-end' }, bar: { width: 18, borderRadius: 9 }, barLabel: { color: colors.inkMuted, fontSize: 11, marginTop: 8, fontWeight: '700' }, chartFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 15, borderTopWidth: 1, borderTopColor: colors.line }, chartFooterText: { color: colors.inkMuted, fontSize: 12 }, chartFooterStrong: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  levelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 }, levelBorder: { borderBottomWidth: 1, borderBottomColor: colors.line }, levelIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginRight: 13 }, levelIconText: { color: colors.ink, fontSize: 18, fontWeight: '900' }, levelName: { color: colors.ink, fontSize: 15, fontWeight: '800' }, levelNum: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
});
