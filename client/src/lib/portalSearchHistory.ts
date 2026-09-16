/**
 * The search's steps in the phone's history.
 *
 * The phone's Back button walks the browser's history and nothing else. For
 * Back to take exactly one step — from a parcel's details to the answers,
 * from an order the search opened back to the answers, from the answers to
 * the page the search was opened on — every step has to be an entry in that
 * history, and every entry has to remember what was on screen: the words
 * typed, the tab chosen, the answer opened, how far the list was scrolled.
 *
 * The owner's report (2026-09-16): opening a tracking's details and pressing
 * Back went to the home page, not back to the search.
 *
 * These read and write that memory on an entry's state and leave everything
 * else the entry carries alone. Pure, so the rules are tested without a
 * browser; the hook that uses them is hooks/usePortalSearchView.
 */
import type { SearchTab } from "@/lib/portalSearch";

/** This entry shows the search sheet open over its page. */
export const SEARCH_SHEET_MARK = "portalSearchSheet";

/** What the search showed in this entry. */
export const SEARCH_VIEW_KEY = "portalSearchView";

export interface SearchView {
  q: string;
  tab: SearchTab | null;
  /** The answer whose details were open, by its key ("parcel:12"). */
  detail: string | null;
  /** How far down the answers were scrolled, in pixels. */
  scroll: number;
}

export const EMPTY_SEARCH_VIEW: SearchView = { q: "", tab: null, detail: null, scroll: 0 };

const TABS: ReadonlySet<string> = new Set<SearchTab>(["arrived", "onTheWay", "registered"]);

const asRecord = (state: unknown): Record<string, unknown> =>
  state && typeof state === "object" && !Array.isArray(state) ? (state as Record<string, unknown>) : {};

/** Does this entry have the search sheet open? */
export function isSearchSheetEntry(state: unknown): boolean {
  return asRecord(state)[SEARCH_SHEET_MARK] === true;
}

/** The state for a fresh step that opens the sheet over the page. */
export function withSearchSheet(state: unknown, view: SearchView = EMPTY_SEARCH_VIEW): Record<string, unknown> {
  return withSearchView({ ...asRecord(state), [SEARCH_SHEET_MARK]: true }, view);
}

/** What this entry remembers of the search, or null when it remembers none. */
export function readSearchView(state: unknown): SearchView | null {
  const raw = asRecord(state)[SEARCH_VIEW_KEY];
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  return {
    q: typeof v.q === "string" ? v.q : "",
    tab: typeof v.tab === "string" && TABS.has(v.tab) ? (v.tab as SearchTab) : null,
    detail: typeof v.detail === "string" && v.detail ? v.detail : null,
    scroll: typeof v.scroll === "number" && Number.isFinite(v.scroll) && v.scroll > 0 ? Math.round(v.scroll) : 0,
  };
}

/** The same state, remembering this view of the search. */
export function withSearchView(state: unknown, view: SearchView): Record<string, unknown> {
  return {
    ...asRecord(state),
    [SEARCH_VIEW_KEY]: { q: view.q, tab: view.tab, detail: view.detail, scroll: Math.max(0, Math.round(view.scroll)) },
  };
}
