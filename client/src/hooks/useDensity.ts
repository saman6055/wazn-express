import { useCallback, useEffect, useState } from "react";

const KEY = "wazn-density";

function readCompact(): boolean {
  try {
    return localStorage.getItem(KEY) === "compact";
  } catch {
    return false;
  }
}

/**
 * Compact mode: `data-density="compact"` on <html>, which index.css uses to
 * tighten every list at once. Saved for this browser.
 *
 * The owner (2026-09-17): the old toggle changed nothing anyone could see —
 * "remove it or make it really work". The CSS now takes real room out of every
 * table row and the page's own padding; this hook is the one switch for it.
 */
export function useDensity(): [boolean, (compact: boolean) => void] {
  const [compact, setCompactState] = useState<boolean>(readCompact);

  useEffect(() => {
    document.documentElement.dataset.density = compact ? "compact" : "comfortable";
  }, [compact]);

  const setCompact = useCallback((next: boolean) => {
    setCompactState(next);
    try {
      localStorage.setItem(KEY, next ? "compact" : "comfortable");
    } catch {
      /* private mode — still applies for this visit */
    }
  }, []);

  return [compact, setCompact];
}
