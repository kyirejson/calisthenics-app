import { Asset } from 'expo-asset';
import { runVoiceClips, type RunVoiceStyle } from './voiceClips';
import manifest from '../../modules/uncover-running/android/src/main/assets/run-voices/manifest.json';

const assets = { female: require('../../modules/uncover-running/android/src/main/assets/run-voices/female.wav'), male: require('../../modules/uncover-running/android/src/main/assets/run-voices/male.wav') };
let context: AudioContext | null = null, generation = 0;
let cached: { style: RunVoiceStyle; buffer: AudioBuffer } | null = null;
const loading = new Map<RunVoiceStyle, Promise<AudioBuffer>>();
const sources = new Set<AudioBufferSourceNode>();
async function load(style: RunVoiceStyle) {
  if (cached?.style === style) return cached.buffer;
  const existing = loading.get(style); if (existing) return existing;
  const ownContext = context!;
  const operation = (async () => {
    const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 15000);
    try {
      const response = await fetch(Asset.fromModule(assets[style]).uri, { signal: abort.signal });
      if (!response.ok) throw Error('Voice asset unavailable');
      const buffer = await ownContext.decodeAudioData(await response.arrayBuffer());
      cached = { style, buffer }; return buffer;
    } finally { clearTimeout(timeout); loading.delete(style); }
  })();
  loading.set(style, operation); return operation;
}
/** Called on the actual Start tap, before the countdown loses browser activation. */
export function prepareWebRunVoice(style: RunVoiceStyle) {
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => undefined);
    void load(style).catch(() => undefined); // Actual utterance reports any failure.
  } catch { /* Unsupported browser audio never blocks the Start tap. */ }
}
export function webRunVoice(text: string, report: (issue: string) => void, style: RunVoiceStyle = 'female') {
  if (!context || context.state !== 'running') { report('浏览器未允许声音播放，请点按喇叭重新开启；跑步记录不受影响。'); return false; }
  let keys: string[];
  try { keys = runVoiceClips(text); } catch { report('语音内容无效，跑步记录不受影响。'); return false; }
  const ownContext = context;
  stopWebRunVoice(); const token = generation;
  void load(style).then(buffer => {
    if (token !== generation) return;
    const clips = manifest.voices[style].clips as Record<string, { start: number; length: number }>;
    let time = ownContext.currentTime + .025;
    for (const key of keys) {
      const clip = clips[key]; if (!clip) throw Error('Missing voice clip');
      const node = ownContext.createBufferSource(); node.buffer = buffer; node.connect(ownContext.destination); sources.add(node);
      node.onended = () => { sources.delete(node); node.disconnect(); };
      const seconds = clip.length / manifest.sampleRate;
      node.start(time, clip.start / manifest.sampleRate, seconds); time += seconds;
    }
  }).catch(() => { if (token === generation) { stopWebRunVoice(); report('内置语音播放失败，跑步记录不受影响。'); } });
  return true;
}
export function stopWebRunVoice() {
  generation++;
  for (const source of sources) { try { source.stop(); source.disconnect(); } catch { /* Already ended. */ } }
  sources.clear();
}
