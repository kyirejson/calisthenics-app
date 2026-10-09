// Measures production algorithms against actual bundled texts; no user state/API access.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const { repositoryHarness } = require('./lib/app-repository-harness.cjs');
const { applicationGraph } = require('./lib/module-graph.cjs');
const root = path.resolve(__dirname, '..');
const round = (value) => Math.round(value * 100) / 100;
const describe = (values) => {
  const ordered = [...values].sort((a, b) => a - b);
  return {
    samples: values.length,
    minMs: round(ordered[0]),
    medianMs: round(ordered[Math.floor(ordered.length / 2)]),
    p95Ms: round(ordered[Math.ceil(ordered.length * 0.95) - 1]),
  };
};
async function browserMeasurements() {
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }),
    samples = [];
  try {
    for (let index = 0; index < 3; index++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
        page = await context.newPage(),
        errors = [];
      try {
        page.on('pageerror', (error) => errors.push(error.message));
        await context.addInitScript(() => {
          localStorage.setItem('profile-invitation-seen', '1');
          localStorage.setItem(
            'user_profile',
            JSON.stringify({
              name: '性能隔离',
              age: 30,
              sex: 'male',
              height: 175,
              weight: 75,
              goal: 'street_mastery',
              frequency: 3,
              experience: 'beginner',
              levels: {},
              planStartedAt: '2026-09-28T01:00:00Z',
            }),
          );
        });
        const startup = performance.now();
        await page.goto(process.env.APP_URL || 'http://127.0.0.1:8081/');
        await page.getByRole('tab', { name: '切换到我的', exact: true }).waitFor();
        const startupMs = performance.now() - startup;
        const databases = await page.evaluate(() => indexedDB.databases());
        assert.ok(
          !databases.some((database) => database.name === 'uncover-knowledge'),
          'startup must not initialize the knowledge database',
        );
        await page.getByRole('tab', { name: '切换到我的', exact: true }).click();
        const cold = performance.now();
        await page.getByRole('button', { name: '知识库', exact: true }).click();
        await page.getByRole('button', { name: '打开资料库 囚徒健身全集', exact: true }).waitFor();
        const firstOpenMs = performance.now() - cold;
        await page.getByRole('button', { name: '关闭知识库', exact: true }).click();
        const warm = performance.now();
        await page.getByRole('button', { name: '知识库', exact: true }).click();
        await page.getByRole('button', { name: '打开资料库 囚徒健身全集', exact: true }).waitFor();
        samples.push({
          startupMs: round(startupMs),
          firstOpenMs: round(firstOpenMs),
          repeatOpenMs: round(performance.now() - warm),
        });
        assert.deepEqual(errors, []);
      } finally {
        await context.close();
      }
    }
    return {
      environment: 'Desktop Chrome, 390x844, local Expo development server; not mobile timing',
      startup: describe(samples.map((sample) => sample.startupMs)),
      firstKnowledgeOpen: describe(samples.map((sample) => sample.firstOpenMs)),
      repeatKnowledgeOpen: describe(samples.map((sample) => sample.repeatOpenMs)),
      samples,
    };
  } finally {
    await browser.close();
  }
}
async function main() {
  const { readBundledLibraries } = await import('./lib/knowledge/seed-files.mjs');
  const { indexVault, searchNotes } = await import('../src/knowledge/vault.mjs');
  const { createKnowledgeStore } = await import('../src/knowledge/collection.mjs');
  if (global.gc) global.gc();
  const heapBefore = process.memoryUsage().heapUsed,
    seeds = readBundledLibraries(root);
  const coldTimes = [],
    indexes = [];
  for (let sample = 0; sample < 7; sample++) {
    const map = new Map(),
      start = performance.now();
    const adapter = {
      resetLegacy: async () => {},
      readAll: async () => structuredClone([...map.values()]),
      writeVault: async (library) => map.set(library.id, structuredClone(library)),
    };
    const store = createKnowledgeStore(adapter, () => Promise.resolve(seeds));
    const libraries = await store.list();
    coldTimes.push(performance.now() - start);
    if (sample === 6) {
      const build = performance.now();
      for (const library of libraries) indexes.push(indexVault(library));
      const indexMs = performance.now() - build,
        cachedTimes = [],
        searchTimes = [],
        refreshTimes = [];
      for (let iteration = 0; iteration < 100; iteration++) {
        const cached = performance.now();
        libraries.forEach((library, i) => assert.equal(indexVault(library), indexes[i]));
        cachedTimes.push(performance.now() - cached);
        const search = performance.now();
        indexes.forEach((index) => searchNotes(index, iteration % 2 ? '蛋白质' : '深蹲'));
        searchTimes.push(performance.now() - search);
      }
      for (let iteration = 0; iteration < 10; iteration++) {
        const refresh = performance.now(),
          latest = await store.list();
        refreshTimes.push(performance.now() - refresh);
        latest.forEach((library, i) => assert.equal(library, libraries[i]));
      }
      if (global.gc) global.gc();
      const h = repositoryHarness({
        initial: {
          user_profile: JSON.stringify({
            name: '性能隔离',
            age: 30,
            sex: 'male',
            height: 175,
            weight: 75,
            goal: 'street_mastery',
            frequency: 3,
            experience: 'beginner',
            levels: {},
            planStartedAt: '2026-09-28T01:00:00Z',
          }),
        },
      });
      await h.load();
      const notifications = { root: 0, nutrition: 0, training: 0, profile: 0 };
      const stops = [
        h.repository.subscribe(() => notifications.root++),
        h.repository.subscribeSelection(
          (value) => value.nutritionJournal,
          () => notifications.nutrition++,
        ),
        h.repository.subscribeSelection(
          (value) => ({ sessions: value.sessions, dailyEdits: value.dailyEdits }),
          () => notifications.training++,
        ),
        h.repository.subscribeSelection(
          (value) => value.profile,
          () => notifications.profile++,
        ),
      ];
      for (let iteration = 0; iteration < 100; iteration++)
        await h.store().setPhotoConsent(iteration % 2 === 0);
      stops.forEach((stop) => stop());
      assert.deepEqual(notifications, { root: 100, nutrition: 100, training: 0, profile: 0 });
      const report = {
        measuredAt: new Date().toISOString(),
        node: process.version,
        dataset: {
          libraries: seeds.length,
          notes: seeds.reduce((sum, library) => sum + library.documents.length, 0),
          markdownBytes: seeds
            .flatMap((library) => library.documents)
            .reduce((sum, note) => sum + Buffer.byteLength(note.markdown), 0),
        },
        knowledge: {
          coldSeedMerge: describe(coldTimes),
          firstIndexMs: round(indexMs),
          cachedIndex: describe(cachedTimes),
          twoLibrarySearch: describe(searchTimes),
          warmRefreshInMemoryAdapter: describe(refreshTimes),
          retainedHeapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
          heapMeasurement: global.gc
            ? 'V8 heap, explicit GC; includes corpus/modules/repository, not mobile RSS'
            : 'V8 heap, no explicit GC, noisy; not mobile RSS',
        },
        notificationsFor100NutritionWrites: notifications,
        eagerSeedModules: [...applicationGraph(root, 'web', { eagerOnly: true }).keys()]
          .filter((file) => /knowledge[\\/](referenceBundle|private[\\/]bundle)\.ts$/.test(file))
          .map((file) => path.relative(root, file)),
        limits:
          'Node corpus processing and synthetic in-memory persistence only; no Android performance claims',
      };
      if (process.argv.includes('--browser')) report.browser = await browserMeasurements();
      const outputAt = process.argv.indexOf('--output');
      if (outputAt >= 0)
        fs.writeFileSync(
          path.resolve(process.argv[outputAt + 1]),
          JSON.stringify(report, null, 2) + '\n',
        );
      console.log(JSON.stringify(report, null, 2));
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
