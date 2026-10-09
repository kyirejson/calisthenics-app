import { useTodayTraining } from '../features/today/useTodayTraining';
import type { TodayTrainingProps } from '../features/today/types';
import type { Profile } from '../types';
import { TrainingStagePicker } from '../components/TrainingStagePicker';

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Button, Page, ProgressBar } from '../components/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import { TodayTrainingTask } from '../components/TodayTrainingTask';
import { todayTrainingStyles, weekdayLabels } from '../components/todayTrainingStyles';
import { YearSchedule } from '../components/YearSchedule';
import { AppGlyph } from '../components/AppGlyph';
import { canPlanNeckBridges } from '../domain/training/catalog';
import { getDayTrainingState, localDateKey } from '../domain/training/planProgress';
import { plannedCardioMinutes, RETIRED_PLAN_ID } from '../domain/training/trainingPlans';

import { useAppStore } from '../store/AppStore';
import { appPalette, fitnessColors as colors, progressPageLayout } from '../theme';
import { usesHeadstandGate } from '../domain/training/sessionRecords';
import { completedCourseSets, resumableSession } from '../domain/training/sessionResume';

import { EquipmentTodayScreen } from './EquipmentTodayScreen';

export function TodayTrainingScreen(props: TodayTrainingProps) {
  const profile = useAppStore((state) => state.profile);
  if (!profile) return null;
  if (profile.goal === 'equipment')
    return <EquipmentTodayScreen onStart={props.onStart} onOpenExercise={props.onOpenExercise} />;
  if (
    (profile.goal !== 'weight_loss' && profile.goal !== 'street_mastery') ||
    profile.planId === RETIRED_PLAN_ID
  )
    return (
      <Page tone="dark">
        <View style={styles.unavailableCard}>
          <Text style={styles.unavailableEyebrow}>训练计划已移除</Text>
          <Text style={styles.unavailableTitle}>当前目标暂无课程</Text>
          <Text style={styles.unavailableBody}>
            当前旧目标的课程已移除。档案、动作阶数和历史训练记录仍会保留。
          </Text>
          <Text style={styles.unavailableBody}>可主动选择减肥控重或街头健身专题。</Text>
        </View>
      </Page>
    );

  return <TrainingOverview {...props} profile={profile} />;
}
function TrainingOverview(props: TodayTrainingProps & { profile: Profile }) {
  const {
    sessions,
    addDailyExercise,
    removeDailyExercise,
    showExercisePicker,
    setShowExercisePicker,
    showCalendar,
    setShowCalendar,
    dayEditError,
    setDayEditError,
    resetting,
    savingNeck,
    showGateDetails,
    setShowGateDetails,
    setViewport,
    compact,
    actionHeight,
    showFrequency,
    setShowFrequency,
    showPlanPreview,
    setShowPlanPreview,
    savingFrequency,
    frequencyError,
    draftFrequency,
    setDraftFrequency,
    draftMinutes,
    setDraftMinutes,
    draftExperience,
    setDraftExperience,
    generationStep,
    generationSummary,
    now,
    todayKey,
    displayedDate,
    isViewingToday,
    resolved,
    editableWorkoutId,
    addedIds,
    workout,
    workoutExercises,
    todayState,
    courseTitle,
    selectedDate,
    week,
    weightLossWeek,
    gate,
    todayRecordCount,
    hasDayEdits,
    prisoner,
    previewItems,
    previewEstimate,
    openPlanSettings,
    changeNeckPreparation,
    applyFrequency,
    requestReset,
    onStart,
    onOpenExercise,
    onViewDateChange,
    profile,
  } = useTodayTraining(props);
  return (
    <View
      style={styles.trainingRoot}
      testID="today-training-content"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0)
          setViewport((previous) =>
            Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1
              ? previous
              : { width, height },
          );
      }}
    >
      <Page tone="dark" style={styles.trainingContent}>
        <View testID="today-date-rail" style={styles.calendarRow}>
          {week.map((day) => {
            const dayKey = localDateKey(day.date);
            const today = localDateKey(day.date) === localDateKey(now);
            const isSelected = dayKey === (selectedDate || localDateKey(now));
            const state = getDayTrainingState(day, sessions);
            return (
              <Pressable
                key={dayKey}
                accessibilityRole="button"
                accessibilityLabel={`${day.date.getMonth() + 1}月${day.date.getDate()}日 周${weekdayLabels[day.date.getDay()]}`}
                accessibilityState={{ selected: isSelected }}
                aria-pressed={isSelected}
                onPress={() => {
                  onViewDateChange(today ? null : day.date);
                  setDayEditError('');
                }}
                style={[
                  styles.calendarDay,
                  today && styles.calendarDayToday,
                  isSelected && styles.calendarDayActive,
                ]}
              >
                <Text style={[styles.calendarWeek, isSelected && styles.calendarTextActive]}>
                  {weekdayLabels[day.date.getDay()]}
                </Text>
                <Text style={[styles.calendarDate, isSelected && styles.calendarTextActive]}>
                  {day.date.getDate()}
                </Text>
                <View
                  style={[
                    styles.calendarStatus,
                    state.complete && styles.calendarStatusComplete,
                    state.partial && !state.complete && styles.calendarStatusPartial,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        <View testID="today-schedule-controls" style={styles.scheduleHeader}>
          <Text style={styles.scheduleTitle}>日程</Text>
          <View style={styles.scheduleActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="调整训练计划"
              onPress={openPlanSettings}
              style={styles.frequencyTrigger}
            >
              <Text style={styles.frequencyTriggerText}>
                {prisoner
                  ? {
                      beginner: '阶段 I · 初试身手',
                      intermediate: '阶段 II · 渐入佳境',
                      advanced: '阶段 III · 炉火纯青',
                      elite: '阶段 IV · 闭关修炼',
                      supermax: '阶段 V · 登峰造极',
                    }[profile.experience] || '六艺训练'
                  : '每周 ' + profile.frequency + ' 天'}{' '}
                ▾
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="查看全年训练日历"
              onPress={() => setShowCalendar(true)}
              style={styles.calendarDetails}
            >
              <AppGlyph name="calendar" size={18} />
            </Pressable>
          </View>
        </View>
        <View testID="today-course-card" style={[styles.course, compact && styles.courseCompact]}>
          <View style={styles.courseKickerRow}>
            <View style={styles.courseAccent} />
            <Text style={styles.courseKicker}>
              {isViewingToday
                ? '今日课程'
                : `${displayedDate.getMonth() + 1}月${displayedDate.getDate()}日课程`}
              {todayState.complete ? ' · 已完成' : ''}
            </Text>
          </View>
          <View style={styles.courseCopy}>
            <Text style={[styles.courseTitle, compact && styles.courseTitleCompact]}>
              {courseTitle}
            </Text>
            <Text style={styles.courseSubtitle}>{resolved.cycle.label}</Text>
          </View>
          <Svg
            pointerEvents="none"
            style={styles.courseRoute}
            width={156}
            height={36}
            viewBox="0 0 156 36"
            aria-hidden
          >
            <Path d="M4 31H61L86 8H156" stroke="#8BA634" strokeWidth={1.2} fill="none" />
            <Circle cx={4} cy={31} r={2.5} fill={appPalette.lime} />
          </Svg>
        </View>
        {weightLossWeek ? (
          <View style={styles.weightLossSchedule}>
            <Text style={styles.weightLossScheduleTitle}>本周安排</Text>
            <Text style={styles.weightLossScheduleMain}>
              {weightLossWeek.strengthDays} 次全身保肌{' '}
              <Text style={styles.weightLossScheduleSep}>/</Text> {weightLossWeek.cardioDays}{' '}
              次低冲击有氧 · 计划内 {weightLossWeek.plannedCardioMinutes} 分钟
            </Text>
            <Text style={styles.weightLossScheduleNote}>
              {profile.age < 18
                ? '生长发育期不以体重下降速度为目标；按身体状态活动，并寻求专业指导。'
                : '成人可逐步靠近每周 150 分钟中等强度活动；上方仅统计计划内有氧，未计入日常步行。'}
            </Text>
          </View>
        ) : null}
        {!isViewingToday ? (
          <View testID="today-selected-day-notes" style={styles.dayNotes}>
            <Text style={styles.dayNotesLabel}>
              {resolved.day.type === 'recovery' ? '恢复建议' : '注意事项'}
            </Text>
            <Text style={styles.dayNotesText}>{resolved.day.tip}</Text>
          </View>
        ) : null}

        <View style={styles.actionsHeader}>
          <Text style={styles.scheduleTitle}>
            {resolved.day.type === 'cardio' ? '活动安排' : '训练清单'}
          </Text>
          {isViewingToday ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="添加今日训练动作"
              disabled={resetting}
              onPress={() => setShowExercisePicker(true)}
              style={styles.addAction}
            >
              <AppGlyph name="plus" size={17} color={appPalette.lime} />
              <Text style={styles.addActionText}>添加</Text>
            </Pressable>
          ) : null}
        </View>
        {workoutExercises.length ? (
          <View testID="today-workout-list" style={styles.todayWorkoutList}>
            {workoutExercises.map((exercise, index) => (
              <TodayTrainingTask
                key={exercise.id}
                exercise={exercise}
                index={index}
                compact={compact}
                minHeight={actionHeight}
                completedSets={completedCourseSets(sessions, selectedDate, editableWorkoutId, exercise.id)}
                onOpen={() => onOpenExercise(exercise.id)}
                onRemove={
                  isViewingToday && addedIds.includes(exercise.id)
                    ? () =>
                        void removeDailyExercise(todayKey, editableWorkoutId, exercise.id).catch(
                          () => setDayEditError('移除失败，请重试。'),
                        )
                    : undefined
                }
              />
            ))}
          </View>
        ) : (
          <View style={styles.restCard}>
            <Text style={styles.restTitle}>
              {resolved.day.type === 'cardio'
                ? '快走或舒适骑行'
                : isViewingToday
                  ? '今天留给恢复'
                  : '这一天留给恢复'}
            </Text>
            <Text style={styles.restText}>
              {resolved.day.type === 'cardio'
                ? `活动 ${resolved.day.targetMinutes || plannedCardioMinutes(profile)} 分钟 · 另留 8 分钟热身与整理`
                : '没有安排训练动作，保持轻松活动即可。'}
            </Text>
          </View>
        )}

        {isViewingToday ? (
          <View style={styles.dayTools}>
            {usesHeadstandGate(profile) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="查看倒立训练条件"
                onPress={() => setShowGateDetails(true)}
                style={styles.gateBox}
              >
                <AppGlyph
                  name="shield"
                  size={21}
                  color={gate.unlocked ? appPalette.lime : appPalette.muted}
                />
                <Text style={styles.gateTitle}>
                  {gate.unlocked ? '倒立训练已解锁' : '倒立训练待解锁'}
                </Text>
                <Text style={styles.gateLinkText}>条件 ›</Text>
              </Pressable>
            ) : (
              <View style={styles.utilitySpacer} />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="重置今天的训练"
              disabled={resetting || (!todayRecordCount && !hasDayEdits)}
              onPress={requestReset}
              style={[styles.dayTool, !todayRecordCount && !hasDayEdits && styles.disabled]}
            >
              <Text style={styles.dayToolText}>{resetting ? '重置中…' : '重置'}</Text>
            </Pressable>
          </View>
        ) : null}
        {dayEditError ? (
          <Text accessibilityRole="alert" style={styles.dayError}>
            {dayEditError}
          </Text>
        ) : null}
      </Page>
      {!isViewingToday || (workout && workoutExercises.length > 0) ? (
        <View testID="today-start-dock" style={styles.startDock}>
          <View style={styles.startAction}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!isViewingToday) {
                  onViewDateChange(null);
                  return;
                }
                if (workout)
                  onStart(workout.id, resolved.cycle.setMultiplier, resolved.cycle.rirTarget);
              }}
              style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}
            >
              <Text style={styles.startButtonText}>
                {!isViewingToday
                  ? '回到今日训练  →'
                  : resumableSession(sessions, todayKey, editableWorkoutId)
                    ? '继续今日训练  →'
                  : todayState.complete
                    ? '再练一次'
                    : resolved.day.type === 'recovery'
                      ? todayState.partial
                        ? '继续完整恢复  →'
                        : '开始今日恢复  →'
                      : '开始今日训练  →'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.restDockSpace} />
      )}

      <ExercisePicker
        visible={showExercisePicker && isViewingToday}
        onClose={() => setShowExercisePicker(false)}
        excludedIds={workoutExercises.map((item) => item.id)}
        onSelect={async (exercise) => {
          if (isViewingToday) await addDailyExercise(todayKey, editableWorkoutId, exercise.id);
        }}
      />

      {showCalendar ? (
        <YearSchedule
          profile={profile}
          sessions={sessions}
          anchor={now}
          onSelect={() => {}}
          onOpenExercise={(id) => {
            setShowCalendar(false);
            onOpenExercise(id);
          }}
          onClose={() => setShowCalendar(false)}
        />
      ) : null}

      <Modal
        transparent
        visible={showGateDetails}
        animationType="none"
        onRequestClose={() => setShowGateDetails(false)}
      >
        <View style={styles.frequencyBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭倒立训练条件"
            onPress={() => setShowGateDetails(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.frequencyCard}>
            <ScrollView
              style={styles.frequencyScroll}
              contentContainerStyle={styles.frequencyContent}
            >
              <Text style={styles.frequencyTitle}>倒立训练条件</Text>
              <View style={styles.gateDetailSection}>
                <Text style={styles.gateDetailTitle}>
                  {gate.unlocked ? '已满足解锁条件' : '窄距俯卧撑 · 单日累计 200 次'}
                </Text>
                <Text style={styles.gateDetailText}>
                  {gate.unlocked
                    ? `达标日期 ${gate.qualifiedDay}；倒立训练日按当前阶数安排。`
                    : `今日 ${gate.todayReps} 次 · 历史单日最高 ${gate.bestDayReps} 次\n未达标时安排俯卧撑与颈部准备，不安排靠墙顶立。`}
                </Text>
                <Text style={styles.gateDetailNote}>
                  各阶段统一检查。这是应用门槛，并非原书标准或安全评估；无需强凑次数。
                </Text>
              </View>
              <View style={styles.gateDetailSection}>
                <Text style={styles.gateDetailTitle}>
                  颈部准备 · {canPlanNeckBridges(profile) ? '正、反颈桥预备式' : '轻量手阻抬头'}
                </Text>
                <Text style={styles.gateDetailText}>
                  {canPlanNeckBridges(profile)
                    ? '按已确认的基础与适宜性安排，两项各 1 组起步；可查看原图与指导，不自动升级为标准颈桥。'
                    : '轻阻力 1 组共 10 次起步，附 AI 写实示范与原文指导。颈桥另需标准桥基础与适宜性确认。'}
                </Text>
                <Text style={styles.gateDetailNote}>
                  每周自动安排最多两次；不适时停止，不补课加量。
                </Text>
              </View>
              <Button
                label={
                  savingNeck
                    ? '保存中…'
                    : profile.neckBridgeConsent
                      ? '改回轻量颈部准备'
                      : '我已掌握标准桥，检查颈桥条件'
                }
                disabled={
                  savingNeck || (!profile.neckBridgeConsent && (profile.levels.bridge || 1) < 6)
                }
                onPress={changeNeckPreparation}
              />
              {!profile.neckBridgeConsent && (profile.levels.bridge || 1) < 6 ? (
                <Text style={styles.gateDetailNote}>掌握标准桥后，才可检查颈桥条件。</Text>
              ) : null}
              {dayEditError ? <Text style={styles.frequencyError}>{dayEditError}</Text> : null}
            </ScrollView>
            <View style={styles.frequencyFooter}>
              <Button label="关闭" variant="lime" onPress={() => setShowGateDetails(false)} />
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        transparent
        visible={showFrequency}
        animationType="none"
        onRequestClose={() => {
          if (!savingFrequency) setShowFrequency(false);
        }}
      >
        <View style={styles.frequencyBackdrop}>
          <Pressable
            onPress={() => {
              if (!savingFrequency) setShowFrequency(false);
            }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.frequencyCard}>
            <View style={styles.planModalTop}>
              <Text style={styles.planModalLabel}>训练计划</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭训练计划"
                disabled={savingFrequency}
                onPress={() => setShowFrequency(false)}
                style={styles.planModalClose}
              >
                <Text style={styles.planModalCloseText}>×</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.frequencyScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.frequencyContent}
            >
              {generationSummary ? (
                <>
                  <Text style={styles.frequencySection}>计划已生成</Text>
                  <Text style={styles.frequencyInfo}>
                    每周 {generationSummary.strengthDays} 天力量
                    {generationSummary.cardioDays
                      ? ` · ${generationSummary.cardioDays} 天${prisoner ? '轻松活动' : '有氧'}`
                      : ''}
                    ；力量课预计 {generationSummary.longestMinutes} 分钟。
                  </Text>
                </>
              ) : prisoner ? (
                <>
                  <TrainingStagePicker
                    value={draftExperience || profile.experience}
                    disabled={savingFrequency}
                    onSelect={(key, frequency) => {
                      setDraftExperience(key);
                      setDraftFrequency(frequency);
                    }}
                    bodyMassIndex={profile.weight / (profile.height / 100) ** 2}
                    needsFoundation={['push', 'pull', 'squat', 'legRaise'].some(
                      (art) => (profile.levels[art] || 1) < 6,
                    )}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="展开首课预览"
                    accessibilityState={{ expanded: showPlanPreview }}
                    onPress={() => setShowPlanPreview((value) => !value)}
                    style={styles.previewTrigger}
                  >
                    <Text style={styles.previewTriggerText}>首课预览</Text>
                    <Text style={styles.previewTriggerText}>
                      {showPlanPreview ? '收起 −' : '展开 ＋'}
                    </Text>
                  </Pressable>
                  {showPlanPreview && previewEstimate ? (
                    <View style={styles.planPreview}>
                      <Text style={styles.planPreviewTitle}>
                        首课预览 · {previewItems.length} 个动作 · 预计{' '}
                        {previewEstimate.totalMinutes} 分钟
                      </Text>
                      <Text style={styles.planPreviewMeta}>
                        热身 {previewEstimate.warmupSeconds / 60} 分钟 · 整理{' '}
                        {previewEstimate.cooldownSeconds / 60} 分钟
                      </Text>
                      {previewItems.map((item) => (
                        <Text key={item.id} style={styles.planPreviewItem}>
                          {item.name} · {item.targetSets} 组 × {item.targetValue}{' '}
                          {item.targetUnit === 'seconds'
                            ? '秒'
                            : item.targetUnit === 'steps'
                              ? '步'
                              : item.targetUnit === 'meters'
                                ? '米'
                                : '次'}{' '}
                          · 组间休 {item.restSeconds} 秒
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.frequencyTitle}>定制训练计划</Text>
                  <Text style={styles.frequencySection}>每周训练天数</Text>
                  <View style={styles.frequencyOptions}>
                    {[2, 3, 4, 5, 6].map((days) => (
                      <Pressable
                        key={days}
                        disabled={savingFrequency}
                        onPress={() => setDraftFrequency(days)}
                        style={[
                          styles.frequencyOption,
                          draftFrequency === days && styles.frequencyOptionActive,
                        ]}
                      >
                        <Text style={styles.frequencyNumber}>{days}</Text>
                        <Text
                          style={[
                            styles.frequencyUnit,
                            draftFrequency === days && styles.frequencyUnitActive,
                          ]}
                        >
                          天
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.frequencySection}>希望每次训练多久（含休息）</Text>
                  <View style={styles.frequencyOptions}>
                    {[20, 30, 45, 60, 75].map((minutes) => (
                      <Pressable
                        key={minutes}
                        disabled={savingFrequency}
                        onPress={() => setDraftMinutes(minutes)}
                        style={[
                          styles.frequencyOption,
                          draftMinutes === minutes && styles.frequencyOptionActive,
                        ]}
                      >
                        <Text style={styles.frequencyNumber}>{minutes}</Text>
                        <Text
                          style={[
                            styles.frequencyUnit,
                            draftMinutes === minutes && styles.frequencyUnitActive,
                          ]}
                        >
                          分钟
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.frequencySection}>目前训练基础</Text>
                  <View style={styles.experienceOptions}>
                    {(
                      [
                        ['beginner', '刚开始'],
                        ['intermediate', '有基础'],
                        ['advanced', '高阶'],
                      ] as const
                    ).map(([key, label]) => (
                      <Pressable
                        key={key}
                        disabled={savingFrequency}
                        onPress={() => setDraftExperience(key)}
                        style={[
                          styles.experienceOption,
                          draftExperience === key && styles.frequencyOptionActive,
                        ]}
                      >
                        <Text style={styles.experienceText}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
            <View style={styles.frequencyFooter}>
              {generationStep ? (
                <View style={styles.generationBox}>
                  <Text style={styles.generationLabel}>
                    {generationStep.label} · {generationStep.progress}%
                  </Text>
                  <ProgressBar value={generationStep.progress} color={colors.limeDark} />
                </View>
              ) : null}
              {frequencyError ? <Text style={styles.frequencyError}>{frequencyError}</Text> : null}
              {generationSummary ? (
                <Button label="查看日程" variant="lime" onPress={() => setShowFrequency(false)} />
              ) : (
                <Button
                  label={savingFrequency ? '正在生成…' : '应用计划'}
                  variant="lime"
                  disabled={savingFrequency}
                  onPress={() => void applyFrequency()}
                />
              )}
              {!generationSummary ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="取消调整训练计划"
                  disabled={savingFrequency}
                  onPress={() => setShowFrequency(false)}
                  style={styles.frequencyClose}
                >
                  <Text style={styles.frequencyCloseText}>取消</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  ...todayTrainingStyles,
  trainingRoot: { flex: 1, minWidth: 0 },
  trainingContent: { paddingTop: 2, paddingBottom: 4 },
  addAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  addActionText: { color: appPalette.lime, fontSize: 13, fontWeight: '700' },
  restDockSpace: { height: 106 },
  disabled: { opacity: 0.4 },
  dayTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
    minHeight: 44,
    paddingLeft: 10,
    borderWidth: 1,
    borderColor: '#303A35',
    borderRadius: 10,
    backgroundColor: '#1A2224',
  },
  dayTool: {
    minHeight: 44,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#3A453D',
  },
  dayToolText: { color: appPalette.muted, fontSize: 12, fontWeight: '600' },
  dayError: { color: appPalette.danger, fontSize: 12, lineHeight: 19, marginTop: 10 },
  dayNotes: {
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#48563E',
    marginTop: 6,
    marginBottom: 4,
  },
  dayNotesLabel: { color: appPalette.lime, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  dayNotesText: { color: '#C0C8BC', fontSize: 12, lineHeight: 19, marginTop: 2 },
  gateBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    minWidth: 0,
  },
  gateTitle: { flexShrink: 1, color: appPalette.muted, fontSize: 12 },
  gateLinkText: { color: '#B5C5A7', fontSize: 11 },
  utilitySpacer: { flex: 1 },
  gateDetailSection: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: appPalette.border,
    marginBottom: 12,
  },
  gateDetailTitle: { color: appPalette.text, fontSize: 14, fontWeight: '800' },
  gateDetailText: { color: appPalette.muted, fontSize: 13, lineHeight: 21, marginTop: 8 },
  gateDetailNote: { color: appPalette.muted, fontSize: 11, lineHeight: 18, marginTop: 8 },
  unavailableCard: {
    marginTop: 18,
    backgroundColor: appPalette.card,
    borderColor: appPalette.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  unavailableEyebrow: { color: appPalette.lime, fontSize: 11, fontWeight: '800' },
  unavailableTitle: { ...progressPageLayout.title, color: appPalette.text },
  unavailableBody: { color: appPalette.muted, fontSize: 13, lineHeight: 21 },
  weightLossSchedule: {
    borderLeftWidth: 1,
    borderLeftColor: '#48563E',
    paddingLeft: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  weightLossScheduleTitle: { color: appPalette.muted, fontSize: 11, fontWeight: '700' },
  weightLossScheduleMain: {
    color: appPalette.text,
    fontSize: 12,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 4,
  },
  weightLossScheduleSep: { color: appPalette.muted },
  weightLossScheduleNote: { color: appPalette.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  previewTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: appPalette.border,
    marginTop: 8,
  },
  previewTriggerText: { color: appPalette.muted, fontSize: 12, fontWeight: '700' },
  planModalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 8,
    paddingTop: 4,
  },
  planModalLabel: { color: appPalette.muted, fontSize: 11, fontWeight: '700' },
  planModalClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  planModalCloseText: { color: appPalette.muted, fontSize: 26 },
  frequencyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  frequencyCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    backgroundColor: appPalette.background,
    borderWidth: 1,
    borderColor: appPalette.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
  frequencyScroll: { flexShrink: 1 },
  frequencyContent: { padding: 16 },
  planPreview: { backgroundColor: appPalette.card, borderRadius: 16, padding: 14, marginTop: 16 },
  planPreviewTitle: { color: appPalette.text, fontSize: 13, fontWeight: '800' },
  planPreviewMeta: {
    color: appPalette.muted,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 7,
  },
  planPreviewItem: { color: appPalette.text, fontSize: 12, lineHeight: 22 },
  frequencyFooter: {
    paddingHorizontal: 16,
    paddingBottom: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: appPalette.border,
  },
  frequencyTitle: { ...progressPageLayout.title, color: appPalette.text },
  frequencyInfo: { color: appPalette.muted, fontSize: 12, lineHeight: 19, marginTop: 7 },
  frequencyOptions: { flexDirection: 'row', gap: 7, marginTop: 14 },
  frequencySection: { color: appPalette.text, fontSize: 12, fontWeight: '800', marginTop: 15 },
  frequencyOption: {
    flex: 1,
    minWidth: 0,
    height: 63,
    borderRadius: 12,
    backgroundColor: appPalette.card,
    borderWidth: 1,
    borderColor: appPalette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyOptionActive: { backgroundColor: appPalette.olive, borderColor: appPalette.lime },
  frequencyNumber: { color: appPalette.text, fontSize: 20, fontWeight: '900' },
  frequencyUnit: { color: appPalette.muted, fontSize: 10 },
  frequencyUnitActive: { color: appPalette.lime },
  experienceOptions: { flexDirection: 'row', gap: 7, marginTop: 9 },
  experienceOption: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: appPalette.card,
    borderWidth: 1,
    borderColor: appPalette.border,
  },
  experienceText: { color: appPalette.text, fontSize: 11, fontWeight: '800' },
  generationBox: { marginTop: 16, marginBottom: 12, gap: 8 },
  generationLabel: { color: appPalette.text, fontSize: 11, fontWeight: '800' },
  frequencyError: { color: appPalette.danger, fontSize: 11, lineHeight: 18, marginTop: 8 },
  frequencyClose: { alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: 8 },
  frequencyCloseText: { color: appPalette.muted, fontSize: 12, fontWeight: '700' },
});

export type { TodayTrainingProps } from '../features/today/types';
