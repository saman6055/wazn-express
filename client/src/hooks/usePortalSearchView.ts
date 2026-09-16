import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useLocation } from "wouter";
import type { SearchTab } from "@/lib/portalSearch";
import { readSearchView, withSearchView, type SearchView } from "@/lib/portalSearchHistory";

/**
 * What the search shows, kept in step with the phone's history.
 *
 * Every change a customer would expect Back to undo is a history entry:
 * opening an answer's details, and leaving for an answer's own page. Before
 * either, the current entry is told what is on screen, so Back returns to it
 * exactly — the words, the tab, the details that were open, the scroll.
 * Typing and choosing a tab are not steps: Back from the answers leaves the
 * search, as the owner expects.
 *
 * Shared by the sheet the bottom bar opens and the /portal/search page. The
 * rules for reading and writing an entry are in lib/portalSearchHistory.
 */
export interface PortalSearchView {
  query: string;
  setQuery: (query: string) => void;
  tab: SearchTab | null;
  setTab: (tab: SearchTab | null) => void;
  /** The answer whose details are open, by its key. */
  detail: string | null;
  openDetail: (key: string) => void;
  closeDetail: () => void;
  /** Go to another screen; Back from it returns to exactly this. */
  leave: (href: string) => void;
  /** Bumped when the customer presses Enter: the search is remembered. */
  submitted: number;
  submit: () => void;
}

export function usePortalSearchView(options: {
  /** The answers' own scrolling box — the sheet's. The window when absent. */
  scrollRef?: RefObject<HTMLElement | null>;
  /** The words to start with when the entry remembers none — the page's ?q=. */
  initialQuery?: string;
  /** Keep ?q= in this address while typing — the search page. */
  urlPath?: string;
  /** Before leaving for another screen — the sheet closes itself. */
  onLeave?: () => void;
} = {}): PortalSearchView {
  const [, navigate] = useLocation();
  // Read once: what this entry remembered when the search appeared on it.
  const [restored] = useState<SearchView | null>(() =>
    typeof window === "undefined" ? null : readSearchView(window.history.state),
  );
  const [query, setQuery] = useState(restored?.q ?? options.initialQuery ?? "");
  const [tab, setTab] = useState<SearchTab | null>(restored?.tab ?? null);
  const [detail, setDetail] = useState<string | null>(restored?.detail ?? null);
  const [submitted, setSubmitted] = useState(0);

  const live = useRef({ query, tab, detail });
  live.current = { query, tab, detail };
  const opts = useRef(options);
  opts.current = options;

  const scrolled = useCallback((): number => {
    const box = opts.current.scrollRef?.current;
    return box ? box.scrollTop : window.scrollY;
  }, []);

  /** Tell the current entry what is on screen. */
  const remember = useCallback(
    (patch: Partial<SearchView> = {}) => {
      const view: SearchView = {
        q: live.current.query,
        tab: live.current.tab,
        detail: live.current.detail,
        scroll: scrolled(),
        ...patch,
      };
      const path = opts.current.urlPath;
      window.history.replaceState(
        withSearchView(window.history.state, view),
        "",
        path ? searchAddress(path, view.q) : undefined,
      );
    },
    [scrolled],
  );

  // Back and Forward between this search's own entries show what each one
  // remembers. An entry without a memory is another screen's; closing the
  // sheet on it is the sheet's own business.
  useEffect(() => {
    const onPop = () => {
      const view = readSearchView(window.history.state);
      if (!view) return;
      setQuery(view.q);
      setTab(view.tab);
      setDetail(view.detail);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Back onto the search from another screen: the list returns to where it
  // was, once there is enough of it drawn to scroll that far.
  // A timer rather than animation frames: a view that is not painting — a
  // backgrounded app, a hidden pane — runs no frames, and the list would stay
  // at the top.
  useEffect(() => {
    const target = restored?.scroll ?? 0;
    if (target <= 0) return;
    let timer = 0;
    let tries = 0;
    const attempt = () => {
      const box = opts.current.scrollRef?.current;
      const room = box
        ? box.scrollHeight - box.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      if (room >= target || tries++ >= 40) {
        if (box) box.scrollTop = target;
        else window.scrollTo(0, target);
        return;
      }
      timer = window.setTimeout(attempt, 50);
    };
    timer = window.setTimeout(attempt, 0);
    return () => window.clearTimeout(timer);
  }, [restored]);

  const openDetail = useCallback(
    (key: string) => {
      remember({ detail: null });
      window.history.pushState(
        withSearchView(window.history.state, {
          q: live.current.query,
          tab: live.current.tab,
          detail: key,
          scroll: scrolled(),
        }),
        "",
      );
      setDetail(key);
    },
    [remember, scrolled],
  );

  const closeDetail = useCallback(() => {
    // The details are their own step: take it back, and the entry below —
    // the answers — shows itself again.
    if (readSearchView(window.history.state)?.detail) window.history.back();
    else setDetail(null);
  }, []);

  const leave = useCallback(
    (href: string) => {
      // A new step on top of this one — never replacing it — so Back from the
      // screen it opens comes back here.
      remember();
      opts.current.onLeave?.();
      navigate(href);
    },
    [navigate, remember],
  );

  const submit = useCallback(() => setSubmitted((n) => n + 1), []);

  // The search page keeps ?q= in its address while typing, so a reload or a
  // shared link shows the same answers.
  const urlPath = options.urlPath;
  useEffect(() => {
    if (!urlPath) return;
    const timer = window.setTimeout(() => {
      const next = searchAddress(urlPath, query);
      if (next !== `${window.location.pathname}${window.location.search}`) {
        window.history.replaceState(window.history.state, "", next);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query, urlPath]);

  return { query, setQuery, tab, setTab, detail, openDetail, closeDetail, leave, submitted, submit };
}

function searchAddress(path: string, query: string): string {
  const q = query.trim();
  return q ? `${path}?q=${encodeURIComponent(q)}` : path;
}
