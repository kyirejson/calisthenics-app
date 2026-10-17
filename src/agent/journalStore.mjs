// A committed head points only to fully written immutable records. One owner serializes all writes.
// Platform adapters own persistence; this is not a server-side cache or a native execution ledger.
export const JOURNAL_KEY = 'uncover.agent.journal.v2';
const IDENTITY_KEY = 'uncover.agent.anonymous-user.v1';
const PART_CHARS = 128 * 1024;
function partsOf(text) {
  const parts = [];
  for (let offset = 0; offset < text.length;) {
    let end = Math.min(text.length, offset + PART_CHARS);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]) && /[\uDC00-\uDFFF]/.test(text[end])) end++;
    parts.push(text.slice(offset, end)); offset = end;
  }
  return parts.length ? parts : [''];
}
export const journalId = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
export function copyJson(value) { return JSON.parse(JSON.stringify(value)); }
export function freezeJson(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeJson); Object.freeze(value);
  }
  return value;
}
/** @param {any} storage */
export function createJournalStore(storage) {
  let head = null, events = [], generation = 0, loaded = false, loading = null, writes = Promise.resolve();
  const knownKeys = new Set();
  const changed = () => { const error = Error('对话上下文已清空，本次记录未提交。'); error.code = 'context_cleared'; return error; };
  const check = token => { if (token !== generation) throw changed(); };
  const queue = operation => { const job = writes.then(operation, operation); writes = job.catch(() => {}); return job; };
  const valueKey = (session, seq) => `${JOURNAL_KEY}:${session}:event:${seq}`;
  const artifactKey = (session, id, part) => `${JOURNAL_KEY}:${session}:artifact:${id}:${part}`;
  async function writeValue(key, value, token) {
    const serialized = JSON.stringify(value); check(token);
    if (serialized.length <= PART_CHARS) { knownKeys.add(key); await storage.setItem(key, serialized); check(token); return; }
    const chunks = partsOf(serialized), parts = chunks.length;
    for (let i = 0; i < parts; i++) {
      check(token); const partKey = `${key}:part:${i}`; knownKeys.add(partKey);
      await storage.setItem(partKey, chunks[i]);
    }
    check(token); knownKeys.add(key); await storage.setItem(key, JSON.stringify({ journalEncoding: 'json-parts-v1', parts })); check(token);
  }
  async function readValue(key) {
    const raw = await storage.getItem(key); if (raw === null || raw === undefined) throw Error('对话记录缺失，未使用不完整历史。');
    knownKeys.add(key); const value = JSON.parse(raw);
    if (value?.journalEncoding !== 'json-parts-v1') return value;
    if (!Number.isSafeInteger(value.parts) || value.parts < 1) throw Error('对话分段格式无效。');
    const parts = [];
    for (let i = 0; i < value.parts; i++) { const partKey = `${key}:part:${i}`; knownKeys.add(partKey); const part = await storage.getItem(partKey); if (part == null) throw Error('对话分段缺失，未继续执行。'); parts.push(part); }
    return JSON.parse(parts.join(''));
  }
  async function load() {
    if (loaded) return;
    if (!loading) {
      const token = generation;
      const job = (async () => {
        const raw = await storage.getItem(JOURNAL_KEY); check(token);
        let next;
        if (raw) {
          next = JSON.parse(raw);
          if (next.version !== 2 || typeof next.sessionId !== 'string' || !Number.isSafeInteger(next.count) || next.count < 0 || !Array.isArray(next.artifacts)) throw Error('模型会话日志格式无效，未覆盖现有记录。');
        } else {
          let userId = await storage.getItem(IDENTITY_KEY); check(token);
          if (!userId || !/^[a-zA-Z0-9_-]{1,512}$/.test(userId)) { userId = 'max-' + journalId(); await storage.setItem(IDENTITY_KEY, userId); check(token); }
          next = { version: 2, sessionId: journalId(), userId, count: 0, artifacts: [] };
        }
        const restored = [];
        for (let offset = 0; offset < next.count; offset += 64) {
          const batch = await Promise.all(Array.from({ length: Math.min(64, next.count - offset) }, (_, i) => readValue(valueKey(next.sessionId, offset + i))));
          check(token);
          for (const event of batch) { if (event.seq !== restored.length || typeof event.type !== 'string') throw Error('模型会话日志顺序无效。'); restored.push(freezeJson(event)); }
        }
        check(token); head = next; events = restored; loaded = true;
      })().finally(() => { if (loading === job) loading = null; });
      loading = job;
    }
    await loading;
  }
  async function appendBatch(records, expectedGeneration = generation) {
    const captured = copyJson(records);
    return queue(async () => {
      check(expectedGeneration); await load(); check(expectedGeneration);
      const additions = captured.map((record, i) => freezeJson({ ...record, seq: head.count + i }));
      for (const event of additions) await writeValue(valueKey(head.sessionId, event.seq), event, expectedGeneration);
      const next = { ...head, count: head.count + additions.length };
      check(expectedGeneration); await storage.setItem(JOURNAL_KEY, JSON.stringify(next)); check(expectedGeneration);
      head = next; events.push(...additions); return additions;
    });
  }
  async function putArtifact(text, metadata = {}, expectedGeneration = generation) {
    if (typeof text !== 'string') throw Error('资料正文必须是文字。');
    return queue(async () => {
      check(expectedGeneration); await load(); check(expectedGeneration);
      const id = 'artifact-' + journalId(), chunks = partsOf(text), parts = chunks.length, starts = [];
      let offset = 0; for (const chunk of chunks) { starts.push(offset); offset += chunk.length; }
      const descriptor = freezeJson({ ...copyJson(metadata), artifactId: id, revision: 1, chars: text.length, parts, starts });
      for (let i = 0; i < parts; i++) {
        check(expectedGeneration); const key = artifactKey(head.sessionId, id, i); knownKeys.add(key);
        await storage.setItem(key, chunks[i]);
      }
      const next = { ...head, artifacts: [...head.artifacts, descriptor] };
      check(expectedGeneration); await storage.setItem(JOURNAL_KEY, JSON.stringify(next)); check(expectedGeneration);
      head = next; return descriptor;
    });
  }
  async function readArtifact(input) {
    await load(); const token = generation;
    const descriptor = head.artifacts.find(item => item.artifactId === input?.artifactId);
    if (!descriptor) throw Error('资料引用不存在或已随上下文清空。');
    if (input.revision !== undefined && input.revision !== descriptor.revision) throw Error('资料版本不匹配，请使用实际版本。');
    const offset = input.offset ?? 0, limit = input.full === true ? descriptor.chars : input.limit ?? 16000;
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 0) throw Error('资料读取范围应为非负整数。');
    const end = Math.min(descriptor.chars, offset + limit), chunks = [];
    for (let i = 0; i < descriptor.parts; i++) {
      const start = descriptor.starts[i], partEnd = descriptor.starts[i + 1] ?? descriptor.chars;
      if (start >= end || partEnd <= offset) continue;
      const part = await storage.getItem(artifactKey(head.sessionId, descriptor.artifactId, i)); check(token);
      if (part == null) throw Error('资料正文缺失，未返回伪造内容。');
      chunks.push(part.slice(Math.max(0, offset - start), Math.max(0, end - start)));
    }
    return { ok: true, ...descriptor, offset, text: chunks.join(''), complete: offset === 0 && end >= descriptor.chars,
      nextOffset: end < descriptor.chars ? end : null, referenceData: true };
  }
  async function clear() {
    if (head) for (const artifact of head.artifacts) for (let i = 0; i < artifact.parts; i++) knownKeys.add(artifactKey(head.sessionId, artifact.artifactId, i));
    ++generation; loaded = true; head = null; events = []; loading = null;
    return queue(async () => {
      // Enumerate only our own namespace; unrelated business records and the anonymous identity stay intact.
      if (storage.getAllKeys) for (const key of await storage.getAllKeys()) if (key === JOURNAL_KEY || key.startsWith(JOURNAL_KEY + ':')) knownKeys.add(key);
      // Remove the commit pointer first: an interrupted clear must not restore a head
      // whose private bodies have already been erased. Leftover bodies are never replayed.
      await storage.removeItem(JOURNAL_KEY);
      for (const key of knownKeys) if (key !== JOURNAL_KEY) await storage.removeItem(key);
      knownKeys.clear(); loaded = false;
    });
  }
  return { load, appendBatch, putArtifact, readArtifact, clear, generation: () => generation, events: () => [...events],
    eventsSince: offset => events.slice(offset),
    identity: () => head ? { sessionId: head.sessionId, userId: head.userId } : null, flush: () => writes,
    append: (type, data, requestId = '', token = generation) => appendBatch([{ type, data, requestId }], token).then(rows => rows[0]) };
}
