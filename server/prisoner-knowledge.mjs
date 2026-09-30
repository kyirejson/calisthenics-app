import fs from 'node:fs';
const defaultIndex = new URL('./private/prisoner-index.json', import.meta.url);
const tokens = value => { const text = value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); const result = []; for (let i = 0; i < text.length - 1; i++) result.push(text.slice(i, i + 2)); return result; };
export function loadPrisonerKnowledge(file = defaultIndex) {
  let index; try { index = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { count: 0, retrieve: () => [] }; }
  if (index.version !== 1 || !Array.isArray(index.chunks)) return { count: 0, retrieve: () => [] };
  const chunks = index.chunks.filter(c => /^cc-[a-f0-9]{24}$/u.test(c.id) && typeof c.text === 'string' && c.text.length <= 850 && typeof c.title === 'string' && Number.isInteger(c.lineStart) && Number.isInteger(c.lineEnd));
  const documents = chunks.map(chunk => ({ chunk, terms: new Set(tokens(chunk.title + chunk.text)), titleTerms: new Set(tokens(chunk.title)) }));
  const df = new Map(); for (const doc of documents) for (const term of doc.terms) df.set(term, (df.get(term) || 0) + 1);
  return { count: chunks.length, retrieve(question) {
    const aliases = [['六艺', '俯卧撑 深蹲 引体 举腿 桥 倒立撑'], ['恢复', '休息 训练计划'], ['营养', '狱中饮食'], ['减肥', '控重'], ['记餐', '饮食']];
    const expanded = question + ' ' + aliases.filter(([k]) => question.includes(k)).map(([, v]) => v).join(' ');
    const query = new Set(tokens(expanded));
    const ranked = documents.map(doc => ({ ...doc, score: [...query].reduce((sum, term) => sum + (doc.terms.has(term) ? Math.log(1 + documents.length / (df.get(term) || 1)) * (doc.titleTerms.has(term) ? 3 : 1) : 0), 0) })).filter(doc => doc.score > 2).sort((a, b) => b.score - a.score);
    const selected = [], perPath = new Map();
    for (const { chunk } of ranked) { if ((perPath.get(chunk.path) || 0) >= 2) continue; selected.push({ id: chunk.id, title: chunk.title, excerpt: chunk.text, lineStart: chunk.lineStart, lineEnd: chunk.lineEnd }); perPath.set(chunk.path, (perPath.get(chunk.path) || 0) + 1); if (selected.length === 3) break; }
    return selected;
  } };
}
