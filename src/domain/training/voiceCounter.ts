export const DEFAULT_COUNT_INTERVAL = 5;
export function normalizeCountInterval(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.min(30, Math.round(value))) : DEFAULT_COUNT_INTERVAL;
}

/** A spoken guide, never evidence that a repetition was physically completed. */
export class VoiceCounter {
  private value = 0;
  private dueAt = 0;
  private suspended = false;
  private wait = 0;
  private intervalMs: number;
  constructor(interval: number, now: number) {
    this.intervalMs = normalizeCountInterval(interval) * 1000;
    this.dueAt = now;
  }
  setInterval(interval: number, now: number) {
    this.intervalMs = normalizeCountInterval(interval) * 1000;
    this.dueAt = now + this.intervalMs;
    this.wait = this.intervalMs;
  }
  synchronize(now: number) { this.dueAt = now + this.intervalMs; }
  pause(now: number) {
    if (this.suspended) return;
    this.wait = Math.max(0, this.dueAt - now);
    this.suspended = true;
  }
  resume(now: number) {
    if (!this.suspended) return;
    this.dueAt = now + this.wait;
    this.suspended = false;
  }
  tick(now: number, goal: number): number | null {
    if (this.suspended || !Number.isFinite(goal) || goal <= 0 || this.value >= Math.floor(goal) || now < this.dueAt) return null;
    // Never rapidly replay missed ticks or count unseen background intervals as repetitions.
    this.value += 1;
    this.dueAt = now + this.intervalMs;
    return this.value;
  }
}

/** Announce actual elapsed seconds, not an utterance counter. */
export function elapsedAnnouncement(elapsed: number, goal: number, interval: number, previous: number): number | null {
  if (!Number.isFinite(elapsed) || !Number.isFinite(goal) || goal <= 0) return null;
  const second = Math.min(Math.floor(goal), Math.max(0, Math.floor(elapsed)));
  if (!second || second <= previous) return null;
  const step = normalizeCountInterval(interval);
  return second === Math.floor(goal) || second - previous >= step ? second : null;
}
