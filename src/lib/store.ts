import { useSyncExternalStore } from 'react';

/** 极简外部 store：getState / setState / subscribe，支持 localStorage 持久化 */
export type Store<T> = {
  getState: () => T;
  setState: (updater: (s: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T>(initial: T, storageKey?: string): Store<T> {
  let state: T = initial;

  if (storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw != null) {
        state = { ...(initial as object), ...(JSON.parse(raw) as object) } as T;
      }
    } catch {
      /* 损坏的缓存直接忽略 */
    }
  }

  const listeners = new Set<() => void>();

  const persist = () => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* 存储满或被禁用时静默失败 */
    }
  };

  return {
    getState: () => state,
    setState: (updater) => {
      state = updater(state);
      persist();
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useStore<T, S>(store: Store<T>, selector: (s: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
