// Local-build fallback: read the existing EAS key only; never create/rotate credentials.
// Passwords stay in child-process environment; the short-lived key is outside the repo.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const config = require('../app.json').expo;
const [unsigned, previous, target, mode] = process.argv.slice(2);
const buildRoot = path.resolve('D:/UncoverBuildTools'), tempRoot = path.join(buildRoot, 'temp');
const cliRoot = process.env.EAS_CLI_ROOT || path.join(buildRoot, 'npm-cache/_npx/cdcf29a1293ceb8d/node_modules/eas-cli/build');
let stage = 'validate inputs';
function command(executable, args, options = {}) { return execFileSync(executable, args, { encoding: 'utf8', timeout: 60000, windowsHide: true, ...options }); }
function inspect(apk) { return JSON.parse(command(process.execPath, [path.join(__dirname, 'inspect-apk-certificate.cjs'), apk])); }
const normalize = value => value?.replace(/:/g, '').toLowerCase();
(async () => {
  assert.equal(config.android.package, 'com.zizhong.jinjie');
  assert.equal(path.dirname(path.resolve(previous)), tempRoot);
  assert.match(path.basename(previous), /^uncover-v\d+\.\d+\.\d+\.apk$/);
  const old = inspect(previous);
  stage = 'verify previous public release';
  const response = await fetch('https://api.github.com/repos/kyirejson/calisthenics-app/releases/latest', { headers: { 'User-Agent': 'Uncover-local-signing' }, signal: AbortSignal.timeout(30000) });
  assert.equal(response.ok, true);
  const latest = await response.json(), asset = latest.assets.find(item => item.name === path.basename(previous));
  assert.ok(asset && asset.digest === 'sha256:' + old.sha256 && asset.size === fs.statSync(previous).size);
  stage = 'read existing remote signer';
  const SessionManager = require(path.join(cliRoot, 'user/SessionManager')).default;
  const { createGraphqlClient } = require(path.join(cliRoot, 'commandUtils/context/contextUtils/createGraphqlClient'));
  const { getDefaultAndroidAppBuildCredentialsAsync } = require(path.join(cliRoot, 'credentials/android/api/GraphqlClient'));
  const session = new SessionManager({});
  const authentication = { accessToken: session.getAccessToken(), sessionSecret: session.getSessionSecret() };
  assert.ok(authentication.accessToken || authentication.sessionSecret);
  const client = createGraphqlClient(authentication);
  const credentials = await Promise.race([
    getDefaultAndroidAppBuildCredentialsAsync(client, { account: { name: config.owner }, projectName: config.slug, androidApplicationIdentifier: config.android.package }),
    new Promise((_, reject) => { const timeout = setTimeout(() => reject(Error('Credentials request timed out')), 45000); timeout.unref(); }),
  ]);
  const key = credentials?.androidKeystore;
  assert.ok(key && key.keystore && key.keystorePassword && key.keyAlias, 'Existing official credentials unavailable');
  assert.equal(normalize(key.sha256CertificateFingerprint), normalize(old.certificates[0].sha256));
  if (mode === 'verify-key-only') { console.log('Existing official EAS signer matches the hash-verified previous release; no credential mutation.'); return; }
  stage = 'validate unsigned output';
  assert.equal(path.resolve(unsigned), path.join(buildRoot, 'release-v' + config.version, 'android/app/build/outputs/apk/release/app-release-unsigned.apk'));
  assert.equal(path.resolve(target), path.join(tempRoot, 'uncover-v' + config.version + '.apk'));
  assert.ok(fs.existsSync(unsigned)); assert.equal(fs.existsSync(target), false, 'Refuse to overwrite an existing APK');
  const keyDirectory = fs.mkdtempSync(path.join(tempRoot, 'release-signing-'));
  const keyFile = path.join(keyDirectory, 'official.jks');
  try {
    stage = 'restrict temporary key access';
    const sid = command('whoami.exe', ['/user', '/fo', 'csv', '/nh']).match(/S-1-\d+(?:-\d+)+/)?.[0];
    assert.ok(sid);
    command('icacls.exe', [keyDirectory, '/inheritance:r', '/grant:r', sid + ':(OI)(CI)F']);
    fs.writeFileSync(keyFile, Buffer.from(key.keystore, 'base64'), { flag: 'wx', mode: 0o600 });
    stage = 'sign local production APK';
    const java = path.join(buildRoot, 'java17/jdk-17.0.20.1+1/bin/java.exe');
    const tools = fs.readdirSync(path.join(buildRoot, 'android-sdk/build-tools')).sort().at(-1);
    const signer = path.join(buildRoot, 'android-sdk/build-tools', tools, 'lib/apksigner.jar');
    command(java, ['-jar', signer, 'sign', '--ks', keyFile, '--ks-key-alias', key.keyAlias, '--ks-pass', 'env:UNCOVER_SIGN_STORE_PASSWORD', '--key-pass', 'env:UNCOVER_SIGN_KEY_PASSWORD', '--out', target, unsigned], { env: { ...process.env, UNCOVER_SIGN_STORE_PASSWORD: key.keystorePassword, UNCOVER_SIGN_KEY_PASSWORD: key.keyPassword || key.keystorePassword } });
    command(java, ['-jar', signer, 'verify', '--verbose', target]);
    const signed = inspect(target);
    assert.equal(signed.certificates[0].sha256, old.certificates[0].sha256);
    const sourceCommit = command('git', ['-C', path.join(__dirname, '..'), 'rev-parse', 'HEAD']).trim();
    const proof = { localBuild: true, sourceCommit, appVersion: config.version, versionCode: config.android.versionCode, sha256: signed.sha256, signer: signed.certificates[0].sha256, bytes: fs.statSync(target).size, previousRelease: latest.tag_name };
    fs.writeFileSync(target + '.verification.json', JSON.stringify(proof, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(proof));
  } finally {
    if (fs.existsSync(keyFile)) fs.unlinkSync(keyFile);
    fs.rmdirSync(keyDirectory);
  }
})().catch(error => {
  const detail = error.name === 'AssertionError' ? String(error.message).slice(0, 500) : String(error.code || error.name);
  console.error('Official local signing failed at: ' + stage + ' (' + detail + '). No credentials were printed or mutated; publication must stop.');
  process.exitCode = 1;
});
