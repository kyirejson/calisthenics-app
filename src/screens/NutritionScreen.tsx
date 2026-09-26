import React, { useState } from 'react';
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { calculateNutritionPlan, dietPatterns } from '../data/nutritionPlanner';
import { getPlanDay, RETIRED_PLAN_ID } from '../data/trainingPlans';
import { recordWeight, suggestedPlanningWeight, summarizeWeightTrend } from '../data/weightTrend';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import type { DietPattern } from '../types';
import { confirmAction, showMessage } from '../utils/confirm';

export function NutritionScreen({ onBack }: { onBack: () => void }) {
  const { profile, saveProfile } = useAppStore();
  const [pattern, setPattern] = useState<DietPattern>(profile?.dietPattern || 'balanced_cn');
  const [showEvidence, setShowEvidence] = useState(false);
  const latestRecordedWeight = profile?.weightHistory?.[profile.weightHistory.length - 1]?.kg;
  const [weightEntry, setWeightEntry] = useState(latestRecordedWeight ? String(latestRecordedWeight) : profile?.weight ? String(profile.weight) : '');
  const [savingWeight, setSavingWeight] = useState(false);
  if (!profile) return null;
  if ((profile.goal !== 'weight_loss' && profile.goal !== 'street_mastery') || profile.planId === RETIRED_PLAN_ID) return <SafeAreaView style={styles.safe}>
    <View style={styles.top}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.title}>今日能量</Text><View style={{ width: 42 }} /></View>
    <View style={styles.unavailable}><Text style={styles.unavailableTitle}>当前目标暂无今日能量计划</Text><Text style={styles.unavailableText}>旧训练计划已移除，原档案仍保留。请返回今日页，主动选择减肥控重或囚徒健身六艺专题。</Text></View>
  </SafeAreaView>;
  const prisoner = profile.goal === 'street_mastery';
  const activeNutritionGoal = prisoner ? 'performance' as const : 'rapid_loss' as const;
  const todayPlan = getPlanDay(profile);
  const today = todayPlan.day;
  const isTrainingDay = today.type === 'strength' || today.type === 'cardio';
  const draftProfile = { ...profile, frequency: todayPlan.plan.frequency, nutritionGoal: activeNutritionGoal, dietPattern: pattern };
  const plan = calculateNutritionPlan(draftProfile, isTrainingDay);
  const dayDifference = plan.trainingDayCalories - plan.restDayCalories;
  const weightLossView = profile.age >= 18 && plan.goal === 'rapid_loss' && plan.safetyLevel !== 'blocked';
  const trend = weightLossView ? summarizeWeightTrend(profile.weightHistory) : null;
  const baselineCandidate = trend ? suggestedPlanningWeight(profile.weight, trend) : null;
  const persistWeight = async (kg: number) => {
    setSavingWeight(true);
    try {
      await saveProfile({ ...profile, weightHistory: recordWeight(profile.weightHistory, kg) });
      setWeightEntry(String(kg));
    } catch {
      showMessage('保存失败', '今日体重没有保存，请稍后重试。');
    } finally {
      setSavingWeight(false);
    }
  };
  const saveWeight = () => {
    const kg = Number(weightEntry.trim().replace(',', '.'));
    if (!Number.isFinite(kg) || kg < 30 || kg > 300) {
      showMessage('请核对体重', '请输入 30–300 kg 之间的有效数值。');
      return;
    }
    const rounded = Math.round(kg * 10) / 10;
    if (Math.abs(rounded - profile.weight) > profile.weight * 0.1) {
      confirmAction('体重变化较大', `新记录 ${rounded} kg 与当前 ${profile.weight} kg 相差超过 10%，确认保存吗？`, () => { void persistWeight(rounded); });
      return;
    }
    void persistWeight(rounded);
  };
  const updatePlanningWeight = () => {
    if (baselineCandidate === null) return;
    confirmAction(
      '更新计划基准体重？',
      `以近 7 天均重 ${baselineCandidate} kg 重新估算后续能量计划；每日体重记录仍会保留。`,
      () => {
        setSavingWeight(true);
        void saveProfile({ ...profile, weight: baselineCandidate })
          .catch(() => showMessage('保存失败', '计划基准体重没有更新，请稍后重试。'))
          .finally(() => setSavingWeight(false));
      },
    );
  };
  const openEvidence = async (url: string) => {
    try { await Linking.openURL(url); }
    catch { showMessage('无法打开链接', '请检查网络后重试。'); }
  };
  const saveChoice = async (nextPattern: DietPattern) => {
    try {
      await saveProfile({ ...profile, nutritionGoal: activeNutritionGoal, dietPattern: nextPattern });
      setPattern(nextPattern);
    } catch {
      showMessage('保存失败', '营养选择没有保存，请稍后重试。');
    }
  };
  const selectPattern = (nextPattern: DietPattern) => {
    const candidate = calculateNutritionPlan({ ...profile, frequency: todayPlan.plan.frequency, nutritionGoal: activeNutritionGoal, dietPattern: nextPattern }, isTrainingDay);
    if (candidate.safetyLevel === 'blocked') {
      showMessage(candidate.safetyTitle || '当前方案不可用', candidate.safetyMessage || '请先检查个人资料，再选择饮食模式。');
      return;
    }
    if (nextPattern === 'keto') {
      confirmAction(
        '启用生酮前请确认',
        candidate.caution || '生酮属于限制性饮食，请先确认自己没有相关禁忌。',
        () => { void saveChoice(nextPattern); },
        { confirmLabel: '我已确认，启用', cancelLabel: '暂不启用', destructive: true },
      );
      return;
    }
    void saveChoice(nextPattern);
  };

  return <SafeAreaView style={styles.safe}>
    <View style={styles.top}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.title}>今日能量</Text><View style={{ width: 42 }} /></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {plan.safetyLevel !== 'ok' ? <View accessibilityRole="alert" style={[styles.safetyCard, plan.safetyLevel === 'blocked' ? styles.safetyBlocked : styles.safetyWarning]}>
        <Text style={styles.safetyEyebrow}>{plan.safetyLevel === 'blocked' ? '已自动启用安全保护' : '重要安全提示'}</Text>
        <Text style={styles.safetyTitle}>{plan.safetyTitle}</Text>
        <Text style={styles.safetyText}>{plan.safetyMessage}</Text>
        <Text style={styles.safetyMeta}>当前生效：{plan.goalLabel} · {dietPatterns.find((item) => item.key === plan.pattern)?.label}</Text>
      </View> : null}

      <View style={styles.horizontalWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{dietPatterns.map((item) => <Pressable key={item.key} onPress={() => selectPattern(item.key)} style={[styles.pattern, plan.pattern === item.key && styles.patternActive]}><Text style={[styles.patternTitle, plan.pattern === item.key && styles.patternTitleActive]}>{item.label}</Text><Text style={styles.patternSub}>{item.subtitle}</Text></Pressable>)}</ScrollView>
        <LinearGradient pointerEvents="none" colors={['rgba(245,243,237,0)', colors.paper]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.horizontalFade} />
      </View>

      {plan.safetyLevel === 'blocked' ? <View style={styles.blockedAdvice}>
        <Text style={styles.blockedAdviceTitle}>先保持规律、均衡饮食</Text>
        <Text style={styles.blockedAdviceText}>按正常饥饿感安排三餐，搭配蔬菜、水果、全谷物和鱼禽蛋奶豆；目前不提供热量、宏量或食物份量目标。请先核对个人资料，并根据上方提示寻求个体评估。</Text>
      </View> : <>
      <View style={styles.energyCard}>
        <View style={styles.energyTop}><View><Text style={styles.kicker}>{isTrainingDay ? '训练日目标' : '恢复日目标'} · {plan.goalLabel}</Text><Text style={styles.calories}>{plan.targetCalories}<Text style={styles.calorieUnit}> kcal</Text></Text></View><View style={styles.deltaBadge}><Text style={styles.delta}>{plan.calorieDelta > 0 ? '+' : ''}{plan.calorieDelta}</Text><Text style={styles.deltaLabel}>对比维持</Text></View></View>
        <Text style={styles.strategy}>{plan.strategy}</Text>
        <View style={styles.energyRow}><Mini label="估算基础代谢" value={`${plan.bmr}`} /><Mini label="估算维持消耗" value={`${plan.tdee}`} /><Mini label="饮水" value={`${(plan.waterMl / 1000).toFixed(1)}L`} /></View>
      </View>

      {weightLossView ? <View style={styles.weightTrendCard}>
        <Text style={styles.weightTrendTitle}>体重趋势</Text>
        <Text style={styles.weightTrendHint}>早晨、相近条件下记录；看 7 天均值，不因单日波动改餐。每日记录不自动修改计划基准体重。</Text>
        <View style={styles.weightEntryRow}><TextInput accessibilityLabel="记录今日体重公斤" value={weightEntry} onChangeText={setWeightEntry} keyboardType="decimal-pad" selectTextOnFocus style={styles.weightInput} /><Text style={styles.weightUnit}>kg</Text><Pressable accessibilityRole="button" disabled={savingWeight} onPress={saveWeight} style={styles.weightSave}><Text style={styles.weightSaveText}>{savingWeight ? '保存中' : '记录今日'}</Text></Pressable></View>
        <Text style={styles.weightTrendResult}>{trend?.currentAverage !== undefined ? `近 7 天均重 ${trend.currentAverage} kg` : '尚无近 7 天记录'}{trend?.changeKg !== undefined ? ` · 较前 7 天 ${trend.changeKg > 0 ? '+' : ''}${trend.changeKg} kg` : ''}</Text>
        <Text style={styles.weightTrendNote}>{trend?.changePercent === undefined ? '前后两个 7 天各记录至少 4 天后，才显示趋势对比。' : trend.changePercent < -1 ? '下降较快；留意饥饿、乏力和训练表现，不要继续加大缺口。' : '短期变化受水分影响；连续观察 2–4 周，再结合腰围、饥饿感和力量表现调整。'}</Text>
        <Text style={styles.weightBaseline}>当前计划基准：{profile.weight} kg</Text>
        {baselineCandidate !== null ? <Pressable accessibilityRole="button" disabled={savingWeight} onPress={updatePlanningWeight} style={styles.weightBaselineAction}><Text style={styles.weightBaselineActionText}>按近 7 天均重 {baselineCandidate} kg 更新计划 ›</Text></Pressable> : null}
      </View> : null}

      {plan.meals.map((meal, index) => <View key={meal.name} style={styles.mealCard}><View style={styles.mealTop}><View style={styles.mealIndex}><Text style={styles.mealIndexText}>{index + 1}</Text></View><View style={{ flex: 1 }}><Text style={styles.mealName}>{meal.name} · {meal.timing}</Text><Text style={styles.mealPurpose}>{meal.purpose}</Text></View><Text style={styles.mealCalories}>{meal.calories} kcal</Text></View><View style={styles.foods}>{meal.foods.map((food) => <View key={food} style={styles.foodChip}><Text style={styles.foodText}>{food}</Text></View>)}</View></View>)}

      <Text style={styles.sectionTitle}>深入了解</Text>
      <Collapse title="饮食节奏" hint="热量循环 · 训练日与恢复日安排">
        <View style={styles.rhythmCard}>
          <View style={styles.rhythmHeader}><View style={styles.rhythmHeaderTitle}><Text style={styles.rhythmEyebrow}>热量循环</Text><Text style={styles.rhythmTitle}>跟着训练日安排</Text></View><View style={styles.rhythmDifference}><Text style={styles.rhythmDifferenceText}>{dayDifference > 0 ? `训练日较恢复日 +${dayDifference} kcal` : '两日保持一致'}</Text></View></View>
          <View style={styles.dayCompare}>
            <View style={[styles.dayCompareItem, isTrainingDay && styles.dayCompareActive]}><Text style={[styles.dayCompareLabel, isTrainingDay && styles.dayCompareLabelActive]}>训练日</Text><Text style={[styles.dayCompareValue, isTrainingDay && styles.dayCompareValueActive]}>{plan.trainingDayCalories}<Text style={styles.dayCompareUnit}> kcal</Text></Text></View>
            <View style={[styles.dayCompareItem, !isTrainingDay && styles.dayCompareActive]}><Text style={[styles.dayCompareLabel, !isTrainingDay && styles.dayCompareLabelActive]}>恢复日</Text><Text style={[styles.dayCompareValue, !isTrainingDay && styles.dayCompareValueActive]}>{plan.restDayCalories}<Text style={styles.dayCompareUnit}> kcal</Text></Text></View>
          </View>
          <Text style={styles.rhythmCaption}>{dayDifference > 0 ? `已计入上方今日目标，不需要在餐单之外再加 ${dayDifference} kcal。` : '为避免低于保守能量下限，当前不额外进行热量循环。'}</Text>
          <View style={styles.rhythmDivider} />
          <View style={styles.rhythmDetail}><View style={[styles.rhythmDetailIcon, styles.carbIcon]}><Text style={styles.rhythmDetailIconText}>C</Text></View><View style={styles.rhythmDetailBody}><Text style={styles.rhythmDetailTitle}>碳水 · 今日 {plan.carbs}g</Text><Text style={styles.rhythmDetailText}>{pattern === 'keto' ? '生酮模式不套用常规训前加餐；若训练表现持续下降，请重新评估饮食模式。' : isTrainingDay ? '按实际训练时间，把一部分主食放在训前与训后的正餐；不必追求固定“窗口”。' : '恢复日适度减少主食，保留蔬菜、水果与足够的总能量。'}</Text></View></View>
          <View style={styles.rhythmDetail}><View style={[styles.rhythmDetailIcon, styles.proteinIcon]}><Text style={styles.rhythmDetailIconText}>P</Text></View><View style={styles.rhythmDetailBody}><Text style={styles.rhythmDetailTitle}>蛋白质 · 今日 {plan.protein}g</Text><Text style={styles.rhythmDetailText}>分散到三至四餐；训练日与恢复日都要覆盖全天目标。</Text></View></View>
        </View>
      </Collapse>
      <Collapse title="恢复与补给" hint="训练、睡眠和正常饮食优先；补剂不是每日任务">
        <View style={styles.evidencePanel}>
          <View style={styles.evidenceLead}><View style={styles.evidenceLeadAccent} /><View style={styles.evidenceLeadBody}><View style={styles.evidenceTitleRow}><Text style={styles.evidenceLeadTitle}>胶原蛋白与肌腱</Text><Text style={styles.evidenceBadge}>研究中</Text></View><Text style={styles.evidenceLeadText}>小样本研究提示，胶原蛋白配合负荷训练可能影响肌腱结构；“训练前 45–60 分钟必须补充”的窗口和治愈伤痛效果都未获证实。</Text><Text style={styles.evidenceLeadNote}>不代替合理负荷、疼痛评估或康复治疗。</Text></View></View>
          <View style={styles.evidenceSeparator} />
          <EvidenceRow index="01" title="一水肌酸" badge="证据较充分" body="健康成年人可考虑每日 3–5g，主要支持短时、重复高强度训练；不是必需品。肾病或正在用药者先咨询医生。" />
          <EvidenceRow index="02" title="维生素 D" badge="先评估需要" body="不把 2000–4000 IU/天当作通用处方；是否补充、剂量多少，应结合饮食、日照和健康情况判断。" />
          <EvidenceRow index="03" title="Omega-3" badge="饮食优先" body="优先通过鱼类等食物摄入；不常规建议所有人补充 2–3g/天，也不能称为“关节润滑剂”。" last />
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showEvidence }} onPress={() => setShowEvidence((value) => !value)} style={styles.evidenceToggle}><Text style={styles.evidenceToggleText}>研究与安全依据</Text><Text style={styles.evidenceToggleArrow}>{showEvidence ? '⌃' : '⌄'}</Text></Pressable>
          {showEvidence ? <View style={styles.evidenceLinks}>
            <SourceLink label="肌酸 · NIH 运动补剂资料" onPress={() => { void openEvidence('https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-HealthProfessional/'); }} />
            <SourceLink label="胶原蛋白 · 2026 系统综述" onPress={() => { void openEvidence('https://pubmed.ncbi.nlm.nih.gov/41900537/'); }} />
            <SourceLink label="维生素 D · NIH 资料" onPress={() => { void openEvidence('https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/'); }} />
            <SourceLink label="Omega-3 · NIH 资料" onPress={() => { void openEvidence('https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/'); }} />
          </View> : null}
        </View>
      </Collapse>
      <Collapse title="数字依据" hint="这些数字如何得出、何时调整">
        <View style={styles.basisCard}>
          <Text style={styles.basisText}>以年龄、身高、体重及性别估算基础代谢，再按每周训练次数估算维持消耗；这不是代谢测试结果。</Text>
          <Text style={styles.basisText}>今日建议比估算维持消耗{plan.calorieDelta < 0 ? '低' : plan.calorieDelta > 0 ? '高' : '相同'}约 {Math.abs(Math.round(plan.calorieDelta / Math.max(1, plan.tdee) * 100))}%。训练日与恢复日分配不同，一周平均约 {plan.weeklyMeanCalories} kcal。</Text>
          <Text style={styles.basisText}>蛋白质按参考体重和目标估算；碳水、脂肪随饮食模式调整。食谱份量只作起点，两周后结合体重趋势、饥饿感和训练表现再调整。</Text>
        </View>
      </Collapse>
      </>}

      <Collapse title="执行原则" hint={`共 ${plan.principles.length} 条实操原则`}>
        <View style={styles.notes}>{plan.principles.map((item, index) => <View key={item} style={styles.noteRow}><Text style={styles.noteNum}>{index + 1}</Text><Text style={styles.noteText}>{item}</Text></View>)}</View>
      </Collapse>
      {plan.caution ? <View style={styles.caution}><Text style={styles.cautionTitle}>开始前请确认</Text><Text style={styles.cautionText}>{plan.caution}</Text></View> : null}
      <Text style={styles.disclaimer}>计划采用估算值，体重、腰围、饥饿感和训练表现连续记录两周后再调整。它不能替代医生或注册营养师的个体化建议。</Text>
    </ScrollView>
  </SafeAreaView>;
}

