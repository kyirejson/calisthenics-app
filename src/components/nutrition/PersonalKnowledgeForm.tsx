import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { personalQuestions, personalFrequencyChoices, prefillPersonalProfile, type PersonalTrainingProfile } from '../../nutrition/personalKnowledge';
import { useAppStore } from '../../store/AppStore';
import { appPalette as c } from '../../theme';

export function PersonalKnowledgeForm({ onClose }: { onClose: () => void }) {
  const { profile, nutritionJournal, savePersonalTrainingProfile } = useAppStore();
  const [draft, setDraft] = useState<PersonalTrainingProfile | null>(() => profile ? prefillPersonalProfile(profile, nutritionJournal.assistant.personalProfiles?.[profile.goal]) : null);
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!profile || !draft) return null;
  const q = personalQuestions[Math.min(step, 5)];
  const save = async () => {
    if (busy) return; setBusy(true); setError('');
    try { await savePersonalTrainingProfile({ ...draft, updatedAt: new Date().toISOString() }); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : '档案未能保存，请重试。'); }
    finally { setBusy(false); }
  };
  const choices = q.field === 'schedule' ? personalFrequencyChoices(profile).map(n => `每周${n}次`) : q.choices;
  return <View style={s.root} testID="personal-knowledge-questionnaire">
    <View style={s.row}><Text style={s.title}>个人训练档案</Text><Text style={s.small}>{step < 6 ? `${step + 1} / 6` : '核对档案'}</Text></View>
    <Text style={s.small}>只建立助手记忆，不自动改课表。已有设置保留。</Text>
    {step < 6 ? <>
      <Text style={s.question}>{q.title}</Text>
      <View style={s.choices}>{choices.map(value => <Pressable accessibilityRole="button" accessibilityLabel={'档案选择' + value} disabled={busy} key={value} onPress={() => setDraft({ ...draft, [q.field]: value })} style={[s.chip, draft[q.field] === value && s.selected]}><Text style={draft[q.field] === value ? s.dark : s.text}>{value}</Text></Pressable>)}</View>
      <TextInput accessibilityLabel={q.title} placeholder="可补充具体情况，也可跳过" placeholderTextColor={c.muted} value={draft[q.field]} onChangeText={value => setDraft({ ...draft, [q.field]: value })} maxLength={240} multiline editable={!busy} style={s.input} />
      {q.field === 'schedule' ? <Text style={s.small}>可补星期；选择次数只表达需求，实际计划仍以训练设置为准。</Text> : null}
      {q.field === 'baseline' ? <Text style={s.small}>已有训练记录会单独读取，自述能力不视为完成记录或晋级证据。</Text> : null}
      {q.field === 'restrictions' ? <><Text style={s.text}>饮食补充 · 可选</Text><TextInput accessibilityLabel="档案饮食忌口过敏和喜好" value={draft.diet} onChangeText={diet => setDraft({ ...draft, diet })} placeholder="例如不吃香菜、花生过敏；已有记录不用重填" placeholderTextColor={c.muted} maxLength={240} multiline editable={!busy} style={s.input} /><Text style={s.small}>过敏原请在助手对话中明确记录；此处补充说明不会自动修改配餐条件。</Text></> : null}
    </> : <View style={s.summary}>{personalQuestions.map(item => <View key={item.field}><Text style={s.small}>{item.title}</Text><Text style={s.text}>{draft[item.field] || '未填写'}</Text></View>)}<Text style={s.small}>饮食补充</Text><Text style={s.text}>{draft.diet || '未填写'}</Text></View>}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    <View style={s.row}><Pressable accessibilityRole="button" disabled={busy} onPress={() => step ? setStep(step - 1) : onClose()} style={s.secondary}><Text style={s.text}>{step ? '上一步' : '取消'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={step === 6 ? '保存个人训练档案' : '档案下一题'} disabled={busy} onPress={() => step === 6 ? void save() : setStep(step + 1)} style={s.bright}><Text style={s.dark}>{busy ? '保存中…' : step === 6 ? '保存个人档案' : '下一步'}</Text></Pressable></View>
  </View>;
}
const s = StyleSheet.create({ root: { gap: 16 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { color: c.text, fontSize: 22, fontWeight: '800' }, small: { color: c.muted, fontSize: 11, lineHeight: 18 }, text: { color: c.text, fontSize: 13, lineHeight: 21 }, question: { color: c.text, fontSize: 18, fontWeight: '700' }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { padding: 12, minHeight: 44, borderRadius: 12, backgroundColor: c.card }, selected: { backgroundColor: c.lime }, dark: { color: c.onLime, fontSize: 13, fontWeight: '800' }, input: { minHeight: 100, padding: 14, borderRadius: 14, color: c.text, backgroundColor: c.card, borderColor: c.border, borderWidth: 1, fontSize: 14, textAlignVertical: 'top' }, bright: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 12, backgroundColor: c.lime }, secondary: { minHeight: 44, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border }, summary: { gap: 12 }, error: { color: c.warning, fontSize: 12 } });
