import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/ui';
import { colors, radius } from '../theme';
import type { Goal, Profile } from '../types';
import { useAppStore } from '../store/AppStore';
import { getTrainingPlan, recommendPlanId } from '../data/trainingPlans';

const goals: Array<{ key: Goal; label: string; desc: string }> = [
  { key: 'strength', label: '提升力量', desc: '稳步解锁更高难度动作' },
  { key: 'gain', label: '增肌塑形', desc: '提高训练容量与肌肉质量' },
  { key: 'fat_loss', label: '减脂塑形', desc: '力量训练搭配能量管理' },
  { key: 'health', label: '健康体能', desc: '改善活动度与日常状态' },
];

export function OnboardingScreen() {
  const { saveProfile } = useAppStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('训练者');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState('28');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('68');
  const [goal, setGoal] = useState<Goal>('strength');
  const [frequency, setFrequency] = useState(3);
  const [experience, setExperience] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const canContinue = useMemo(() => name.trim() && Number(age) > 12 && Number(height) > 100 && Number(weight) > 30, [name, age, height, weight]);

  useEffect(() => {
    if (Platform.OS !== 'android' || step === 0) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep((value) => Math.max(0, value - 1));
      return true;
    });
    return () => subscription.remove();
  }, [step]);

  const finish = () => {
    const base = {
      name: name.trim(), sex, age: Number(age), height: Number(height), weight: Number(weight), goal, frequency,
      nutritionGoal: goal === 'gain' ? 'muscle_gain' as const : goal === 'strength' ? 'performance' as const : goal === 'fat_loss' ? 'fat_loss' as const : 'maintain' as const,
      dietPattern: 'balanced_cn' as const,
      experience,
      planStartedAt: new Date().toISOString(),
      levels: { push: 1, pull: 1, squat: 1, legRaise: 1, bridge: 1, hspu: 1, auxiliary: 1 },
    };
    const planId = recommendPlanId(base);
    const profile: Profile = { ...base, planId, frequency: getTrainingPlan(planId).frequency };
    void saveProfile(profile);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}><Text style={styles.brandMark}>涅</Text><Text style={styles.brandText}>涅槃</Text></View>
          <View style={styles.progress}><View style={[styles.progressFill, { width: `${((step + 1) / 3) * 100}%` }]} /></View>

          {step === 0 ? (
            <View>
              <Text style={styles.kicker}>01 / 建立档案</Text>
              <Text style={styles.hero}>从你的身体，{`\n`}开始训练。</Text>
              <Text style={styles.subtitle}>这些信息只保存在你的手机，用于计算训练量和恢复建议。</Text>
              <Field label="怎么称呼你" value={name} onChangeText={setName} />
              <View style={styles.inline}><View style={styles.inlineField}><Field label="年龄" value={age} onChangeText={setAge} keyboardType="number-pad" /></View><View style={{ width: 12 }} /><View style={styles.inlineField}><Field label="身高 cm" value={height} onChangeText={setHeight} keyboardType="decimal-pad" /></View></View>
              <Field label="体重 kg" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
              <View style={styles.pills}><OptionPill label="男性" active={sex === 'male'} onPress={() => setSex('male')} /><OptionPill label="女性" active={sex === 'female'} onPress={() => setSex('female')} /></View>
            </View>
          ) : step === 1 ? (
            <View>
              <Text style={styles.kicker}>02 / 训练目标</Text>
              <Text style={styles.hero}>你想成为{`\n`}怎样的自己？</Text>
              <Text style={styles.subtitle}>目标会影响训练容量和建议节奏，之后可随时修改。</Text>
              {goals.map((item) => <Choice key={item.key} title={item.label} desc={item.desc} selected={goal === item.key} onPress={() => setGoal(item.key)} />)}
            </View>
          ) : (
            <View>
              <Text style={styles.kicker}>03 / 安排节奏</Text>
              <Text style={styles.hero}>每周练几次，{`\n`}最容易坚持？</Text>
              <Text style={styles.subtitle}>我们会自动安排训练日与休息日，不需要你每天做决定。</Text>
              <View style={styles.frequencyGrid}>{[2, 3, 4, 5, 6].map((item) => <Pressable key={item} onPress={() => setFrequency(item)} style={[styles.frequency, frequency === item && styles.frequencyActive]}><Text style={[styles.frequencyNum, frequency === item && styles.frequencyNumActive]}>{item}</Text><Text style={[styles.frequencyLabel, frequency === item && styles.frequencyNumActive]}>天 / 周</Text></Pressable>)}</View>
              <Text style={styles.fieldLabel}>你的训练经验</Text>
              <View style={styles.pills}><OptionPill label="刚开始" active={experience === 'beginner'} onPress={() => setExperience('beginner')} /><OptionPill label="有基础" active={experience === 'intermediate'} onPress={() => setExperience('intermediate')} /><OptionPill label="高阶" active={experience === 'advanced'} onPress={() => setExperience('advanced')} /></View>
              <View style={styles.tip}><Text style={styles.tipTitle}>{frequency <= 2 ? '稳妥入门' : frequency <= 4 ? '推荐节奏' : '高频训练'}</Text><Text style={styles.tipBody}>{frequency <= 2 ? '适合零基础或时间有限，从关节适应开始。' : frequency <= 4 ? '力量、恢复与生活节奏之间更容易平衡。' : '适合已有训练基础的人，注意睡眠与营养。'}</Text></View>
            </View>
          )}
          <View style={{ flex: 1, minHeight: 24 }} />
          <Button label={step === 2 ? '生成我的计划' : '继续'} variant="lime" disabled={step === 0 && !canContinue} onPress={() => step === 2 ? finish() : setStep(step + 1)} />
          {step > 0 ? <Pressable onPress={() => setStep(step - 1)}><Text style={styles.back}>返回上一步</Text></Pressable> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...inputProps} style={styles.input} placeholderTextColor="#A1A39C" /></View>;
}

