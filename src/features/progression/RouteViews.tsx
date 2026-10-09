import { styles, palette } from './styles';

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { ExerciseMedia } from '../../components/ExerciseResource';

import {
  getProgressionStageState,
  getSeriesExercises,
  type ProgressionStatus,
} from '../../domain/training/progression';

import type { Exercise } from '../../types';

export function RouteDetail({
  status,
  onOpen,
  onArtwork,
  onUnlock,
  saving,
}: {
  status: ProgressionStatus;
  onOpen?: (id: string) => void;
  onArtwork: (exercise: Exercise) => void;
  onUnlock: () => void;
  saving: boolean;
}) {
  const [passedExpanded, setPassedExpanded] = useState(false);
  const [extensionsOpen, setExtensionsOpen] = useState(false);
  const [examHelp, setExamHelp] = useState(false);
  const sequence = getSeriesExercises(status.series.key);
  const stages = sequence.slice(0, status.totalLevels);
  const extensions = sequence.slice(status.totalLevels);
  const passedCount = status.complete ? stages.length : status.level - 1;
  const visibleFrom = passedExpanded
    ? 0
    : status.complete
      ? Math.max(0, passedCount - 2)
      : passedCount;
  const currentStage = (exercise: Exercise, index: number) => (
    <View key={exercise.id} style={styles.routeRow} testID="progression-current-stage">
      <View style={styles.rail}>
        <View style={styles.railLine} />
        <View style={[styles.node, styles.nodeCurrent]}>
          <View style={styles.nodeDot} />
        </View>
      </View>
      <View style={styles.currentCard}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(199,245,72,0.10)', 'rgba(199,245,72,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.currentTop}>
          <Text style={styles.currentKicker}>
            第 {index + 1} 式 · {index + 1 === stages.length ? '终式待验收' : '当前阶'}
          </Text>
          <Glyph
            name={index + 1 === stages.length ? 'crown' : 'shield'}
            color={palette.lime}
            size={21}
          />
        </View>
        <View style={styles.currentMain}>
          <PhotoButton exercise={exercise} size="large" onArtwork={onArtwork} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={'查看第' + (index + 1) + '式' + exercise.name + '动作指导'}
            onPress={() => onOpen?.(exercise.id)}
            style={styles.currentCopy}
          >
            <Text style={styles.currentName}>{exercise.name}</Text>
            <Text style={styles.guideLink}>动作指导 ›</Text>
          </Pressable>
        </View>
        <Text testID="progression-current-standard" style={styles.criteria}>
          {status.criteria.display}
        </Text>
        <View style={styles.examRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="查看当前阶验收条件"
            accessibilityState={{ expanded: examHelp }}
            onPress={() => setExamHelp(!examHelp)}
            style={styles.examHelp}
          >
            <View style={styles.pips}>
              {Array.from({ length: status.requiredSessions }, (_, pip) => (
                <View
                  key={pip}
                  style={[styles.pip, pip < status.qualifiedSessions && styles.pipDone]}
                >
                  {pip < status.qualifiedSessions ? (
                    <Glyph name="check" color={palette.bg} size={11} />
                  ) : null}
                </View>
              ))}
            </View>
            <Text testID="progression-exam-count" style={styles.examCount}>
              专项验收 {status.qualifiedSessions}/{status.requiredSessions}
            </Text>
            <Text style={styles.helpMark}>?</Text>
          </Pressable>
          {status.eligible ? <Text style={styles.ready}>可进阶</Text> : null}
        </View>
        {examHelp ? (
          <View style={styles.examNote}>
            <Text style={styles.examNoteText}>
              两次按升级标准完成的专项课，间隔至少24小时，反馈为动作扎实且无痛；未完成或未反馈不算验收。
            </Text>
            {status.criteria.manual ? (
              <Text style={styles.examNoteText}>
                {status.criteria.confirmationHint || '还需确认侧别、负重或其他动作条件均已满足。'}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Pressable
          testID="progression-current-action"
          accessibilityRole="button"
          accessibilityState={{ disabled: saving, busy: saving }}
          accessibilityLabel={
            status.eligible ? (status.next ? '解锁下一式' : '解锁最终动作') : '查看当前阶练习与验收'
          }
          disabled={saving}
          onPress={status.eligible ? onUnlock : () => onOpen?.(exercise.id)}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            saving && styles.disabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={palette.bg} size="small" />
          ) : (
            <Text style={styles.primaryText}>
              {status.eligible ? (status.next ? '解锁下一式' : '解锁最终动作') : '练习与验收'} ›
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.route}>
      <View style={styles.routeHead}>
        <Text style={styles.routeTitle}>{status.series.label}</Text>
        <Text style={styles.routeState}>
          {status.complete
            ? '终式已解锁'
            : '第 ' + status.level + ' / ' + status.totalLevels + ' 式'}
        </Text>
      </View>
      <View style={styles.listHeading}>
        <Text style={styles.listTitle}>阶数动作</Text>
        {passedCount ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passedExpanded ? '收起已通过阶数' : '展开全部已通过阶数'}
            accessibilityState={{ expanded: passedExpanded }}
            onPress={() => setPassedExpanded(!passedExpanded)}
            style={styles.fold}
          >
            <Text style={styles.foldText}>{passedCount} 式已通过</Text>
            <Text style={styles.foldArrow}>{passedExpanded ? '⌃' : '⌄'}</Text>
          </Pressable>
        ) : (
          <Text style={styles.listCount}>从当前阶开始</Text>
        )}
      </View>
      {stages.slice(visibleFrom).map((exercise, offset) => {
        const index = offset + visibleFrom;
        const state = getProgressionStageState(status, index);
        return state === 'current' ? (
          currentStage(exercise, index)
        ) : (
          <ActionRow
            key={exercise.id}
            exercise={exercise}
            index={index}
            state={state}
            badge={
              status.complete && index === stages.length - 1
                ? '终式已解锁'
                : state === 'passed'
                  ? '已通过'
                  : '待解锁'
            }
            onOpen={onOpen}
            onArtwork={onArtwork}
          />
        );
      })}
      {extensions.length ? (
        <View style={styles.extensions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={extensionsOpen ? '收起拓展动作' : '展开拓展动作'}
            accessibilityState={{ expanded: extensionsOpen }}
            onPress={() => setExtensionsOpen(!extensionsOpen)}
            style={styles.extensionToggle}
          >
            <View>
              <Text style={styles.listTitle}>拓展动作</Text>
              <Text style={styles.extensionNote}>不计入终式解锁</Text>
            </View>
            <Text style={styles.extensionCount}>
              {extensions.length} 个 {extensionsOpen ? '⌃' : '⌄'}
            </Text>
          </Pressable>
          {extensionsOpen
            ? extensions.map((exercise) => (
                <ActionRow
                  key={exercise.id}
                  exercise={exercise}
                  index={(exercise.step || 1) - 1}
                  state="upcoming"
                  badge="拓展"
                  rail={false}
                  onOpen={onOpen}
                  onArtwork={onArtwork}
                />
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}
export function ActionRow({
  exercise,
  index,
  badge,
  state,
  rail = true,
  onOpen,
  onArtwork,
}: {
  exercise: Exercise;
  index: number;
  badge: string;
  state: 'passed' | 'upcoming';
  rail?: boolean;
  onOpen?: (id: string) => void;
  onArtwork: (exercise: Exercise) => void;
}) {
  const passed = state === 'passed';
  return (
    <View style={styles.routeRow} testID={'progression-stage-' + exercise.id}>
      {rail ? (
        <View style={styles.rail}>
          <View style={styles.railLine} />
          <View style={[styles.node, passed && styles.nodePassed]}>
            <Glyph
              name={passed ? 'shield' : 'lock'}
              size={19}
              color={passed ? palette.lime : palette.faint}
            />
          </View>
        </View>
      ) : null}
      <View style={[styles.actionCard, !rail && styles.auxCard]}>
        <PhotoButton exercise={exercise} size="small" onArtwork={onArtwork} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            (rail ? '查看第' + (index + 1) + '式' : '查看') + exercise.name + '动作指导，' + badge
          }
          onPress={() => onOpen?.(exercise.id)}
          style={styles.actionCopy}
        >
          <Text style={styles.stepLabel}>{rail ? '第 ' + (index + 1) + ' 式' : badge}</Text>
          <Text style={styles.actionName}>{exercise.name}</Text>
          <Text style={[styles.stageBadge, passed && styles.stageBadgePassed]}>{badge}</Text>
        </Pressable>
        <Glyph
          name={passed ? 'check' : 'chevron'}
          color={passed ? palette.lime : palette.faint}
          size={17}
        />
      </View>
    </View>
  );
}
function PhotoButton({
  exercise,
  size,
  onArtwork,
}: {
  exercise: Exercise;
  size: 'small' | 'large';
  onArtwork: (exercise: Exercise) => void;
}) {
  const width = size === 'large' ? 104 : 82;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'放大查看' + exercise.name + '动作配图'}
      onPress={() => onArtwork(exercise)}
      style={styles.photo}
    >
      <ExerciseMedia
        exercise={exercise}
        width={width}
        minHeight={56}
        maxHeight={size === 'large' ? 126 : 98}
      />
      <View pointerEvents="none" style={styles.photoZoom}>
        <Glyph name="expand" size={11} color="#F2F5F9" />
      </View>
    </Pressable>
  );
}
export function Glyph({
  name,
  color,
  size = 20,
}: {
  name: 'crown' | 'shield' | 'lock' | 'check' | 'chevron' | 'expand' | 'search';
  color: string;
  size?: number;
}) {
  const paths = {
    crown: 'M3 7l4 4 5-7 5 7 4-4-2 11H5L3 7zm3 14h12',
    shield: 'M12 2l8 4v7c0 4-5 7-8 9-3-2-8-5-8-9V6l8-4zm-4 10 3 3 5-6',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M6 10h12v11H6V10zm6 5v2',
    check: 'M4 12l5 5L20 6',
    chevron: 'M9 5l7 7-7 7',
    expand: 'M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6',
    search: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none">
      <Path
        d={paths[name]}
        stroke={color}
        fill="none"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
