/** Browser counterpart of the native gate: only continuous, reliable speed evidence. */
export class MotionGate {
  private stationarySince: number | null = null;
  private movingSince: number | null = null;
  private lastAt: number | null = null;
  reset() { this.stationarySince = this.movingSince = this.lastAt = null; }
  update(at: number, speed: number | null | undefined, accuracy: number, autoPaused: boolean): 'pause' | 'resume' | null {
    if (this.lastAt !== null && at <= this.lastAt) return null;
    if (this.lastAt !== null && at - this.lastAt > 4000) this.reset();
    this.lastAt = at;
    if (!Number.isFinite(speed) || speed! < 0 || speed! > 12 || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 20) {
      this.stationarySince = this.movingSince = null; return null;
    }
    if (!autoPaused) {
      this.movingSince = null;
      if (speed! <= .5) {
        this.stationarySince ??= at;
        if (at - this.stationarySince >= 8000) { this.reset(); return 'pause'; }
      } else this.stationarySince = null;
    } else {
      this.stationarySince = null;
      if (speed! >= 1.2) {
        this.movingSince ??= at;
        if (at - this.movingSince >= 3000) { this.reset(); return 'resume'; }
      } else this.movingSince = null;
    }
    return null;
  }
}
