/** Native is the sole owner of these phases; JS renders snapshots and runs requested model work. */
export type VoicePhase = 'stopped' | 'starting' | 'wake' | 'listening' | 'assessing' | 'processing' | 'synthesizing' | 'buffering' | 'speaking' | 'blocked' | 'unavailable';
export type VoicePresentation = {
  phase: VoicePhase; input?: 'wake' | 'listening' | 'candidate' | 'hearing' | 'assessing' | 'blocked';
  output?: 'idle' | 'generating' | 'synthesizing' | 'playing' | 'buffering'; held?: boolean;
  requestId?: string; segmentId?: string; text?: string; spokenEnd?: number;
  speechStart?: number; speechEnd?: number; error?: string;
  inputSuppressed?: boolean; externalPlayback?: 'none' | 'navigation' | 'external_speech'; externalMetadataAvailable?: boolean;
};
export type VoiceEvent = VoicePresentation & {
  kind: 'status' | 'transcript' | 'interrupt' | 'speech' | 'playback_error' | 'decision_cancelled'; sequence: number;
  serviceEpoch?: string; sessionId?: string; decisionId?: string;
};

/** Output ownership is a protocol fact, independent of the label currently shown to the user. */
export function hasVoiceOutput(voice: VoicePresentation) {
  return voice.output !== undefined ? voice.output !== 'idle' : ['processing', 'synthesizing', 'buffering', 'speaking'].includes(voice.phase);
}
