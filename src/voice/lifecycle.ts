import type { VoiceEvent } from './protocol';

/** Event-driven cancellation, shared by headless model work and read-only turn assessments. */
export function createVoiceCancellationBus() {
  type Subscription = { id: string; scope: 'turn' | 'decision'; cancel(): void };
  const subscriptions = new Set<Subscription>();
  return {
    subscribe(id: string, scope: Subscription['scope'], cancel: () => void) {
      const subscription = { id, scope, cancel }; subscriptions.add(subscription);
      return () => { subscriptions.delete(subscription); };
    },
    publish(event: VoiceEvent) {
      for (const subscription of [...subscriptions]) {
        if (event.phase === 'stopped' || event.phase === 'blocked' ||
          subscription.scope === 'turn' && event.kind === 'interrupt' && subscription.id === event.requestId ||
          subscription.scope === 'decision' && event.kind === 'decision_cancelled' && subscription.id === event.decisionId) {
          subscriptions.delete(subscription); subscription.cancel();
        }
      }
    },
  };
}
