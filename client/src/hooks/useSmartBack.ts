import { useCallback } from "react";
import { useLocation } from "wouter";
import { backStep, currentStepFrom } from "@/lib/historySteps";

/**
 * The portal's on-screen back arrow — the phone's Back button, drawn.
 *
 * One step back to the screen before, as it was left: the search with its
 * words and tab, the receipts tab where it was scrolled to. The owner's rule
 * (2026-09-19): an arrow never jumps to a fixed page.
 *
 * Only when the step behind is not the portal's — the first page of a visit,
 * a link opened from WhatsApp, the page after signing in — does it open the
 * fallback instead, in place of the page it is on, so the phone's Back from
 * there leaves rather than bouncing back. See lib/historySteps.
 *
 * `back(target)` is for a button that names where it goes ("back to all
 * posts"): the step is taken when that page is the one behind, and the page
 * is opened otherwise.
 */
export function useSmartBack(fallback = "/portal"): (target?: string) => void {
  const [, navigate] = useLocation();
  return useCallback(
    (target?: string) => {
      if (backStep(currentStepFrom(), target) === "back") window.history.back();
      else if (target) navigate(target);
      else navigate(fallback, { replace: true });
    },
    [navigate, fallback],
  );
}
