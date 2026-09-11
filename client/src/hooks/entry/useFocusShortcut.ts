import { useEffect, type RefObject } from "react";

/**
 * Ctrl+/ (⌘/ on a Mac) puts the cursor in this box from anywhere on the page.
 *
 * The key is free: Ctrl+K is the command palette, "?" the shortcut list,
 * Ctrl+M and Ctrl+S belong to the scanner, Ctrl+B to the sidebar. A box that
 * is not on screen (another tab of the page) leaves the key alone.
 */
export function useFocusShortcut(ref: RefObject<HTMLInputElement | null>, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key !== "/") return;
      const box = ref.current;
      if (!box || box.offsetParent === null) return;
      e.preventDefault();
      box.focus();
      box.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ref, enabled]);
}
