import * as DocumentPicker from 'expo-document-picker';
import { attachmentKind, checkedText, extractText, MAX_FILE_BYTES, MAX_TEXT_CHARS } from './chatAttachments.mjs';
import type { FileSource } from './chatFileTypes';

export async function pickChatFiles(): Promise<FileSource[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown', '.md', '.txt', '.docx', '.pdf'], multiple: true, base64: false });
  return result.canceled ? [] : result.assets.map(asset => ({ ...asset, size: asset.size ?? 0 }));
}
export async function readChatFile(source: FileSource): Promise<string> {
  const kind = attachmentKind(source.name);
  if (source.size > MAX_FILE_BYTES) throw Error('文件超过本机读取大小（32 MB），请拆分后添加。');
  const bytes = new Uint8Array(source.file ? await source.file.arrayBuffer() : await (await fetch(source.uri)).arrayBuffer());
  if (bytes.length > MAX_FILE_BYTES) throw Error('文件超过本机读取大小（32 MB），请拆分后添加。');
  if (kind !== 'pdf') return extractText(bytes, kind);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('/chat-pdf/pdf.worker.min.mjs', window.location.href).href;
  const resource = (path: string) => new URL(`/chat-pdf/${path}/`, window.location.href).href;
  const loading = pdfjs.getDocument({ data: bytes, cMapUrl: resource('cmaps'), cMapPacked: true, standardFontDataUrl: resource('standard_fonts'), wasmUrl: resource('wasm') });
  try {
    const pdf = await loading.promise;
    const pages: string[] = [];
    let length = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.map(item => 'str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '').join('');
      pages.push(text);
      length += text.length;
      page.cleanup();
      if (length > MAX_TEXT_CHARS) throw Error('文件文字过多，请拆分文件后发送；没有截断或发送原文。');
    }
    return checkedText(pages.join('\n\n'));
  } finally { await loading.destroy(); }
}
export function releaseChatFile(source: FileSource) { if (source.uri.startsWith('blob:')) URL.revokeObjectURL(source.uri); }
