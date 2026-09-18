/**
 * Where a click in the Portal Center goes (owner, 2026-09-18).
 *
 * Each figure at the top of the page opens its own tab, already filtered —
 * "pending tracking" opens the tracking tab showing only what is pending — and
 * each tab with work waiting says how much, in red. One place for both, and
 * for the /portal-center?tab=… links that open the page on a tab from
 * anywhere else in the system. Pure: no React, no database.
 */

export const PORTAL_CENTER_TABS = [
  "customers",
  "messages",
  "send",
  "prices",
  "tutorials",
  "activity",
  "declared",
  "claims",
  "prohibited",
  "ratings",
  "announcements",
  "features",
  "yuan",
] as const;

export type PortalCenterTab = (typeof PORTAL_CENTER_TABS)[number];

export const DEFAULT_PORTAL_CENTER_TAB: PortalCenterTab = "customers";

/** A tab, and the filter it opens with. */
export interface PortalCenterLink {
  tab: PortalCenterTab;
  /** The status filter of the tracking or ownership tab. */
  status?: string;
  /** The activity tab: only the last N days. */
  sinceDays?: number;
}

const STATUSES: Partial<Record<PortalCenterTab, readonly string[]>> = {
  declared: ["pending", "matched", "received", "cancelled"],
  claims: ["pending", "approved", "rejected"],
};

/** The activity tab's time windows, the same two the figures at the top count. */
export const ACTIVITY_WINDOWS = [1, 7] as const;

const isTab = (value: string | null): value is PortalCenterTab =>
  !!value && (PORTAL_CENTER_TABS as readonly string[]).includes(value);

/** Read /portal-center?tab=…&status=…&since=… — anything it does not know is left out. */
export function readPortalCenterLink(search: string): PortalCenterLink {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tabParam = params.get("tab");
  const tab = isTab(tabParam) ? tabParam : DEFAULT_PORTAL_CENTER_TAB;
  const link: PortalCenterLink = { tab };
  const status = params.get("status");
  if (status && STATUSES[tab]?.includes(status)) link.status = status;
  const since = Number(params.get("since"));
  if (tab === "activity" && (ACTIVITY_WINDOWS as readonly number[]).includes(since)) link.sinceDays = since;
  return link;
}

/** The link that opens the Portal Center on a tab, filtered. */
export function portalCenterHref(link: PortalCenterLink): string {
  const params = new URLSearchParams({ tab: link.tab });
  if (link.status) params.set("status", link.status);
  if (link.sinceDays) params.set("since", String(link.sinceDays));
  return `/portal-center?${params.toString()}`;
}

/** The figures at the top of the page. */
export type OverviewFigure =
  | "totalCustomers"
  | "activeToday"
  | "activeWeek"
  | "pendingDeclares"
  | "pendingClaims"
  | "messagesWeek";

/** Where each figure takes you: its own tab, filtered to what it counted. */
export const OVERVIEW_TARGET: Record<OverviewFigure, PortalCenterLink> = {
  totalCustomers: { tab: "customers" },
  activeToday: { tab: "activity", sinceDays: 1 },
  activeWeek: { tab: "activity", sinceDays: 7 },
  pendingDeclares: { tab: "declared", status: "pending" },
  pendingClaims: { tab: "claims", status: "pending" },
  messagesWeek: { tab: "messages" },
};

/** A rating low enough to call the customer about. */
export const LOW_RATING_MAX = 3;

export function isLowRating(rating: number | null | undefined): boolean {
  const r = Number(rating);
  return Number.isFinite(r) && r >= 1 && r <= LOW_RATING_MAX;
}

/** What waits on each tab — the red number on it. Zero is not shown. */
export function tabBadges(
  overview: {
    pendingDeclares?: number;
    pendingClaims?: number;
    unreadMessages?: number;
    prohibitedAwaiting?: number;
    lowRatingsWeek?: number;
  } | null | undefined,
  pendingYuan?: number | null,
): Partial<Record<PortalCenterTab, number>> {
  const counts: Partial<Record<PortalCenterTab, number>> = {
    declared: overview?.pendingDeclares ?? 0,
    claims: overview?.pendingClaims ?? 0,
    messages: overview?.unreadMessages ?? 0,
    prohibited: overview?.prohibitedAwaiting ?? 0,
    ratings: overview?.lowRatingsWeek ?? 0,
    yuan: pendingYuan ?? 0,
  };
  const shown: Partial<Record<PortalCenterTab, number>> = {};
  for (const [tab, count] of Object.entries(counts) as [PortalCenterTab, number][]) {
    if (Number(count) > 0) shown[tab] = Number(count);
  }
  return shown;
}
