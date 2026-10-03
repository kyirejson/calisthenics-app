// Compatibility exports; shared client/server implementation lives in public source.
export * from '../src/agent/core/validation.mjs';
import { ServiceError, MAX_BODY_BYTES, record, text } from '../src/agent/core/validation.mjs';
const BAD = () => new ServiceError(400, 'INVALID_REQUEST', '请求内容不完整或格式不正确，请检查后重试。');

function imageFormat(bytes) {
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && bytes.readUInt32BE(8) === 13 && bytes.toString('ascii', 12, 16) === 'IHDR'
    && bytes.subarray(-12).equals(Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]))) {
    return { mime: 'image/png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 14 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)) && bytes.at(-1) === 0x3b) {
    return { mime: 'image/gif', width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
    && bytes.readUInt32LE(4) === bytes.length - 8) {
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && bytes.readUInt32LE(16) === 10) {
      return { mime: 'image/webp', width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
    }
    if (chunk === 'VP8 ' && bytes.subarray(23, 26).equals(Buffer.from([157, 1, 42]))) {
      return { mime: 'image/webp', width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L' && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      return { mime: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }
  if (bytes.length > 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
        return { mime: 'image/jpeg', height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
      }
      offset += length;
    }
  }
  return null;
}

export function validatePhotoRequest(value) {
  record(value, ['imageDataUrl', 'note']);
  if (typeof value.imageDataUrl !== 'string' || value.imageDataUrl.length > MAX_BODY_BYTES) throw BAD();
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value.imageDataUrl);
  if (!match || match[2].length % 4 !== 0) throw new ServiceError(400, 'INVALID_IMAGE', '请选择有效的 JPEG、PNG、WebP 或 GIF 图片。');
  const bytes = Buffer.from(match[2], 'base64');
  const detected = imageFormat(bytes);
  if (bytes.toString('base64') !== match[2] || !detected || detected.mime !== match[1]
    || detected.width < 1 || detected.height < 1 || detected.width > 8192 || detected.height > 8192
    || detected.width * detected.height > 24000000) {
    throw new ServiceError(400, 'INVALID_IMAGE', '图片内容、格式或尺寸不符合要求，请重新选择或压缩图片。');
  }
  return { imageDataUrl: value.imageDataUrl, note: value.note === undefined ? '' : text(value.note, 500, true) };
}
