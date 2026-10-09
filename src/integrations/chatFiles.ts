import { requireOptionalNativeModule } from 'expo';
import { File, Paths } from 'expo-file-system';
import { attachmentKind, checkedText, extractText, MAX_FILE_BYTES } from './chatAttachments.mjs';
import type { FileSource } from './chatFileTypes';

const reader = requireOptionalNativeModule<{ readPdf(uri: string): Promise<string> }>('UncoverChatFiles');
export async function pickChatFiles(): Promise<FileSource[]> {
  if (!requireOptionalNativeModule('ExpoDocumentPicker')) throw Error('附件选择需要安装包含此功能的新版 App；文字聊天仍可使用。');
  const picker = await import('expo-document-picker');
  const result = await picker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
  return result.canceled ? [] : result.assets.map(asset => ({ ...asset, size: asset.size ?? 0 }));
}
export async function readChatFile(source: FileSource): Promise<string> {
  const kind = attachmentKind(source.name);
  const file = new File(source.uri);
  if (Math.max(file.size ?? 0, source.size) > MAX_FILE_BYTES) throw Error('文件超过本机读取大小（32 MB），请拆分后添加。');
  if (kind === 'pdf') {
    if (!reader) throw Error('PDF 读取需要安装包含此功能的新版 App。');
    return checkedText(await reader.readPdf(source.uri));
  }
  return extractText(await file.bytes(), kind);
}
export function releaseChatFile(source: FileSource) {
  // Only delete the individual copied picker file, never the original user file.
  if (!source.uri.startsWith(`${Paths.cache.uri.replace(/\/$/, '')}/DocumentPicker/`)) return;
  try { const file = new File(source.uri); if (file.exists) file.delete(); } catch { /* OS also expires cache files. */ }
}
