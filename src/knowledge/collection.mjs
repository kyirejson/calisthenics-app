import { cleanMarkdown } from './cleanMarkdown.mjs';
import { normalizedPath } from './vault.mjs';
import { reconcileSeed, resolveSeedConflict } from './seedUpgrade.mjs';
export function validateLibraryId(id) {
  if (typeof id !== 'string' || !/^[a-z0-9_-]+$/i.test(id)) throw Error('资料库标识无效');
  return id;
}
export function noteFromInput(input) {
  if (!input || typeof input.path !== 'string' || typeof input.markdown !== 'string')
    throw Error('笔记参数无效');
  const path = normalizedPath(input.path);
  if (!path || !path.endsWith('.md')) throw Error('只导入 Markdown 文件');
  const markdown = cleanMarkdown(input.markdown);
  return {
    path,
    title: /^#\s+(.+)$/m.exec(markdown)?.[1].trim() || path.split('/').at(-1).slice(0, -3),
    kind: 'reference',
    sha256: '',
    markdown,
  };
}
export function folderEntries(library, folder = '') {
  const prefix = folder ? folder + '/' : '',
    folders = new Map(),
    notes = [];
  for (const note of library.documents) {
    if (!note.path.startsWith(prefix)) continue;
    const remainder = note.path.slice(prefix.length),
      slash = remainder.indexOf('/');
    if (slash < 0) notes.push({ type: 'note', path: note.path, title: note.title, count: 1 });
    else {
      const path = prefix + remainder.slice(0, slash);
      folders.set(path, (folders.get(path) || 0) + 1);
    }
  }
  return [
    ...[...folders]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, count]) => ({
        type: 'folder',
        path,
        title: path.split('/').at(-1).replace(/^\d+_/, '').replace(/_/g, ' · '),
        count,
      })),
    ...notes.sort((a, b) => a.path.localeCompare(b.path)),
  ];
}
export function createKnowledgeStore(adapter, seeds) {
  let queue = Promise.resolve(),
    initialized = false,
    cached = null;
  const enqueue = (fn) => {
    const job = queue.then(fn);
    queue = job.catch(() => {});
    return job;
  };
  const refresh = async () => {
    const latest = await adapter.readAll();
    cached = latest.map((library) => {
      const old = cached.find((item) => item.id === library.id);
      const same =
        old &&
        old.version === library.version &&
        old.name === library.name &&
        JSON.stringify(old.seed) === JSON.stringify(library.seed) &&
        old.documents.length === library.documents.length &&
        old.documents.every((note, index) => {
          const next = library.documents[index];
          return (
            note.path === next.path &&
            note.title === next.title &&
            note.kind === next.kind &&
            note.sha256 === next.sha256 &&
            note.markdown === next.markdown
          );
        });
      return same ? old : library;
    });
  };
  const initialize = async () => {
    if (initialized) return;
    await adapter.resetLegacy();
    const libraries = await adapter.readAll(),
      bundle = typeof seeds === 'function' ? await seeds() : seeds;
    for (const seed of bundle) {
      validateLibraryId(seed.id);
      const index = libraries.findIndex((l) => l.id === seed.id),
        local = libraries[index],
        next = reconcileSeed(local, seed);
      if (next !== local) {
        await adapter.writeVault(next);
        if (index < 0) libraries.push(next);
        else libraries[index] = next;
      }
    }
    cached = libraries;
    initialized = true;
  };
  return {
    list: () =>
      enqueue(async () => {
        const loaded = initialized;
        await initialize();
        if (loaded) await refresh();
        return cached;
      }),
    create: (name) =>
      enqueue(async () => {
        await initialize();
        await refresh();
        if (typeof name !== 'string' || !name.trim()) throw Error('请输入资料库名称');
        const existing = cached;
        if (existing.some((l) => l.name === name.trim())) throw Error('同名资料库已存在');
        const library = {
          version: 1,
          id: 'library-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
          name: name.trim(),
          documents: [],
        };
        await adapter.writeVault(library);
        cached = [...cached, library];
        return library;
      }),
    importNotes: (id, inputs) =>
      enqueue(async () => {
        await initialize();
        await refresh();
        validateLibraryId(id);
        if (!Array.isArray(inputs) || !inputs.length) throw Error('请选择 Markdown 文件');
        const library = cached.find((l) => l.id === id);
        if (!library) throw Error('资料库不存在');
        const notes = inputs.map(noteFromInput),
          paths = new Set(library.documents.map((d) => d.path));
        for (const note of notes) {
          if (paths.has(note.path)) throw Error('文件已存在：' + note.path + '。未覆盖任何笔记。');
          paths.add(note.path);
        }
        const next = { ...library, documents: [...library.documents, ...notes] };
        await adapter.writeVault(next);
        cached = cached.map((l) => (l.id === id ? next : l));
        return next;
      }),
    resolveConflict: (id, path, choice) =>
      enqueue(async () => {
        await initialize();
        await refresh();
        validateLibraryId(id);
        const library = cached.find((l) => l.id === id);
        if (!library) throw Error('资料库不存在');
        const next = resolveSeedConflict(library, path, choice);
        await adapter.writeVault(next);
        cached = cached.map((l) => (l.id === id ? next : l));
        return next;
      }),
  };
}
