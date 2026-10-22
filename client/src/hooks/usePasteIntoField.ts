import { useEffect, useRef } from "react";
import { pastedIdKind } from "@shared/orderNumberPlatform";

type Target = {
  /** Put the value in the field's state, the same way typing would. */
  set: (value: string) => void;
  /** The field itself, to put the caret in and light up for a moment. */
  ref: React.RefObject<HTMLInputElement | null>;
};

/** Is the caret in something that takes text? Then Ctrl+V is its own. */
function typingSomewhere(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Ctrl+V with no field chosen puts the number where it belongs (owner,
 * 2026-10-22: «بەبێ تەحدید کردنی خانەکە، کۆنترۆل فی دابگرم، خۆی لە خانەی
 * ئۆردەر نەمبەر پەیستی بکات»). An order number goes to the order-number
 * field, a tracking to the tracking field (shared/orderNumberPlatform:
 * pastedIdKind); a screen that has only one of them passes only that one.
 * With the caret in any field, Ctrl+V is the ordinary paste.
 */
export function usePasteIntoField(targets: { order?: Target; tracking?: Target }, enabled = true) {
  // The latest targets, without re-binding the listener on every render.
  const latest = useRef(targets);
  latest.current = targets;

  useEffect(() => {
    if (!enabled) return;
    const onPaste = (e: ClipboardEvent) => {
      if (typingSomewhere()) return;
      const found = pastedIdKind(e.clipboardData?.getData("text"));
      if (!found) return;
      // Each number only to its own field: an order number never lands in
      // a tracking box (Quick Register has only the tracking).
      const { order, tracking } = latest.current;
      const target = found.kind === "order" ? order : tracking;
      if (!target) return;
      e.preventDefault();
      target.set(found.value);
      const el = target.ref.current;
      if (!el) return;
      el.focus();
      // An animation rather than a class: the form redraws the field's
      // classes as soon as the value lands, and a class would be gone.
      el.animate?.(
        [{ boxShadow: "0 0 0 4px rgba(16, 185, 129, 0.85)" }, { boxShadow: "0 0 0 4px rgba(16, 185, 129, 0)" }],
        { duration: 1200, easing: "ease-out" },
      );
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enabled]);
}
