import React, { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { calculateNutritionPlan, dietPatterns, nutritionGoals } from '../data/nutritionPlanner';
import { getPlanDay } from '../data/trainingPlans';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import type { DietPattern, NutritionGoal } from '../types';
import { confirmAction, showMessage } from '../utils/confirm';

export function NutritionScreen({ onBack }: { onBack: () => void }) {
  const { profile, saveProfile } = useAppStore();
  const [goal, setGoal] = useState<NutritionGoal>(profile?.nutritionGoal || 'maintain');
  const [pattern, setPattern] = useState<DietPattern>(profile?.dietPattern || 'balanced_cn');
  const [showBasis, setShowBasis] = useState(false);
  if (!profile) return null;
  const todayPlan = getPlanDay(profile);
  const today = todayPlan.day;
  const isTrainingDay = today.type === 'strength' || today.type === 'cardio';
  const draftProfile = { ...profile, frequency: todayPlan.plan.frequency, nutritionGoal: goal, dietPattern: pattern };
  const plan = calculateNutritionPlan(draftProfile, isTrainingDay);
  const saveChoice = async (nextGoal: NutritionGoal, nextPattern: DietPattern) => {
    try {
      await saveProfile({ ...profile, nutritionGoal: nextGoal, dietPattern: nextPattern });
      setGoal(nextGoal); setPattern(nextPattern);
    } catch {
      showMessage('保存失败', '营养选择没有保存，请稍后重试。');
    }
  };
  const selectGoal = (nextGoal: NutritionGoal) => {
    const candidate = calculateNutritionPlan({ ...profile, frequency: todayPlan.plan.frequency, nutritionGoal: nextGoal, dietPattern: pattern }, isTrainingDay);
    if (candidate.safetyLevel === 'blocked') {
      showMessage(candidate.safetyTitle || '当前方案不可用', candidate.safetyMessage || '请先检查个人资料，再选择营养目标。');
      return;
    }
    void saveChoice(nextGoal, pattern);
  };
  const selectPattern = (nextPattern: DietPattern) => {
    const candidate = calculateNutritionPlan({ ...profile, frequency: todayPlan.plan.frequency, nutritionGoal: goal, dietPattern: nextPattern }, isTrainingDay);
    if (candidate.safetyLevel === 'blocked') {
      showMessage(candidate.safetyTitle || '当前方案不可用', candidate.safetyMessage || '请先检查个人资料，再选择饮食模式。');
      return;
    }
    if (nextPattern === 'keto') {
      confirmAction(
        '启用生酮前请确认',
        candidate.caution || '生酮属于限制性饮食，请先确认自己没有相关禁忌。',
        () => { void saveChoice(goal, nextPattern); },
        { confirmLabel: '我已确认，启用', cancelLabel: '暂不启用', destructive: true },
      );
      return;
    }
    void saveChoice(goal, nextPattern);
  };

  return <SafeAreaView style={styles.safe}>
    <View style={styles.top}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.title}>今日饮食</Text><View style={{ width: 42 }} /></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.sub}>选择你的营养目标和饮食模式。下方是今日建议，不是已摄入记录。</Text>
      {plan.safetyLevel !== 'ok' ? <View accessibilityRole="alert" style={[styles.safetyCard, plan.safetyLevel === 'blocked' ? styles.safetyBlocked : styles.safetyWarning]}>
        <Text style={styles.safetyEyebrow}>{plan.safetyLevel === 'blocked' ? '已自动启用安全保护' : '重要安全提示'}</Text>
        <Text style={styles.safetyTitle}>{plan.safetyTitle}</Text>
        <Text style={styles.safetyText}>{plan.safetyMessage}</Text>
        <Text style={styles.safetyMeta}>当前生效：{plan.goalLabel} · {dietPatterns.find((item) => item.key === plan.pattern)?.label}</Text>
      </View> : null}

      <Text style={styles.sectionTitle}>你的营养目标</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{nutritionGoals.map((item) => <Pressable key={item.key} onPress={() => selectGoal(item.key)} style={[styles.choice, plan.goal === item.key && styles.choiceActive]}><Text style={[styles.choiceTitle, plan.goal === item.key && styles.choiceTitleActive]}>{item.label}</Text><Text style={[styles.choiceSub, plan.goal === item.key && styles.choiceSubActive]}>{item.subtitle}</Text></Pressable>)}</ScrollView>

      <Text style={styles.sectionTitle}>饮食模式</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{dietPatterns.map((item) => <Pressable key={item.key} onPress={() => selectPattern(item.key)} style={[styles.pattern, plan.pattern === item.key && styles.patternActive]}><Text style={[styles.patternTitle, plan.pattern === item.key && styles.patternTitleActive]}>{item.label}</Text><Text style={styles.patternSub}>{item.subtitle}</Text></Pressable>)}</ScrollView>

      {plan.safetyLevel === 'blocked' ? <View style={styles.blockedAdvice}>
        <Text style={styles.blockedAdviceTitle}>先保持规律、均衡饮食</Text>
        <Text style={styles.blockedAdviceText}>按正常饥饿感安排三餐，搭配蔬菜、水果、全谷物和鱼禽蛋奶豆；目前不提供热量、宏量或食物份量目标。请先核对个人资料，并根据上方提示寻求个体评估。</Text>
      </View> : <>
      <View style={styles.energyCard}>
        <View style={styles.energyTop}><View><Text style={styles.kicker}>{isTrainingDay ? '训练日目标' : '恢复日目标'} · {plan.goalLabel}</Text><Text style={styles.calories}>{plan.targetCalories}<Text style={styles.calorieUnit}> kcal</Text></Text></View><View style={styles.deltaBadge}><Text style={styles.delta}>{plan.calorieDelta > 0 ? '+' : ''}{plan.calorieDelta}</Text><Text style={styles.deltaLabel}>对比维持</Text></View></View>
        <Text style={styles.strategy}>{plan.strategy}</Text>
        <View style={styles.energyRow}><Mini label="估算基础代谢" value={`${plan.bmr}`} /><Mini label="估算维持消耗" value={`${plan.tdee}`} /><Mini label="饮水" value={`${(plan.waterMl / 1000).toFixed(1)}L`} /></View>
      </View>

      <Text style={styles.sectionTitle}>宏量目标</Text>
      <View style={styles.macroRow}><Macro label="蛋白质" value={plan.protein} unit="g" color={colors.orange} /><Macro label="碳水" value={plan.carbs} unit="g" color={colors.blue} /><Macro label="脂肪" value={plan.fat} unit="g" color={colors.green} /><Macro label="纤维" value={plan.fiber} unit="g+" color="#8B5CF6" /></View>
      <Pressable onPress={() => setShowBasis((value) => !value)} style={styles.basisToggle} accessibilityRole="button">
        <Text style={styles.basisToggleText}>这些数字如何得出</Text><Text style={styles.basisArrow}>{showBasis ? '⌃' : '⌄'}</Text>
      </Pressable>
      {showBasis ? <View style={styles.basisCard}>
        <Text style={styles.basisText}>以年龄、身高、体重及性别估算基础代谢，再按每周训练次数估算维持消耗；这不是代谢测试结果。</Text>
        <Text style={styles.basisText}>今日建议比估算维持消耗{plan.calorieDelta < 0 ? '低' : plan.calorieDelta > 0 ? '高' : '相同'}约 {Math.abs(Math.round(plan.calorieDelta / Math.max(1, plan.tdee) * 100))}%。训练日与恢复日分配不同，但一周平均保持同一目标。</Text>
        <Text style={styles.basisText}>蛋白质按参考体重和目标估算；碳水、脂肪随饮食模式调整。食谱份量只作起点，两周后结合体重趋势、饥饿感和训练表现再调整。</Text>
      </View> : null}

      <Text style={styles.sectionTitle}>今日四餐</Text>
      <Text style={styles.mealHint}>以下是按目标调整过份量的参考组合，右侧热量为该餐预算，并非逐项食材的实测热量。食材品牌、烹饪方式和用油不同，请对照包装信息调整。</Text>
      {plan.meals.map((meal, index) => <View key={meal.name} style={styles.mealCard}><View style={styles.mealTop}><View style={styles.mealIndex}><Text style={styles.mealIndexText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.mealName}>{meal.name} · {meal.timing}</Text><Text style={styles.mealPurpose}>{meal.purpose}</Text></View><Text style={styles.mealCalories}>{meal.calories} kcal</Text></View><View style={styles.foods}>{meal.foods.map((food) => <View key={food} style={styles.foodChip}><Text style={styles.foodText}>{food}</Text></View>)}</View></View>)}
      </>}

      <Text style={styles.sectionTitle}>执行原则</Text>
      <View style={styles.notes}>{plan.principles.map((item, index) => <View key={item} style={styles.noteRow}><Text style={styles.noteNum}>{index + 1}</Text><Text style={styles.noteText}>{item}</Text></View>)}</View>
      {plan.caution ? <View style={styles.caution}><Text style={styles.cautionTitle}>开始前请确认</Text><Text style={styles.cautionText}>{plan.caution}</Text></View> : null}
      <Text style={styles.disclaimer}>计划采用估算值，体重、腰围、饥饿感和训练表现连续记录两周后再调整。它不能替代医生或注册营养师的个体化建议。</Text>
    </ScrollView>
  </SafeAreaView>;
}

