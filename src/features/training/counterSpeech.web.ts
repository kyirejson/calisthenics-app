import { createCounterSpeaker } from './counterSpeechQueue';

export function createTrainingSpeaker(onFailure: (message?: string) => void, onStarted?: () => void) {
  return createCounterSpeaker({
    stop: () => { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); },
    speak: (text, callbacks) => {
      if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') throw Error('浏览器不支持语音。');
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN'; utterance.rate = 1.1;
      utterance.voice = speechSynthesis.getVoices().find(voice => /^zh[-_]CN$/i.test(voice.lang) && voice.localService)
        ?? speechSynthesis.getVoices().find(voice => /^zh/i.test(voice.lang)) ?? null;
      utterance.onstart = callbacks.onStart;
      utterance.onerror = event => callbacks.onError(Error(`浏览器语音播放失败（${event.error}），请检查声音权限和系统语音。`));
      speechSynthesis.speak(utterance);
    },
  }, onFailure, onStarted);
}
