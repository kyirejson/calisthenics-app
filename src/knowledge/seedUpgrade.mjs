import { fingerprint } from './fingerprint.mjs';
const noteHash = (note) =>
  fingerprint(JSON.stringify([note.title ?? '', note.kind ?? 'reference', note.markdown]));
export function seedRevision(seed) {
  return fingerprint(
    JSON.stringify([seed.id, seed.name, seed.documents.map((note) => [note.path, noteHash(note)])]),
  );
}
/** Three-way merge: upstream baseline, installed Markdown, incoming app seed. */
export function reconcileSeed(local, incoming) {
  const revision = seedRevision(incoming);
  if (local?.seed?.revision === revision) return local;
  const baseline = local?.seed?.notes ?? {},
    previousConflicts = local?.seed?.conflicts ?? {};
  const current = new Map((local?.documents ?? []).map((note) => [note.path, note]));
  const upstream = new Map(incoming.documents.map((note) => [note.path, note]));
  const documents = [],
    conflicts = {},
    notes = {};
  for (const [path, next] of upstream) {
    const mine = current.get(path),
      hash = noteHash(next);
    notes[path] = hash;
    if (!local) {
      documents.push(next);
      continue;
    }
    if (mine && noteHash(mine) === hash) {
      documents.push(mine);
      continue;
    }
    // Old installations have no baseline. A matching stored source hash proves unedited text;
    // unknown or imported content is conservatively treated as a user change.
    const pristine =
      mine &&
      (baseline[path]
        ? noteHash(mine) === baseline[path]
        : /^[a-f0-9]{64}$/.test(mine.sha256 ?? '') && fingerprint(mine.markdown) === mine.sha256);
    if (pristine) {
      documents.push(next);
      continue;
    }
    if (!mine && !Object.hasOwn(baseline, path)) {
      documents.push(next);
      continue;
    }
    if (mine) documents.push(mine);
    if (baseline[path] !== hash || previousConflicts[path])
      conflicts[path] = { incoming: next, reason: mine ? 'modified' : 'deleted_locally' };
  }
  for (const [path, mine] of current) {
    if (upstream.has(path)) continue;
    const pristine = baseline[path] && noteHash(mine) === baseline[path];
    if (pristine) continue;
    documents.push(mine);
    if (Object.hasOwn(baseline, path) || previousConflicts[path])
      conflicts[path] = { incoming: null, reason: 'removed_upstream' };
  }
  const name =
    local?.seed && local.name === local.seed.name ? incoming.name : (local?.name ?? incoming.name);
  return {
    ...incoming,
    ...local,
    name,
    documents,
    seed: { revision, name: incoming.name, notes, conflicts },
  };
}
export function resolveSeedConflict(library, path, choice) {
  if (choice !== 'local' && choice !== 'incoming') throw Error('请选择保留本机或采用新版');
  const conflict = library.seed?.conflicts?.[path];
  if (!conflict) throw Error('冲突已经处理或不存在');
  const documents =
    choice === 'local'
      ? library.documents
      : library.documents
          .filter((note) => note.path !== path)
          .concat(conflict.incoming ? [conflict.incoming] : []);
  const conflicts = { ...library.seed.conflicts };
  delete conflicts[path];
  return { ...library, documents, seed: { ...library.seed, conflicts } };
}
