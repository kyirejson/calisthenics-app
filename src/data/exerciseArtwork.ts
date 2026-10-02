import type { ImageSourcePropType } from 'react-native';
import type { Exercise } from '../types';
import { getOriginalActionFrames, getOriginalActionImage, getOriginalImage, getOriginalResource } from './originalResources';
import { supplementalImageMap } from './private/supplementalImageMaps';
import { getDemonImage } from './demonImages';
import { equipmentArtwork } from './equipmentArtwork';

export type ArtworkFrame = { key: string; source: ImageSourcePropType; caption: string; kind: 'original' | 'reference' | 'generated' };
export type ExerciseArtwork = { frames: ArtworkFrame[]; cover?: ArtworkFrame; coverIndex: number; missingReason?: string };

// Confirmed mismatches are never rendered as a different exercise. Retain IDs
// and source files for old records / future licensed replacements, not display.
export const rejectedArtwork: Readonly<Record<string, string>> = {
  push_demon_03: '现有历史照片无法核实负重单臂俯卧撑。',
  push_demon_05: '现有照片是双臂双杠支撑，不是单臂双杠屈臂撑。',
  push_demon_06: '现有照片是跳跃准备，不是行走俯卧撑。',
  squat_demon_01: '现有照片未展示单腿跳箱深蹲。',
  squat_demon_05: '现有图片是插画且未展示西西弗斯式深蹲。',
  pull_demon_05: '现有照片未展示直腿L位单臂攀绳。',
  legRaise_demon_03: '现有照片是支撑变式，未展示俄式反折高位撑的姿态。',
  legRaise_demon_04: '现有图片是训练表，不是悬空折叠示范。',
  bridge_demon_01: '现有图片是训练表，不是台阶跌落反推示范。',
  bridge_demon_02: '现有照片是后空翻，不是倒立与铁板桥的转体。',
  hspu_demon_03: '现有照片是靠墙单臂倒立，不是倒立走台阶。',
  hspu_demon_05: '现有照片是双臂偏重倒立，不是单臂倒立。',
};

function reviewedReference(exerciseId: string): ImageSourcePropType | undefined {
  if (exerciseId === 'legRaise_demon_05') return getOriginalImage('image00653.jpeg');
  return undefined;
}

const neckDemo = require('../../assets/training-demos/neck-hand-resistance-single-v2.png');
const calfDemo = require('../../assets/training-demos/single-leg-calf-shoes-single-v2.png');
const cache = new Map<string, ExerciseArtwork>();

/** Single source of truth for thumbnails, training, detail and full-size view. */
export function getExerciseArtwork(exercise: Pick<Exercise, 'id' | 'realImage' | 'image'>): ExerciseArtwork {
  const cached = cache.get(exercise.id);
  if (cached) return cached;
  if (exercise.id.startsWith('equipment_')) {
    const asset = equipmentArtwork[exercise.id];
    const cover: ArtworkFrame | undefined = asset ? { key: exercise.id + '-equipment-demo', source: asset.source, kind: 'generated', caption: asset.variant + ' · 写实生成示范，非真人实拍' } : undefined;
    const result: ExerciseArtwork = { frames: cover ? [cover] : [], cover, coverIndex: 0, ...(!cover ? { missingReason: '暂无对应器械动作示范图。' } : {}) };
    cache.set(exercise.id, result);
    return result;
  }
  let result: ExerciseArtwork;
  const missingReason = rejectedArtwork[exercise.id];
  const demo = exercise.id === 'neck_handResistance' ? neckDemo : exercise.id === 'aux_singleLegCalf' ? calfDemo : undefined;
  if (missingReason) result = { frames: [], coverIndex: 0, missingReason };
  else if (demo) {
    const cover: ArtworkFrame = { key: exercise.id + '-demo', source: demo, kind: 'generated', caption: '补充示范 · 不属于原书照片' };
    result = { frames: [cover], cover, coverIndex: 0 };
  } else {
    const reviewed = reviewedReference(exercise.id);
    // A missing approved replacement must not resurrect the rejected old file.
    const requiresReviewed = exercise.id === 'legRaise_demon_05';
    const demon = !requiresReviewed ? getDemonImage(exercise.id) : undefined;
    const original = getOriginalActionImage(exercise.id);
    const supplemental = reviewed || supplementalImageMap[exercise.id] || demon;
    if (supplemental) {
      const cover: ArtworkFrame = { key: exercise.id + '-reference', source: supplemental, kind: 'reference', caption: '关键姿态参考' };
      result = { frames: [cover], cover, coverIndex: 0 };
    } else if (original) {
      const frames: ArtworkFrame[] = getOriginalActionFrames(exercise.id).map(frame => ({ ...frame, kind: 'original' }));
      const coverIndex = frames.findIndex(frame => frame.source === original);
      if (coverIndex < 0) {
        const fromBook = getOriginalResource(exercise.id)?.kind === 'book';
        frames.unshift({ key: exercise.id + '-original', source: original, caption: fromBook ? '原书关联配图' : '补充资料配图', kind: fromBook ? 'original' : 'reference' });
      }
      result = { frames, coverIndex: Math.max(0, coverIndex), cover: frames[Math.max(0, coverIndex)] };
    } else {
      const remote = exercise.realImage || exercise.image;
      const cover: ArtworkFrame | undefined = remote && /^https?:\/\//i.test(remote)
        ? { key: remote, source: { uri: remote }, caption: '外部参考图', kind: 'reference' } : undefined;
      result = { frames: cover ? [cover] : [], cover, coverIndex: 0 };
    }
  }
  cache.set(exercise.id, result);
  return result;
}
