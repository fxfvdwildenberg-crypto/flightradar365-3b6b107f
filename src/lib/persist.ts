import { useEffect, useState } from "react";

/**
 * State that survives closing and reopening the app.
 * Reads happen after mount so SSR and hydration stay in sync.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`atc365:${key}`);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore unreadable storage */
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(`atc365:${key}`, JSON.stringify(value));
    } catch {
      /* storage full or blocked */
    }
  }, [key, loaded, value]);

  return [value, setValue] as const;
}

/** Same, but for a Set persisted as an array. */
export function usePersistentSet<T extends string>(key: string, initial: T[]) {
  const [list, setList] = usePersistentState<T[]>(key, initial);
  const set = new Set(list);
  const setSet = (updater: (prev: Set<T>) => Set<T>) =>
    setList((prev) => Array.from(updater(new Set(prev))));
  return [set, setSet] as const;
}
