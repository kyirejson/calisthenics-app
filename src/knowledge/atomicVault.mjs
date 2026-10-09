import { validateLibraryId } from './collection.mjs';
import { normalizedPath } from './vault.mjs';
export function validateVault(vault) {
  if (
    !vault ||
    vault.version !== 1 ||
    typeof vault.name !== 'string' ||
    !Array.isArray(vault.documents)
  )
    throw Error('知识库结构无效');
  validateLibraryId(vault.id);
  const paths = new Set();
  for (const note of vault.documents) {
    if (
      !note ||
      typeof note.markdown !== 'string' ||
      normalizedPath(note.path) !== note.path ||
      !note.path.endsWith('.md') ||
      paths.has(note.path)
    )
      throw Error('知识库笔记无效或重复');
    paths.add(note.path);
  }
  return vault;
}
/** Write-ahead journal: a process interruption rolls forward; a reported failure rolls back.
 * Files are still plain Markdown. This recoverable journal is not a second knowledge database.
 */
export function createAtomicVaultWriter(io) {
  const recover = async () => {
    const raw = await io.readJournal();
    if (!raw) return;
    const journal = JSON.parse(raw);
    if (journal.version !== 1) throw Error('知识库恢复日志版本无效');
    validateVault(journal.after);
    if (journal.before) validateVault(journal.before);
    if (journal.before && journal.before.id !== journal.after.id)
      throw Error('恢复日志包含不同资料库');
    const rollback = await io.isRollback();
    await io.apply(
      rollback ? journal.before : journal.after,
      journal.after.id,
      rollback ? journal.after : journal.before,
    );
    await io.removeJournal();
  };
  return {
    recover,
    async write(before, after) {
      validateVault(after);
      if (before) validateVault(before);
      if (before && before.id !== after.id) throw Error('不能跨资料库写入');
      await recover();
      await io.prepare(JSON.stringify({ version: 1, before, after }));
      try {
        await io.apply(after, after.id, before);
      } catch (error) {
        try {
          await io.markRollback();
          await recover();
        } catch (recovery) {
          throw new Error('知识库写入失败，恢复日志已保留；重新打开后重试。', { cause: recovery });
        }
        throw error;
      }
      // Commit is durable; a cleanup interruption can safely replay the same transaction.
      try {
        await io.removeJournal();
      } catch {
        console.warn('知识库已经保存，恢复日志将在下次读取时清理。');
      }
    },
  };
}
