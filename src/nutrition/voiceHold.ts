/** Finger lifetime is independent of async permission/module startup. */
export function createVoiceHold(d: { start: () => void; stop: () => void; cancel: () => void; change: (held: boolean, cancelling: boolean) => void }) {
  let held = false, started = false, cancelling = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const end = (interrupted = false) => {
    if (!held) return;
    clear(); const discard = interrupted || cancelling, wasStarted = started;
    held = false; started = false; cancelling = false; d.change(false, false);
    if (wasStarted) { if (discard) d.cancel(); else d.stop(); }
  };
  return {
    begin: () => { if (held) return; held = true; started = false; cancelling = false; d.change(true, false);
      timer = setTimeout(() => { timer = undefined; if (held) { started = true; d.start(); } }, 180); },
    move: (dy: number) => { if (!held) return; cancelling = dy < -48; d.change(true, cancelling); },
    release: () => end(), interrupt: () => end(true), dispose: () => { end(true); clear(); },
  };
}
