import { strFromU8, unzipSync } from 'fflate';

// Resource safeguards for local parsers, not model/conversation restrictions.
export const MAX_FILE_BYTES = 32 * 1024 * 1024;
export const MAX_TEXT_CHARS = 1_000_000;
export function attachmentKind(name) {
  const kind = name.split('.').pop()?.toLowerCase();
  if (!['pdf', 'docx', 'txt', 'md'].includes(kind)) throw Error('请选择 PDF、DOCX、TXT 或 MD 文件。');
  return kind;
}
export function checkedText(text) {
  const result = text.replace(/\u0000/g, '').trim();
  if (!result) throw Error('未提取到文字。扫描 PDF 暂不支持识别，请改用有文字的文件。');
  if (result.length > MAX_TEXT_CHARS) throw Error('文件文字过多，请拆分文件后发送；没有截断或发送原文。');
  return result;
}
export function fileSize(size) {
  return size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
}
function decodeEntity(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity.toLowerCase()];
  });
}
export function extractText(bytes, kind) {
  if (bytes.length > MAX_FILE_BYTES) throw Error('文件超过本机读取大小（32 MB），请拆分后添加。');
  if (kind === 'docx') {
    const archive = unzipSync(bytes, { filter(entry) {
      if (entry.name !== 'word/document.xml') return false;
      if (entry.originalSize > MAX_FILE_BYTES) throw Error('DOCX 正文过大，请拆分文件。');
      return true;
    } });
    if (!archive['word/document.xml']) throw Error('DOCX 文件中没有可读取的正文。');
    const xml = strFromU8(archive['word/document.xml']);
    const tokens = xml.match(/<(?:\w+:)?t\b[^>]*>[\s\S]*?<\/(?:\w+:)?t>|<(?:\w+:)?(?:tab|br|cr)\b[^>]*\/?\s*>|<\/(?:\w+:)?(?:p|tc)>/g) || [];
    return checkedText(tokens.map(token => {
      if (/^<\//.test(token)) return '\n';
      if (/^<(?:\w+:)?tab\b/.test(token)) return '\t';
      if (/^<(?:\w+:)?(?:br|cr)\b/.test(token)) return '\n';
      return decodeEntity(token.replace(/^<[^>]*>|<\/[^>]*>$/g, ''));
    }).join('').replace(/\n{3,}/g, '\n\n'));
  }
  if (kind !== 'txt' && kind !== 'md') throw Error('此文件需要 PDF 读取器。');
  let text;
  if (bytes[0] === 0xff && bytes[1] === 0xfe || bytes[0] === 0xfe && bytes[1] === 0xff) {
    const little = bytes[0] === 0xff;
    const pieces = [];
    for (let i = 2; i + 1 < bytes.length; i += 2) pieces.push(String.fromCharCode(little ? bytes[i] | bytes[i + 1] << 8 : bytes[i] << 8 | bytes[i + 1]));
    text = pieces.join('');
  } else text = strFromU8(bytes).replace(/^\uFEFF/, '');
  if (text.includes('\u0000')) throw Error('文件不是可读取的文本，请另存为 UTF-8 后添加。');
  return checkedText(text);
}
