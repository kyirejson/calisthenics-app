import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
export function bookIndexPath(filename) {
  const directory = process.env.NUTRITION_KNOWLEDGE_DIR?.trim();
  return directory ? path.resolve(directory, filename) : new URL('./private/' + filename, import.meta.url);
}
const tokens = value => { const text = value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); const result = []; for (let i = 0; i < text.length - 1; i++) result.push(text.slice(i, i + 2)); return result; };
export function loadPrisonerKnowledge(file = process.env.NUTRITION_PRISONER_INDEX?.trim() || bookIndexPath('prisoner-index.json')) {
  const unavailable = reason => ({ count: 0, status: { available: false, chunks: 0, reason }, retrieve: () => [] });
  let index;
  try {
    let source = fs.readFileSync(file, 'utf8');
    if (String(file).endsWith('.gz.b64')) {
      const encoded = source.trim();
      if (encoded.length > 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) return unavailable('invalid');
      source = gunzipSync(Buffer.from(encoded, 'base64'), { maxOutputLength: 8 * 1024 * 1024 }).toString('utf8');
    }
    index = JSON.parse(source);
  }
  catch (error) { return unavailable(error?.code === 'ENOENT' ? 'missing' : 'unreadable'); }
  if (!index || index.version !== 1 || !Array.isArray(index.chunks)) return unavailable('invalid');
  if (!index.chunks.length) return unavailable('empty');
  const idPattern = /^cc-[a-f0-9]{24}$/u;
  const chunks = index.chunks.filter(c => c && idPattern.test(c.id) && typeof c.text === 'string' && c.text.trim().length > 0 && c.text.length <= 850 && typeof c.title === 'string' && c.title.trim().length > 0 && c.title.length <= 200 && typeof c.path === 'string' && Number.isInteger(c.lineStart) && c.lineStart > 0 && Number.isInteger(c.lineEnd) && c.lineEnd >= c.lineStart);
  if (chunks.length !== index.chunks.length || new Set(chunks.map(c => c.id)).size !== chunks.length) return unavailable('invalid');
  const documents = chunks.map(chunk => ({ chunk, terms: new Set(tokens(chunk.title + chunk.text)), titleTerms: new Set(tokens(chunk.title)) }));
  const df = new Map(); for (const doc of documents) for (const term of doc.terms) df.set(term, (df.get(term) || 0) + 1);
  return { count: chunks.length, status: { available: true, chunks: chunks.length, reason: 'ready' }, retrieve(question) {
    const aliases = [['恢复', '休息 训练计划'], ['营养', '狱中饮食'], ['减肥', '控重'], ['记餐', '饮食'], ['六练', '炉火纯青']];
    const clean = question.replace(/街头健身|囚徒健身|囚徒|原书|动作要点|动作技巧|怎么做|如何做|怎么安排|有什么|请问/giu, '');
    const expanded = clean + ' ' + aliases.filter(([k]) => clean.includes(k)).map(([, v]) => v).join(' ');
    const query = new Set(tokens(expanded));
    const ranked = documents.map(doc => ({ ...doc, score: [...query].reduce((sum, term) => sum + (doc.terms.has(term) ? Math.log(1 + documents.length / (df.get(term) || 1)) * (doc.titleTerms.has(term) ? 3 : 1) : 0), 0) })).filter(doc => doc.score > 2).sort((a, b) => b.score - a.score);
    const selected = [], perPath = new Map();
    for (const { chunk } of ranked) { if ((perPath.get(chunk.path) || 0) >= 2) continue; selected.push({ id: chunk.id, title: chunk.title, excerpt: chunk.text, lineStart: chunk.lineStart, lineEnd: chunk.lineEnd }); perPath.set(chunk.path, (perPath.get(chunk.path) || 0) + 1); if (selected.length === 3) break; }
    return selected;
  } };
}
