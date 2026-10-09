/** A failed write cannot poison subsequent work. */
export function createWriteQueue(guard: () => void) {
  let pending = Promise.resolve();
  return {
    drain: () => pending,
    enqueue<T>(work: () => Promise<T>): Promise<T> {
      try {
        guard();
      } catch (error) {
        return Promise.reject(error);
      }
      const operation = pending.then(work);
      pending = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
  };
}
