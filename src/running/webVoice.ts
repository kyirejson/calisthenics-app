/** A browser can announce only while its page executes, unlike the Android service. */
export function webRunVoice(text: string, report: (issue: string) => void) {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') { report('浏览器语音不可用，跑步记录不受影响。'); return false; }
  try {
    const voices = speechSynthesis.getVoices(), voice = voices.find(item => /^zh/i.test(item.lang));
    if (voices.length && !voice) { report('浏览器未提供中文语音，跑步记录不受影响。'); return false; }
    const message = new SpeechSynthesisUtterance(text); message.lang = 'zh-CN';
    if (voice) message.voice = voice;
    message.onerror = () => report('浏览器语音播报失败，跑步记录不受影响。');
    speechSynthesis.cancel(); speechSynthesis.speak(message); return true;
  } catch { report('浏览器语音播报失败，跑步记录不受影响。'); return false; }
}
export function stopWebRunVoice() { try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch { /* A speech failure must never prevent finishing the run. */ } }