function Choice({ title, desc, selected, onPress }: { title: string; desc: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceActive]}><View style={{ flex: 1 }}><Text style={styles.choiceTitle}>{title}</Text><Text style={styles.choiceDesc}>{desc}</Text></View><View style={[styles.radio, selected && styles.radioActive]}>{selected ? <View style={styles.radioDot} /> : null}</View></Pressable>;
}

function OptionPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.optionPill, active && styles.optionPillActive]}><Text style={[styles.optionPillText, active && styles.optionPillTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  content: { padding: 24, minHeight: '100%' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 26 },
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.lime, color: colors.ink, textAlign: 'center', lineHeight: 34, fontWeight: '900', fontSize: 17 },
  brandText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  progress: { height: 3, backgroundColor: '#34372F', marginBottom: 42 },
  progressFill: { height: 3, backgroundColor: colors.lime },
  kicker: { color: colors.lime, fontSize: 12, letterSpacing: 1.5, fontWeight: '800', marginBottom: 14 },
  hero: { color: '#FFFFFF', fontSize: 38, lineHeight: 45, fontWeight: '900', letterSpacing: -1.4 },
  subtitle: { color: '#AEB1A8', fontSize: 15, lineHeight: 23, marginTop: 14, marginBottom: 26 },
  field: { marginBottom: 14 }, fieldLabel: { color: '#AEB1A8', fontSize: 12, fontWeight: '700', marginBottom: 7 },
  input: { backgroundColor: '#262822', color: '#FFFFFF', height: 54, width: '100%', minWidth: 0, borderRadius: radius.sm, paddingHorizontal: 16, fontSize: 17, borderWidth: 1, borderColor: '#373A32' },
  inline: { flexDirection: 'row', width: '100%' }, inlineField: { flex: 1, minWidth: 0 }, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  optionPill: { minHeight: 40, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: '#44483F', backgroundColor: '#22241F', alignItems: 'center', justifyContent: 'center' }, optionPillActive: { backgroundColor: colors.lime, borderColor: colors.lime }, optionPillText: { color: '#C5C7C0', fontSize: 13, fontWeight: '800' }, optionPillTextActive: { color: colors.ink },
  choice: { flexDirection: 'row', alignItems: 'center', padding: 17, borderRadius: radius.md, borderWidth: 1, borderColor: '#373A32', backgroundColor: '#22241F', marginBottom: 12 },
  choiceActive: { borderColor: colors.lime, backgroundColor: '#29301C' },
  choiceTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginBottom: 4 }, choiceDesc: { color: '#AEB1A8', fontSize: 13 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#656960', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.lime }, radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.lime },
  frequencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  frequency: { width: '30%', minWidth: 92, paddingVertical: 19, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: '#373A32', backgroundColor: '#22241F' },
  frequencyActive: { backgroundColor: colors.lime, borderColor: colors.lime }, frequencyNum: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' }, frequencyLabel: { color: '#AEB1A8', fontWeight: '700', marginTop: 2 }, frequencyNumActive: { color: colors.ink },
  tip: { marginTop: 22, padding: 18, borderRadius: radius.md, backgroundColor: '#262822' }, tipTitle: { color: colors.lime, fontWeight: '800', fontSize: 15 }, tipBody: { color: '#C5C7C0', marginTop: 7, lineHeight: 20 },
  back: { color: '#AEB1A8', textAlign: 'center', padding: 16, fontWeight: '700' },
});
