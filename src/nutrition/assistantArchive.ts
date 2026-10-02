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
  const put = async (value: Pick<SQLiteDatabase, 'runAsync'>, turn: AssistantConversation) => {
    const t = validatedTurn(turn);
    await value.runAsync('INSERT INTO turns(id,cursor,topic,createdAt,question,answer) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET cursor=excluded.cursor,topic=excluded.topic,createdAt=excluded.createdAt,question=excluded.question,answer=excluded.answer', t.id, archiveCursor(t), t.topic || null, t.createdAt, t.question, t.answer);
    await value.runAsync('DELETE FROM turn_search WHERE id=?', t.id);
    await value.runAsync('INSERT INTO turn_search(id,tokens) VALUES (?,?)', t.id, memoryTokens(t.question).join(' '));
  };
  return {
    async migrate(turns) { const value = await db(); await value.withExclusiveTransactionAsync(async tx => { if (!await tx.getFirstAsync("SELECT value FROM meta WHERE key='legacy-imported'")) { for (const t of turns) await put(tx, t); await tx.runAsync("INSERT INTO meta VALUES ('legacy-imported','true')"); } }); },
    async put(turn) { const value = await db(); await value.withExclusiveTransactionAsync(tx => put(tx, turn)); },
    async list(query: ArchiveQuery = {}) {
      const value = await db(), where: string[] = [], args: string[] = [];
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
    },
    async forget(text) { if (!text.trim()) throw new Error('待忘记的信息不能为空。'); const value = await db(); await value.runAsync('DELETE FROM turns WHERE instr(question,?)>0 OR instr(answer,?)>0', text, text); },
    async clear() { await (await db()).runAsync('DELETE FROM turns'); },
    async exportAll() { return (await (await db()).getAllAsync<AssistantConversation>('SELECT id,topic,createdAt,question,answer FROM turns ORDER BY cursor')).map(validatedTurn); },
  };
}
export const assistantArchive = createSQLiteArchive(() => openDatabaseAsync('uncover-assistant-memory-v2.db'));
