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
    | 'items'
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
    | 'setWarmupDone'
    | 'current'
    | 'equipment'
    | 'estimate'
    | 'addExercise'
  >;
}) {
  const {
    profile,
    plan,
    logInteraction,
    items,
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
    setWarmupDone,
    current,
    equipment,
    estimate,
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
    </>
  );
}
