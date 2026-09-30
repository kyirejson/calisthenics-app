import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import type { NutritionPhoto } from './types';
import { validPhotoId } from './photoMetadata';

let database: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('此浏览器不支持本地照片存储，请取消照片留存后记餐。')); return; }
    const request = indexedDB.open('uncover-nutrition-photos-v1', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('photos', { keyPath: 'id' }); };
    request.onerror = () => reject(new Error('本地照片存储不可用，请检查浏览器权限或剩余空间。'));
    request.onblocked = () => reject(new Error('照片存储被其他页面占用，请关闭重复页面后重试。'));
    request.onsuccess = () => { const result = request.result; result.onversionchange = () => { result.close(); database = undefined; }; resolve(result); };
  }).catch(error => { database = undefined; throw error; });
  return database;
}
async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('photos', mode), request = run(tx.objectStore('photos'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(new Error('照片未能保存，请检查剩余空间；饮食记录尚未提交。'));
  });
}
function bytesFromJpeg(dataUrl: string): Uint8Array {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[1].length > 4 * 1024 * 1024 || match[1].length % 4 !== 0) throw new Error('照片格式或大小无效，请重新拍摄。');
  const encoded = match[1], alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new Uint8Array(encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0));
  for (let i = 0, j = 0; i < encoded.length; i += 4) {
    const value = alphabet.indexOf(encoded[i]) << 18 | alphabet.indexOf(encoded[i + 1]) << 12
      | Math.max(0, alphabet.indexOf(encoded[i + 2])) << 6 | Math.max(0, alphabet.indexOf(encoded[i + 3]));
    if (j < bytes.length) bytes[j++] = value >> 16 & 255;
    if (j < bytes.length) bytes[j++] = value >> 8 & 255;
    if (j < bytes.length) bytes[j++] = value & 255;
  }
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) throw new Error('照片内容不是有效的 JPEG。');
  return bytes;
}
function fileFor(id: string) {
  if (!validPhotoId(id)) throw new Error('照片引用无效。');
  return new File(Paths.document, 'nutrition-photos', id + '.jpg');
}
export async function saveNutritionPhoto(dataUrl: string, kind: NutritionPhoto['kind'], capturedAt = new Date().toISOString()): Promise<NutritionPhoto> {
  if (!['food', 'label'].includes(kind) || !Number.isFinite(Date.parse(capturedAt))) throw new Error('照片类型或拍摄时间无效。');
  const bytes = bytesFromJpeg(dataUrl);
  const id = 'nutrition-photo-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 14) + '-' + Math.random().toString(36).slice(2, 8);
  if (Platform.OS === 'web') await transaction('readwrite', store => store.add({ id, blob: new Blob([bytes.buffer as ArrayBuffer], { type: 'image/jpeg' }), capturedAt }));
  else {
    const directory = new Directory(Paths.document, 'nutrition-photos');
    directory.create({ intermediates: true, idempotent: true });
    const file = fileFor(id);
    try { file.create({ overwrite: false }); file.write(bytes); }
    catch { if (file.exists) file.delete(); throw new Error('照片未能保存，请检查本机剩余空间。'); }
  }
  return { id, kind, capturedAt };
}
export async function nutritionPhotoURI(id: string): Promise<string | null> {
  if (!validPhotoId(id)) return null;
  if (Platform.OS === 'web') {
    const value = await transaction('readonly', store => store.get(id));
    return value?.blob instanceof Blob ? URL.createObjectURL(value.blob) : null;
  }
  const file = fileFor(id);
  return file.exists ? file.uri : null;
}
export function releasePhotoURI(uri: string | null) { if (uri?.startsWith('blob:')) URL.revokeObjectURL(uri); }
export async function deleteStoredPhotos(ids: readonly string[]): Promise<void> {
  for (const id of new Set(ids)) {
    if (!validPhotoId(id)) continue;
    if (Platform.OS === 'web') await transaction('readwrite', store => store.delete(id));
    else { const file = fileFor(id); if (file.exists) file.delete(); }
  }
}
export type CapturedNutritionPhoto = { dataUrl: string; capturedAt: number; kind?: NutritionPhoto['kind'] };
/** Store first, commit journal second, remove the newly owned asset if the commit fails. */
export async function withCapturedPhoto(frame: CapturedNutritionPhoto | undefined, retain: boolean, commit: (photo?: NutritionPhoto) => Promise<void>): Promise<void> {
  let photo: NutritionPhoto | undefined;
  try {
    if (retain && frame?.dataUrl) photo = await saveNutritionPhoto(frame.dataUrl, frame.kind ?? 'food', new Date(frame.capturedAt).toISOString());
    await commit(photo);
  } catch (error) {
    if (photo) { try { await deleteStoredPhotos([photo.id]); } catch { /* Do not mask the original failure. */ } }
    throw error;
  }
}
