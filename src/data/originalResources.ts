import type { ImageSourcePropType } from 'react-native';
import { originalImageMap } from './private/imageMap';
import { originalTexts } from './private/originalTexts';
import { recoveryOriginalTexts } from './private/recoveryTexts';
import { recoveryImageMap } from './private/recoveryImageMap';

export type OriginalResource = {
  title: string;
  kind: 'book' | 'mini_program';
  scope: 'section' | 'chapter' | 'supplement';
  sourceFile: string | null;
  markdown: string;
  primaryImageName: string | null;
  missingImageNames?: string[];
};

export function getOriginalResource(exerciseId: string) {
  return recoveryOriginalTexts[exerciseId] || originalTexts[exerciseId];
}

export function getOriginalImage(imageName: string | null | undefined): ImageSourcePropType | undefined {
  return imageName ? originalImageMap[imageName] || recoveryImageMap[imageName] : undefined;
}

// Specific exercise illustrations to override chapter introductions or ambiguous section figures.
const verifiedChapterActionImages: Record<string, string> = {
  recovery_shortBridge: 'image00917.jpeg',
  recovery_bentHold: 'image00926.jpeg',
  recovery_easyTwist: 'image00935.jpeg',
  // 靠墙顶立用图108（双脚上墙后的完成姿势）作封面，而非图107（起式入位），避免大图看不出动作形态。
  hspu_01: 'image00692.jpeg',
  trifecta_twist: 'image00935.jpeg',
  aux_fingertipPushup: 'image00786.jpeg',
  flagClutch_08: 'image00818.jpeg',
  flagPress_08: 'image00843.jpeg',
  hang_08: 'image00777.jpeg',
  neck_01: 'image00851.jpeg',
  neck_02: 'image00853.jpeg',
  neck_03: 'image00855.jpeg',
  neck_04: 'image00860.jpeg',
  // 单腿台阶提踵用图18（直腿单腿台阶提踵终极式，image00877），杜绝误用原地高抬腿图（image00880）。
  aux_calfRaise: 'image00877.jpeg',
};

export function getOriginalActionImage(exerciseId: string): ImageSourcePropType | undefined {
  const chapterImage = getOriginalImage(verifiedChapterActionImages[exerciseId]);
  if (chapterImage) return chapterImage;
  const resource = getOriginalResource(exerciseId);
  const primary = getOriginalImage(resource?.primaryImageName);
  if (primary) return primary;
  // A verified action section can contain its own ordered figures even when
  // the resource generator did not mark one as the cover image.
  if (resource?.kind !== 'book' || resource.scope !== 'section') return undefined;
  for (const match of resource.markdown.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
    const image = getOriginalImage(match[1]);
    if (image) return image;
  }
  return undefined;
}
