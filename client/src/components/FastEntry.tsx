import { useEffect } from "react";

/**
 * App-wide data-entry accelerators — pure UX, no logic changes:
 *  1. Number inputs select their contents on focus (type over without clearing)
 *     and get a numeric-keypad hint (inputMode).
 *  2. Ctrl/Cmd+Enter submits the surrounding form from any field.
 *  3. Enter advances to the next field — but ONLY inside forms opted in with
 *     `data-fast` (the long order-entry forms), so it never interferes with
 *     search boxes, comboboxes, or QuickRegister's own Enter handling.
 * Comboboxes (cmdk / role=combobox), search inputs, textareas, checkboxes and
 * fields marked `data-no-fast` are always left untouched.
 */
export function FastEntry() {
  useEffect(() => {
    const isEntryInput = (el: EventTarget | null): el is HTMLInputElement => {
      if (!(el instanceof HTMLInputElement)) return false;
      const t = (el.type || "text").toLowerCase();
      if (["checkbox", "radio", "submit", "button", "reset", "file", "range", "color", "search"].includes(t)) return false;
      if (el.getAttribute("role") === "combobox") return false;
      if (el.closest("[cmdk-input],[role=listbox]")) return false;
      if (el.hasAttribute("data-no-fast")) return false;
      return true;
    };

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.type === "number" && !el.hasAttribute("data-no-fast")) {
        if (!el.inputMode) el.inputMode = "decimal";
        // Select on the next tick so a click's own selection doesn't override it.
        window.setTimeout(() => {
          try {
            el.select();
          } catch {
            /* ignore */
          }
        }, 0);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const el = e.target;

      // Ctrl/Cmd + Enter → submit the surrounding form from anywhere.
      if (e.ctrlKey || e.metaKey) {
        const form = el instanceof HTMLElement ? el.closest("form") : null;
        const submit = form?.querySelector<HTMLElement>('button[type="submit"],input[type="submit"]');
        if (submit) {
          e.preventDefault();
          submit.click();
        }
        return;
      }

      if (e.shiftKey || e.altKey) return;
      if (!isEntryInput(el)) return;

      // Enter-to-advance is opt-in per form (data-fast) to avoid surprises.
      const form = el.closest<HTMLFormElement>("form[data-fast]");
      if (!form) return;

      const fields = Array.from(form.querySelectorAll<HTMLElement>("input,select,textarea")).filter((f) => {
        const inp = f as HTMLInputElement;
        return !inp.disabled && inp.type !== "hidden" && f.offsetParent !== null;
      });
      const idx = fields.indexOf(el);
      if (idx === -1 || idx >= fields.length - 1) return; // last field → let the form submit naturally

      e.preventDefault();
      const next = fields[idx + 1];
      next.focus();
      if (next instanceof HTMLInputElement && next.type === "number") {
        try {
          next.select();
        } catch {
          /* ignore */
        }
      }
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return null;
}
