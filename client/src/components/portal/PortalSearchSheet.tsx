import {
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { pickLang } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { cleanSearchPaste } from "@/lib/entry/cleanPaste";
import { isSearchSheetEntry, withSearchSheet } from "@/lib/portalSearchHistory";
import { usePortalSearchView } from "@/hooks/usePortalSearchView";
import { PortalSearchResultsSkeleton } from "@/components/portal/PortalListSkeleton";

/**
 * The search the centre button of the bottom bar opens.
 *
 * Two halves on purpose. This file is small and loads with the portal's
 * chrome, so a tap can open the sheet and put the cursor in the box inside
 * the same touch — which is the only way an iPhone agrees to raise its
 * keyboard. The answers (PortalUniversalSearch) are larger and load behind
 * it; by the time the customer has typed two characters they are there.
 */
const PortalUniversalSearch = lazy(() => import("@/components/portal/PortalUniversalSearch"));

/** The search page's own box, so the centre button can focus it instead of stacking a sheet over it. */
export const PORTAL_SEARCH_INPUT_ID = "portal-search-input";

/** Whether the current history entry is one with the search open over its page. */
const isMarked = () => typeof window !== "undefined" && isSearchSheetEntry(window.history.state);

export const PortalSearchField = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onChange: (value: string) => void;
    /** Enter: put the keyboard away and remember the search. */
    onSubmit?: () => void;
    id?: string;
    autoFocus?: boolean;
    /** On the page's dark header rather than the sheet's light one. */
    onDark?: boolean;
  }
>(function PortalSearchField({ value, onChange, onSubmit, id, autoFocus, onDark }, ref) {
  const { language } = useLanguage();
  const innerRef = useRef<HTMLInputElement | null>(null);

  const setRefs = (el: HTMLInputElement | null) => {
    innerRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const cleaned = cleanSearchPaste(e.clipboardData.getData("text"));
    if (cleaned === null) return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + cleaned + value.slice(end));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    innerRef.current?.blur();
    onSubmit?.();
  };

  const label = pickLang(language, {
    ku: "گەڕان: تراکینگ، ئۆردەر، سندوق یان ناوی کاڵا",
    en: "Search: tracking, order, box or product",
    ar: "بحث: رقم التتبع أو الطلب أو الصندوق أو المنتج",
    zh: "搜索：运单号、订单、箱号或商品",
  });

  return (
    <div className="relative min-w-0 flex-1">
      <Search
        className={cn(
          "pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2",
          onDark ? "text-slate-400" : "text-slate-400 dark:text-slate-500",
        )}
      />
      <input
        ref={setRefs}
        id={id}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        aria-label={label}
        placeholder={pickLang(language, {
          ku: "تراکینگ، ژمارەی ئۆردەر، سندوق، ناوی کاڵا…",
          en: "Tracking, order no., box, product…",
          ar: "رقم التتبع، الطلب، الصندوق، المنتج…",
          zh: "运单号、订单号、箱号、商品…",
        })}
        className={cn(
          "h-12 w-full rounded-2xl border ps-11 pe-11 text-base md:text-sm outline-none transition",
          "[&::-webkit-search-cancel-button]:appearance-none",
          onDark
            ? "border-transparent bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-400 dark:bg-slate-900 dark:text-slate-100"
            : "border-slate-200 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900",
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            innerRef.current?.focus();
          }}
          aria-label={pickLang(language, { ku: "پاککردنەوە", en: "Clear", ar: "مسح", zh: "清除" })}
          className="tap-44 absolute end-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});

function PortalSearchSheet({
  inputRef,
  onClosed,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onClosed: () => void;
}) {
  const { language } = useLanguage();
  const isRTL = language === "ku" || language === "ar";
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // The words, the tab and the open details, each step of them in the
  // phone's history — see hooks/usePortalSearchView. Leaving for an answer's
  // page closes the sheet; Back from that page opens it again as it was.
  const view = usePortalSearchView({ scrollRef, onLeave: onClosed });

  useEffect(() => {
    // Opening the search is one step in the phone's history, so Back closes
    // it and leaves the customer on the page they opened it from. A sheet
    // brought back by Back is already that step.
    if (!isMarked()) window.history.pushState(withSearchSheet(window.history.state), "");

    // The page under the sheet stays where it was.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  // Closing is the same step taken back; the bar's hook sees it and closes.
  const close = useCallback(() => {
    if (isMarked()) window.history.back();
    else onClosed();
  }, [onClosed]);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const title = pickLang(language, { ku: "گەڕان", en: "Search", ar: "بحث", zh: "搜索" });

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      dir={isRTL ? "rtl" : "ltr"}
      onKeyDown={(e) => {
        // A detail sheet open on top handles its own Escape; React still
        // bubbles that key up to here through the portal.
        if (e.key !== "Escape" || e.defaultPrevented) return;
        if (!e.currentTarget.contains(e.target as Node)) return;
        close();
      }}
      className="portal-theme fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950"
    >
      <div className="shrink-0 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)] dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-1.5 px-2 py-2">
          <button
            type="button"
            onClick={close}
            aria-label={pickLang(language, { ku: "داخستن", en: "Close", ar: "إغلاق", zh: "关闭" })}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <BackIcon className="h-5 w-5" />
          </button>
          <PortalSearchField ref={inputRef} value={view.query} onChange={view.setQuery} onSubmit={view.submit} />
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-2xl pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          <Suspense fallback={<PortalSearchResultsSkeleton />}>
            <PortalUniversalSearch view={view} />
          </Suspense>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The sheet and the function that opens it, for a bottom bar.
 *
 * `openSearch` has to run inside the tap's own handler: it renders the sheet
 * synchronously and focuses the box before returning, and a focus that comes
 * a frame later leaves an iPhone's keyboard down.
 */
export function usePortalSearchSheet() {
  // Open from the very first frame when Back lands on an entry that had the
  // search open — coming back from an order the search opened, say.
  const [open, setOpen] = useState(isMarked);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Back and Forward decide: the entry either has the search open or not.
  useEffect(() => {
    const onPop = () => setOpen(isMarked());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openSearch = useCallback(() => {
    // On the search page itself the box is already there.
    const pageBox = document.getElementById(PORTAL_SEARCH_INPUT_ID);
    if (pageBox instanceof HTMLInputElement) {
      pageBox.focus();
      pageBox.select();
      return;
    }
    flushSync(() => setOpen(true));
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const onClosed = useCallback(() => setOpen(false), []);

  return {
    searchOpen: open,
    openSearch,
    searchSheet: open ? <PortalSearchSheet inputRef={inputRef} onClosed={onClosed} /> : null,
  };
}
