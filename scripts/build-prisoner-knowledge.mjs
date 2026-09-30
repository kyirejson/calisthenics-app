import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(process.argv[2] || path.join(project, '..', '001号', '囚徒健身全集'));
if (!fs.statSync(root).isDirectory()) throw Error('未找到囚徒健身原始资料目录。');
const chunks = [], files = [];
for (const book of fs.readdirSync(root).filter(name => /^0[1-4]_/u.test(name)).sort()) {
  const folder = path.join(root, book);
  for (const name of fs.readdirSync(folder).filter(n => n.endsWith('.md')).sort()) {
    const relative = book + '/' + name, source = fs.readFileSync(path.join(folder, name), 'utf8').replace(/\r\n/g, '\n');
    files.push({ path: relative, sha256: createHash('sha256').update(source).digest('hex') });
    let heading = name.replace(/\.md$/u, ''), buffer = '', start = 1, end = 1;
    const flush = () => { if (!buffer.trim()) return; const text = buffer.trim(); const id = 'cc-' + createHash('sha256').update(relative + ':' + start + ':' + text).digest('hex').slice(0, 24); chunks.push({ id, title: '囚徒健身' + Number(book.slice(0, 2)) + ' · ' + heading, path: relative, lineStart: start, lineEnd: end, text }); buffer = ''; };
    for (const [index, raw] of source.split('\n').entries()) {
      if (/^#{1,6}\s/u.test(raw)) { flush(); heading = raw.replace(/^#{1,6}\s+/u, ''); }
      const line = raw.replace(/!\[\[.*?\]\]|!\[[^\]]*\]\([^)]*\)/gu, '').trim(); if (!line) continue;
      for (let offset = 0; offset < line.length; offset += 650) {
        const part = line.slice(offset, offset + 650); if (buffer.length + part.length > 800) flush();
        if (!buffer) start = index + 1; end = index + 1; buffer += part + '\n';
      }
    }
    flush();
  }
}
const output = path.join(project, 'server', 'private', 'prisoner-index.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ version: 1, builtAt: new Date().toISOString(), files, chunks }));
console.log(JSON.stringify({ documents: files.length, chunks: chunks.length, bytes: fs.statSync(output).size, output }));
