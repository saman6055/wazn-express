import { describe, expect, it } from "vitest";
import {
  buildRiskItems,
  describeRisk,
  localDay,
  markSeen,
  parseSeen,
  pathVisibleTo,
  shouldFlash,
  RISK_GATE,
  RISK_PATH,
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
    expect(buildRiskItems({ staleDepotDays: [], volumetric: [], debtOverLimit: 0, ordersWithoutTracking: 0, unclaimed: 0 })).toEqual([]);
  });

  it("every risk leads to its list and is guarded by a page", () => {
    for (const item of items) {
      expect(RISK_PATH[item.id].startsWith(RISK_GATE[item.id])).toBe(true);
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
    const notices = buildRiskItems({ staleDepotDays: [], volumetric: [], debtOverLimit: 0, ordersWithoutTracking: 0, unclaimed: 6 });
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
