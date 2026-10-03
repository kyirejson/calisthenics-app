import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { createVoiceSession, type VoicePhase } from '../../nutrition/voiceSession';
import { releaseWakeMicrophone } from '../../agent/systemChannel';

export function useNutritionVoice(onText: (text: string) => void, onError: (text: string) => void) {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const alive = useRef(true);
  const callbacks = useRef({ onText, onError }); callbacks.current = { onText, onError };
  const session = useRef<ReturnType<typeof createVoiceSession> | null>(null);
  if (!session.current) session.current = createVoiceSession({
    load: async () => { await releaseWakeMicrophone(); return (await import('expo-speech-recognition')).ExpoSpeechRecognitionModule; },
    platform: Platform.OS,
    foreground: () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive'
      && (Platform.OS !== 'web' || !document.hidden),
    secure: () => Platform.OS !== 'web' || window.isSecureContext,
    onPhase: value => { if (alive.current) setPhase(value); },
    onText: text => { if (alive.current) callbacks.current.onText(text); },
    onError: text => { if (alive.current) callbacks.current.onError(text); },
  });
  useEffect(() => {
    alive.current = true;
    const changed = () => { if (AppState.currentState === 'background' || AppState.currentState === 'inactive' || (Platform.OS === 'web' && document.hidden)) session.current?.background(); };
    const sub = AppState.addEventListener('change', changed); if (Platform.OS === 'web') document.addEventListener('visibilitychange', changed);
    return () => { alive.current = false; session.current?.abort(); sub.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', changed); };
  }, []);
  return { phase, active: phase !== 'idle', start: session.current.start, stop: session.current.stop,
    cancel: session.current.cancel, abort: session.current.abort };
}
