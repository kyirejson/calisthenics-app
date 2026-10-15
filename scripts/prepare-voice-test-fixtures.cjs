// Public model-author examples, used only by Android instrumentation, never production assets.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const files = [
  ['speaker1_a_cn_16k.wav', '5f20ce0ddc378ca3239d3ce864b1142726a46a1221ae553912e4e142045df58b'],
  ['speaker1_b_cn_16k.wav', '20745dc08a4281894d146140b99b9ef7417ac681119b7f7202f553cdf1a85f65'],
  ['speaker2_a_cn_16k.wav', '8a6cffa452df32ef10503f7992f22ffcdd7f16c4e0273d13311bc5cdcb13abf4'],
];
async function main() {
  const directory = path.resolve(__dirname, '../modules/uncover-voice/android/src/androidTest/assets/voice-speaker-fixtures'); fs.mkdirSync(directory, { recursive: true });
  for (const [name, sha] of files) {
    const target = path.join(directory, name);
    const bytes = fs.existsSync(target) ? fs.readFileSync(target) : Buffer.from(await (await fetch('https://www.modelscope.cn/api/v1/models/iic/speech_campplus_sv_zh-cn_16k-common/repo?Revision=master&FilePath=examples/' + name, { signal: AbortSignal.timeout(30000) })).arrayBuffer());
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== sha) throw Error('Public speaker fixture digest mismatch: ' + name);
    if (!fs.existsSync(target)) fs.writeFileSync(target, bytes, { flag: 'wx' });
  }
  const syntheticFlag = process.argv.find(value => value.startsWith('--synthetic-dir='));
  if (syntheticFlag) {
    const source = syntheticFlag.slice('--synthetic-dir='.length);
    for (const name of ['owner-enroll-1', 'owner-enroll-2', 'owner-enroll-3', 'owner-wake-check', 'other-wake']) {
      const bytes = fs.readFileSync(path.join(source, name + '.wav'));
      if (bytes.subarray(0, 4).toString() !== 'RIFF') throw Error('Invalid synthetic WAV: ' + name);
      fs.writeFileSync(path.join(directory, name + '.wav'), bytes);
    }
  }
  console.log('Verified three public speaker recordings for instrumentation only.');
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { files };
