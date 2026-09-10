/**
 * How fresh a portal query has to be.
 *
 * The app-wide React Query default is a two-minute staleTime with
 * refetch-on-focus switched off. For staff screens that is fine — the
 * person changing the data is the person looking at it. For a customer it
 * is the opposite: everything they look at is changed by somebody else, in
 * the office, while their tab sits open. A cashier records a payment and
 * the customer's phone kept showing the debt until they happened to
 * navigate away and back after two minutes.
 *
 * Two option objects, so a screen never invents a third:
 *
 *  - LIVE: anything the office edits during the day — balance, ledger,
 *    batch and parcel status, boxes, orders, claims, prohibited decisions,
 *    notifications. Refetched on a slow interval while the tab is visible,
 *    never in a background tab.
 *  - SETTINGS: admin configuration that changes rarely — price list,
 *    announcement. A minute is plenty.
 *
 * Coming back to the tab is handled once, centrally, by
 * hooks/usePortalRealtime (throttled), rather than by every query on its
 * own — two mechanisms firing on the same focus event would fetch twice.
 * The same hook invalidates everything on every live event; this interval
 * is the safety net for the office actions that emit no event at all
 * (payment recorded, batch status changed, box delivered).
 */
export const PORTAL_LIVE_QUERY = {
  staleTime: 30_000,
  refetchInterval: 90_000,
  refetchIntervalInBackground: false,
} as const;

export const PORTAL_SETTINGS_QUERY = {
  staleTime: 60_000,
} as const;
