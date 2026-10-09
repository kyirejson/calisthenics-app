const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

// Discover all domain suites so new suites cannot be omitted by a release workflow.
const suites = fs.readdirSync(__dirname).filter(name => /^test-.*\.cjs$/.test(name) && name !== path.basename(__filename))
  .sort().map(name => path.join(__dirname, name));
if (!suites.length) throw Error('No regression suites discovered');
function libraryScripts(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? libraryScripts(path.join(directory, entry.name))
    : /\.(cjs|mjs)$/.test(entry.name) ? [path.join(directory, entry.name)] : []);
}
for (const file of libraryScripts(path.join(__dirname, 'lib')).sort()) {
  const check = spawnSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit' });
  if (check.error) throw check.error;
  if (check.status !== 0) process.exit(check.status ?? 1);
}
const result = spawnSync(process.execPath, ['--test', ...suites], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
