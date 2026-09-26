import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import type { Profile } from '../types';

export function RecoveryDayContent({
  dayOfWeek: _dayOfWeek,
  weightLoss = false,
  profile,
}: {
  dayOfWeek: number;
  weightLoss?: boolean;
  profile?: Profile;
}) {
  const isSupermax = profile?.experience === 'supermax';
  const isElite = profile?.experience === 'elite';
  const isVeterano = (profile?.experience === 'advanced' || profile?.frequency === 6) && !isElite && !isSupermax;
  const isGoodOlIron = profile?.experience === 'intermediate' || profile?.frequency === 3;

  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <View style={styles.card}>
      <Text style={styles.title}>
        {weightLoss
          ? '可选短步行'
          : isSupermax
          ? '登峰造极 · 极容量代谢冲刷'
          : isElite
          ? '闭关修炼 · 神经与结缔组织减压'
          : isVeterano
          ? '炉火纯青 · 弹性恢复原则'
          : isGoodOlIron
          ? '渐入佳境 · 24h 神经系统重置'
          : '初试身手 · 牢房漫步与软组织休养'}
      </Text>
      <Text style={styles.body}>
        {weightLoss
          ? '精神状态允许时，饭后或白天分段轻松走 10–20 分钟；这不是必须完成的“补课”。疲劳时直接休息。'
          : isSupermax
          ? '经历数百组大容量耐力循环后，身体代谢物高度堆积。今日以轻柔步行促进淋巴循环，配合下午平躺抬腿排空下肢血液，避免任何加练。'
          : isElite
          ? '双循环大课（六艺加三大专项）对中枢神经与深层小肌群消耗极大。严禁离心运动，保证 9 小时以上深度睡眠，完成组织超量修复。'
          : isVeterano
          ? '践行原著第 12 章弹性原则：若感到疲劳或关节有紧绷反应，可随时在此日额外插入完全静养，不受一周七天的机械限制。'
          : isGoodOlIron
          ? '周末双休是神经系统与能量储备的再充能窗口。远离剧烈抓握与核心负荷，通过优质蛋白与充足水分加速肌糖原与胶原重塑。'
          : '今天可以完全休息，也可舒适步行 10–20 分钟。周二、周四的轻量恢复课不是强度测试；有疲劳或不适时可以跳过，不需要补课。'}
      </Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.title}>{weightLoss ? '检查恢复与饮食' : '《囚徒健身 2》关节三诀哲学'}</Text>
      <Text style={styles.body}>
        {weightLoss
          ? '关注睡眠、饥饿和酸痛；若连续几天明显疲劳或力量下降，不再追加有氧，先调整休息与进食。'
          : '关节三诀包含桥式、直角式和扭转式，应选轻松可控的版本。初试身手从短桥、屈膝辅助支撑和舒适扭转开始，短时分组，不要求完整高难姿势。它们不是伤病治疗，也不保证免于受伤。'}
      </Text>
    </View>
    <View style={styles.notice}>
      <Text style={styles.noticeText}>恢复日不安排新的极限测试。若关节疼痛持续、加重或伴随明显肿胀，请暂停相关动作并咨询专业人士。</Text>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8F3' },
  content: { padding: 14, gap: 10 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14 },
  title: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  body: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 6 },
  notice: { padding: 14, borderRadius: radius.md, backgroundColor: '#FFF5DF' },
  noticeText: { color: '#715A31', fontSize: 12, lineHeight: 19 },
});
