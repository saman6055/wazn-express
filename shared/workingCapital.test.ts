import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { cashCheck, parseStoredCashCheck, workingCapital, type WorkingCapitalFacts } from "./workingCapital";

/**
 * Working capital is derived, never typed (owner, 2026-10-05: "money does not
 * rest with me one day — I cannot type the cash; make it automatic").
 *
 * What would undo it: a counted cash figure becoming a line in a total (it is
 * stale by the next morning and counts the same dollars twice), the page
 * growing an input for cash or for what is owed to the carrier, or anyone but
 * the main admin being able to read it.
 */

const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

// The live figures of 5 October 2026.
const OCT5: WorkingCapitalFacts = {
  capitalUsd: 32000,
  profitUsd: 17981.46,
  expensesUsd: 14035.99,
  withdrawals: [{ name: "خۆگر", usd: 3839.36 }],
  debtUsd: 25817.23,
  debtors: 80,
  creditUsd: 0,
  goodsOnRoadUsd: 5841.78,
  goodsOnRoadCostUsd: 4966.02,
  goodsOnRoadCount: 119,
};

describe("the picture", () => {
  it("is what the company should hold, less what the records can already place", () => {
    const w = workingCapital(OCT5);
    expect(w.withdrawalsUsd).toBe(3839.36);
    expect(w.shouldHoldUsd).toBe(32106.11);
    expect(w.netCashUsd).toBe(447.1);
  });

  it("always adds back up to what the company should hold", () => {
    const w = workingCapital(OCT5);
    const placed = OCT5.debtUsd + OCT5.goodsOnRoadUsd + w.netCashUsd - OCT5.creditUsd;
    expect(Math.round(placed * 100) / 100).toBe(w.shouldHoldUsd);
  });

  it("a customer paying moves debt to cash and changes no total", () => {
    const before = workingCapital(OCT5);
    const after = workingCapital({ ...OCT5, debtUsd: OCT5.debtUsd - 374 });
    expect(after.shouldHoldUsd).toBe(before.shouldHoldUsd);
    expect(after.netCashUsd).toBe(before.netCashUsd + 374);
  });

  it("goods bought for a customer move cash to the road and change no total", () => {
    const before = workingCapital(OCT5);
    const after = workingCapital({ ...OCT5, goodsOnRoadUsd: OCT5.goodsOnRoadUsd + 200 });
    expect(after.shouldHoldUsd).toBe(before.shouldHoldUsd);
    expect(after.netCashUsd).toBe(Math.round((before.netCashUsd - 200) * 100) / 100);
  });

  it("an expense or a withdrawal comes out of both", () => {
    const before = workingCapital(OCT5);
    const spent = workingCapital({ ...OCT5, expensesUsd: OCT5.expensesUsd + 20 });
    expect(spent.shouldHoldUsd).toBe(Math.round((before.shouldHoldUsd - 20) * 100) / 100);
    expect(spent.netCashUsd).toBe(Math.round((before.netCashUsd - 20) * 100) / 100);
  });

  it("goes negative when the company owes, rather than hiding it", () => {
    expect(workingCapital({ ...OCT5, debtUsd: 27000 }).netCashUsd).toBeLessThan(0);
  });

  it("money a customer left with us is cash in hand that is not ours", () => {
    const w = workingCapital({ ...OCT5, creditUsd: 100 });
    expect(w.netCashUsd).toBe(547.1);
    expect(w.shouldHoldUsd).toBe(32106.11);
  });
});

describe("a count is a test", () => {
  it("says how much went out unwritten", () => {
    const c = cashCheck(447.1, 494.45, 374);
    expect(c.countedNetUsd).toBe(120.45);
    expect(c.unwrittenUsd).toBe(326.65);
  });

  it("and says so when there is more than the books know", () => {
    expect(cashCheck(100, 300, 0).unwrittenUsd).toBe(-200);
  });

  it("is read back whole or not at all", () => {
    expect(parseStoredCashCheck(null)).toBeNull();
    expect(parseStoredCashCheck("{broken")).toBeNull();
    expect(parseStoredCashCheck(JSON.stringify({ haveUsd: 5 }))).toBeNull();
    expect(parseStoredCashCheck(JSON.stringify({ haveUsd: 494, oweUsd: 374, netCashUsd: 447.1, unwrittenUsd: 327.1, at: "2026-10-05T10:00:00.000Z" }))?.oweUsd).toBe(374);
  });
});

describe("nothing is typed into the sum", () => {
  const facts = root("server/db/workingCapital.db.ts");
  const router = root("server/routers/finance.router.ts");
  const page = root("client/src/pages/WorkingCapital.tsx");

  it("the facts never read the stored count", () => {
    const fn = facts.slice(facts.indexOf("export async function getWorkingCapitalFacts"), facts.indexOf("export async function getWorkingCapital()"));
    expect(fn.length).toBeGreaterThan(500);
    expect(fn).not.toContain("WORKING_CAPITAL_CHECK_KEY");
    expect(fn).not.toContain("getSetting");
  });

  it("profit comes from the one rule, and goods on the road are uncharged live orders", () => {
    expect(facts).toContain("getProfitForPeriod(");
    expect(facts).toContain("LIVE_SALE_SQL");
    expect(facts).toContain("COALESCE(${fullPackageOrders.isCharged}, 0) = 0");
  });

  it("only the main admin reads it or records a count", () => {
    expect(router).toContain("workingCapital: superAdminProcedure.query");
    expect(router).toContain("checkWorkingCapital: superAdminProcedure");
  });

  it("the page has two inputs, both in the check, and totals come from the rule", () => {
    expect(page.match(/<Input /g)?.length).toBe(2);
    expect(page).toContain("data.netCashUsd");
    expect(page).toContain("cashCheck(data.netCashUsd");
    expect(page).not.toContain("last.haveUsd +");
  });

  it("is on the menu for the main admin alone", () => {
    const menu = root("client/src/components/DashboardLayout.tsx");
    expect(menu).toContain('...(isSuperAdmin ? [{ icon: Coins');
    expect(root("client/src/App.tsx")).toContain('path="/finance/working-capital"');
  });
});
