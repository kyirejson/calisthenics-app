import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv.slice(2).length > 1 || process.argv.slice(2).some(arg => arg.startsWith('--'))) throw Error('仅支持一个囚徒健身原始资料目录参数。');
const root = path.resolve(process.argv[2] || path.join(project, '..', '001号', '囚徒健身全集'));
if (!fs.statSync(root).isDirectory()) throw Error('未找到原始书籍资料目录。');
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
if (!chunks.length) throw Error('囚徒健身资料为空，未覆盖现有索引。');
const output = path.join(project, 'server', 'private', 'prisoner-index.json');
const serialized = JSON.stringify({ version: 1, builtAt: new Date().toISOString(), files, chunks });
const renderPayload = gzipSync(serialized, { level: 9 }).toString('base64');
if (Buffer.byteLength(renderPayload) >= 1024 * 1024) throw Error('压缩索引超过 Render Secret Files 限制，未覆盖现有索引。');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, serialized);
const renderOutput = output + '.gz.b64';
fs.writeFileSync(renderOutput, renderPayload);
console.log(JSON.stringify({ documents: files.length, chunks: chunks.length, bytes: fs.statSync(output).size, output, renderOutput, renderBytes: Buffer.byteLength(renderPayload), sha256: createHash('sha256').update(renderPayload).digest('hex') }));
