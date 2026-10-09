import { TrainingDialogs } from '../features/training/TrainingDialogs';
import { styles } from '../features/training/styles';
import { useTrainingSession, type TrainingProps } from '../features/training/useTrainingSession';

import { SafeAreaView, Text, View } from 'react-native';
import { Button, UITheme } from '../components/ui';

import { TrainingCockpit } from '../components/TrainingCockpit';

export function TrainingScreen(props: TrainingProps) {
  const session = useTrainingSession(props);
  const {
    rirTarget,
    onBack,
    profile,
    openChat,
    setSelectedSet,
    timerDuration,
    receipt,
    plan,
    workout,
    items,
    sets,
    index,
    elapsed,
    timerKind,
    remaining,
    paused,
    saving,
    error,
    setShowGuide,
    setShowWarmup,
    setShowCooldown,
    setShowPrehab,
    setShowPicker,
    warmupDone,
    current,
    equipment,
    activeSet,
    changeExercise,
    togglePause,
    extendRest,
    confirmExit,
    toggleSet,
    editSet,
    endTimer,
    startManualTimer,
    addSet,
    removeSet,
    startRest,
    requestFinish,
  } = session;
  if (!profile || !workout || !current)
    return (
      <UITheme>
        <SafeAreaView style={styles.safe}>
          <View style={styles.empty}>
            <Text style={styles.actionTitle}>当前没有可训练动作</Text>
            <Text style={styles.note}>
              {plan
                ? plan.notice
                : '请查看今日页的倒立解锁条件；颈桥还需标准桥基础及适宜性确认。可先选择准备动作。'}
            </Text>
            <Button label="返回" onPress={onBack} />
          </View>
        </SafeAreaView>
      </UITheme>
    );

  return (
    <UITheme>
      <SafeAreaView style={styles.safe}>
        <TrainingCockpit
          items={items}
          index={index}
          sets={sets}
          activeSet={activeSet}
          elapsed={elapsed}
          saving={saving}
          error={error}
          warmupDone={warmupDone}
          rirTarget={rirTarget}
          timerKind={timerKind}
          remaining={remaining}
          timerDuration={timerDuration}
          paused={paused}
          receipt={receipt}
          onBack={confirmExit}
          onChat={openChat}
          onFinish={requestFinish}
          onGuide={() => setShowGuide(true)}
          onWarmup={() => setShowWarmup(true)}
          onExercise={changeExercise}
          onSet={setSelectedSet}
          onEdit={editSet}
          onToggleSet={toggleSet}
          onAddSet={addSet}
          onRemoveSet={removeSet}
          onPause={togglePause}
          onExtend={extendRest}
          onEndTimer={endTimer}
          onStartTimer={startManualTimer}
          onStartRest={startRest}
          onAddExercise={() => setShowPicker(true)}
          onSafety={() => (equipment ? setShowGuide(true) : setShowPrehab(true))}
          onCooldown={() => setShowCooldown(true)}
        />
        <TrainingDialogs model={session} />
      </SafeAreaView>
    </UITheme>
  );
}