function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniValue}>{value}</Text><Text style={styles.miniLabel}>{label}</Text></View>; }
function Macro({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) { return <View style={styles.macro}><View style={[styles.macroDot, { backgroundColor: color }]} /><Text style={styles.macroValue}>{value}<Text style={styles.macroUnit}>{unit}</Text></Text><Text style={styles.macroLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, top: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }, back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, backText: { color: colors.ink, fontSize: 34, lineHeight: 37 }, title: { color: colors.ink, fontWeight: '900', fontSize: 17 },
  content: { padding: 20, paddingBottom: 55 }, sub: { color: colors.inkMuted, fontSize: 13, lineHeight: 20 }, sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', marginTop: 24, marginBottom: 12 }, horizontal: { paddingRight: 20 },
  safetyCard: { borderRadius: radius.md, borderWidth: 1, padding: 15, marginTop: 16 }, safetyBlocked: { backgroundColor: '#FFF0EC', borderColor: '#E9A08D' }, safetyWarning: { backgroundColor: '#FFF8DE', borderColor: '#D7B94B' }, safetyEyebrow: { color: '#8D351F', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, safetyTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 5 }, safetyText: { color: '#644E47', fontSize: 11, lineHeight: 18, marginTop: 6 }, safetyMeta: { color: colors.ink, fontSize: 10, fontWeight: '800', marginTop: 9 },
  choice: { width: 170, minHeight: 86, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, padding: 14, marginRight: 9 }, choiceActive: { backgroundColor: colors.ink, borderColor: colors.ink }, choiceTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, choiceTitleActive: { color: colors.lime }, choiceSub: { color: colors.inkMuted, fontSize: 10, lineHeight: 15, marginTop: 6 }, choiceSubActive: { color: '#BFC2B8' },
  pattern: { width: 145, minHeight: 76, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, padding: 13, marginRight: 9 }, patternActive: { borderColor: colors.limeDark, backgroundColor: '#F0F6DC' }, patternTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' }, patternTitleActive: { color: '#4F6114' }, patternSub: { color: colors.inkMuted, fontSize: 9, lineHeight: 14, marginTop: 5 },
  energyCard: { marginTop: 27, borderRadius: radius.lg, backgroundColor: colors.ink, padding: 20 }, energyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, kicker: { color: colors.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, calories: { color: '#FFFFFF', fontSize: 38, fontWeight: '900', marginTop: 5 }, calorieUnit: { color: '#AEB1A8', fontSize: 12 }, deltaBadge: { backgroundColor: '#30332C', borderRadius: 15, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center' }, delta: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' }, deltaLabel: { color: '#92958C', fontSize: 8, marginTop: 2 }, strategy: { color: '#BFC2B8', fontSize: 12, lineHeight: 18, marginTop: 12 }, energyRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#393C34', marginTop: 17, paddingTop: 15 }, mini: { flex: 1 }, miniValue: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 }, miniLabel: { color: '#888B82', fontSize: 9, marginTop: 3 },
  macroRow: { flexDirection: 'row', gap: 8 }, macro: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 12 }, macroDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 8 }, macroValue: { color: colors.ink, fontSize: 17, fontWeight: '900' }, macroUnit: { fontSize: 9, color: colors.inkMuted }, macroLabel: { color: colors.inkMuted, fontSize: 9, marginTop: 3 },
  basisToggle: { minHeight: 43, marginTop: 10, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  basisToggleText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  basisArrow: { color: colors.inkMuted, fontSize: 18 },
  basisCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 14, marginTop: 7 },
  basisText: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginBottom: 8 },
  mealHint: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: -5, marginBottom: 11 },
  blockedAdvice: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 16, marginTop: 23 }, blockedAdviceTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' }, blockedAdviceText: { color: colors.inkMuted, fontSize: 12, lineHeight: 20, marginTop: 8 },
  mealCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 15, marginBottom: 10 }, mealTop: { flexDirection: 'row', alignItems: 'center' }, mealIndex: { width: 35, height: 35, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, mealIndexText: { color: colors.ink, fontWeight: '900' }, mealName: { color: colors.ink, fontSize: 14, fontWeight: '900' }, mealPurpose: { color: colors.inkMuted, fontSize: 9, marginTop: 3 }, mealCalories: { color: colors.ink, fontSize: 11, fontWeight: '800' }, foods: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }, foodChip: { backgroundColor: colors.paper, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 6 }, foodText: { color: colors.inkMuted, fontSize: 10 },
  notes: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 15 }, noteRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 7 }, noteNum: { width: 22, height: 22, borderRadius: 8, backgroundColor: colors.ink, color: colors.lime, textAlign: 'center', lineHeight: 22, fontSize: 10, fontWeight: '900', marginRight: 10 }, noteText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 19 }, caution: { backgroundColor: '#FFF0EC', borderRadius: radius.md, padding: 15, marginTop: 12, borderLeftWidth: 3, borderLeftColor: colors.orange }, cautionTitle: { color: '#8D351F', fontWeight: '900', fontSize: 12 }, cautionText: { color: '#7E4B40', fontSize: 11, lineHeight: 18, marginTop: 5 }, disclaimer: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 18 },
});
