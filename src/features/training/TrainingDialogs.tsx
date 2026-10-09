import { styles } from './styles';
import type { useTrainingSession } from './useTrainingSession';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../../components/ui';
import { ExerciseDetailedGuide } from '../../components/ExerciseResource';

import { EquipmentMovementGuide } from '../../components/EquipmentMovementGuide';
import { ExercisePicker } from '../../components/ExercisePicker';
import { WarmupGuide, CooldownGuide } from '../../components/WarmupCooldown';
import { PrehabGuideModal } from '../../components/PrehabGuide';

export function TrainingDialogs({
  model,
}: {
  model: Pick<
    ReturnType<typeof useTrainingSession>,
    | 'profile'
    | 'plan'
    | 'logInteraction'
    | 'selectedExercise'
    | 'mastery'
    | 'items'
    | 'saving'
    | 'showGuide'
    | 'setShowGuide'
    | 'showWarmup'
    | 'setShowWarmup'
    | 'showCooldown'
    | 'setShowCooldown'
    | 'showPrehab'
    | 'setShowPrehab'
    | 'showPicker'
    | 'setShowPicker'
    | 'showQuality'
    | 'setShowQuality'
    | 'constraintsConfirmed'
    | 'setConstraintsConfirmed'
    | 'setWarmupDone'
    | 'current'
    | 'equipment'
    | 'completedCount'
    | 'estimate'
    | 'save'
    | 'addExercise'
  >;
}) {
  const {
    profile,
    plan,
    logInteraction,
    selectedExercise,
    mastery,
    items,
    saving,
    showGuide,
    setShowGuide,
    showWarmup,
    setShowWarmup,
    showCooldown,
    setShowCooldown,
    showPrehab,
    setShowPrehab,
    showPicker,
    setShowPicker,
    showQuality,
    setShowQuality,
    constraintsConfirmed,
    setConstraintsConfirmed,
    setWarmupDone,
    current,
    equipment,
    completedCount,
    estimate,
    save,
    addExercise,
  } = model;
  if (!profile || !current) return null;
  return (
    <>
      <ExercisePicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={addExercise}
        excludedIds={items.map((item) => item.id)}
      />
      <Modal
        transparent
        visible={showGuide}
        animationType="fade"
        onRequestClose={() => setShowGuide(false)}
      >
        <View style={styles.shade}>
          <View style={styles.sheet}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{current.name}</Text>
              <Pressable
                accessibilityLabel="关闭动作指导"
                onPress={() => setShowGuide(false)}
                style={styles.close}
              >
                <Text style={styles.modalClose}>×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.guideContent}>
              {equipment ? (
                <EquipmentMovementGuide exerciseId={current.id} />
              ) : (
                <ExerciseDetailedGuide key={current.id} exercise={current} />
              )}
            </ScrollView>
            <View style={styles.modalFoot}>
              <Button label="返回训练" variant="lime" onPress={() => setShowGuide(false)} />
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={showWarmup} animationType="slide" onRequestClose={() => setShowWarmup(false)}>
        <WarmupGuide
          items={items}
          minutes={estimate.warmupSeconds / 60}
          onSkip={() => setShowWarmup(false)}
          onComplete={() => {
            setWarmupDone(true);
            if (plan) logInteraction('warmup_acknowledged');
            setShowWarmup(false);
          }}
        />
      </Modal>
      <Modal
        visible={showCooldown}
        animationType="slide"
        onRequestClose={() => setShowCooldown(false)}
      >
        <CooldownGuide
          minutes={estimate.cooldownSeconds / 60}
          onComplete={() => setShowCooldown(false)}
        />
      </Modal>
      <PrehabGuideModal
        visible={showPrehab}
        onClose={() => setShowPrehab(false)}
        profile={profile}
      />
      <Modal
        transparent
        visible={showQuality}
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setShowQuality(false);
        }}
      >
        <View style={styles.shade}>
          <View style={[styles.sheet, styles.qualitySheet]}>
            <Text style={styles.eyebrow}>本次记录 · {completedCount} 组</Text>
            <Text style={[styles.modalTitle, { flex: 0 }]}>训练感觉如何？</Text>
            <Text style={styles.helper}>
              {selectedExercise && items.length === 1
                ? '动作稳定且满足专项标准的完整记录，才能计入进阶。'
                : '尚未完成的组和未练的动作不会写入记录。'}
            </Text>
            {selectedExercise && mastery?.manual && items.length === 1 ? (
              <Pressable
                disabled={saving}
                onPress={() => setConstraintsConfirmed((value) => !value)}
                style={styles.criteria}
              >
                <Text style={styles.secondaryText}>
                  {constraintsConfirmed ? '☑' : '□'} 已按完整标准完成
                </Text>
                <Text style={styles.note}>
                  {mastery.display}
                  {mastery.confirmationHint ? ' · ' + mastery.confirmationHint : ''}
                </Text>
              </Pressable>
            ) : null}
            {(
              [
                { value: 'solid', title: '动作稳定', detail: '可控完成，仍有余力' },
                { value: 'hard', title: '有些勉强', detail: '后续需要调整难度或训练量' },
                { value: 'pain', title: '出现不适', detail: '停止相关动作，优先处理疼痛' },
              ] as const
            ).map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={'按' + option.title + '保存训练'}
                disabled={
                  saving ||
                  (option.value === 'solid' &&
                    !!selectedExercise &&
                    items.length === 1 &&
                    !!mastery?.manual &&
                    !constraintsConfirmed)
                }
                onPress={() => void save(option.value)}
                style={[
                  styles.qualityOption,
                  option.value === 'pain' && styles.qualityPain,
                  (saving ||
                    (option.value === 'solid' &&
                      !!selectedExercise &&
                      items.length === 1 &&
                      !!mastery?.manual &&
                      !constraintsConfirmed)) && { opacity: 0.4 },
                ]}
              >
                <Text style={styles.secondaryText}>{option.title}</Text>
                <Text style={styles.note}>{option.detail}</Text>
              </Pressable>
            ))}
            <Pressable
              disabled={saving}
              onPress={() => setShowQuality(false)}
              style={styles.cooldownLink}
            >
              <Text style={styles.linkText}>{saving ? '保存中…' : '返回训练'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
