import { useEffect, useSyncExternalStore } from "react";

/**
 * Amounts hidden while a customer can see the screen.
 *
 * When on, every figure marked `data-private` is blurred (index.css); hovering
 * or focusing one shows it. Ctrl+Shift+H switches it wherever
 * usePrivacyShortcut is mounted. Kept for this tab only (sessionStorage), so
 * it never starts hidden for the next person — and it hides nothing from the
 * page itself: what is blurred is still there.
 */
const KEY = "wazn.privacyMode";
const listeners = new Set<() => void>();

function startValue(): boolean {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let hidden = startValue();

function paint(): void {
  if (typeof document !== "undefined") document.documentElement.toggleAttribute("data-privacy", hidden);
}

export function setPrivacyMode(next: boolean): void {
  hidden = next;
  try {
    sessionStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // Storage refused: it still works for this page.
  }
  paint();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePrivacyMode() {
  const on = useSyncExternalStore(subscribe, () => hidden, () => false);
  useEffect(paint, []);
  return { on, toggle: () => setPrivacyMode(!hidden), set: setPrivacyMode };
}

/** Ctrl+Shift+H (⌘⇧H) switches privacy mode from anywhere on the page. */
export function usePrivacyShortcut(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setPrivacyMode(!hidden);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
