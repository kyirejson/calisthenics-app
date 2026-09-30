type Dimensions = { width: number; height: number };
type ImageEvent = { nativeEvent?: { source?: Partial<Dimensions>; target?: { naturalWidth?: number; naturalHeight?: number } } };

/** RN provides source dimensions; RN Web forwards the browser's image event. */
export function loadedImageDimensions(event: unknown, source?: unknown): Dimensions | undefined {
  const value = event as ImageEvent | null;
  const asset = source && typeof source === 'object' ? source as Partial<Dimensions> : undefined;
  const pairs = [
    [value?.nativeEvent?.source?.width, value?.nativeEvent?.source?.height],
    [value?.nativeEvent?.target?.naturalWidth, value?.nativeEvent?.target?.naturalHeight],
    [asset?.width, asset?.height],
  ];
  for (const [width, height] of pairs) if (typeof width === 'number' && typeof height === 'number' && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return { width, height };
  return undefined;
}
