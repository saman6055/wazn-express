import { useCallback, useEffect, useMemo, useState, type FocusEvent, type KeyboardEvent } from "react";
import { createShield, toggleFilter } from "@/lib/entry/small";
import { evaluateSum } from "@/lib/entry/fieldMath";

/**
 * Small protections for data entry. Each one does nothing until a screen
 * chooses to use it.
 */

/**
 * One press, one save (lib/entry/small.ts createShield). Bind `busy` to the
 * save button's disabled, and send the save through `run`.
 */
export function useSubmitShield() {
  const shield = useMemo(() => createShield(), []);
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    <T>(work: () => Promise<T> | T) =>
      shield.run(async () => {
        setBusy(true);
        try {
          return await work();
        } finally {
          setBusy(false);
        }
      }),
    [shield],
  );
  return { busy, run };
}

/**
 * A half-filled form asks before the tab closes or reloads. The browser
 * writes the question in its own words (it no longer allows ours); what
 * matters is the pause. Only while `dirty` — a saved or empty form closes
 * without asking.
 */
export function useUnsavedChangesGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

/**
 * Ctrl+V with a screenshot of a waybill or a receipt hands the picture to
 * `onImage` — no saving to disk and choosing the file again. Only a picture
 * is taken; a paste of text goes on to the field as usual.
 */
export function useClipboardImage(onImage: (file: File) => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(
        (i) => i.kind === "file" && i.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (!file) return;
      e.preventDefault();
      onImage(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onImage, enabled]);
}

/**
 * Sums in a field: Enter or leaving the field turns "4.5 + 3.2" into 7.7
 * (lib/entry/fieldMath.ts). Needs a text box (inputMode="decimal"): a
 * type="number" box refuses the "+". A plain number, or anything that is not
 * a sum, is left exactly as typed for the form's own checks.
 */
export function useInlineMath(setValue: (next: string) => void) {
  const apply = useCallback(
    (raw: string) => {
      const value = evaluateSum(raw);
      if (value !== null) setValue(String(value));
    },
    [setValue],
  );
  return {
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") apply(e.currentTarget.value);
    },
    onBlur: (e: FocusEvent<HTMLInputElement>) => apply(e.currentTarget.value),
  };
}

/**
 * Click a customer or a status in a row to show only rows like it; click it
 * again to clear. Holds the chosen values; the table filters with
 * lib/entry/small.ts matchesFilters.
 */
export function useClickToFilter() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const toggle = useCallback((field: string, value: string) => setFilters((f) => toggleFilter(f, field, value)), []);
  const clear = useCallback(() => setFilters({}), []);
  return { filters, toggle, clear };
}
