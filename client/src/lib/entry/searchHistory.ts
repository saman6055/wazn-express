/**
 * The last few things somebody searched for, kept in this browser.
 *
 * Tracking numbers, customer codes and names are typed again and again in a
 * day; clicking into a search box offers the last eight without asking the
 * server anything. One storage key holds every box's list (`scope` names the
 * box), and sign-out removes it (lib/signOut.ts): a name searched at the
 * counter is not left behind for the next person at the same computer.
 */
export const SEARCH_HISTORY_KEY = "wazn.searchHistory";
export const SEARCH_HISTORY_LIMIT = 8;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStore(): KeyValueStore | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // Storage refused (private mode, blocked site data).
  }
}

function readAll(store: KeyValueStore | null): Record<string, string[]> {
  if (!store) return {};
  try {
    const parsed: unknown = JSON.parse(store.getItem(SEARCH_HISTORY_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const lists: Record<string, string[]> = {};
    for (const [scope, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(list)) {
        lists[scope] = list.filter((v): v is string => typeof v === "string").slice(0, SEARCH_HISTORY_LIMIT);
      }
    }
    return lists;
  } catch {
    return {}; // Damaged value: start again rather than fail the page.
  }
}

function writeAll(store: KeyValueStore | null, lists: Record<string, string[]>): void {
  try {
    store?.setItem(SEARCH_HISTORY_KEY, JSON.stringify(lists));
  } catch {
    // Storage full or refused: the list is simply not kept.
  }
}

export function readSearchHistory(scope: string, store: KeyValueStore | null = browserStore()): string[] {
  return readAll(store)[scope] ?? [];
}

/** Puts a search at the top of its box's list; the same term moves up instead of repeating. */
export function rememberSearch(scope: string, term: string, store: KeyValueStore | null = browserStore()): string[] {
  const clean = term.trim();
  const lists = readAll(store);
  if (!clean) return lists[scope] ?? [];
  const list = [clean, ...(lists[scope] ?? []).filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(
    0,
    SEARCH_HISTORY_LIMIT,
  );
  lists[scope] = list;
  writeAll(store, lists);
  return list;
}

export function forgetSearchHistory(scope: string, store: KeyValueStore | null = browserStore()): void {
  const lists = readAll(store);
  delete lists[scope];
  writeAll(store, lists);
}

/**
 * The earlier search that begins with what has been typed so far — the faint
 * suggestion under the box. From two characters, and never the text itself.
 */
export function suggestFromHistory(typed: string, history: readonly string[]): string | null {
  const start = typed.trim().toLowerCase();
  if (start.length < 2) return null;
  return history.find((h) => h.toLowerCase().startsWith(start) && h.toLowerCase() !== start) ?? null;
}
