import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppGlyph } from './AppGlyph';
import { appPalette as p } from '../theme';
import type { ExperienceLevel } from '../types';

const stages: Array<{ key: ExperienceLevel; numeral: string; name: string; frequency: number; summary: string; detail: string }> = [
  { key: 'beginner', numeral: 'I', name: '初试身手', frequency: 2, summary: '四艺基础 · 练习与恢复交替', detail: '周一、周五安排基础训练，重点练习俯卧撑、举腿、引体向上和深蹲。' },
  { key: 'intermediate', numeral: 'II', name: '渐入佳境', frequency: 3, summary: '六艺分组 · 练一日，休一日', detail: '周一、周三、周五分组练习六艺。倒立和桥仍按现有条件开放，不因选择阶段自动解锁。' },
  { key: 'advanced', numeral: 'III', name: '炉火纯青', frequency: 6, summary: '一日一艺 · 短时专注练习', detail: '周一至周六，每天围绕一种主要动作训练，周日休息。' },
  { key: 'elite', numeral: 'IV', name: '闭关修炼', frequency: 6, summary: '三日分化 · 每周双循环', detail: '周一、四拉力与下肢；周二、五推力与腹部；周三、六倒立、桥及辅助训练，周日休息。' },
  { key: 'supermax', numeral: 'V', name: '登峰造极', frequency: 6, summary: '高容量耐力 · 需要充足恢复', detail: '两艺组合的高容量耐力训练。适合基础扎实且恢复充足的训练者，不必为了升级而增加训练量。' },
];

export function TrainingStagePicker({ value, disabled, onSelect, bodyMassIndex, needsFoundation }: {
  value: ExperienceLevel; disabled: boolean; onSelect: (key: ExperienceLevel, frequency: number) => void;
  bodyMassIndex: number; needsFoundation: boolean;
}) {
  const [details, setDetails] = useState(false);
  const selected = stages.find(stage => stage.key === value) || stages[0];
  return <View>
    <Text style={s.title}>训练阶段</Text>
    <Text style={s.subtitle}>按当前基础与恢复能力选择</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="街头健身训练阶段" style={s.list}>
      {stages.map(stage => {
        const active = stage.key === value;
        return <Pressable key={stage.key} accessibilityRole="radio" accessibilityLabel={'阶段 ' + stage.numeral + ' · ' + stage.name + ' · 每周 ' + stage.frequency + ' 练'} accessibilityState={{ checked: active, disabled }} aria-checked={active} aria-disabled={disabled} disabled={disabled} onPress={() => onSelect(stage.key, stage.frequency)} style={[s.row, active && s.activeRow]}>
          <View style={[s.number, active && s.activeNumber]}><Text style={[s.numberText, active && s.activeNumberText]}>{stage.numeral}</Text></View>
          <View style={s.copy}><View style={s.heading}><Text style={[s.name, active && s.activeName]}>{stage.name}</Text><Text style={s.frequency}>{stage.frequency} 练 / 周</Text></View><Text style={s.summary}>{stage.summary}</Text></View>
          <View style={[s.radio, active && s.radioActive]}>{active ? <Text style={s.check}>✓</Text> : null}</View>
        </Pressable>;
      })}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="查看所选阶段说明" accessibilityState={{ expanded: details }} onPress={() => setDetails(current => !current)} style={s.detailTrigger}><Text style={s.detailLabel}>阶段说明</Text><AppGlyph name="chevron" size={14} /></Pressable>
    {details ? <Text style={s.detail}>{selected.detail}</Text> : null}
    {bodyMassIndex >= 28 ? <Text style={s.notice}>自重训练负荷较大，可优先从基础阶段开始。</Text> : null}
    {value === 'intermediate' && needsFoundation ? <Text style={s.notice}>基础动作尚需巩固；倒立与桥不会因切换阶段自动开放。</Text> : null}
    {value === 'supermax' ? <Text style={s.notice}>高容量阶段需谨慎选择，不适时减少训练量或停止。</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  title: { color: p.text, fontSize: 22, lineHeight: 30, fontWeight: '900' }, subtitle: { color: p.muted, fontSize: 12, lineHeight: 20, marginTop: 5, marginBottom: 18 },
  list: { gap: 9 }, row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16, borderWidth: 1, borderColor: p.border, backgroundColor: p.card }, activeRow: { backgroundColor: p.olive, borderColor: p.lime },
  number: { width: 38, height: 38, borderRadius: 12, backgroundColor: p.raised, alignItems: 'center', justifyContent: 'center' }, activeNumber: { backgroundColor: p.lime }, numberText: { color: p.muted, fontSize: 14, fontWeight: '800' }, activeNumberText: { color: p.onLime },
  copy: { flex: 1, minWidth: 0 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }, name: { color: p.text, fontSize: 15, lineHeight: 22, fontWeight: '800' }, activeName: { color: p.lime }, frequency: { color: p.muted, fontSize: 11, lineHeight: 18 }, summary: { color: p.muted, fontSize: 11, lineHeight: 18, marginTop: 3 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: p.faint, alignItems: 'center', justifyContent: 'center' }, radioActive: { backgroundColor: p.lime, borderColor: p.lime }, check: { color: p.onLime, fontWeight: '900', fontSize: 12 },
  detailTrigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, detailLabel: { color: p.muted, fontSize: 12, fontWeight: '700' }, detail: { color: p.muted, fontSize: 12, lineHeight: 21, paddingBottom: 8 }, notice: { color: p.warning, fontSize: 11, lineHeight: 19, padding: 10, borderRadius: 12, backgroundColor: p.warningBackground, marginTop: 8 },
});
