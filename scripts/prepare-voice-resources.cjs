// Pinned public native/model artifacts. Generated binaries stay out of source control.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), cache = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, '.voice-resource-cache');
const moduleRoot = path.join(root, 'modules/uncover-voice/android'), assets = path.join(moduleRoot, 'src/main/assets/black-voice');
const artifacts = [
  { name: 'sherpa-onnx-1.13.8.aar', sha256: '633c24321e06b1fe79feafa03ea16cbc0f8a286641e2da3559bac91bdb13bd96', url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-1.13.8.aar', destination: 'libs/sherpa-onnx-1.13.8.aar' },
  { name: 'kws-zh-en.tar.bz2', sha256: '68447f4fbc67e70eee3a93961f36e81e98f47aef73ce7e7ca00885c6cd3616a6', url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20.tar.bz2', directory: 'sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20', files: {
    'encoder-epoch-13-avg-2-chunk-8-left-64.int8.onnx': 'kws/encoder.onnx', 'decoder-epoch-13-avg-2-chunk-8-left-64.onnx': 'kws/decoder.onnx', 'joiner-epoch-13-avg-2-chunk-8-left-64.int8.onnx': 'kws/joiner.onnx', 'tokens.txt': 'kws/tokens.txt',
  } },
  { name: 'asr.tar.bz2', sha256: 'b3b309f7ce4a737195fcc6963ea19b0653a7d3401580af5ae0d3e284cbb71f0b', url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-small-ctc-zh-int8-2025-04-01.tar.bz2', directory: 'sherpa-onnx-streaming-zipformer-small-ctc-zh-int8-2025-04-01', files: { 'model.int8.onnx': 'asr/model.int8.onnx', 'tokens.txt': 'asr/tokens.txt' } },
  { name: 'silero_vad.onnx', sha256: '9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6', url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx', destination: 'src/main/assets/black-voice/vad/silero_vad.onnx' },
  { name: '3dspeaker_speech_campplus_sv_zh-cn_16k-common.onnx', sha256: 'f682b514c05d947ee3fa91cd6ec6c5c7543479a128373fa29b1faedccd21fd11', url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_campplus_sv_zh-cn_16k-common.onnx', destination: 'src/main/assets/black-voice/speaker/campplus.onnx' },
  { name: 'speexdsp-1.2.1.tar.gz', sha256: '8c777343e4a6399569c72abc38a95b24db56882c83dbdb6c6424a5f4aeb54d3d', url: 'https://downloads.xiph.org/releases/speex/speexdsp-1.2.1.tar.gz', directory: 'speexdsp-1.2.1', vendor: true },
  { name: 'webrtc-aec3-2cec2f5.tar.gz', sha256: '3bc3423e71b7280cf96d87b2e429444ed3fee364b94648ce9875ee95b8f485f8', url: 'https://codeload.github.com/Enaium/webrtc-aec3/tar.gz/2cec2f52e26646f93bd2d5498bbabf59cba18da9', directory: 'webrtc-aec3-2cec2f52e26646f93bd2d5498bbabf59cba18da9', aec: true },
];
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function main() {
  fs.mkdirSync(cache, { recursive: true });
  const manifest = { version: 1, artifacts, files: [], license: 'Apache-2.0 AND MIT AND BSD-3-Clause', name: 'BLACK' };
  for (const artifact of artifacts) {
    const source = path.join(cache, artifact.name);
    if (!fs.existsSync(source)) {
      const response = await fetch(artifact.url, { signal: AbortSignal.timeout(300000) });
      if (!response.ok) throw Error('Voice artifact download failed: ' + response.status);
      fs.writeFileSync(source, Buffer.from(await response.arrayBuffer()), { flag: 'wx' });
    }
    if (digest(source) !== artifact.sha256) throw Error('Voice artifact digest mismatch: ' + artifact.name);
    if (artifact.destination) {
      const target = path.join(moduleRoot, artifact.destination); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
      manifest.files.push({ path: artifact.destination, sha256: digest(target), bytes: fs.statSync(target).size });
    } else {
      const entries = execFileSync('tar', ['-tf', source], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/);
      if (entries.some(name => path.isAbsolute(name) || name.replace(/\\/g, '/').split('/').includes('..'))) throw Error('Unsafe upstream archive');
      execFileSync('tar', ['-xf', source, '-C', cache], { windowsHide: true });
      if (artifact.vendor) {
        const extracted = path.join(cache, artifact.directory), target = path.join(moduleRoot, 'native/vendor', artifact.directory);
        fs.mkdirSync(target, { recursive: true });
        for (const directory of ['include', 'libspeexdsp']) fs.cpSync(path.join(extracted, directory), path.join(target, directory), { recursive: true });
        fs.copyFileSync(path.join(extracted, 'COPYING'), path.join(assets, 'SPEEX-DSP-LICENSE.txt'));
      }
      if (artifact.aec) {
        const extracted = path.join(cache, artifact.directory), target = path.join(moduleRoot, 'native/vendor/webrtc-aec3');
        fs.mkdirSync(target, { recursive: true });
        fs.cpSync(path.join(extracted, 'src'), path.join(target, 'src'), { recursive: true });
        fs.copyFileSync(path.join(extracted, 'LICENSE'), path.join(assets, 'WEBRTC-AEC3-LICENSE.txt'));
      }
      for (const [from, to] of Object.entries(artifact.files || {})) {
        const target = path.join(assets, to); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(cache, artifact.directory, from), target);
        manifest.files.push({ path: 'src/main/assets/black-voice/' + to, sha256: digest(target), bytes: fs.statSync(target).size });
      }
    }
  }
  fs.writeFileSync(path.join(assets, 'resources.json'), JSON.stringify(manifest, null, 2));
  console.log('Verified BLACK resources:', manifest.files.length, 'files; wake/ASR/AEC processing stays local.');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { artifacts };
