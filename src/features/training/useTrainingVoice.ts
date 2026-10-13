import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { VoiceCounter, elapsedAnnouncement, normalizeCountInterval } from '../../domain/training/voiceCounter';
import { useAppStore } from '../../store/AppStore';
import { createTrainingSpeaker } from './counterSpeech';
import type { TargetUnit } from '../../domain/training/trainingPrescription';

type VoiceContext = {
  identity: string; unit: TargetUnit; goal: number; complete: boolean; blocked: boolean;
  timerKind: 'rest' | 'transition' | 'hold' | null; timerDuration: number; remaining: number; paused: boolean;
  holdTiming: { run: number; finished: boolean };
};
const now = () => performance.now();

export function useTrainingVoice(context: VoiceContext) {
  const { interval, updateSettings } = useAppStore(state => ({ interval: normalizeCountInterval(state.settings.voiceCountInterval), updateSettings: state.updateSettings }));
  const [enabled, setEnabled] = useState(false), [error, setError] = useState('');
  const [background, setBackground] = useState(AppState.currentState !== 'active');
  const alive = useRef(true), wanted = useRef(false), latest = useRef(context);
  latest.current = context;
  const counter = useRef<VoiceCounter | null>(null), identity = useRef(''), lastSecond = useRef(0);
  const holdRun = useRef(0), activeHold = useRef<number | null>(null);
  const speaker = useRef<ReturnType<typeof createTrainingSpeaker> | null>(null);
  if (!speaker.current) speaker.current = createTrainingSpeaker(message => {
    wanted.current = false;
    counter.current = null; lastSecond.current = 0; activeHold.current = null;
    if (alive.current) { setEnabled(false); setError(message || '报数播放失败，请检查媒体音量、系统语音服务或浏览器的声音权限。'); }
  }, () => { if (latest.current.unit !== 'seconds') counter.current?.synchronize(now()); });
  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener('change', state => {
      const hidden = state !== 'active';
      if (hidden) { counter.current?.pause(now()); void speaker.current?.stop(); }
      setBackground(hidden);
    });
    return () => { alive.current = false; wanted.current = false; subscription.remove(); void speaker.current?.stop(); };
  }, []);

  const unsupported = context.unit === 'meters';
  const blocked = background || context.blocked || context.complete || context.paused || unsupported
    || context.timerKind === 'rest' || context.timerKind === 'transition';
  const mode = context.unit === 'seconds' ? context.timerKind === 'hold' ? 'hold' : 'waiting' : 'reps';
  useEffect(() => {
    if (identity.current !== context.identity) { identity.current = context.identity; counter.current = null; lastSecond.current = 0; activeHold.current = null; }
    if (holdRun.current !== context.holdTiming.run) { holdRun.current = context.holdTiming.run; lastSecond.current = 0; activeHold.current = null; }
    if (!enabled || blocked) {
      counter.current?.pause(now()); void speaker.current?.stop(); return;
    }
    if (mode === 'waiting') {
      counter.current?.pause(now());
      if (context.holdTiming.finished && activeHold.current === holdRun.current) {
        // Natural completion only. An early stop must never announce seconds that did not elapse.
        const value = elapsedAnnouncement(context.timerDuration, context.timerDuration, interval, lastSecond.current);
        if (value !== null) { lastSecond.current = value; void speaker.current!.say(value); }
      } else void speaker.current?.stop();
      return;
    }
    if (mode === 'hold') activeHold.current = holdRun.current;
    if (!counter.current) counter.current = new VoiceCounter(interval, now());
    else counter.current.resume(now());
    const tick = () => {
      if (!wanted.current || !alive.current || speaker.current!.starting) return;
      const current = latest.current;
      // The timer's completion event delivers the final number after its card closes.
      if (mode === 'hold' && current.remaining <= 0) return;
      const value = mode === 'hold'
        ? elapsedAnnouncement(current.timerDuration - current.remaining, current.timerDuration, interval, lastSecond.current)
        : counter.current!.tick(now(), current.goal);
      if (value !== null) { if (mode === 'hold') lastSecond.current = value; void speaker.current!.say(value); }
    };
    tick();
    const timer = setInterval(tick, 100);
    return () => { clearInterval(timer); void speaker.current?.stop(); };
  }, [enabled, blocked, mode, context.identity, interval, context.holdTiming.run, context.holdTiming.finished]);
  useEffect(() => { counter.current?.setInterval(interval, now()); }, [interval]);

  const toggle = () => {
    setError('');
    if (!wanted.current && unsupported) { setError('距离动作不按次数报数，请使用实际距离记录。'); return; }
    wanted.current = !wanted.current;
    if (wanted.current) { counter.current = null; lastSecond.current = 0; activeHold.current = null; }
    setEnabled(wanted.current);
    if (!wanted.current) { void speaker.current?.stop(); counter.current?.pause(now()); }
  };
  // Reset the spoken guide before operations that leave/change a set; recording is a separate path.
  const reset = () => { wanted.current = false; setEnabled(false); counter.current = null; lastSecond.current = 0; activeHold.current = null; void speaker.current?.stop(); };
  const changeInterval = async (value: number) => {
    try { await updateSettings({ voiceCountInterval: normalizeCountInterval(value) }); setError(''); }
    catch { setError('报数间隔保存失败，仍使用原来的设置，请重试。'); }
  };
  return { enabled, interval, error, toggle, reset, changeInterval };
}
