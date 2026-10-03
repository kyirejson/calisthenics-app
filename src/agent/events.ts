export type AgentEvent = { kind: 'training_saved' | 'intake_saved'; id: string; at: number };
const listeners = new Set<(event: AgentEvent) => void>();
export function subscribeAgentEvents(listener: (event: AgentEvent) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
/** Publish only after persistence. A UI observer cannot fail a committed write. */
export function publishAgentEvent(event: AgentEvent) {
  for (const listener of listeners) { try { listener(event); } catch { /* Isolated observer. */ } }
}
