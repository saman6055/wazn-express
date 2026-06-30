import { useCallback, useEffect, useState } from "react";

export type RecentItem = {
  path: string;
  label: string;
  ts: number;
};

const STORAGE_KEY = "wazn-recent";
const MAX_ITEMS = 8;

function readStore(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (it): it is RecentItem =>
        it &&
        typeof it.path === "string" &&
        typeof it.label === "string" &&
        typeof it.ts === "number"
    );
  } catch {
    return [];
  }
}

/**
 * localStorage-backed list of recently viewed locations (key "wazn-recent").
 * Pure client-side UI state — NOT business data. Capped at 8, deduped by path.
 * Syncs across tabs via the storage event.
 */
export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>(() => readStore());

  // Keep in sync if another tab updates the list.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(readStore());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const record = useCallback((path: string, label: string) => {
    if (!path || !label) return;
    setItems((prev) => {
      const next: RecentItem[] = [
        { path, label, ts: Date.now() },
        ...prev.filter((it) => it.path !== path),
      ].slice(0, MAX_ITEMS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota / serialization errors
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setItems([]);
  }, []);

  return { items, record, clear };
}

export default useRecentlyViewed;
