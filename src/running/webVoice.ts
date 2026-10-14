import type { RunVoiceStyle } from './voiceClips';
// Metro selects webVoice.web.ts only for browsers. APKs use the native service,
// so the browser's WAV imports are not redundantly embedded as Expo assets.
export function prepareWebRunVoice(_style: RunVoiceStyle) {}
export function webRunVoice(_text: string, _report: (issue: string) => void, _style: RunVoiceStyle = 'female') { return false; }
export function stopWebRunVoice() {}