function Mini({ label, value }: { label: string; value: string }) { return <View style={styles.mini}><Text style={styles.miniValue}>{value}</Text><Text style={styles.miniLabel}>{label}</Text></View>; }
// 折叠收纳：默认收起长内容（节奏/补剂/原则/依据），保持页面首屏聚焦在能量目标与四餐。
function Collapse({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <View style={styles.collapseCard}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} style={styles.collapseHead}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={styles.collapseTitle}>{title}</Text>
        <Text style={styles.collapseHint}>{hint}</Text>
      </View>
      <Text style={styles.collapseArrow}>{open ? '⌃' : '⌄'}</Text>
    </Pressable>
    {open ? <View style={styles.collapseBody}>{children}</View> : null}
  </View>;
}
function EvidenceRow({ index, title, badge, body, last = false }: { index: string; title: string; badge: string; body: string; last?: boolean }) { return <View style={[styles.evidenceRow, !last && styles.evidenceRowBorder]}><Text style={styles.evidenceIndex}>{index}</Text><View style={styles.evidenceRowBody}><View style={styles.evidenceTitleRow}><Text style={styles.evidenceRowTitle}>{title}</Text><Text style={styles.evidenceRowBadge}>{badge}</Text></View><Text style={styles.evidenceRowText}>{body}</Text></View></View>; }
function SourceLink({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable accessibilityRole="link" onPress={onPress} style={styles.sourceLink}><Text style={styles.sourceLinkText}>{label}</Text><Text style={styles.sourceLinkArrow}>↗</Text></Pressable>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, top: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }, back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, backText: { color: colors.ink, fontSize: 34, lineHeight: 37 }, title: { color: colors.ink, fontWeight: '900', fontSize: 17 },
  unavailable: { margin: 20, padding: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg },
  unavailableTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  unavailableText: { color: colors.inkMuted, fontSize: 12, lineHeight: 20, marginTop: 9 },
  content: { padding: 20, paddingBottom: 55 }, sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', marginTop: 24, marginBottom: 12 }, horizontal: { paddingRight: 20 },
  horizontalWrap: { position: 'relative' },
  horizontalFade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 26 },
  safetyCard: { borderRadius: radius.md, borderWidth: 1, padding: 15, marginTop: 16 }, safetyBlocked: { backgroundColor: '#FFF0EC', borderColor: '#E9A08D' }, safetyWarning: { backgroundColor: '#FFF8DE', borderColor: '#D7B94B' }, safetyEyebrow: { color: '#8D351F', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, safetyTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 5 }, safetyText: { color: '#644E47', fontSize: 11, lineHeight: 18, marginTop: 6 }, safetyMeta: { color: colors.ink, fontSize: 10, fontWeight: '800', marginTop: 9 },
  pattern: { width: 145, minHeight: 76, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, padding: 13, marginRight: 9 }, patternActive: { borderColor: colors.limeDark, backgroundColor: '#F0F6DC' }, patternTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' }, patternTitleActive: { color: '#4F6114' }, patternSub: { color: colors.inkMuted, fontSize: 9, lineHeight: 14, marginTop: 5 },
  energyCard: { marginTop: 27, borderRadius: radius.lg, backgroundColor: colors.ink, padding: 20 }, energyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, kicker: { color: colors.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, calories: { color: '#FFFFFF', fontSize: 38, fontWeight: '900', marginTop: 5 }, calorieUnit: { color: '#AEB1A8', fontSize: 12 }, deltaBadge: { backgroundColor: '#30332C', borderRadius: 15, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center' }, delta: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' }, deltaLabel: { color: '#92958C', fontSize: 8, marginTop: 2 }, strategy: { color: '#BFC2B8', fontSize: 12, lineHeight: 18, marginTop: 12 }, energyRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#393C34', marginTop: 17, paddingTop: 15 }, mini: { flex: 1 }, miniValue: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 }, miniLabel: { color: '#888B82', fontSize: 9, marginTop: 3 },
  weightTrendCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 15, marginTop: 11 },
  weightTrendTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  weightTrendHint: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  weightEntryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  weightInput: { flex: 1, minWidth: 65, height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, color: colors.ink, fontSize: 16, fontWeight: '900', paddingHorizontal: 10 },
  weightUnit: { color: colors.inkMuted, fontSize: 11, fontWeight: '800' },
  weightSave: { height: 42, borderRadius: 10, backgroundColor: colors.ink, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  weightSaveText: { color: colors.lime, fontSize: 11, fontWeight: '900' },
  weightTrendResult: { color: colors.ink, fontSize: 12, fontWeight: '900', marginTop: 13 },
  weightTrendNote: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  weightBaseline: { color: colors.inkMuted, fontSize: 10, marginTop: 10 },
  weightBaselineAction: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 8, paddingHorizontal: 11, borderRadius: 9, backgroundColor: '#EDF4DF' },
  weightBaselineActionText: { color: colors.green, fontSize: 10, fontWeight: '900' },
  rhythmCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 18 },
  rhythmHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  rhythmHeaderTitle: { flex: 1 },
  rhythmEyebrow: { color: colors.green, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  rhythmTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 5 },
  rhythmDifference: { backgroundColor: '#EDF7E5', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 7 },
  rhythmDifferenceText: { color: '#49672B', fontSize: 10, fontWeight: '900' },
  dayCompare: { flexDirection: 'row', gap: 8, marginTop: 17 },
  dayCompareItem: { flex: 1, minWidth: 0, borderRadius: 15, padding: 13, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  dayCompareActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayCompareLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: '800' },
  dayCompareLabelActive: { color: colors.lime },
  dayCompareValue: { color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 6 },
  dayCompareValueActive: { color: '#FFFFFF' },
  dayCompareUnit: { fontSize: 10, color: '#8B8F84' },
  rhythmCaption: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: 10 },
  rhythmDivider: { height: 1, backgroundColor: colors.line, marginVertical: 16 },
  rhythmDetail: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginBottom: 13 },
  rhythmDetailIcon: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  carbIcon: { backgroundColor: '#E9EFFF' }, proteinIcon: { backgroundColor: '#FFF0E8' },
  rhythmDetailIconText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  rhythmDetailBody: { flex: 1 }, rhythmDetailTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  rhythmDetailText: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 4 },
  evidencePanel: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  evidenceLead: { flexDirection: 'row', backgroundColor: '#F2F7EC', padding: 16, gap: 12 },
  evidenceLeadAccent: { width: 4, borderRadius: 3, backgroundColor: colors.green }, evidenceLeadBody: { flex: 1 },
  evidenceTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  evidenceLeadTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', flexShrink: 1 },
  evidenceBadge: { color: '#406B40', backgroundColor: '#DFEDDB', borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '900' },
  evidenceLeadText: { color: colors.ink, fontSize: 11, lineHeight: 19, marginTop: 9 },
  evidenceLeadNote: { color: '#4F7552', fontSize: 10, fontWeight: '700', marginTop: 8 },
  evidenceSeparator: { height: 1, backgroundColor: colors.line },
  evidenceRow: { flexDirection: 'row', gap: 12, padding: 16 }, evidenceRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  evidenceIndex: { color: colors.limeDark, fontSize: 12, fontWeight: '900', width: 21, marginTop: 2 },
  evidenceRowBody: { flex: 1 }, evidenceRowTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', flexShrink: 1 },
  evidenceRowBadge: { color: colors.inkMuted, backgroundColor: colors.paper, borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5, fontSize: 9, fontWeight: '800' },
  evidenceRowText: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 6 },
  evidenceToggle: { borderTopWidth: 1, borderTopColor: colors.line, minHeight: 46, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  evidenceToggleText: { color: colors.ink, fontSize: 11, fontWeight: '900' }, evidenceToggleArrow: { color: colors.inkMuted, fontSize: 18 },
  evidenceLinks: { backgroundColor: colors.paper, paddingHorizontal: 17, paddingBottom: 8 },
  sourceLink: { minHeight: 39, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sourceLinkText: { color: colors.inkMuted, fontSize: 10 }, sourceLinkArrow: { color: colors.blue, fontSize: 14 },
  basisCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 14, marginTop: 7 },
  basisText: { color: colors.inkMuted, fontSize: 11, lineHeight: 18, marginBottom: 8 },
  blockedAdvice: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 16, marginTop: 23 }, blockedAdviceTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' }, blockedAdviceText: { color: colors.inkMuted, fontSize: 12, lineHeight: 20, marginTop: 8 },
  mealCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 15, marginBottom: 10 }, mealTop: { flexDirection: 'row', alignItems: 'center' }, mealIndex: { width: 35, height: 35, borderRadius: 12, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, mealIndexText: { color: colors.ink, fontWeight: '900' }, mealName: { color: colors.ink, fontSize: 14, fontWeight: '900' }, mealPurpose: { color: colors.inkMuted, fontSize: 9, marginTop: 3 }, mealCalories: { color: colors.ink, fontSize: 11, fontWeight: '800' }, foods: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }, foodChip: { backgroundColor: colors.paper, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 6 }, foodText: { color: colors.inkMuted, fontSize: 10 },
  notes: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 15 }, noteRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 7 }, noteNum: { width: 22, height: 22, borderRadius: 8, backgroundColor: colors.ink, color: colors.lime, textAlign: 'center', lineHeight: 22, fontSize: 10, fontWeight: '900', marginRight: 10 }, noteText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 19 }, caution: { backgroundColor: '#FFF0EC', borderRadius: radius.md, padding: 15, marginTop: 12, borderLeftWidth: 3, borderLeftColor: colors.orange }, cautionTitle: { color: '#8D351F', fontWeight: '900', fontSize: 12 }, cautionText: { color: '#7E4B40', fontSize: 11, lineHeight: 18, marginTop: 5 }, disclaimer: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 18 },
  collapseCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, marginBottom: 10, overflow: 'hidden' },
  collapseHead: { minHeight: 58, paddingHorizontal: 15, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  collapseTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  collapseHint: { color: colors.inkMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  collapseArrow: { color: colors.inkMuted, fontSize: 20 },
  collapseBody: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 13, paddingHorizontal: 13, paddingBottom: 13 },
});
