// Real production queues/lifecycle; only storage and platform effects are synthetic.
if (!require.extensions['.ts']) require('./register-typescript.cjs')();
const { createAppRepository } = require('../../src/store/repository.ts');
function repositoryHarness({
  initial = {},
  before = async () => {},
  readBefore = async () => {},
  deletePhotos,
  effects = {},
} = {}) {
  const disk = new Map(Object.entries(initial));
  const storage = {
    getItem: async (key) => {
      await readBefore(key);
      return disk.get(key) ?? null;
    },
    setItem: async (key, value) => {
      await before({ kind: 'set', key, value });
      disk.set(key, value);
    },
    multiSet: async (pairs) => {
      await before({ kind: 'multiSet', pairs });
      pairs.forEach(([key, value]) => disk.set(key, value));
    },
    multiRemove: async (keys) => {
      await before({ kind: 'remove', keys });
      keys.forEach((key) => disk.delete(key));
    },
  };
  const repository = createAppRepository(storage, {
    clearRetired: async () => {},
    clearRunning: async () => {},
    clearMusic: async () => {},
    resetConnection: async () => {},
    clearMemory: async () => {},
    deletePhotos: deletePhotos || (async () => {}),
    ...effects,
  });
  return { disk, storage, repository, store: repository.getSnapshot, load: repository.load };
}
module.exports = { repositoryHarness };
