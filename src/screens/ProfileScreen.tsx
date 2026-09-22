import React from 'react';
import { Alert, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { Card, Header, Page, SectionTitle, commonStyles } from '../components/ui';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';

export function ProfileScreen({ onPlans }: { onPlans: () => void }) {
  const { profile, sessions, settings, updateSettings, exportData, clearData } = useAppStore();
  if (!profile) return null;
  const shareBackup = () => void Share.share({ title: '自重进阶数据备份', message: exportData() });
  const confirmClear = () => Alert.alert('清除全部数据？', '训练记录和个人档案都会从本机移除，此操作无法撤销。', [{ text: '取消', style: 'cancel' }, { text: '确认清除', style: 'destructive', onPress: () => void clearData() }]);

  return <Page><Header eyebrow="仅存储在本机" title="我的" />
    <View style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{profile.name.slice(0, 1)}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>{profile.name}</Text><Text style={styles.profileSub}>{profile.age} 岁 · {profile.height} cm · {profile.weight} kg</Text></View><View style={styles.level}><Text style={styles.levelText}>{sessions.length} 训</Text></View></View>
    <SectionTitle title="训练" />
    <Card style={styles.list}><MenuRow icon="▦" title="训练计划" sub={`每周 ${profile.frequency} 天`} onPress={onPlans} /><MenuRow icon="◎" title="训练目标" sub={goalName(profile.goal)} /><MenuRow icon="↗" title="我的数据" sub={`${sessions.length} 条训练记录`} /></Card>
    <SectionTitle title="偏好" />
    <Card style={styles.list}><ToggleRow icon="⌁" title="震动反馈" value={settings.vibration} onValueChange={(v) => void updateSettings({ vibration: v })} /><ToggleRow icon="◖" title="提示音" value={settings.sound} onValueChange={(v) => void updateSettings({ sound: v })} /><MenuRow icon="◷" title="默认组间休息" sub={`${settings.restSeconds} 秒`} onPress={() => void updateSettings({ restSeconds: settings.restSeconds === 60 ? 90 : settings.restSeconds === 90 ? 120 : 60 })} /></Card>
    <SectionTitle title="数据与隐私" />
    <Card style={styles.list}><MenuRow icon="⇧" title="导出 JSON 备份" sub="通过系统分享保存" onPress={shareBackup} /><MenuRow icon="⌫" title="清除本机数据" danger onPress={confirmClear} /></Card>
    <Text style={styles.version}>自重进阶 App · v1.0.0{`\n`}数据默认不上传云端</Text>
  </Page>;
}

function MenuRow({ icon, title, sub, danger, onPress }: { icon: string; title: string; sub?: string; danger?: boolean; onPress?: () => void }) { return <Pressable onPress={onPress} style={styles.menuRow}><View style={[styles.menuIcon, danger && { backgroundColor: '#FCEAE7' }]}><Text style={[styles.menuIconText, danger && { color: colors.danger }]}>{icon}</Text></View><Text style={[styles.menuTitle, danger && { color: colors.danger }]}>{title}</Text><Text style={styles.menuSub}>{sub}</Text>{onPress ? <Text style={styles.chevron}>›</Text> : null}</Pressable>; }
function ToggleRow({ icon, title, value, onValueChange }: { icon: string; title: string; value: boolean; onValueChange: (value: boolean) => void }) { return <View style={styles.menuRow}><View style={styles.menuIcon}><Text style={styles.menuIconText}>{icon}</Text></View><Text style={styles.menuTitle}>{title}</Text><Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#D9D8D2', true: colors.limeDark }} thumbColor="#FFFFFF" /></View>; }
function goalName(goal: string) { return ({ strength: '提升力量', gain: '增肌塑形', cut: '减脂', health: '健康体能' } as Record<string,string>)[goal] || goal; }
const styles = StyleSheet.create({
  profileCard: { backgroundColor: colors.ink, padding: 20, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center' }, avatar: { width: 58, height: 58, borderRadius: 19, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginRight: 15 }, avatarText: { color: colors.ink, fontSize: 25, fontWeight: '900' }, name: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' }, profileSub: { color: '#AEB1A8', fontSize: 12, marginTop: 5 }, level: { backgroundColor: '#32352D', paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill }, levelText: { color: colors.lime, fontSize: 11, fontWeight: '800' },
  list: { paddingVertical: 2 }, menuRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, menuIcon: { width: 35, height: 35, borderRadius: 11, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, menuIconText: { color: colors.ink, fontSize: 16, fontWeight: '900' }, menuTitle: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '700' }, menuSub: { color: colors.inkMuted, fontSize: 12 }, chevron: { color: colors.inkMuted, fontSize: 24, marginLeft: 8 }, version: { textAlign: 'center', color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 28 },
});
