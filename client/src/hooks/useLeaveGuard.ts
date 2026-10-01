import { useEffect, useId, useRef } from "react";
import { useLocation } from "wouter";

/**
 * Leaving does not throw away what somebody has half filled in.
 *
 * The owner, 2026-09-30 and again on 2026-10-01: «دوگمەی گەڕانەوە … بنووسرێ
 * دڵنیایت دەتەوێ دەرچیت؟ کە ئۆکەی کرد ئینجا بڕوات. ئەگەر دەستی بەر دوگمەی
 * تریش کەوت لە بێ ئاگایی، دیسان بڵێت دڵنیایت دەتەوێ دەرچیت؟»
 *
 * Two ways off a screen, and both are guarded:
 *
 *  - **Back.** On a phone it is a swipe from the edge of the screen, pressed
 *    by accident more than any other control there is. While the form holds
 *    something, one extra step sits on the history: Back takes that step
 *    instead of the page, the question is asked, and the answer decides —
 *    leave for real, or put the step back and stay.
 *
 *  - **Any other way out.** The tab bar along the bottom, a link in the
 *    header, the back arrow drawn on the screen: all of them are links, and a
 *    thumb finds them by accident too. A click on one is held, the same
 *    question asked, and the move made only on a yes.
 *
 * Nothing is intercepted while the form is empty, because then leaving costs
 * nothing. A link that opens a new tab, a download, a modified click and
 * anything outside the app are left alone — none of them lose the page.
 *
 * A sibling of useBackCloses, which does the opposite job for a layer Back
 * should close. This one is for a page Back should hesitate over.
 */
export function useLeaveGuard(dirty: boolean, ask: () => Promise<boolean>): void {
  const id = useId();
  const [, navigate] = useLocation();
  const askRef = useRef(ask);
  askRef.current = ask;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!dirty || typeof window === "undefined") return;

    const marked = (state: unknown) =>
      Boolean(state && typeof state === "object" && (state as Record<string, unknown>).__leaveGuard === id);

    if (!marked(window.history.state)) {
      window.history.pushState({ ...(window.history.state ?? {}), __leaveGuard: id }, "");
    }

    /** Set while we are leaving for real, so the question is asked once. */
    let leaving = false;

    const onPop = () => {
      if (leaving) return;
      void askRef.current().then((leave) => {
        if (leave) {
          leaving = true;
          window.history.back();
        } else {
          window.history.pushState({ ...(window.history.state ?? {}), __leaveGuard: id }, "");
        }
      });
    };

    const onClick = (event: MouseEvent) => {
      if (leaving || event.defaultPrevented) return;
      // A middle click, or one with a modifier, opens elsewhere and leaves
      // this page where it is.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;

      const href = link.getAttribute("href") ?? "";
      // Only a move inside the app: an address elsewhere, a mailto, a tel or
      // an anchor on this page is not this screen being left behind.
      if (!href.startsWith("/")) return;
      if (href === window.location.pathname + window.location.search) return;

      event.preventDefault();
      event.stopPropagation();
      void askRef.current().then((leave) => {
        if (!leave) return;
        leaving = true;
        navigateRef.current(href);
      });
    };

    window.addEventListener("popstate", onPop);
    // Captured, so the question is asked before the router hears the click.
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick, true);
      // The form emptied — sent, or cleared — so the extra step has nothing
      // left to protect and must not sit there swallowing a Back.
      if (!leaving && marked(window.history.state)) window.history.back();
    };
  }, [dirty, id]);
}
