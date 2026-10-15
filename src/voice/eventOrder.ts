import type { VoiceEvent } from './transport';

/** A retired native service cannot overwrite a newer service's UI snapshot. */
export function createVoiceEventOrder() {
  let epoch: string | undefined, sequence = -1;
  const retired = new Set<string>();
  return (event: VoiceEvent) => {
    if (event.serviceEpoch !== epoch) {
      if (!event.serviceEpoch && epoch || event.serviceEpoch && retired.has(event.serviceEpoch)) return false;
      if (epoch) retired.add(epoch);
      epoch = event.serviceEpoch; sequence = -1;
    }
    if (event.sequence <= sequence) return false;
    sequence = event.sequence; return true;
  };
}
