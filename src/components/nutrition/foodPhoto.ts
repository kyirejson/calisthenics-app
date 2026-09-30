import { Platform } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';

// Only callers that OWN a generated cache file may invoke this; never picker originals.
export function removeOwnedCacheFile(uri: string) {
  if (Platform.OS === 'web' || !uri.startsWith('file://')) return;
  try {
    const cache = Paths.cache.uri.endsWith('/') ? Paths.cache.uri : Paths.cache.uri + '/';
    if (!uri.startsWith(cache)) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch { /* OS cache eviction is the fallback. */ }
}

export async function compressPhoto(photo: { uri: string }, maxSide = 1280): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  let original: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  let outputUri: string | undefined;
  try {
    original = await context.renderAsync();
    const longest = Math.max(original.width, original.height);
    if (!Number.isFinite(longest) || longest <= 0) throw new Error('无法读取图片，请换一张图片。');
    if (longest > maxSide) context.resize(original.width >= original.height ? { width: maxSide } : { height: maxSide });
    rendered = await context.renderAsync();
    const output = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
    outputUri = output.uri;
    if (!output.base64 || Math.max(output.width, output.height) > maxSide || output.base64.length > 4 * 1024 * 1024 - 256)
      throw new Error('图片过大，请只拍摄营养标签区域后重试。');
    return 'data:image/jpeg;base64,' + output.base64;
  } finally {
    if (outputUri && outputUri !== photo.uri) removeOwnedCacheFile(outputUri);
    rendered?.release();
    if (original !== rendered) original?.release();
    context.release();
  }
}
