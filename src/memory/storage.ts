import { Directory, File, Paths } from 'expo-file-system';
const directory = new Directory(Paths.document, 'personal-memory');
export async function readMemory(): Promise<string | null> {
  const file = new File(directory, 'MEMORY.md');
  return file.exists ? file.text() : null;
}
export async function clearMemory(): Promise<void> { if (directory.exists) directory.delete(); }
export async function writeMemory(markdown: string): Promise<void> {
  directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, 'MEMORY.md');
  const previous = file.exists ? await file.text() : null;
  if (previous !== null) { const backup = new File(directory, 'MEMORY.previous.md'); if (!backup.exists) backup.create(); backup.write(previous); }
  if (!file.exists) file.create();
  try { file.write(markdown); if (await file.text() !== markdown) throw new Error('记忆文件写入校验失败'); }
  catch (error) { if (previous !== null) file.write(previous); else if (file.exists) file.delete(); throw error; }
}
