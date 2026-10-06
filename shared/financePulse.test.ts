import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  DEFAULT_FIXED_COSTS,
  cleanFixedCost,
  draws,
  fixedCostMonthlyUsd,
  flow,
  monthlyNeedUsd,
  parseFixedCosts,
  periodBounds,
  pulse,
} from "./financePulse";
import { buildRiskItems, describeRisk, riskGate, riskPath, type RiskFacts } from "./riskBell";

/**
 * The danger bell (owner, 2026-10-07): foresee a loss from slow work and few
 * orders — on averages, "the market is not the same every day" — and say so
 * when a partner takes out more than the company made.
 *
 * What would undo it: one slow day ringing the bell, a discount counted as an
 * expense, a figure on the dashboard with no way back to its records, or the
 * costs becoming something only a programmer can change.
 */

const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("the running costs", () => {
  it("are the owner's own figures until he edits them: about $2,270 a month", () => {
    const need = monthlyNeedUsd(DEFAULT_FIXED_COSTS);
    expect(need).toBeGreaterThan(2250);
    expect(need).toBeLessThan(2290);
  });

  it("a daily cost counts thirty times, and each currency by its own rate", () => {
    expect(fixedCostMonthlyUsd({ name: "ڕۆژانە", amount: 10000, currency: "IQD", rate: 1550, per: "day" })).toBe(193.55);
    expect(fixedCostMonthlyUsd({ name: "چین", amount: 2100, currency: "RMB", rate: 7, per: "month" })).toBe(300);
    expect(fixedCostMonthlyUsd({ name: "کرێ", amount: 1200, currency: "USD", rate: 999, per: "month" })).toBe(1200);
  });

  it("a row that says nothing is dropped, never guessed", () => {
    expect(cleanFixedCost({ name: "", amount: 5, currency: "USD", rate: 1, per: "month" })).toBeNull();
    expect(cleanFixedCost({ name: "x", amount: 0, currency: "USD", rate: 1, per: "month" })).toBeNull();
    expect(cleanFixedCost({ name: "x", amount: 5, currency: "IQD", rate: 0, per: "month" })).toBeNull();
    expect(parseFixedCosts("[]")).toEqual([]);
    expect(parseFixedCosts(null).length).toBe(DEFAULT_FIXED_COSTS.length);
    expect(parseFixedCosts("{broken").length).toBe(DEFAULT_FIXED_COSTS.length);
  });
});

describe("will the month cover its costs", () => {
  const base = { needMonthlyUsd: 2280, dayOfMonth: 7, daysInMonth: 31 };

  it("is quiet when the averages cover the daily need", () => {
    const p = pulse({ ...base, profit7Usd: 700, profit14Usd: 1400, profit30Usd: 3300, monthProfitSoFarUsd: 700 });
    expect(p.needDailyUsd).toBe(76);
    expect(p.level).toBe("ok");
    expect(p.forecastResultUsd).toBeGreaterThan(0);
  });

  it("one slow week inside a covered month is a look, not a bell", () => {
    const p = pulse({ ...base, profit7Usd: 300, profit14Usd: 1200, profit30Usd: 3300, monthProfitSoFarUsd: 300 });
    expect(p.level).toBe("watch");
    expect(p.reason).toBe("week-slow");
  });

  it("a month forecast to end short is danger, and says how short", () => {
    // $441 in seven days, the usual day $63: 441 + 24 x 63 = 1,953 against 2,280.
    const p = pulse({ ...base, profit7Usd: 441, profit14Usd: 900, profit30Usd: 1890, monthProfitSoFarUsd: 441 });
    expect(p.avg30Usd).toBe(63);
    expect(p.forecastProfitUsd).toBe(1953);
    expect(p.forecastResultUsd).toBe(-327);
    expect(p.level).toBe("danger");
    expect(p.reason).toBe("month-loss");
  });

  it("one day never decides anything: only 7, 14 and 30 days are read", () => {
    const rule = root("shared/financePulse.ts");
    const fn = rule.slice(rule.indexOf("export function pulse("), rule.indexOf("// Few orders"));
    expect(fn.length).toBeGreaterThan(400);
    expect(fn).not.toMatch(/profit1Usd|todayUsd|profitTodayUsd/);
  });

  it("with no costs listed there is nothing to fall short of", () => {
    expect(pulse({ ...base, needMonthlyUsd: 0, profit7Usd: 0, profit14Usd: 0, profit30Usd: 0, monthProfitSoFarUsd: 0 }).level).toBe("ok");
  });
});

describe("few orders", () => {
  it("two weeks running under half the usual is slow", () => {
    expect(flow([18, 15, 40, 44, 42, 38, 45, 41, 43, 43]).slow).toBe(true);
  });
  it("one quiet week is the market", () => {
    expect(flow([18, 39, 40, 44, 42, 38, 45, 41, 43, 43]).slow).toBe(false);
  });
  it("a business too small to have a usual week is never called slow", () => {
    expect(flow([0, 0, 2, 3, 1, 2, 2, 3, 2, 1]).slow).toBe(false);
    expect(flow([]).slow).toBe(false);
  });
});

