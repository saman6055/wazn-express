import type { QueryClient } from "@tanstack/react-query";

/**
 * What one person's session leaves in this browser — and must not leave for
 * the next person on the same office computer or the same phone.
 *
 * Sign-out cleared only the "who am I" answer. Every other answer — customer
 * lists, balances, a statement — stayed in memory, and Back could show them
 * again; recent searches, recently viewed customers, the last customer used on
 * the order form and a half-typed order draft stayed in storage.
 *
 * Device preferences stay: theme, language, zoom, full screen, the install
 * prompt's memory.
 */
export const USER_DATA_KEYS = [
  "wazn-recent",
  "wazn-journey-recent",
  "wazn-last-commission-customer",
  "wazn_portal_recent_searches",
  "wazn.orderFormSwitchDraft",
  "manus-runtime-user-info",
  // Every search box's recent searches (lib/entry/searchHistory.ts).
  "wazn.searchHistory",
] as const;

/**
 * Keys named by a prefix, because the rest is computed: a scanner keeps its
 * half-finished session as `scan-session-<scanner>`, and one person's ten
 * scanned cartons must not greet the next person who signs in on that tab.
 */
export const USER_DATA_KEY_PREFIXES = ["scan-session-"] as const;

export function clearSignedInData(queryClient?: QueryClient): void {
  queryClient?.clear();
  for (const store of ["localStorage", "sessionStorage"] as const) {
    try {
      const s = window[store];
      for (const key of USER_DATA_KEYS) s.removeItem(key);
      for (let i = s.length - 1; i >= 0; i--) {
        const key = s.key(i);
        if (key && USER_DATA_KEY_PREFIXES.some((p) => key.startsWith(p))) s.removeItem(key);
      }
    } catch {
      // Storage refused (private mode): nothing was kept there either.
    }
  }
}
