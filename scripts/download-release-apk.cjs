// Range-download one immutable official EAS artifact; preserve the existing prefix
// until every part is complete. Run publish-app-release.ps1 afterwards for signing.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const [uri, target, totalText, resumeDirectory] = process.argv.slice(2);
const total = Number(totalText), url = new URL(uri);
assert.equal(url.protocol, 'https:'); assert.equal(url.hostname, 'expo.dev');
assert.ok(/^\/artifacts\/eas\/[^/]+\.apk$/.test(url.pathname));
assert.ok(Number.isSafeInteger(total) && total > 1000000);
const root = path.resolve('D:/UncoverBuildTools/temp');
const destination = path.resolve(target);
assert.equal(path.dirname(destination), root);
assert.match(path.basename(destination), /^uncover-v\d+\.\d+\.\d+\.apk$/);
const prefix = fs.existsSync(destination) ? fs.statSync(destination).size : 0;
assert.ok(prefix <= total, 'Existing prefix cannot exceed the artifact');
if (prefix === total) { console.log('Already downloaded; run signature verification.'); process.exit(0); }
const directory = resumeDirectory ? path.resolve(resumeDirectory) : fs.mkdtempSync(path.join(root, 'release-ranges-'));
assert.equal(path.dirname(directory), root); assert.match(path.basename(directory), /^release-ranges-[A-Za-z0-9]+$/);
const metadata = { uri, destination, total, prefix }, metadataFile = path.join(directory, 'manifest.json');
if (resumeDirectory) assert.deepEqual(JSON.parse(fs.readFileSync(metadataFile, 'utf8')), metadata, 'Range checkpoint belongs to another artifact or prefix');
else fs.writeFileSync(metadataFile, JSON.stringify(metadata));
const count = 8, chunk = Math.ceil((total - prefix) / count);
const ranges = Array.from({ length: count }, (_, index) => ({ start: prefix + index * chunk, end: Math.min(total - 1, prefix + (index + 1) * chunk - 1), file: path.join(directory, `part-${index}`) })).filter(part => part.start <= part.end);
const download = part => new Promise((resolve, reject) => {
  const present = fs.existsSync(part.file) ? fs.statSync(part.file).size : 0;
  assert.ok(present <= part.end - part.start + 1);
  if (present === part.end - part.start + 1) { console.log(`Reuse complete range ${part.start}-${part.end}`); resolve(); return; }
  const start = part.start + present, remainder = part.file + '.remaining';
  const child = spawn('curl.exe', ['--fail', '--location', '--silent', '--show-error', '--connect-timeout', '20', '--max-time', '600', '--range', `${start}-${part.end}`, '--output', remainder, '--write-out', '%{http_code}', uri], { windowsHide: true });
  let response = '', error = '';
  child.stdout.on('data', bytes => { response += bytes; }); child.stderr.on('data', bytes => { error += bytes; });
  child.on('error', reject);
  child.on('close', code => {
    try {
      if (response.trim() === '206' && fs.existsSync(remainder) && fs.statSync(remainder).size <= part.end - start + 1) {
        assert.equal(fs.existsSync(part.file) ? fs.statSync(part.file).size : 0, present, 'Range file changed during download');
        fs.appendFileSync(part.file, fs.readFileSync(remainder)); fs.unlinkSync(remainder);
      }
      if (code !== 0 || response.trim() !== '206' || !fs.existsSync(part.file) || fs.statSync(part.file).size !== part.end - part.start + 1) reject(Error(`Range ${part.start}-${part.end} incomplete: exit ${code}, HTTP ${response.trim()}; ${error}`));
      else { console.log(`Complete range ${part.start}-${part.end}`); resolve(); }
    } catch (failure) { reject(failure); }
  });
});
(async () => {
  console.log(`Download ${total - prefix} remaining bytes in ${ranges.length} ranges; preserving ${prefix} bytes`);
  const results = await Promise.allSettled(ranges.map(download));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
  assert.equal(fs.existsSync(destination) ? fs.statSync(destination).size : 0, prefix, 'Another process modified the existing download');
  const assembled = path.join(directory, 'assembled.apk'), fd = fs.openSync(assembled, 'wx');
  try {
    const write = bytes => { let offset = 0; while (offset < bytes.length) offset += fs.writeSync(fd, bytes, offset); };
    if (prefix) write(fs.readFileSync(destination));
    for (const part of ranges) write(fs.readFileSync(part.file));
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  assert.equal(fs.statSync(assembled).size, total);
  fs.renameSync(assembled, destination);
  console.log(`DOWNLOADED ${destination} (${total} bytes); signing/resource verification still required`);
  // Remove only exact generated files under this unique temporary directory.
  for (const part of ranges) fs.unlinkSync(part.file);
  fs.unlinkSync(metadataFile);
  fs.rmdirSync(directory);
})().catch(error => { console.error(error.message); console.error(`Original prefix preserved; parts remain in ${directory}`); process.exitCode = 1; });
