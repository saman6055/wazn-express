import { useEffect, useId, useRef } from "react";
import { isLayerEntry, withLayer } from "@/lib/historySteps";

/**
 * A dialog, drawer or photo that the phone's Back button closes.
 *
 * A customer thinks of anything that covers the page as a screen of its own,
 * and presses Back — the hardware button, the swipe — to leave it. Without
 * this, that press left the page under it instead. The owner's rule
 * (2026-09-16, 2026-09-19): Back closes the top layer and nothing more.
 *
 * Opening pushes one step onto the phone's history; Back takes it and the
 * layer closes. Closing it from the screen — the ×, a tap outside, a choice
 * made in it — takes the same step back, so the next Back goes where it
 * should. The search sheet and its details keep their own, richer version
 * of this (hooks/usePortalSearchView).
 *
 * `alreadyAStep`: the layer was opened by the address itself (a link that
 * opens one order, one receipt) — arriving was the step, and Back leaves the
 * page as it would have. Read each time the layer opens.
 */
export function useBackCloses(open: boolean, onClose: () => void, alreadyAStep = false): void {
  const id = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!open || alreadyAStep || typeof window === "undefined") return;
    // Forward onto a step that already has this layer open: it is that step.
    if (!isLayerEntry(window.history.state, id)) {
      window.history.pushState(withLayer(window.history.state, id), "");
    }
    let takenBack = false;
    const onPop = () => {
      if (isLayerEntry(window.history.state, id)) return;
      takenBack = true;
      if (openRef.current) onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Closed from the screen: take back the step it added. Not when the
      // page itself is leaving — then the step on top is the next page's.
      if (!takenBack && isLayerEntry(window.history.state, id)) window.history.back();
    };
  }, [open, alreadyAStep, id]);
}
