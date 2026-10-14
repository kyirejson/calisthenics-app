import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { AppRepository } from './repository';
import { appRepository } from './runtime';
import { shallowEqual } from './observable';
import type { StoreValue } from './contracts';

const Store = createContext<AppRepository | null>(null);
export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const repository = appRepository;
  useEffect(() => {
    void repository.load();
  }, [repository]);
  return <Store.Provider value={repository}>{children}</Store.Provider>;
}

/** A stable handle for tools: reads are fresh, not snapshots captured by a React render. */
export function useAppRepository() {
  const repository = useContext(Store);
  if (!repository) throw Error('Missing AppStoreProvider');
  return repository;
}
export function useAppStore<T>(select: (state: StoreValue) => T): T {
  const repository = useAppRepository();
  const selector = useRef(select);
  selector.current = select;
  const cached = useRef<{ state: StoreValue; selected: T; selector: typeof select } | null>(null);
  const read = useCallback(() => {
    const state = repository.getSnapshot(),
      previous = cached.current;
    if (previous?.state === state && previous.selector === selector.current)
      return previous.selected;
    const next = selector.current(state),
      selected = previous && shallowEqual(previous.selected, next) ? previous.selected : next;
    cached.current = { state, selected, selector: selector.current };
    return selected;
  }, [repository]);
  const subscribe = useCallback(
    (notify: () => void) => repository.subscribeSelection(() => read(), notify),
    [repository, read],
  );
  return useSyncExternalStore(subscribe, read, read);
}
