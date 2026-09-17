/**
 * How serious each standing problem is — one set of rules for the alert
 * cards, the dashboard and the bell.
 *
 * The owner's levels (2026-09-16):
 *
 *   parcel stuck in the China warehouse   over 30 days critical · 15–30 high
 *   volumetric parcel not yet checked     ×3 or more critical · under ×3 high
 *   customer debt over their limit        critical
 *   order without a tracking number       over 7 days high
 *   unclaimed parcel                      notice
 *
 * Written once, here, so a card cannot paint a parcel red that the bell
 * calls a notice. Pure: no database, no React.
 */

type Words = { ku: string; en: string; ar: string; zh: string };

export type RiskLevel = "critical" | "high" | "notice";

/** Worst first — the order a list of risks is read in. */
export const RISK_LEVELS: readonly RiskLevel[] = ["critical", "high", "notice"];

export const RISK_LEVEL_LABEL: Record<RiskLevel, Words> = {
  critical: { ku: "زۆر مەترسیدار", en: "Critical", ar: "خطير جداً", zh: "严重" },
  high: { ku: "مەترسیدار", en: "High", ar: "خطير", zh: "较高" },
  notice: { ku: "ئاگاداری", en: "Notice", ar: "تنبيه", zh: "提醒" },
};

/** A parcel is expected to join a batch within this many days of arriving. */
export const STALE_IN_DEPOT_AFTER_DAYS = 15;

/** Past this many days on the shelf a waiting parcel is critical. */
export const STALE_IN_DEPOT_CRITICAL_DAYS = 30;

/** Billed at this multiple of the scale's weight or more, a parcel is critical. */
export const VOLUMETRIC_CRITICAL_RATIO = 3;

/** An order still without a tracking number after this many days is a risk. */
export const ORDER_NO_TRACKING_DAYS = 7;

/**
 * A customer whose debt has passed their own credit limit; no limit set counts
 * as zero. The bell, the dashboard's alert and the debtors list's filter all
 * ask this one question, so a number and the list it opens cannot disagree.
 */
export function isOverCreditLimit(balanceUsd: unknown, creditLimitUsd: unknown): boolean {
  const balance = Number(balanceUsd);
  if (!Number.isFinite(balance) || balance <= 0) return false;
  const limit = Number(creditLimitUsd);
  return balance > (Number.isFinite(limit) ? limit : 0);
}

/** Whole days an order has waited for its tracking number, from its order date. No date counts as none. */
export function daysWaitingForTracking(orderDate: Date | string | null | undefined, now: Date = new Date()): number {
  if (!orderDate) return 0;
  const at = new Date(orderDate).getTime();
  if (!Number.isFinite(at)) return 0;
  return Math.floor((now.getTime() - at) / 86_400_000);
}

/** The owner's 7 days — the tracking-alerts page's own "7+" bucket, which the bell counts and opens. */
export function isTrackingOverdue(daysWaiting: number): boolean {
  return daysWaiting >= ORDER_NO_TRACKING_DAYS;
}

/** How serious a parcel's wait in the China warehouse is. */
export function staleDepotLevel(daysInDepot: number): RiskLevel {
  return daysInDepot > STALE_IN_DEPOT_CRITICAL_DAYS ? "critical" : "high";
}

/** How serious a volumetric surcharge nobody has explained yet is. */
export function volumetricLevel(ratio: number): RiskLevel {
  return ratio >= VOLUMETRIC_CRITICAL_RATIO ? "critical" : "high";
}

/** Sort key: critical before high before notice. */
export function levelRank(level: RiskLevel): number {
  return RISK_LEVELS.indexOf(level);
}

/** The most serious of several, or null when there are none. */
export function worstLevel(levels: readonly RiskLevel[]): RiskLevel | null {
  let worst: RiskLevel | null = null;
  for (const level of levels) {
    if (worst === null || levelRank(level) < levelRank(worst)) worst = level;
  }
  return worst;
}
