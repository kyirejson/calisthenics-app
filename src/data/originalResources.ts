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

export type OriginalActionFrame = { key: string; source: ImageSourcePropType; caption: string };

/** Only figures inside this action's section, not later examples or chapter art. */
export function getOriginalActionFrames(exerciseId: string): OriginalActionFrame[] {
  const resource = getOriginalResource(exerciseId);
  if (resource?.kind !== 'book' || resource.scope !== 'section') return [];
  const body = resource.markdown.split(/^###\s+(?:更上|超越|变式|额外|进阶八式)/m)[0];
  const frames: OriginalActionFrame[] = [];
  for (const match of body.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
    const name = match[1];
    // The repeated "最终式" chapter banner is not an exercise photograph.
    if (name === 'image00568.jpeg' || frames.some(frame => frame.key === name)) continue;
    const source = getOriginalImage(name);
    if (!source) continue;
    const after = body.slice((match.index || 0) + match[0].length);
    const caption = /^\s*\n\s*(图\s*\d+[^\n]*)/.exec(after)?.[1]?.trim() || `原图 ${frames.length + 1}`;
    frames.push({ key: name, source, caption });
  }
  return frames;
}

// Specific exercise illustrations to override chapter introductions or ambiguous section figures.
const verifiedChapterActionImages: Record<string, string> = {
  recovery_shortBridge: 'image00917.jpeg',
  recovery_bentHold: 'image00926.jpeg',
  recovery_easyTwist: 'image00935.jpeg',
  // 靠墙顶立用图108（双脚上墙后的完成姿势）作封面，而非图107（起式入位），避免大图看不出动作形态。
  hspu_01: 'image00692.jpeg',
  hspu_03: 'image00696.jpeg',
  bridge_06: 'image00670.jpeg',
  bridge_07: 'image00673.jpeg',
  bridge_08: 'image00674.jpeg',
  bridge_09: 'image00678.jpeg',
  bridge_10: 'image00680.jpeg',
  pPush_08: 'image01118.jpeg',
  pPush_10: 'image01124.jpeg',
  pKip_05: 'image01174.jpeg',
  pKip_06: 'image01180.jpeg',
  pKip_07: 'image01185.jpeg',
  pBFlip_08: 'image01385.jpeg',
  pBFlip_09: 'image01391.jpeg',
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
  const frames = getOriginalActionFrames(exerciseId);
  // Most six-art pairs show the start followed by the distinguishing position.
  if (/^(push|pull|squat|legRaise|bridge|hspu)_\d+$/.test(exerciseId) && frames.length > 1) return frames[1].source;
  if (/^p(Push|Jump)_\d+$/.test(exerciseId) && frames.length === 3) return frames[2].source;
  // Dynamic routes are identifiable in the action, not in a shared start pose.
  if (/^p(Push|Jump|Kip|FFlip|BFlip|Pull)_\d+$/.test(exerciseId) && frames.length > 1) return frames[Math.floor(frames.length / 2)].source;
  const resource = getOriginalResource(exerciseId);
  // Section covers must come from the filtered action figures, never the
  // repeated banner or later chapter examples rejected by the gallery.
  if (resource?.kind === 'book' && resource.scope === 'section') {
    return frames.find(frame => frame.key === resource.primaryImageName)?.source || frames[0]?.source;
  }
  return getOriginalImage(resource?.primaryImageName);
}
