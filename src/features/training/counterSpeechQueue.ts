export type SpeechPort = {
  speak(text: string, callbacks: { onStart: () => void; onError: (error?: unknown) => void }): void;
  prepare?(): Promise<void>;
  stop(): void | Promise<void>;
};

/** Replace stale utterances rather than enqueue a growing speech backlog. */
export function createCounterSpeaker(port: SpeechPort, onFailure: (message?: string) => void, onStarted?: () => void) {
  let generation = 0, watchdog: ReturnType<typeof setTimeout> | undefined;
  let starting = false;
  const clearWatchdog = () => { if (watchdog) clearTimeout(watchdog); watchdog = undefined; };
  const stop = async () => {
    generation += 1;
    starting = false;
    clearWatchdog();
    try { await port.stop(); } catch { /* Closing the screen must remain safe even if speech is unavailable. */ }
  };
  const say = async (number: number) => {
    const token = ++generation;
    starting = true;
    clearWatchdog();
    watchdog = setTimeout(() => { if (generation === token) { void stop(); onFailure('系统语音未开始播放，请检查系统语音服务后重试。'); } }, 8000);
    try {
      await port.prepare?.();
      if (generation !== token) return;
      await port.stop();
      if (generation !== token) return;
      port.speak(String(number), {
        onStart: () => { if (generation === token) { clearWatchdog(); starting = false; onStarted?.(); } },
        onError: error => { if (generation === token) { void stop(); onFailure(error instanceof Error ? error.message : undefined); } },
      });
    } catch (error) { if (generation === token) { void stop(); onFailure(error instanceof Error ? error.message : undefined); } }
  };
  return { say, stop, get starting() { return starting; } };
}
