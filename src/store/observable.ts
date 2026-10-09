/** Immutable snapshots with selection-specific notifications. */
export function shallowEqual<T>(left: T, right: T): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        Object.is((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
    )
  );
}
export function createObservable<T extends object>(initial: T) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    patch(change: Partial<T>) {
      const next = { ...snapshot, ...change };
      if (shallowEqual(snapshot, next)) return;
      snapshot = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeSelection<S>(select: (state: T) => S, listener: () => void, equal = shallowEqual<S>) {
      let previous = select(snapshot);
      const notify = () => {
        const next = select(snapshot);
        if (!equal(previous, next)) {
          previous = next;
          listener();
        }
      };
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
  };
}
