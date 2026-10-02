import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { archiveCursor, archiveSearchTokens, rankArchive, validatedTurn, type ArchiveQuery, type AssistantArchive } from './assistantArchiveCore';
import { memoryTokens, memoryTimeRange } from './personalKnowledge';
import type { AssistantConversation } from './assistantState';

// SQLite for native; Metro resolves assistantArchive.web.ts on browsers.
export function createSQLiteArchive(open: () => Promise<SQLiteDatabase>): AssistantArchive {
  let database: Promise<SQLiteDatabase> | undefined;
  const db = () => database ||= open().then(async value => {
    await value.execAsync(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS turns (id TEXT PRIMARY KEY, cursor TEXT NOT NULL UNIQUE, topic TEXT, createdAt TEXT NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE VIRTUAL TABLE IF NOT EXISTS turn_search USING fts5(id UNINDEXED, tokens);
      CREATE TRIGGER IF NOT EXISTS turn_delete AFTER DELETE ON turns BEGIN DELETE FROM turn_search WHERE id=old.id; END;`);
    return value;
  }).catch(error => { database = undefined; throw error; });
  // Keep one native connection alive. Expo's exclusive helper opens and closes a
  // temporary connection per transaction; its teardown can fail after FTS writes.
  // Serialize reads too, so they cannot observe an unfinished write transaction.
  let tail: Promise<unknown> = Promise.resolve();
  let broken: Error | undefined;
  const serial = <T>(task: (value: SQLiteDatabase) => Promise<T>): Promise<T> => {
    const result = tail.then(async () => {
      if (broken) throw broken;
      return task(await db());
    });
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
  const transaction = async (value: SQLiteDatabase, task: () => Promise<void>) => {
    await value.execAsync('BEGIN IMMEDIATE');
    try {
      await task();
      await value.execAsync('COMMIT');
    } catch (error) {
      try { await value.execAsync('ROLLBACK'); }
      catch {
        // Never continue writing through an unknown transaction state or erase
        // the user's archive to recover. Reopening the app recreates the handle.
        broken = new Error('对话数据库事务未能恢复，请重新打开 App 后重试；历史数据未清除。');
        throw broken;
      }
      throw error;
    }
  };
  const put = async (value: Pick<SQLiteDatabase, 'runAsync'>, turn: AssistantConversation) => {
    const t = validatedTurn(turn);
    await value.runAsync('INSERT INTO turns(id,cursor,topic,createdAt,question,answer) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET cursor=excluded.cursor,topic=excluded.topic,createdAt=excluded.createdAt,question=excluded.question,answer=excluded.answer', t.id, archiveCursor(t), t.topic || null, t.createdAt, t.question, t.answer);
    await value.runAsync('DELETE FROM turn_search WHERE id=?', t.id);
    await value.runAsync('INSERT INTO turn_search(id,tokens) VALUES (?,?)', t.id, memoryTokens(t.question).join(' '));
  };
  return {
    migrate(turns) { return serial(value => transaction(value, async () => { if (!await value.getFirstAsync("SELECT value FROM meta WHERE key='legacy-imported'")) { for (const t of turns) await put(value, t); await value.runAsync("INSERT INTO meta VALUES ('legacy-imported','true')"); } })); },
    put(turn) { return serial(value => transaction(value, () => put(value, turn))); },
    list(query: ArchiveQuery = {}) { return serial(async value => {
      const where: string[] = [], args: string[] = [];
      if (query.topic) { where.push('(topic=? OR topic IS NULL)'); args.push(query.topic); }
      if (query.before) { where.push('cursor<?'); args.push(query.before); }
      const range = memoryTimeRange(query.question || '', query.now);
      if (range) { where.push('createdAt>=? AND createdAt<?'); args.push(range.start, range.end); }
      const tokens = archiveSearchTokens(query.question || '');
      const temporal = !!range || !tokens.length;
      if (tokens.length && !temporal) { where.push('id IN (SELECT id FROM turn_search WHERE turn_search MATCH ?)'); args.push(tokens.map(t => '"' + t.replace(/"/g, '""') + '"').join(' OR ')); }
      const clauses = where.length ? ' WHERE ' + where.join(' AND ') : '';
      // Keyword queries rank all matching candidates, not just the last few chats.
      const rows = await value.getAllAsync<AssistantConversation>('SELECT id,topic,createdAt,question,answer FROM turns' + clauses + ' ORDER BY cursor DESC' + (query.question && !temporal ? '' : ' LIMIT 100'), args);
      return rankArchive(rows.map(validatedTurn), query);
    }); },
    forget(text) { return serial(async value => { if (!text.trim()) throw new Error('待忘记的信息不能为空。'); await value.runAsync('DELETE FROM turns WHERE instr(question,?)>0 OR instr(answer,?)>0', text, text); }); },
    clear() { return serial(async value => { await value.runAsync('DELETE FROM turns'); }); },
    exportAll() { return serial(async value => (await value.getAllAsync<AssistantConversation>('SELECT id,topic,createdAt,question,answer FROM turns ORDER BY cursor')).map(validatedTurn)); },
  };
}
export const assistantArchive = createSQLiteArchive(() => openDatabaseAsync('uncover-assistant-memory-v2.db', { useNewConnection: true }));
