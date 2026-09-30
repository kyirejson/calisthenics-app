import type { ImageSourcePropType } from 'react-native';
import type { Exercise } from '../types';
import { getOriginalActionFrames, getOriginalActionImage, getOriginalImage, getOriginalResource } from './originalResources';
import { getSkillImage } from './skillsImages';
import { getDemonImage } from './demonImages';

export type ArtworkFrame = { key: string; source: ImageSourcePropType; caption: string; kind: 'original' | 'reference' | 'generated' };
export type ExerciseArtwork = { frames: ArtworkFrame[]; cover?: ArtworkFrame; coverIndex: number; missingReason?: string };

// Confirmed mismatches are never rendered as a different exercise. Retain IDs
// and source files for old records / future licensed replacements, not display.
export const rejectedArtwork: Readonly<Record<string, string>> = {
  fl_03: '现有照片未展示单腿前水平，待补对应示范。',
  fl_04: '现有照片未清楚展示分腿前水平，待补对应示范。',
  pl_01: '原图是半俯卧撑起式，不是俯撑前倾。',
  pl_03: '现有照片是屈臂支撑，不是直臂高级收腿俯撑。',
  pl_04: '现有照片无法核实分腿姿态，待补对应示范。',
  bl_01: '现有照片是完全后水平，不是德式悬挂。',
  bl_02: '现有照片是人体旗帜，不是收腿后水平。',
  bl_03: '现有照片是并腿后水平，不是分腿后水平。',
  ls_04: '现有照片是双杠支撑，不是分腿V支撑。',
  ls_05: '现有照片是L支撑变式，不是完全V支撑。',
  hf_02: '现有照片是倾斜旗帜，不是收腿人体旗帜。',
  hf_03: '现有拼图属于单腿扬旗，不能作为分腿人体旗帜示范。',
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
  if (exerciseId === 'pl_02') return getSkillImage('pl_02_reviewed');
  if (exerciseId === 'bl_04') return getSkillImage('bl_04_reviewed') || getDemonImage('pull_demon_02');
  if (exerciseId === 'mu_01') return getOriginalImage('image01454.jpeg');
  if (exerciseId === 'mu_02') return getOriginalImage('image01471.jpeg');
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
    const requiresReviewed = ['pl_02', 'bl_04', 'mu_01', 'mu_02', 'legRaise_demon_05'].includes(exercise.id);
    const skill = reviewed || (!requiresReviewed ? getSkillImage(exercise.id) : undefined);
    const demon = !requiresReviewed ? getDemonImage(exercise.id) : undefined;
    const original = getOriginalActionImage(exercise.id);
    const supplemental = skill || demon;
    if (supplemental) {
      const cover: ArtworkFrame = { key: exercise.id + '-reference', source: supplemental, kind: 'reference', caption: /^(mu_02|mu_03)$/.test(exercise.id) ? '关键位置参考 · 动态过程请结合动作指导' : '关键姿态参考' };
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
