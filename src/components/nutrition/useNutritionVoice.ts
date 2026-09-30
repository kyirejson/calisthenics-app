import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { ExpoSpeechRecognitionModuleType } from 'expo-speech-recognition/build/ExpoSpeechRecognitionModule.types';

export function useNutritionVoice(onText: (text: string) => void, onError: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const module = useRef<ExpoSpeechRecognitionModuleType | null>(null), subscriptions = useRef<{ remove: () => void }[]>([]);
  const alive = useRef(true), ticket = useRef(0), starting = useRef(false), prefix = useRef('');
  const callbacks = useRef({ onText, onError }); callbacks.current = { onText, onError };
  const abort = () => { ticket.current++; starting.current = false; try { module.current?.abort(); } catch { /* Older binaries may lack the speech module. */ } subscriptions.current.forEach(s => s.remove()); subscriptions.current = []; if (alive.current) setListening(false); };
  useEffect(() => {
    alive.current = true;
    const changed = () => { if (AppState.currentState === 'background' || AppState.currentState === 'inactive' || (Platform.OS === 'web' && document.hidden)) abort(); };
    const sub = AppState.addEventListener('change', changed); if (Platform.OS === 'web') document.addEventListener('visibilitychange', changed);
    return () => { alive.current = false; abort(); sub.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', changed); };
  }, []);
  const start = async (existing: string) => {
    if (listening) { module.current?.stop(); return; }
    if (starting.current) return;
    starting.current = true; const own = ++ticket.current;
    const valid = () => alive.current && own === ticket.current;
    try {
      const { ExpoSpeechRecognitionModule: speech } = await import('expo-speech-recognition');
      if (!valid()) return; module.current = speech;
      if (!speech.isRecognitionAvailable()) throw new Error('设备未提供语音识别，请使用文字；安卓可检查系统语音服务。');
      if (Platform.OS === 'web' && !window.isSecureContext) throw new Error('语音输入需要 HTTPS 或 localhost。');
      if (Platform.OS !== 'web') {
        const existing = await speech.getPermissionsAsync(); if (!valid()) return;
        const permission = existing.granted ? existing : await speech.requestPermissionsAsync();
        if (!valid()) return;
        if (!permission.granted) throw new Error('未允许语音权限，请在系统设置开启或输入文字。');
      }
      subscriptions.current.forEach(s => s.remove()); subscriptions.current = []; prefix.current = existing.trim();
      subscriptions.current = [
        speech.addListener('start', () => { if (valid()) setListening(true); }),
        speech.addListener('end', () => { if (valid()) { setListening(false); starting.current = false; } }),
        speech.addListener('result', event => { if (!valid()) return; const transcript = event.results[0]?.transcript?.trim(); if (transcript) callbacks.current.onText((prefix.current ? prefix.current + '，' : '') + transcript); }),
        speech.addListener('error', event => { if (!valid()) return; setListening(false); starting.current = false; if (event.error !== 'aborted') callbacks.current.onError(event.error === 'not-allowed' ? '未允许麦克风或语音权限，请使用文字输入。' : event.error === 'no-speech' ? '没有听清，请再说一次。' : '语音识别未完成，请重试或使用文字。'); }),
      ];
      speech.start({ lang: 'zh-CN', interimResults: true, continuous: false, maxAlternatives: 1, recordingOptions: { persist: false } });
    } catch (reason) { if (valid()) { setListening(false); starting.current = false; callbacks.current.onError(reason instanceof Error && !/native module|Cannot find/iu.test(reason.message) ? reason.message : '当前安装包未包含语音模块，请安装重新构建的版本；仍可输入文字。'); } }
  };
  return { listening, start, abort };
}
