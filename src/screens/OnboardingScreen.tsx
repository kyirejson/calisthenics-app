import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, ProgressBar } from '../components/ui';
import { colors, radius } from '../theme';
import type { ExperienceLevel, Goal, Profile } from '../types';
import { useAppStore } from '../store/AppStore';
import { recommendPlanId } from '../data/trainingPlans';
import { generatePersonalPlan, type PlanGenerationStep } from '../data/personalPlan';
import { trainingGoals } from '../data/trainingGoals';

// 囚徒五阶段对应的每周练次；阶段卡是唯一事实来源，生成计划时以它推导 frequency，
// 避免出现"界面显示阶段 I 已选择、计划却按每周 3 练生成阶段 II"的不一致。
const STAGE_FREQUENCY: Record<ExperienceLevel, 2 | 3 | 6> = { beginner: 2, intermediate: 3, advanced: 6, elite: 6, supermax: 6 };

export function OnboardingScreen() {
  const { saveProfile } = useAppStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('训练者');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState('28');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('68');
  const [goal, setGoal] = useState<Goal>('weight_loss');
  const [frequency, setFrequency] = useState(3);
  const [sessionMinutes, setSessionMinutes] = useState(45);
  const [experience, setExperience] = useState<ExperienceLevel>('beginner');
  const [baseline, setBaseline] = useState({ push: false, pull: false, squat: true });
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<PlanGenerationStep | null>(null);
  const [generationError, setGenerationError] = useState('');
  const canContinue = useMemo(() => name.trim() && Number(age) > 12 && Number(height) > 100 && Number(weight) > 30, [name, age, height, weight]);

  useEffect(() => {
    if (Platform.OS !== 'android' || step === 0) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep((value) => Math.max(0, value - 1));
      return true;
    });
    return () => subscription.remove();
  }, [step]);

  const finish = async () => {
    if (generating) return;
    setGenerating(true);
    setGenerationError('');
    const base = {
      name: name.trim(), sex, age: Number(age), height: Number(height), weight: Number(weight), goal, frequency: goal === 'street_mastery' ? STAGE_FREQUENCY[experience] : frequency, sessionMinutes,
      nutritionGoal: goal === 'street_mastery' ? 'performance' as const : 'rapid_loss' as const,
      dietPattern: 'balanced_cn' as const,
      experience,
      planStartedAt: new Date().toISOString(),
      levels: { push: 1, pull: 1, squat: 1, legRaise: 1, bridge: 1, hspu: 1, auxiliary: 1 },
      planLevels: { push: baseline.push ? 5 : 1, pull: baseline.pull ? 5 : 1, squat: baseline.squat ? 5 : 1 },
      trainingRestSeconds: goal === 'street_mastery' ? 180 : 120,
    };
    const planId = recommendPlanId(base);
    const profile: Profile = { ...base, planId };
    try {
      await generatePersonalPlan(profile, saveProfile, setGenerationStep);
    } catch {
      setGenerationError('计划保存失败，请重试。');
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}><Image source={require('../../assets/app-icon.png')} style={styles.brandIcon} /><Text style={styles.brandText}>Uncover</Text></View>
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
              <Text style={styles.subtitle}>选择一个专题开始；其他旧目标暂未开放，已有训练记录会保留。</Text>
              {trainingGoals.map((item) => <Pressable key={item.key} onPress={() => { setGoal(item.key); if (item.key === 'street_mastery' && ![2, 3, 6].includes(frequency)) setFrequency(3); }} style={[styles.choice, goal === item.key && styles.choiceActive]}><View style={{ flex: 1 }}><Text style={styles.choiceTitle}>{item.label}</Text><Text style={styles.choiceDesc}>{item.description}</Text></View>{goal === item.key ? <Text style={styles.activeGoalBadge}>已选择</Text> : null}</Pressable>)}
              {goal === 'street_mastery' ? <Text style={styles.assessmentNote}>按原书提供每周 2、3、6 练。365 天日历用于查看安排，不保证按期解锁六个最终式；每一式仍需逐项验收。</Text> : null}
            </View>
          ) : (
            <View>
              <Text style={styles.kicker}>03 / 安排节奏</Text>
              <Text style={styles.hero}>{goal === 'street_mastery' ? `选择你的${'\n'}囚徒进阶阶段` : `每周练几次，${'\n'}最容易坚持？`}</Text>
              <Text style={styles.subtitle}>{goal === 'street_mastery' ? '原著《囚徒健身》官方五大进阶日程，选择对应你体能与恢复能力的阶段：' : '按你的训练经历、每周天数与单次可用时间生成课程。'}</Text>
              {goal === 'street_mastery' ? (
                <View style={{ gap: 10 }}>
                  {([
                    { key: 'beginner' as const, freq: 2, tag: '阶段 I', name: '初试身手 · 筑基四艺', desc: '每周2练（周一/五）：推拉蹲腿四艺打底，严禁练桥与倒立' },
                    { key: 'intermediate' as const, freq: 3, tag: '阶段 II', name: '渐入佳境 · 六艺合璧', desc: '每周3练（周一/三/五）：六艺两两合流，各练2组全力组' },
                    { key: 'advanced' as const, freq: 6, tag: '阶段 III', name: '炉火纯青 · 一日一艺', desc: '每周6练（周一至六）：每日专注单项微课（6~15分钟）' },
                    { key: 'elite' as const, freq: 6, tag: '阶段 IV', name: '闭关修炼 · 双循环六练', desc: '每周6练（周一至六）：3天分化双循环，六艺加三大专项支持' },
                    { key: 'supermax' as const, freq: 6, tag: '阶段 V', name: '登峰造极 · 超级耐力', desc: '每周6练（周一至六）：两两组合，每项10~50组（每组10次）' },
                  ] as const).map((stage) => {
                    const active = experience === stage.key;
                    return (
                      <Pressable
                        key={stage.key}
                        onPress={() => {
                          setExperience(stage.key);
                          setFrequency(stage.freq);
                        }}
                        style={[styles.choice, active && styles.choiceActive]}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Text style={{ color: active ? colors.lime : '#A1A39C', fontSize: 12, fontWeight: '800' }}>{stage.tag}</Text>
                            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>{stage.name}</Text>
                          </View>
                          <Text style={styles.choiceDesc}>{stage.desc}</Text>
                        </View>
                        {active ? <Text style={styles.activeGoalBadge}>已选择</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <>
                  <View style={styles.frequencyGrid}>{[2, 3, 4, 5, 6].map((item) => <Pressable key={item} onPress={() => setFrequency(item)} style={[styles.frequency, frequency === item && styles.frequencyActive]}><Text style={[styles.frequencyNum, frequency === item && styles.frequencyNumActive]}>{item}</Text><Text style={[styles.frequencyLabel, frequency === item && styles.frequencyNumActive]}>天 / 周</Text></Pressable>)}</View>
                  <Text style={[styles.fieldLabel, { marginTop: 18 }]}>希望每次训练多久（含热身、组间休息）</Text>
                  <View style={styles.pills}>{[20, 30, 45, 60, 75].map((minutes) => <OptionPill key={minutes} label={`${minutes}分钟`} active={sessionMinutes === minutes} onPress={() => setSessionMinutes(minutes)} />)}</View>
                  <Text style={[styles.fieldLabel, { marginTop: 18 }]}>最近的训练基础</Text>
                  <View style={styles.pills}><OptionPill label="刚开始 · 近2个月未规律训练" active={experience === 'beginner'} onPress={() => setExperience('beginner')} /><OptionPill label="有基础 · 连续训练3个月以上" active={experience === 'intermediate'} onPress={() => setExperience('intermediate')} /><OptionPill label="高阶 · 稳定训练1年以上" active={experience === 'advanced'} onPress={() => setExperience('advanced')} /></View>
                  <View style={styles.tip}><Text style={styles.tipTitle}>{frequency <= 2 ? '稳妥入门' : frequency <= 4 ? '循序进阶' : '高频分日'}</Text><Text style={styles.tipBody}>{frequency <= 2 ? '适合零基础或时间有限，从关节适应开始。' : frequency <= 4 ? '按身体反馈逐步增加训练，不强行晋级。' : '保持规律作息与充足睡眠，确保超量恢复。'}</Text></View>
                </>
              )}
            </View>
          )}
          <View style={{ flex: 1, minHeight: 24 }} />
          {generating && generationStep ? <View style={styles.generation}><Text style={styles.generationTitle}>{generationStep.label}</Text><ProgressBar value={generationStep.progress} color={colors.lime} /><Text style={styles.generationPercent}>{generationStep.progress}%</Text></View> : null}
          {generationError ? <Text style={styles.generationError}>{generationError}</Text> : null}
          <Button label={generating ? '正在生成计划…' : step === 2 ? '生成我的计划' : '继续'} variant="lime" disabled={generating || (step === 0 && !canContinue)} onPress={() => step === 2 ? void finish() : setStep(step + 1)} />
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

function OptionPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.optionPill, active && styles.optionPillActive]}><Text style={[styles.optionPillText, active && styles.optionPillTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  content: { padding: 24, minHeight: '100%' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 26 },
  brandIcon: { width: 36, height: 36, borderRadius: 10 },
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
  activeGoalBadge: { color: colors.lime, fontSize: 10, fontWeight: '900', marginLeft: 10 },
  frequencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  frequency: { width: '30%', minWidth: 92, paddingVertical: 19, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: '#373A32', backgroundColor: '#22241F' },
  frequencyActive: { backgroundColor: colors.lime, borderColor: colors.lime }, frequencyNum: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' }, frequencyLabel: { color: '#AEB1A8', fontWeight: '700', marginTop: 2 }, frequencyNumActive: { color: colors.ink },
  tip: { marginTop: 22, padding: 18, borderRadius: radius.md, backgroundColor: '#262822' }, tipTitle: { color: colors.lime, fontWeight: '800', fontSize: 15 }, tipBody: { color: '#C5C7C0', marginTop: 7, lineHeight: 20 },
  assessmentNote: { color: '#AEB1A8', fontSize: 11, lineHeight: 17, marginTop: 12 },
  generation: { marginBottom: 16, gap: 7 }, generationTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, generationPercent: { color: colors.lime, fontSize: 11, textAlign: 'right' }, generationError: { color: '#FFC7BF', fontSize: 12, marginBottom: 10 },
  back: { color: '#AEB1A8', textAlign: 'center', padding: 16, fontWeight: '700' },
});
