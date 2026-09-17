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
import { debtorsHref, trackingAlertsHref } from "./listLinks";
import { checkDefinition, type CheckId, type CheckResult, type CheckSeverity } from "./auditSweep";

type Words = { ku: string; en: string; ar: string; zh: string };

/** The warehouse's, the orders' and the accounts' own standing risks. */
export type OperationalRiskId = "stale-depot" | "volumetric" | "debt-over-limit" | "orders-no-tracking" | "unclaimed" | "empty-boxes";

/**
 * One of the auditor's checks that found something, or could not run — the
 * owner (2026-09-17): the bell is the system's sensor, "anything incomplete,
 * any error, any risk" shows there.
 */
export type AuditRiskId = `audit:${CheckId}`;

export type RiskId = OperationalRiskId | AuditRiskId;

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
  /** An auditor's check that could not run — itself something to know. */
  failed?: boolean;
}

/** The facts the server gathers — counted with the same queries as the cards and the dashboard. */
export interface RiskFacts {
  staleDepotDays: readonly number[];
  volumetric: ReadonlyArray<{ ratio: number; extraKg: number }>;
  debtOverLimit: number;
  /** Orders without a tracking number for longer than ORDER_NO_TRACKING_DAYS. */
  ordersWithoutTracking: number;
  unclaimed: number;
  /** Delivery boxes nothing was ever put in (shared/emptyBox). */
  emptyBoxes: number;
}

/**
 * Where each risk's list is — exactly the records it counted, already
 * filtered, on the page where they are dealt with (owner, 2026-09-17: a click
 * goes to the problem itself). Never a whole list that merely contains them.
 */
export const RISK_PATH: Record<OperationalRiskId, string> = {
  "stale-depot": "/packages/registrations?alert=stale",
  volumetric: "/packages/registrations?alert=volumetric",
  "debt-over-limit": debtorsHref({ over: "limit" }),
  "orders-no-tracking": trackingAlertsHref({ days: "7+" }),
  unclaimed: "/packages/unclaimed",
  "empty-boxes": "/customer-delivery-scanner?empty=1",
};

/** The page whose permission decides who is told. */
export const RISK_GATE: Record<OperationalRiskId, string> = {
  "stale-depot": "/packages/registrations",
  volumetric: "/packages/registrations",
  "debt-over-limit": "/finance/debtors",
  "orders-no-tracking": "/tracking-alerts",
  unclaimed: "/packages/unclaimed",
  "empty-boxes": "/customer-delivery-scanner",
};

export const AUDIT_RISK_PREFIX = "audit:";

/** The roles the auditor's page serves — auditorProcedure in server/middleware/auth.ts. */
export const AUDIT_ROLES: readonly string[] = ["super_admin", "admin", "auditor"];

/** The auditor's page: the samples behind every finding, opened at that check. */
export const AUDIT_PAGE = "/audit-sweep";

/** The most rows the auditor keeps per check (SAMPLE_LIMIT in the sweep). */
export const AUDIT_SAMPLE_CAP = 10;

export function isAuditRisk(id: RiskId): id is AuditRiskId {
  return id.startsWith(AUDIT_RISK_PREFIX);
}

const auditCheckOf = (id: AuditRiskId) => id.slice(AUDIT_RISK_PREFIX.length) as CheckId;

/** Where a risk's own records are; for a finding, the auditor's page opened at that check. */
export function riskPath(id: RiskId): string {
  return isAuditRisk(id) ? `${AUDIT_PAGE}?check=${auditCheckOf(id)}` : RISK_PATH[id];
}

/** The page whose permission decides who is told. */
export function riskGate(id: RiskId): string {
  return isAuditRisk(id) ? AUDIT_PAGE : RISK_GATE[id];
}

/** Which half of the bell a risk sits in. */
export type RiskGroup = "risks" | "incomplete";

export function riskGroup(id: RiskId): RiskGroup {
  return isAuditRisk(id) || id === "empty-boxes" ? "incomplete" : "risks";
}

const SEVERITY_LEVEL: Record<CheckSeverity, RiskLevel> = { critical: "critical", warning: "high", info: "notice" };

/**
 * The auditor's findings as the bell's items. A clean check says nothing. A
 * check that could not run is said too, quietly: nobody should believe the
 * books balance on the strength of a query that failed.
 */
