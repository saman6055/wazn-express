/**
 * The bell: today's risks, worst first, and when it should flash.
 *
 * The owner's word (2026-09-16): a notification bell for the whole system,
 * its risks ranked by how serious they are, there every day, flashing.
 * Settled with him:
 *
 *  - Each person sees only the risks of the pages they may open — the
 *    warehouse its parcels, the accountant the debts; an admin everything.
 *  - It flashes while there is a critical or high risk the person has not
 *    looked at today. Opening it stops the flashing; a new risk, or one that
 *    has grown or become more serious, starts it again; and the next day it
 *    flashes again for anything still unresolved.
 *
 * Pure: the server builds the items with it, the bell describes and flashes
 * with it, and the tests read it without either.
 */
import { levelRank, staleDepotLevel, volumetricLevel, type RiskLevel } from "./riskRules";
import { PATH_TO_MODULE } from "./permissions";
import { canSeeAllAccounts, isAllAccountsPath } from "./financeAccess";

type Words = { ku: string; en: string; ar: string; zh: string };

export type RiskId = "stale-depot" | "volumetric" | "debt-over-limit" | "orders-no-tracking" | "unclaimed";

export interface RiskItem {
  id: RiskId;
  level: RiskLevel;
  count: number;
  /** Stuck in the China warehouse: the longest wait, in days. */
  oldestDays?: number;
  /** Volumetric: the kilograms billed beyond the scale, all parcels together. */
  extraKg?: number;
  /** How many of them are critical on their own. */
  criticalCount?: number;
}

/** The facts the server gathers — counted with the same queries as the cards and the dashboard. */
export interface RiskFacts {
  staleDepotDays: readonly number[];
  volumetric: ReadonlyArray<{ ratio: number; extraKg: number }>;
  debtOverLimit: number;
  /** Orders without a tracking number for longer than ORDER_NO_TRACKING_DAYS. */
  ordersWithoutTracking: number;
  unclaimed: number;
}

/** Where each risk's list is. */
export const RISK_PATH: Record<RiskId, string> = {
  "stale-depot": "/packages/registrations?alert=stale",
  volumetric: "/packages/registrations?alert=volumetric",
  "debt-over-limit": "/finance/debtors",
  "orders-no-tracking": "/unified-orders",
  unclaimed: "/packages/unclaimed",
};

