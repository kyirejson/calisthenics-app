// Plain Markdown is authoritative; this index is disposable and rebuildable.
export function normalizedPath(value) {
  if (typeof value !== 'string') throw Error('路径无效');
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw Error('路径编码无效');
  }
  if (/^[a-z][a-z\d+.-]*:|^[\\/]|\0/i.test(decoded)) throw Error('不允许库外路径');
  const parts = [];
  for (const part of decoded.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) throw Error('路径超出知识库');
      parts.pop();
    } else parts.push(part);
  }
  return parts.join('/');
}
const pathIndexes = new WeakMap(),
  vaultIndexes = new WeakMap(),
  searchIndexes = new WeakMap();
function pathIndex(vault) {
  if (pathIndexes.has(vault)) return pathIndexes.get(vault);
  const exact = new Map(),
    basenames = new Map();
  for (const doc of vault.documents) {
    const entry = { path: doc.path, type: 'note' },
      base = doc.path.split('/').at(-1);
    exact.set(doc.path, entry);
    basenames.set(base, [...(basenames.get(base) ?? []), entry]);
  }
  const index = { exact, basenames };
  pathIndexes.set(vault, index);
  return index;
}
export function resolveLink(vault, from, target) {
  const raw = target.replace(/\\\|/g, '|').split('|')[0];
  const split = raw.indexOf('#');
  const name = split < 0 ? raw : raw.slice(0, split),
    heading = split < 0 ? '' : raw.slice(split + 1);
  const index = pathIndex(vault);
  if (!name) return { path: from, type: 'note', heading };
  let root = '',
    relative = '';
  try {
    root = normalizedPath(name);
  } catch {}
  try {
    relative = normalizedPath(from.slice(0, from.lastIndexOf('/') + 1) + name);
  } catch {}
  if (!root && !relative) return null;
  const exact =
    index.exact.get(relative) ??
    index.exact.get(relative + '.md') ??
    index.exact.get(root) ??
    index.exact.get(root + '.md');
  if (exact) return { ...exact, heading };
  const basename = root.split('/').at(-1);
  const candidates = [
    ...(index.basenames.get(basename) ?? []),
    ...(index.basenames.get(basename + '.md') ?? []),
  ];
  return candidates.length === 1 ? { ...candidates[0], heading } : null;
}
export function noteLinks(markdown) {
  const links = [];
  const pattern = /(!?)\[\[([^\]]+)\]\]|(!?)\[([^\]]*)\]\(([^\n]*?)\)(?=\s|$|[。，、；])/gm;
  for (const match of markdown.matchAll(pattern)) {
    const wiki = match[2] !== undefined;
    const raw = wiki ? match[2] : match[5];
    // Parentheses in Obsidian chapter names require a balanced Markdown destination.
    const target = raw?.replace(/^<|>$/g, '');
    if (target && !/^[a-z][a-z\d+.-]*:/i.test(target))
      links.push({
        target,
        label: wiki ? (target.split('|')[1] ?? target.split('|')[0]) : match[4],
        embed: Boolean(wiki ? match[1] : match[3]),
      });
  }
  return links;
}
export function indexVault(vault) {
  if (vaultIndexes.has(vault)) return vaultIndexes.get(vault);
  const documents = vault.documents.map((doc) => ({
    ...doc,
    headings: [...doc.markdown.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1]),
    links: noteLinks(doc.markdown).map((link) => ({
      ...link,
      resolved: resolveLink(vault, doc.path, link.target),
    })),
    backlinks: [],
  }));
  const backlinks = new Map();
  for (const other of documents)
    for (const target of new Set(
      other.links.map((link) => link.resolved?.path).filter((path) => path && path !== other.path),
    )) {
      if (!backlinks.has(target)) backlinks.set(target, []);
      backlinks.get(target).push({ path: other.path, title: other.title });
    }
  for (const document of documents) document.backlinks = backlinks.get(document.path) ?? [];
  vaultIndexes.set(vault, documents);
  return documents;
}
export function searchNotes(documents, query) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return documents.map((document) => ({ document, score: 0, excerpt: '' }));
  return documents
    .map((document) => {
      let indexed = searchIndexes.get(document);
      if (!indexed) {
        indexed = {
          text: document.markdown.toLocaleLowerCase(),
          title: document.title.toLocaleLowerCase(),
          path: document.path.toLocaleLowerCase(),
        };
        searchIndexes.set(document, indexed);
      }
      const { text, title, path } = indexed;
      if (
        !terms.every((term) => text.includes(term) || title.includes(term) || path.includes(term))
      )
        return null;
      const position = Math.max(0, text.indexOf(terms[0]));
      return {
        document,
        score: terms.reduce((sum, term) => sum + (title.includes(term) ? 10 : 1), 0),
        excerpt: document.markdown
          .slice(Math.max(0, position - 40), position + 150)
          .replace(/\s+/g, ' '),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.document.path.localeCompare(b.document.path));
}
