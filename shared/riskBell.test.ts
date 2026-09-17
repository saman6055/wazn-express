import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  auditRiskItems,
  buildRiskItems,
  describeRisk,
  localDay,
  markSeen,
  parseSeen,
  pathVisibleTo,
  riskGate,
  riskGroup,
  riskPath,
  riskVisibleTo,
  shouldChime,
  shouldFlash,
  sortRiskItems,
  AUDIT_ROLES,
  type RiskFacts,
} from "./riskBell";

const FACTS: RiskFacts = {
  staleDepotDays: [136, 70, 54, 54, 40, 22, 18, 16],
  volumetric: [
    { ratio: 3.21, extraKg: 6.3 },
    { ratio: 2.41, extraKg: 4.82 },
  ],
  debtOverLimit: 3,
  ordersWithoutTracking: 4,
  unclaimed: 6,
  emptyBoxes: 2,
};

describe("today's risks", () => {
  const items = buildRiskItems(FACTS);

  it("are ranked worst first, the bigger of equals first", () => {
    expect(items.map((i) => `${i.id}:${i.level}`)).toEqual([
      "stale-depot:critical",
      "debt-over-limit:critical",
      "volumetric:critical",
      "orders-no-tracking:high",
      "unclaimed:notice",
      "empty-boxes:notice",
    ]);
  });

  it("carry what the bell says about them", () => {
    const stale = items.find((i) => i.id === "stale-depot")!;
    expect(stale).toMatchObject({ count: 8, oldestDays: 136, criticalCount: 5 });
    const volumetric = items.find((i) => i.id === "volumetric")!;
    expect(volumetric).toMatchObject({ count: 2, extraKg: 11.12, criticalCount: 1 });
    expect(describeRisk(stale).title.ku).toBe("8 پاکەت لە کۆگای چین ماونەتەوە");
    expect(describeRisk(stale).detail?.ku).toBe("کۆنترینیان 136 ڕۆژ");
    expect(describeRisk(volumetric).detail?.ku).toBe("11.12 kg زیادە");
  });

  it("are only high when nothing in them is critical", () => {
    const calmer = buildRiskItems({ ...FACTS, staleDepotDays: [20, 16], volumetric: [{ ratio: 2, extraKg: 1 }] });
    expect(calmer.find((i) => i.id === "stale-depot")?.level).toBe("high");
    expect(calmer.find((i) => i.id === "volumetric")?.level).toBe("high");
  });

  it("leave out whatever has nothing in it", () => {
    expect(buildRiskItems({ staleDepotDays: [], volumetric: [], debtOverLimit: 0, ordersWithoutTracking: 0, unclaimed: 0, emptyBoxes: 0 })).toEqual([]);
  });

  it("every risk leads to its list and is guarded by a page", () => {
    for (const item of items) {
      expect(riskPath(item.id).startsWith(riskGate(item.id))).toBe(true);
    }
  });
});

describe("who is told", () => {
  it("the owner sees everything", () => {
    expect(pathVisibleTo("super_admin", new Set(), "/finance/debtors")).toBe(true);
  });

  it("an employee sees the warehouse they may open, never the debts", () => {
    const warehouse = new Set(["registrations", "debtors_report"]);
    expect(pathVisibleTo("employee", warehouse, "/packages/registrations")).toBe(true);
    expect(pathVisibleTo("employee", warehouse, "/finance/debtors")).toBe(false);
    expect(pathVisibleTo("employee", new Set(), "/packages/registrations")).toBe(false);
  });

  it("the accountant sees the debts when granted them", () => {
    expect(pathVisibleTo("accountant", new Set(["debtors_report"]), "/finance/debtors")).toBe(true);
  });
});

describe("when the bell flashes", () => {
  const today = "2026-09-16";
  const items = buildRiskItems(FACTS);

  it("flashes when nothing has been looked at today", () => {
    expect(shouldFlash(items, null, today)).toBe(true);
    expect(shouldFlash(items, markSeen(items, "2026-09-15"), today)).toBe(true);
  });

  it("stops once opened", () => {
    expect(shouldFlash(items, markSeen(items, today), today)).toBe(false);
  });

  it("starts again for a new risk, a bigger one, or a more serious one", () => {
    const seen = markSeen(items, today);
    const bigger = buildRiskItems({ ...FACTS, debtOverLimit: 4 });
    expect(shouldFlash(bigger, seen, today)).toBe(true);

    const withoutOrders = buildRiskItems({ ...FACTS, ordersWithoutTracking: 0 });
    expect(shouldFlash(items, markSeen(withoutOrders, today), today)).toBe(true);

    const calmStale = buildRiskItems({ ...FACTS, staleDepotDays: [20] });
    expect(shouldFlash(items, markSeen(calmStale, today), today)).toBe(true);
  });

  it("does not flash when a risk shrinks", () => {
    const seen = markSeen(items, today);
    expect(shouldFlash(buildRiskItems({ ...FACTS, debtOverLimit: 2 }), seen, today)).toBe(false);
  });

  it("a notice alone never flashes", () => {
    const notices = buildRiskItems({ staleDepotDays: [], volumetric: [], debtOverLimit: 0, ordersWithoutTracking: 0, unclaimed: 6, emptyBoxes: 3 });
    expect(shouldFlash(notices, null, today)).toBe(false);
  });

  it("reads a damaged memory as never seen", () => {
    expect(parseSeen("{not json")).toBeNull();
    expect(parseSeen(JSON.stringify({ day: 5 }))).toBeNull();
    expect(parseSeen(JSON.stringify(markSeen(items, today)))?.day).toBe(today);
  });

  it("a day is the person's own calendar day", () => {
    expect(localDay(new Date(2026, 8, 6, 23, 59))).toBe("2026-09-06");
  });
});