/** The page whose permission decides who is told. */
export const RISK_GATE: Record<RiskId, string> = {
  "stale-depot": "/packages/registrations",
  volumetric: "/packages/registrations",
  "debt-over-limit": "/finance/debtors",
  "orders-no-tracking": "/unified-orders",
  unclaimed: "/packages/unclaimed",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Today's risks, by the owner's levels, worst first. A risk with nothing in it is not a risk. */
export function buildRiskItems(facts: RiskFacts): RiskItem[] {
  const items: RiskItem[] = [];

  if (facts.staleDepotDays.length > 0) {
    const critical = facts.staleDepotDays.filter((d) => staleDepotLevel(d) === "critical").length;
    items.push({
      id: "stale-depot",
      level: critical > 0 ? "critical" : "high",
      count: facts.staleDepotDays.length,
      oldestDays: Math.max(...facts.staleDepotDays),
      criticalCount: critical,
    });
  }

  if (facts.volumetric.length > 0) {
    const critical = facts.volumetric.filter((v) => volumetricLevel(v.ratio) === "critical").length;
    items.push({
      id: "volumetric",
      level: critical > 0 ? "critical" : "high",
      count: facts.volumetric.length,
      extraKg: round2(facts.volumetric.reduce((s, v) => s + v.extraKg, 0)),
      criticalCount: critical,
    });
  }

  if (facts.debtOverLimit > 0) {
    items.push({ id: "debt-over-limit", level: "critical", count: facts.debtOverLimit });
  }
  if (facts.ordersWithoutTracking > 0) {
    items.push({ id: "orders-no-tracking", level: "high", count: facts.ordersWithoutTracking });
  }
  if (facts.unclaimed > 0) {
    items.push({ id: "unclaimed", level: "notice", count: facts.unclaimed });
  }

  return items.sort((a, b) => levelRank(a.level) - levelRank(b.level) || b.count - a.count);
}

/**
 * May this person open that page? The same rule the sidebar uses
 * (hooks/usePermissions → canViewPath), written for the server.
 */
export function pathVisibleTo(role: string | null | undefined, viewableModules: ReadonlySet<string>, path: string): boolean {
  if (role === "super_admin") return true;
  if (isAllAccountsPath(path) && !canSeeAllAccounts(role)) return false;
  const module = PATH_TO_MODULE[path.split(/[?#]/)[0]];
  if (!module) return true;
  return viewableModules.has(module);
}

/** What the bell says about one risk, in the reader's language. Digits stay 0-9. */
export function describeRisk(item: RiskItem): { title: Words; detail: Words | null } {
  const n = item.count;
  switch (item.id) {
    case "stale-depot":
      return {
        title: {
          ku: `${n} پاکەت لە کۆگای چین ماونەتەوە`,
          en: `${n} parcel(s) stuck in the China warehouse`,
          ar: `${n} طرد عالق في مستودع الصين`,
          zh: `${n} 个包裹滞留在中国仓库`,
        },
        detail: item.oldestDays
          ? {
              ku: `کۆنترینیان ${item.oldestDays} ڕۆژ`,
              en: `the oldest ${item.oldestDays} days`,
              ar: `أقدمها ${item.oldestDays} يوماً`,
              zh: `最久 ${item.oldestDays} 天`,
            }
          : null,
      };
    case "volumetric":
      return {
        title: {
          ku: `${n} باری قەبارەیی چێک نەکراون`,
          en: `${n} volumetric parcel(s) not checked`,
          ar: `${n} طرد حجمي لم يُراجَع`,
          zh: `${n} 个体积重包裹未核实`,
        },
        detail:
          item.extraKg != null
            ? {
                ku: `${item.extraKg} kg زیادە`,
                en: `${item.extraKg} kg extra`,
                ar: `${item.extraKg} kg زيادة`,
                zh: `多出 ${item.extraKg} kg`,
              }
            : null,
      };
    case "debt-over-limit":
      return {
        title: {
          ku: `${n} کڕیار قەرزیان لە سنوور تێپەڕیوە`,
          en: `${n} customer(s) over their credit limit`,
          ar: `${n} عميل تجاوز حد الدين`,
          zh: `${n} 位客户超出信用额度`,
        },
        detail: null,
      };
    case "orders-no-tracking":
      return {
        title: {
          ku: `${n} ئۆردەر بێ تراکینگن`,
          en: `${n} order(s) without a tracking number`,
          ar: `${n} طلب بلا رقم تتبع`,
          zh: `${n} 个订单没有运单号`,
        },
        detail: { ku: "زیاتر لە 7 ڕۆژ", en: "over 7 days", ar: "أكثر من 7 أيام", zh: "超过 7 天" },
      };
    case "unclaimed":
      return {
        title: { ku: `${n} پاکەتی بێخاوەن`, en: `${n} unclaimed parcel(s)`, ar: `${n} طرد بلا صاحب`, zh: `${n} 个无主包裹` },
        detail: null,
      };
  }
}

// ---------------------------------------------------------------------------
// Flashing
// ---------------------------------------------------------------------------

/** What a person had seen the last time they opened the bell. */
export interface RiskSeen {
  /** Their local day, YYYY-MM-DD. */
  day: string;
  marks: Partial<Record<RiskId, { level: RiskLevel; count: number }>>;
}

/** A person's own calendar day, not the server's. */
export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Record that these were seen today. */
export function markSeen(items: readonly RiskItem[], today: string): RiskSeen {
  const marks: RiskSeen["marks"] = {};
  for (const item of items) marks[item.id] = { level: item.level, count: item.count };
  return { day: today, marks };
}

/**
 * Flash while a critical or high risk is unseen today: nothing opened today,
 * a risk that was not there, one that is more serious, or one that has grown.
 * A notice alone never flashes — it is there to be read, not to interrupt.
 */
export function shouldFlash(items: readonly RiskItem[], seen: RiskSeen | null, today: string): boolean {
  const urgent = items.filter((i) => i.level === "critical" || i.level === "high");
  if (urgent.length === 0) return false;
  if (!seen || seen.day !== today) return true;
  return urgent.some((item) => {
    const before = seen.marks[item.id];
    if (!before) return true;
    if (levelRank(item.level) < levelRank(before.level)) return true;
    return item.count > before.count;
  });
}

/** Read a stored seen-state back; anything unreadable is "never seen". */
export function parseSeen(raw: string | null): RiskSeen | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as RiskSeen;
    if (!value || typeof value.day !== "string" || typeof value.marks !== "object" || value.marks === null) return null;
    return value;
  } catch {
    return null;
  }
}
