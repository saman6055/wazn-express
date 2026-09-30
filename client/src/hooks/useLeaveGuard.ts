import { useEffect, useId, useRef } from "react";

/**
 * Back does not throw away what somebody has half filled in.
 *
 * The owner, 2026-09-30, of the portal's tracking screen on a phone: the Back
 * button — «دوگمەی گەڕانەوە» — should not simply leave, and after the press
 * it should ask «دڵنیایت دەتەوێ دەرچیت؟», and only then go.
 *
 * On a phone Back is a swipe from the edge of the screen. It is pressed by
 * accident more than any other control there is, and on this screen the cost
 * of that is a tracking number typed off a courier's slip, a photograph taken
 * of the parcel, and a note — gone with no way to get them back.
 *
 * So while the form holds anything, one extra step sits on the history. Back
 * takes that step instead of the page, the question is asked, and the answer
 * decides: leave for real, or put the step back and stay. Nothing is
 * intercepted while the form is empty, because then Back costs nothing.
 *
 * A sibling of useBackCloses, which does the same for a layer that Back
 * should close. This one is for a page that Back should hesitate over.
 */
export function useLeaveGuard(dirty: boolean, ask: () => Promise<boolean>): void {
  const id = useId();
  const askRef = useRef(ask);
  askRef.current = ask;

  useEffect(() => {
    if (!dirty || typeof window === "undefined") return;

    const marked = (state: unknown) =>
      Boolean(state && typeof state === "object" && (state as Record<string, unknown>).__leaveGuard === id);

    if (!marked(window.history.state)) {
      window.history.pushState({ ...(window.history.state ?? {}), __leaveGuard: id }, "");
    }

    /** Set while we are going back for real, so the answer is asked once. */
    let leaving = false;

    const onPop = () => {
      if (leaving) return;
      // The step we added has been taken. Ask before letting the page go.
      void askRef.current().then((leave) => {
        if (leave) {
          leaving = true;
          window.history.back();
        } else {
          window.history.pushState({ ...(window.history.state ?? {}), __leaveGuard: id }, "");
        }
      });
    };

    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // The form emptied — it was sent, or cleared — so the extra step has
      // nothing left to protect and must not sit there swallowing a Back.
      if (!leaving && marked(window.history.state)) window.history.back();
    };
  }, [dirty, id]);
}