/**
 * The bell as the system's sensor (owner, 2026-09-17): anything incomplete,
 * any error, any risk — and a soft chime for the very big ones.
 */
describe("the auditor's findings in the bell", () => {
  const results = [
    { id: "account_balance_drift", status: "found", count: 2 },
    { id: "duplicate_tracking_number", status: "found", count: 10 },
    { id: "unclaimed_no_request", status: "found", count: 6 },
    { id: "negative_weight", status: "clean", count: 0 },
    { id: "batch_unwatched", status: "failed", count: 0, error: "boom" },
  ] as const;
  const findings = auditRiskItems(results as never);

  it("says what was found, at the auditor's own severity, and nothing that was clean", () => {
    expect(findings.map((i) => `${i.id}:${i.level}:${i.count}`)).toEqual([
      "audit:account_balance_drift:critical:2",
      "audit:duplicate_tracking_number:high:10",
      "audit:unclaimed_no_request:notice:6",
      "audit:batch_unwatched:notice:0",
    ]);
  });

  it("says a check that could not run, quietly", () => {
    const failed = findings.find((i) => i.id === "audit:batch_unwatched")!;
    expect(failed.failed).toBe(true);
    expect(describeRisk(failed).detail?.ku).toBe("ئەم پشکنینە نەتوانرا بکرێت");
  });

  it("names each finding by the auditor's title, and caps the count where the sweep does", () => {
    const drift = findings.find((i) => i.id === "audit:account_balance_drift")!;
    expect(describeRisk(drift).title.ku).toBe("باڵانسی کڕیار لەگەڵ مێژووی خۆی ناگونجێت");
    expect(describeRisk(drift).detail?.ku).toBe("2 دۆزرایەوە");
    const dupes = findings.find((i) => i.id === "audit:duplicate_tracking_number")!;
    expect(describeRisk(dupes).detail?.en).toBe("10+ found");
  });

  it("each leads to the auditor's page, opened at that check", () => {
    expect(riskPath("audit:account_balance_drift")).toBe("/audit-sweep?check=account_balance_drift");
    expect(riskGate("audit:account_balance_drift")).toBe("/audit-sweep");
  });

  it("sit with the empty boxes under errors and gaps; the standing risks under risks", () => {
    expect(riskGroup("audit:negative_weight")).toBe("incomplete");
    expect(riskGroup("empty-boxes")).toBe("incomplete");
    expect(riskGroup("stale-depot")).toBe("risks");
    expect(riskGroup("debt-over-limit")).toBe("risks");
  });

  it("join the standing risks worst first", () => {
    const all = sortRiskItems([...buildRiskItems(FACTS), ...findings]);
    expect(all[0].level).toBe("critical");
    expect(all.at(-1)!.level).toBe("notice");
  });
});

describe("who is told about a finding", () => {
  it("only the auditor's roles, and only with the auditor's page", () => {
    expect(riskVisibleTo("super_admin", new Set(), "audit:account_balance_drift")).toBe(true);
    expect(riskVisibleTo("admin", new Set(["audit_sweep"]), "audit:account_balance_drift")).toBe(true);
    expect(riskVisibleTo("employee", new Set(["audit_sweep"]), "audit:account_balance_drift")).toBe(false);
    expect(riskVisibleTo("admin", new Set(), "audit:account_balance_drift")).toBe(false);
  });

  it("the standing risks by their own pages, as before", () => {
    expect(riskVisibleTo("employee", new Set(["registrations"]), "stale-depot")).toBe(true);
    expect(riskVisibleTo("employee", new Set(["registrations"]), "debt-over-limit")).toBe(false);
  });

  it("the roles are the auditor page's own", () => {
    const auth = fs.readFileSync(path.resolve(__dirname, "../server/middleware/auth.ts"), "utf8");
    const start = auth.indexOf("export const auditorProcedure");
    expect(start).toBeGreaterThan(-1);
    expect(auth.slice(start, start + 300)).toContain(JSON.stringify([...AUDIT_ROLES]).replace(/,/g, ", "));
  });
});

describe("when the bell chimes", () => {
  const today = "2026-09-17";
  const items = buildRiskItems(FACTS);

  it("for a critical risk nobody has looked at or been chimed about today", () => {
    expect(shouldChime(items, null, null, today)).toBe(true);
  });

  it("never twice for the same thing", () => {
    expect(shouldChime(items, null, markSeen(items, today), today)).toBe(false);
  });

  it("not at all for what the person has already opened the bell on", () => {
    expect(shouldChime(items, markSeen(items, today), null, today)).toBe(false);
  });

  it("again when a critical risk grows", () => {
    const chimed = markSeen(items, today);
    const grown = buildRiskItems({ ...FACTS, debtOverLimit: FACTS.debtOverLimit + 1 });
    expect(shouldChime(grown, null, chimed, today)).toBe(true);
  });

  it("never for anything below critical", () => {
    const calm = buildRiskItems({ staleDepotDays: [20], volumetric: [], debtOverLimit: 0, ordersWithoutTracking: 4, unclaimed: 6, emptyBoxes: 2 });
    expect(calm.some((i) => i.level === "critical")).toBe(false);
    expect(shouldChime(calm, null, null, today)).toBe(false);
  });
});