export function auditRiskItems(results: readonly CheckResult[]): RiskItem[] {
  const items: RiskItem[] = [];
  for (const result of results) {
    const definition = checkDefinition(result.id);
    if (!definition) continue;
    if (result.status === "found" && result.count > 0) {
      items.push({ id: `audit:${result.id}`, level: SEVERITY_LEVEL[definition.severity], count: result.count });
    } else if (result.status === "failed") {
      items.push({ id: `audit:${result.id}`, level: "notice", count: 0, failed: true });
    }
  }
  return items;
}

/** Worst first, the bigger of equals first. */
export function sortRiskItems(items: readonly RiskItem[]): RiskItem[] {
  return [...items].sort((a, b) => levelRank(a.level) - levelRank(b.level) || b.count - a.count);
}

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
  // Owner, 2026-09-17: an empty box should be flagged so it can be deleted. A
  // notice — it costs nothing while it waits, so it never flashes.
  if (facts.emptyBoxes > 0) {
    items.push({ id: "empty-boxes", level: "notice", count: facts.emptyBoxes });
  }

  return sortRiskItems(items);
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

/** May this person be told about this risk? Its page, and for a finding the auditor's roles too. */
export function riskVisibleTo(role: string | null | undefined, viewableModules: ReadonlySet<string>, id: RiskId): boolean {
  if (isAuditRisk(id) && !AUDIT_ROLES.includes(String(role))) return false;
  return pathVisibleTo(role, viewableModules, riskGate(id));
}

/** What the bell says about one risk, in the reader's language. Digits stay 0-9. */
export function describeRisk(item: RiskItem): { title: Words; detail: Words | null } {
  const n = item.count;
  if (isAuditRisk(item.id)) {
    const check = auditCheckOf(item.id);
    const title = checkDefinition(check)?.title ?? { ku: check, en: check, ar: check, zh: check };
    if (item.failed) {
      return {
        title,
        detail: { ku: "ئەم پشکنینە نەتوانرا بکرێت", en: "This check could not run", ar: "تعذّر تشغيل هذا الفحص", zh: "此项检查无法运行" },
      };
    }
    const shown = n >= AUDIT_SAMPLE_CAP ? `${AUDIT_SAMPLE_CAP}+` : String(n);
    return { title, detail: { ku: `${shown} دۆزرایەوە`, en: `${shown} found`, ar: `وُجد ${shown}`, zh: `发现 ${shown} 项` } };
  }
  const id: OperationalRiskId = item.id;
  switch (id) {
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
    case "empty-boxes":
      return {
        title: { ku: `${n} بۆکسی بەتاڵ`, en: `${n} empty box(es)`, ar: `${n} صندوق فارغ`, zh: `${n} 个空箱子` },
        detail: {
          ku: "هیچیان تێدا نییە — دەکرێت بسڕدرێنەوە",
          en: "nothing in them — they can be deleted",
          ar: "لا شيء فيها — يمكن حذفها",
          zh: "里面没有物品 — 可以删除",
        },
      };
  }
  return { title: { ku: id, en: id, ar: id, zh: id }, detail: null };
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
  return items.some((item) => (item.level === "critical" || item.level === "high") && isNewSince(item, seen, today));
}

/** Not in the mark: nothing marked today, a risk that was not there, more serious, or grown. */
function isNewSince(item: RiskItem, mark: RiskSeen | null, today: string): boolean {
  if (!mark || mark.day !== today) return true;
  const before = mark.marks[item.id];
  if (!before) return true;
  if (levelRank(item.level) < levelRank(before.level)) return true;
  return item.count > before.count;
}

/**
 * Chime: a critical risk the person has neither opened the bell on nor been
 * chimed about today — new, grown, or newly critical.
 *
 * Owner (2026-09-17): a soft sound for the very big risks, only to draw the
 * eye, never annoying, never repeated for the same thing. So nothing below
 * critical chimes, the same risk chimes at most once a day, and one the person
 * has already looked at does not chime at all.
 */
export function shouldChime(items: readonly RiskItem[], seen: RiskSeen | null, chimed: RiskSeen | null, today: string): boolean {
  return items.some((item) => item.level === "critical" && isNewSince(item, seen, today) && isNewSince(item, chimed, today));
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
