// Display-only crops reviewed against the unmodified book photographs. The
// gallery and source guidance always retain the complete, original frame.
export type SubjectFrame = { x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number };
const reviewed: Readonly<Record<string, SubjectFrame>> = {
  'image00551.jpeg': { x: 0.3, y: 0.075, width: 0.42, height: 0.9, sourceWidth: 628, sourceHeight: 407 },
  'image00553.jpeg': { x: 0.15, y: 0.18, width: 0.66, height: 0.78, sourceWidth: 628, sourceHeight: 401 },
  'image00555.jpeg': { x: 0.06, y: 0.28, width: 0.86, height: 0.65, sourceWidth: 628, sourceHeight: 410 },
  'image00557.jpeg': { x: 0.055, y: 0.35, width: 0.9, height: 0.6, sourceWidth: 628, sourceHeight: 405 },
  'image00559.jpeg': { x: 0.24, y: 0.43, width: 0.54, height: 0.52, sourceWidth: 628, sourceHeight: 408 },
  'image00561.jpeg': { x: 0.18, y: 0.4, width: 0.64, height: 0.55, sourceWidth: 628, sourceHeight: 416 },
  'image00563.jpeg': { x: 0.25, y: 0.33, width: 0.47, height: 0.62, sourceWidth: 628, sourceHeight: 422 },
  'image00565.jpeg': { x: 0.3, y: 0.25, width: 0.43, height: 0.69, sourceWidth: 628, sourceHeight: 426 },
  'image00567.jpeg': { x: 0.2, y: 0.45, width: 0.76, height: 0.5, sourceWidth: 628, sourceHeight: 417 },
  'image00570.jpeg': { x: 0.29, y: 0.49, width: 0.44, height: 0.475, sourceWidth: 628, sourceHeight: 426 },
  'image00607.jpeg': { x: 0.35, y: 0.05, width: 0.45, height: 0.93, sourceWidth: 628, sourceHeight: 415 },
  'image00609.jpeg': { x: 0.19, y: 0.08, width: 0.74, height: 0.86, sourceWidth: 628, sourceHeight: 401 },
  'image00611.jpeg': { x: 0.26, y: 0, width: 0.45, height: 0.98, sourceWidth: 628, sourceHeight: 401 },
  'image00613.jpeg': { x: 0.35, y: 0.04, width: 0.38, height: 0.88, sourceWidth: 628, sourceHeight: 408 },
  'image00615.jpeg': { x: 0.36, y: 0.04, width: 0.33, height: 0.82, sourceWidth: 628, sourceHeight: 454 },
  'image00617.jpeg': { x: 0.34, y: 0.02, width: 0.41, height: 0.76, sourceWidth: 628, sourceHeight: 453 },
  'image00619.jpeg': { x: 0.35, y: 0.025, width: 0.43, height: 0.8, sourceWidth: 628, sourceHeight: 425 },
  'image00621.jpeg': { x: 0.36, y: 0.03, width: 0.34, height: 0.82, sourceWidth: 628, sourceHeight: 426 },
  'image00623.jpeg': { x: 0.39, y: 0.03, width: 0.4, height: 0.76, sourceWidth: 628, sourceHeight: 447 },
  'image00625.jpeg': { x: 0.35, y: 0.03, width: 0.36, height: 0.81, sourceWidth: 628, sourceHeight: 425 },
  'image00578.jpeg': { x: 0.31, y: 0.39, width: 0.34, height: 0.57, sourceWidth: 628, sourceHeight: 411 },
  'image00580.jpeg': { x: 0.1, y: 0.21, width: 0.78, height: 0.7, sourceWidth: 628, sourceHeight: 410 },
  'image00582.jpeg': { x: 0.24, y: 0.29, width: 0.46, height: 0.64, sourceWidth: 628, sourceHeight: 410 },
  'image00584.jpeg': { x: 0.39, y: 0.26, width: 0.27, height: 0.69, sourceWidth: 628, sourceHeight: 415 },
  'image00586.jpeg': { x: 0.37, y: 0.32, width: 0.3, height: 0.62, sourceWidth: 628, sourceHeight: 402 },
  'image00588.jpeg': { x: 0.39, y: 0.41, width: 0.3, height: 0.56, sourceWidth: 628, sourceHeight: 423 },
  'image00590.jpeg': { x: 0.35, y: 0.35, width: 0.43, height: 0.59, sourceWidth: 628, sourceHeight: 429 },
  'image00592.jpeg': { x: 0.35, y: 0.25, width: 0.47, height: 0.73, sourceWidth: 628, sourceHeight: 398 },
  'image00594.jpeg': { x: 0.32, y: 0.41, width: 0.46, height: 0.52, sourceWidth: 628, sourceHeight: 402 },
  'image00596.jpeg': { x: 0.29, y: 0.37, width: 0.47, height: 0.6, sourceWidth: 628, sourceHeight: 401 },
  'image00633.jpeg': { x: 0.24, y: 0.08, width: 0.48, height: 0.78, sourceWidth: 628, sourceHeight: 398 },
  'image00635.jpeg': { x: 0.1, y: 0.125, width: 0.64, height: 0.73, sourceWidth: 628, sourceHeight: 403 },
  'image00637.jpeg': { x: 0.09, y: 0.07, width: 0.58, height: 0.86, sourceWidth: 628, sourceHeight: 400 },
  'image00639.jpeg': { x: 0.24, y: 0.12, width: 0.6, height: 0.82, sourceWidth: 628, sourceHeight: 301 },
  'image00642.jpeg': { x: 0.07, y: 0.07, width: 0.58, height: 0.88, sourceWidth: 628, sourceHeight: 407 },
  'image00644.jpeg': { x: 0.28, y: 0, width: 0.39, height: 0.9, sourceWidth: 628, sourceHeight: 424 },
  'image00646.jpeg': { x: 0.28, y: 0, width: 0.55, height: 0.78, sourceWidth: 628, sourceHeight: 406 },
  'image00648.jpeg': { x: 0.28, y: 0, width: 0.4, height: 0.75, sourceWidth: 628, sourceHeight: 419 },
  'image00651.jpeg': { x: 0.3, y: 0, width: 0.48, height: 0.76, sourceWidth: 628, sourceHeight: 414 },
  'image00653.jpeg': { x: 0.3, y: 0, width: 0.48, height: 0.76, sourceWidth: 628, sourceHeight: 435 },
  'image00660.jpeg': { x: 0.08, y: 0.18, width: 0.82, height: 0.7, sourceWidth: 628, sourceHeight: 399 },
  'image00662.jpeg': { x: 0.04, y: 0.105, width: 0.91, height: 0.8, sourceWidth: 628, sourceHeight: 398 },
  'image00664.jpeg': { x: 0.19, y: 0.15, width: 0.61, height: 0.79, sourceWidth: 628, sourceHeight: 403 },
  'image00666.jpeg': { x: 0.16, y: 0.18, width: 0.68, height: 0.74, sourceWidth: 628, sourceHeight: 397 },
  'image00668.jpeg': { x: 0.11, y: 0.15, width: 0.77, height: 0.78, sourceWidth: 628, sourceHeight: 396 },
  'image00670.jpeg': { x: 0.14, y: 0.13, width: 0.75, height: 0.78, sourceWidth: 628, sourceHeight: 397 },
  'image00673.jpeg': { x: 0.23, y: 0.4, width: 0.48, height: 0.57, sourceWidth: 628, sourceHeight: 432 },
  'image00674.jpeg': { x: 0.23, y: 0.49, width: 0.57, height: 0.49, sourceWidth: 628, sourceHeight: 422 },
  'image00678.jpeg': { x: 0.39, y: 0.035, width: 0.45, height: 0.93, sourceWidth: 628, sourceHeight: 357 },
  'image00680.jpeg': { x: 0.23, y: 0.31, width: 0.6, height: 0.62, sourceWidth: 628, sourceHeight: 435 },
  'image00692.jpeg': { x: 0.46, y: 0.02, width: 0.33, height: 0.97, sourceWidth: 628, sourceHeight: 391 },
  'image00694.jpeg': { x: 0.2, y: 0.22, width: 0.66, height: 0.68, sourceWidth: 628, sourceHeight: 403 },
  'image00696.jpeg': { x: 0.47, y: 0, width: 0.32, height: 0.995, sourceWidth: 628, sourceHeight: 439 },
  'image00698.jpeg': { x: 0.45, y: 0.1, width: 0.44, height: 0.88, sourceWidth: 628, sourceHeight: 566 },
  'image00700.jpeg': { x: 0.51, y: 0.1, width: 0.32, height: 0.87, sourceWidth: 628, sourceHeight: 551 },
  'image00702.jpeg': { x: 0.51, y: 0.08, width: 0.34, height: 0.9, sourceWidth: 628, sourceHeight: 513 },
  'image00704.jpeg': { x: 0.5, y: 0.07, width: 0.37, height: 0.9, sourceWidth: 628, sourceHeight: 494 },
  'image00706.jpeg': { x: 0.35, y: 0.03, width: 0.53, height: 0.95, sourceWidth: 628, sourceHeight: 478 },
  'image00708.jpeg': { x: 0.47, y: 0.045, width: 0.42, height: 0.9, sourceWidth: 628, sourceHeight: 505 },
  'image00710.jpeg': { x: 0.33, y: 0.06, width: 0.59, height: 0.91, sourceWidth: 628, sourceHeight: 533 },
};
export const getSubjectFrame = (key?: string) => key ? reviewed[key] : undefined;

/** Contain the reviewed region, never cover-crop limbs to fill a mismatched box. */
export function fitSubjectFrame(frame: SubjectFrame, boxWidth: number, boxHeight: number) {
  const width = frame.sourceWidth * frame.width, height = frame.sourceHeight * frame.height;
  const scale = Math.min(boxWidth / width, boxHeight / height);
  return { width: frame.sourceWidth * scale, height: frame.sourceHeight * scale,
    left: (boxWidth - width * scale) / 2 - frame.x * frame.sourceWidth * scale,
    top: (boxHeight - height * scale) / 2 - frame.y * frame.sourceHeight * scale };
}
export function photoAspect(dimensions?: { width: number; height: number }, subject?: SubjectFrame) {
  if (subject) return subject.sourceWidth * subject.width / (subject.sourceHeight * subject.height);
  return dimensions && dimensions.width > 0 && dimensions.height > 0 ? dimensions.width / dimensions.height : 4 / 3;
}
