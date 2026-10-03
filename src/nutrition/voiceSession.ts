import type { ExpoSpeechRecognitionModuleType } from 'expo-speech-recognition/build/ExpoSpeechRecognitionModule.types';

export type VoicePhase = 'idle' | 'starting' | 'listening' | 'stopping';
type Speech = Pick<ExpoSpeechRecognitionModuleType, 'start' | 'stop' | 'abort' | 'addListener' | 'isRecognitionAvailable' | 'getStateAsync' | 'getPermissionsAsync' | 'requestPermissionsAsync'>;
type Dependencies = {
  load: () => Promise<Speech>;
  platform: string;
  foreground: () => boolean;
  secure: () => boolean;
  onText: (text: string) => void;
  onError: (text: string) => void;
  onPhase: (phase: VoicePhase) => void;
};

const vocabulary = ['早餐', '午餐', '晚餐', '加餐', '鸡蛋', '牛肉', '吊龙', '韭黄', '米饭', '鸡胸肉', '燕麦', '乳清蛋白', '半斤', '克', '千卡', '推拉腿', '上肢', '下肢'];
const errors: Record<string, string> = {
  'not-allowed': '未允许麦克风或语音权限，请在系统设置开启，或使用键盘输入。',
  'service-not-allowed': '系统语音服务不可用，请检查手机语音服务，或使用输入法的语音按钮。',
  'language-not-supported': '系统语音服务不支持普通话，请检查语音语言设置，或使用输入法语音。',
  'network': '系统语音识别联网失败，已保留输入内容；请检查网络后重试。',
  'audio-capture': '麦克风不可用，可能被其他应用占用；请关闭其他录音后重试。',
  'busy': '系统语音服务仍在结束上一段录音，请稍后重试。',
  'interrupted': '语音输入被系统中断，已保留识别内容，可编辑后发送。',
  'no-speech': '没有听到清晰语音，请靠近麦克风再试一次。',
  'speech-timeout': '没有听到清晰语音，请靠近麦克风再试一次。',
};

// A bounded session owns native callbacks; stale events cannot overwrite text
// after cancellation, completion or unmount. React only renders its state.
export function createVoiceSession(d: Dependencies) {
  let phase: VoicePhase = 'idle', ticket = 0, speech: Speech | undefined;
  let subscriptions: { remove: () => void }[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let prefix = '', finalParts: string[] = [], heard = false;
  let permissionPending = false;
  const setPhase = (value: VoicePhase) => { phase = value; d.onPhase(value); };
  const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const disposeListeners = () => {
    for (const sub of subscriptions.splice(0)) { try { sub.remove(); } catch { /* Native bridge already disposed. */ } }
  };
  const finish = () => { ticket++; permissionPending = false; clearTimer(); disposeListeners(); setPhase('idle'); };
  const abort = () => {
    const current = speech, active = phase !== 'idle';
    finish();
    if (active) { try { current?.abort(); } catch { /* Keep text if the native module is unavailable. */ } }
  };
  const fail = (message: string) => { abort(); d.onError(message); };
  const watchdog = (ms: number, task: () => void) => {
    clearTimer(); const own = ticket;
    timer = setTimeout(() => { if (own === ticket) task(); }, ms);
  };
  const stop = () => {
    if (phase === 'starting') { abort(); return; }
    if (phase !== 'listening') return;
    setPhase('stopping');
    watchdog(5000, () => fail('语音服务未及时结束，已保留识别内容；请核对后发送。'));
    try { speech?.stop(); }
    catch { fail('结束语音输入失败，已保留输入内容，可编辑后发送。'); }
  };
  const start = async (existing: string) => {
    if (phase !== 'idle') return;
    const own = ++ticket;
    const valid = () => own === ticket;
    prefix = existing; finalParts = []; heard = false;
    setPhase('starting');
    watchdog(30000, () => fail('语音权限或服务响应超时，请检查系统设置后重试。'));
    try {
      speech = await d.load(); if (!valid()) return;
      if (d.platform === 'web' && !d.secure()) throw new Error('语音输入需要 HTTPS 或 localhost。');
      if (!speech.isRecognitionAvailable()) throw new Error(errors['service-not-allowed']);
      if (d.platform !== 'web') {
        const existingPermission = await speech.getPermissionsAsync(); if (!valid()) return;
        permissionPending = !existingPermission.granted;
        const permission = existingPermission.granted ? existingPermission : await speech.requestPermissionsAsync();
        if (!valid()) return;
        permissionPending = false;
        if (!permission.granted) throw new Error(errors['not-allowed']);
      }
      if (!d.foreground()) { abort(); return; }
      const nativeState = d.platform === 'web' ? 'inactive' : await speech.getStateAsync(); if (!valid()) return;
      if (nativeState !== 'inactive') throw new Error(errors.busy);
      const listen = () => {
        if (!valid() || phase === 'stopping') return;
        setPhase('listening'); watchdog(60000, stop);
      };
      subscriptions.push(speech.addListener('start', listen));
      subscriptions.push(speech.addListener('audiostart', listen));
      subscriptions.push(speech.addListener('end', () => {
        if (!valid()) return;
        const noSpeech = !heard; finish();
        if (noSpeech) d.onError(errors['no-speech']);
      }));
      subscriptions.push(speech.addListener('result', event => {
        if (!valid()) return;
        const text = event.results[0]?.transcript?.trim(); if (!text) return;
        heard = true;
        // iOS is cumulative. Android uses one non-continuous utterance here,
        // so repeated final hypotheses replace rather than append. Web alone
        // retains separate final segments from its continuous session.
        const cumulative = d.platform !== 'web';
        const parts = cumulative ? [text] : [...finalParts, text];
        d.onText([prefix, ...parts].filter(Boolean).join('，').slice(0, 1000));
        if (event.isFinal && !cumulative) finalParts.push(text);
      }));
      subscriptions.push(speech.addListener('nomatch', () => { if (valid()) fail('没有识别出内容，请重新说一次，或使用键盘输入。'); }));
      subscriptions.push(speech.addListener('error', event => {
        if (!valid()) return;
        if (event.error === 'aborted') { finish(); return; }
        // Some OEM services report ERROR_CLIENT when stopListening finishes.
        // Only salvage an explicit stop with a non-empty interim transcript.
        if (d.platform === 'android' && phase === 'stopping' && heard && event.code === 5) { finish(); return; }
        fail(errors[event.error] || '语音识别未完成，已保留输入内容；请重试或使用输入法语音。');
      }));
      watchdog(10000, () => fail('系统语音服务未开始收音，请重试或使用输入法语音。'));
      speech.start({
        lang: 'zh-CN', interimResults: true, maxAlternatives: 1,
        // Android continuous mode injects an audio stream that OEM services
        // may not support. Keep the service's native microphone path instead.
        continuous: d.platform !== 'android',
        contextualStrings: [...vocabulary], recordingOptions: { persist: false },
        ...(d.platform === 'android' ? { androidIntentOptions: {
          EXTRA_LANGUAGE_MODEL: 'free_form',
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 4000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 4000,
        } } : {}),
      });
    } catch (reason) {
      if (!valid()) return;
      fail(reason instanceof Error && !/native module|Cannot find/iu.test(reason.message)
        ? reason.message : '当前安装包的语音模块不可用，请更新 App；仍可使用键盘或输入法语音。');
    }
  };
  return { start, stop, cancel: () => { abort(); d.onText(prefix); }, abort,
    background: () => { if (!permissionPending) abort(); }, getPhase: () => phase };
}