describe("a partner taking out too much", () => {
  it("more than the company made in the same 30 days came out of capital", () => {
    const d = draws([{ name: "خۆگر", last30Usd: 900, prior90Usd: 1500 }], 3000, 2600);
    expect(d.netProfit30Usd).toBe(400);
    expect(d.eatingCapital).toBe(true);
    expect(d.fromCapitalUsd).toBe(500);
  });
  it("within what was made is not a danger", () => {
    expect(draws([{ name: "خۆگر", last30Usd: 500, prior90Usd: 1500 }], 3000, 2000).eatingCapital).toBe(false);
  });
  it("a loss-making month makes every dollar taken a dollar of capital", () => {
    expect(draws([{ name: "خۆگر", last30Usd: 300, prior90Usd: 900 }], 1000, 1500).fromCapitalUsd).toBe(300);
  });
  it("well over a partner's own usual month is named, whoever it is", () => {
    const d = draws([{ name: "خۆگر", last30Usd: 1200, prior90Usd: 1500 }, { name: "سامان", last30Usd: 520, prior90Usd: 1500 }], 9000, 1000);
    expect(d.spikes.map((s) => s.name)).toEqual(["خۆگر"]);
  });
});

describe("the bell", () => {
  const NONE: RiskFacts = { staleDepotDays: [], volumetric: [], debtOverLimit: 0, ordersWithoutTracking: 0, unclaimed: 0, emptyBoxes: 0 };

  it("rings for a forecast loss, for partners over-drawing and for orders drying up", () => {
    const items = buildRiskItems({ ...NONE, lossForecastUsd: 327, partnerOverdrawUsd: 500, ordersSlowThisWeek: 18 });
    expect(items.map((i) => `${i.id}:${i.level}:${i.count}`)).toEqual(["loss-forecast:critical:327", "partner-overdraw:high:500", "orders-slow:high:18"]);
    expect(describeRisk(items[0]).title.ku).toContain("$327");
  });

  it("says nothing when there is nothing to say", () => {
    expect(buildRiskItems({ ...NONE, lossForecastUsd: 0, partnerOverdrawUsd: 0, ordersSlowThisWeek: null })).toEqual([]);
  });

  it("a click comes back to the dashboard, at the warning", () => {
    for (const id of ["loss-forecast", "orders-slow", "partner-overdraw"] as const) {
      expect(riskPath(id)).toBe("/finance/company-dashboard?focus=pulse");
      expect(riskGate(id)).toBe("/finance/company-dashboard");
    }
    expect(root("client/src/pages/CompanyFinanceDashboard.tsx")).toContain('focus === "pulse"');
  });
});

describe("periods are the office's", () => {
  it("this month starts at midnight in Baghdad and knows today's place in it", () => {
    const b = periodBounds("month", new Date("2026-10-07T09:00:00Z"));
    expect(b.start.toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(b.dayOfMonth).toBe(7);
    expect(b.daysInMonth).toBe(31);
  });
  it("last month ends where this one begins", () => {
    const b = periodBounds("lastMonth", new Date("2026-10-07T09:00:00Z"));
    expect(b.start.toISOString()).toBe("2026-08-31T21:00:00.000Z");
    expect(b.end.toISOString()).toBe("2026-09-30T20:59:59.999Z");
  });
});

describe("the dashboard", () => {
  const page = root("client/src/pages/CompanyFinanceDashboard.tsx");
  const facts = root("server/db/financePulse.db.ts");

  it("a discount is told, never subtracted", () => {
    const net = facts.slice(facts.indexOf("netUsd:"), facts.indexOf("netUsd:") + 80);
    expect(net).toContain("workProfitUsd - spent.usd");
    expect(net).not.toContain("discount");
    expect(page).toContain('data-testid="discount-list"');
  });

  it("each figure is read by the function its own page reads", () => {
    for (const fn of ["getProfitForPeriod(", "getFinancialSummary()", "getDebtAges()", "findUnbilledArrivedOrders()", "listUnsentPaymentWhatsApp()", "getBatchProfitRowsInPeriod(", "getWorkingCapital()"]) {
      expect(facts, fn).toContain(fn);
    }
  });

  it("every money line carries its way back", () => {
    for (const href of ["/payments", "/reports/monthly-profit", "/finance/debtors", "/reports/batches", "/company/expenses", "/company/partners", "/finance/working-capital", "/batches", "/settings/data-management", "/customer-delivery-scanner?whatsapp=unsent"]) {
      expect(page, href).toContain(href);
    }
  });

  it("where the capital is goes to the main admin alone, and only he edits the costs", () => {
    const router = root("server/routers/finance.router.ts");
    expect(router).toContain('ctx.user.role === "super_admin"');
    expect(router).toContain("saveFixedCosts: superAdminProcedure");
    expect(facts).toContain("mainAdmin ? settle(() => getWorkingCapital(), null)");
  });
});
