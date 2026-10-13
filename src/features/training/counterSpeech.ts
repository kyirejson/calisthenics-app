import { createCounterSpeaker } from './counterSpeechQueue';

export function createTrainingSpeaker(onFailure: (message?: string) => void, onStarted?: () => void) {
  let speech: typeof import('expo-speech') | undefined;
  let ready: Promise<void> | undefined, voice: string | undefined;
  const prepare = () => ready ??= (async () => {
    try { speech ??= await import('expo-speech'); }
    catch { throw Error('当前安装包无法加载语音模块，请更新安装包后重试。'); }
    // Wait for TTS initialization before queuing speech; cancelled initialization must not speak later.
    const voices = await speech.getAvailableVoicesAsync();
    voice = (voices.find(item => /^zh[-_]CN$/i.test(item.language)) ?? voices.find(item => /^zh/i.test(item.language)))?.identifier;
    if (!voices.length) throw Error('系统没有可用的语音，请检查系统文字转语音服务后重试。');
  })().catch(error => { ready = undefined; throw error; });
  return createCounterSpeaker({
    prepare,
    stop: async () => { await speech?.stop(); },
    speak: (text, callbacks) => speech!.speak(text, { language: 'zh-CN', voice, rate: 1.1, ...callbacks,
      onError: error => callbacks.onError(Error(error.message && error.message !== 'undefined' ? error.message : '系统语音播放失败，请检查中文语音服务是否可用。')),
      onStopped: () => callbacks.onError(Error('语音播放被系统中断，请重新开启喇叭。')) }),
  }, onFailure, onStarted);
}
