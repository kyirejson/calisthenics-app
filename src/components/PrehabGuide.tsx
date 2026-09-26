import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import type { Profile } from '../types';

const tips = [
  { number: '01', title: '训练前 · 逐步升温', body: '先活动到身体暖起来，再用主动作的简单版本做 1–2 组。手腕、肩和髋只在舒适范围内活动。' },
  { number: '02', title: '训练中 · 保持可控', body: '选择能稳定完成的阶数；组间休息可按呼吸和动作质量延长。动作变形时，降阶或减少训练量。' },
  { number: '03', title: '疼痛时 · 及时停止', body: '停止引发疼痛的动作；持续、加重或伴随明显肿胀时，咨询医生或物理治疗师。' },
];

export function PrehabGuideModal({ visible, onClose, profile }: { visible: boolean; onClose: () => void; profile?: Profile }) {
  const weightLoss = profile?.goal === 'weight_loss';
  const prisoner = profile?.goal === 'street_mastery';
  const lowImpact = profile ? profile.weight / ((profile.height / 100) ** 2) >= 30 || profile.age >= 55 : false;
  const displayedTips = weightLoss ? [
    { number: '01', title: '力量课 · 优先保肌', body: '每周完成至少两次全身力量，推、拉、腿和后链轮换；保留 2–3 次余力，组间按动作质量充分休息。' },
    { number: '02', title: '有氧 · 低冲击起步', body: lowImpact ? '优先快走、舒适骑行等低冲击活动；暂不安排波比跳、冲刺或大量跳跃。以能正常交谈的强度逐步增加。' : '先把可交谈强度的快走或骑行做规律；不必靠冲刺追求“燃脂区间”或运动后额外消耗。' },
    { number: '03', title: '日常活动 · 不硬追步数', body: '可把饭后短步行、久坐起身分散到一天。先观察自己的基线，再逐渐增加；没有人人必须达到的单一步数门槛。' },
    { number: '04', title: '恢复 · 不补偿性加练', body: '睡眠不足、持续乏力、过度饥饿或力量明显下降时，先减少强度并检查饮食；漏练无需第二天加倍补课。' },
  ] : prisoner ? [
    { number: '01', title: '先热身，再做正式组', body: '先轻松踏步和活动关节，再用当日主动作的简单版本完成热身组。正式组保留余力，组间可按呼吸与动作质量延长休息。' },
    { number: '02', title: '倒立 · 各阶段统一检查', body: '沿用的单日窄距俯卧撑 200 次是应用自定门槛，不是原书或医学标准。未解锁的倒立日改为俯卧撑与颈部准备；头颈、肩腕不适时不做承重倒立，不能靠练颈部替代推举力量评估。' },
    { number: '05', title: '颈部 · 先轻阻力，再核对基础', body: '默认手阻抬头，头部不撑地。原书要求掌握标准桥后才尝试正、反颈桥预备式；应用还需用户确认已接受适宜性评估与指导，成对各一组起步。自动排课每周最多两次，不追求力竭；疼痛、头晕或麻木立即停止。' },
    { number: '03', title: '恢复课 · 选择轻松的版本', body: '初试身手使用短桥、屈膝辅助支撑与舒适坐姿扭转，分次短时保持；不要求完整全桥或 L 型支撑。恢复日不做极限测试，不适时跳过。' },
    { number: '04', title: profile?.frequency === 3 ? '渐入佳境 · 不设固定减量周' : '按恢复状态调整', body: profile?.frequency === 3 ? '不再按第四周自动减少组数。按训练表现稳步推进，持续疲劳或动作质量下降时减少训练、增加休息。' : '睡眠不足、疲劳明显或关节不适时，减少训练或休息，不用加组来补偿漏练。原书恢复建议与应用周期安排并非同一套规则。' },
  ] : tips;
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.backdrop}><View style={styles.sheet}>
      <View style={styles.handle} />
      <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>健康与康复</Text><Text style={styles.title}>{weightLoss ? '减重期，先保住身体' : prisoner ? '六艺进阶，先守住恢复' : '按身体反馈调整训练'}</Text><Text style={styles.subtitle}>{weightLoss ? '训练、日常活动与恢复一起安排，不靠极端强度。' : prisoner ? '四艺打底，桥与倒立按前置条件推进。' : '热身、降阶与充分恢复，比硬撑计划更重要。'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="关闭健康与康复指南" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>{displayedTips.map((tip) => <View key={tip.number} style={styles.card}><Text style={styles.cardNumber}>{tip.number}</Text><View style={styles.cardContent}><Text style={styles.cardTitle}>{tip.title}</Text><Text style={styles.cardBody}>{tip.body}</Text></View></View>)}<View style={styles.notice}><Text style={styles.noticeTitle}>关于“康复”</Text><Text style={styles.noticeText}>这里只提供一般训练安全提示，不能代替伤病诊断或个体康复方案。</Text></View></ScrollView>
      <Pressable accessibilityRole="button" style={styles.action} onPress={onClose}><Text style={styles.actionText}>我知道了</Text></Pressable>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(12,15,10,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '84%', paddingBottom: 22 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#C7C7BE', alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 17 },
  eyebrow: { color: colors.green, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 6 },
  subtitle: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  close: { width: 35, height: 35, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 25, color: colors.inkMuted },
  content: { paddingHorizontal: 18, paddingBottom: 12, gap: 9 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 15, flexDirection: 'row', gap: 11 },
  cardNumber: { color: colors.green, fontSize: 12, fontWeight: '900', width: 22, marginTop: 2 },
  cardContent: { flex: 1 }, cardTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  cardBody: { color: colors.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 6 },
  notice: { borderRadius: radius.md, backgroundColor: '#EBEEE3', padding: 14 },
  noticeTitle: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  noticeText: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  action: { marginHorizontal: 18, marginTop: 6, height: 48, backgroundColor: colors.lime, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: colors.ink, fontSize: 14, fontWeight: '900' },
});
