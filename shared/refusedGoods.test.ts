import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  REFUSAL_FAULT,
  REFUSAL_REASONS,
  REFUSAL_REASON_WORDS,
  clampKeep,
  planRefusal,
  stockHeldUsd,
  stockOutcomeUsd,
  stockResultUsd,
  suggestKeep,
} from "./refusedGoods";
import { workingCapital, type WorkingCapitalFacts } from "./workingCapital";
import { buildRiskItems, riskPath, type RiskFacts } from "./riskBell";

/**
 * Refused goods have a place on the books (owner, 2026-10-07): they come off
 * the customer, become the company's stock at what they cost, and end as sold
 * or written off — "I want money to stop getting lost, everything clear as
 * daylight".
 *
 * What would undo it: a refusal that leaves the goods' cost nowhere, the
 * customer's money kept or returned without anyone deciding, a loss counted
 * before the goods have ended, or the working-capital sum no longer closing.
 */

const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("what a refusal does", () => {
  // Five pieces at $12 each ($10 cost); the customer owes $60 and takes three.
  const five = { orderQuantity: 5, unitSellUsd: 12, unitBuyUsd: 10, charged: true };

  it("takes only the refused pieces off the customer and puts them in stock at cost", () => {
    const p = planRefusal({ ...five, refuseQuantity: 2, balanceUsd: 60 });
    expect(p).toEqual({ whole: false, remainingQuantity: 3, takenOffUsd: 24, costUsd: 20, balanceAfterUsd: 36, keepableUsd: 0 });
  });

  it("an order never put on the account has nothing to take off", () => {
    const p = planRefusal({ ...five, charged: false, refuseQuantity: 5, balanceUsd: 0 });
    expect(p.takenOffUsd).toBe(0);
    expect(p.costUsd).toBe(50);
    expect(p.whole).toBe(true);
  });

  it("never more pieces than the order has", () => {
    expect(planRefusal({ ...five, refuseQuantity: 9, balanceUsd: 60 }).remainingQuantity).toBe(0);
  });

  it("the customer's own money in our hands is the most that can be kept", () => {
    // One piece at $60, an advance of $10 already paid: owes $50.
    const p = planRefusal({ orderQuantity: 1, refuseQuantity: 1, unitSellUsd: 60, unitBuyUsd: 50, charged: true, balanceUsd: 50 });
    expect(p.balanceAfterUsd).toBe(-10);
    expect(p.keepableUsd).toBe(10);
    expect(clampKeep(999, p)).toBe(10);
    expect(clampKeep(-5, p)).toBe(0);
    expect(clampKeep(4, p)).toBe(4);
  });
});

describe("whose side, and the money that follows", () => {
  it("every reason has words and a side", () => {
    for (const r of REFUSAL_REASONS) {
      expect(REFUSAL_REASON_WORDS[r].ku.length).toBeGreaterThan(3);
      expect(["customer", "office"]).toContain(REFUSAL_FAULT[r]);
    }
  });

  it("late, or the office's own mistake: the customer's money is theirs", () => {
    for (const r of ["late", "office_mistake", "office_duplicate"] as const) expect(suggestKeep(r)).toBe(false);
  });

  it("the customer simply does not want it: the suggestion is to keep it", () => {
    for (const r of ["fake_customer", "no_answer", "partial", "changed_mind"] as const) expect(suggestKeep(r)).toBe(true);
  });

  it("is only ever a suggestion: the form makes the main admin answer", () => {
    const page = root("client/src/pages/CompanyStock.tsx");
    expect(page).toContain("useState<boolean | null>(null)");
    expect(page).toContain("p.plan.keepableUsd > 0 && keep === null");
    expect(page).toContain('data-testid="keep-question"');
  });
});

describe("how it ends", () => {
  const held = { status: "held" as const, costUsd: 22, keptUsd: 0, soldPriceUsd: null };

  it("is not a loss while it is on our hands", () => {
    expect(stockOutcomeUsd(held)).toBe(0);
    expect(stockHeldUsd([held, { ...held, status: "sold", soldPriceUsd: 30 }])).toBe(22);
  });

  it("sold: the price less the cost, a profit or a loss", () => {
    expect(stockOutcomeUsd({ ...held, status: "sold", soldPriceUsd: 30 })).toBe(8);
    expect(stockOutcomeUsd({ ...held, status: "sold", soldPriceUsd: 15 })).toBe(-7);
  });

  it("written off: the cost is the loss", () => {
    expect(stockOutcomeUsd({ ...held, status: "written_off" })).toBe(-22);
  });

  it("money kept from the customer softens it", () => {
    expect(stockResultUsd({ ...held, keptUsd: 10, status: "sold", soldPriceUsd: 15 })).toBe(3);
  });
});

describe("the books still close", () => {
  const base: WorkingCapitalFacts = {
    capitalUsd: 1000, profitUsd: 36, expensesUsd: 0, withdrawals: [],
    debtUsd: 160, debtors: 3, creditUsd: 0,
    goodsOnRoadUsd: 22, goodsOnRoadCostUsd: 16, goodsOnRoadCount: 1,
    stockUsd: 0, stockCount: 0,
  };

  it("a refusal moves value from debt to stock and leaves cash where it was", () => {
    const before = workingCapital(base);
    // Two of five refused: $24 off the debt, the $4 margin out of profit, $20 into stock.
    const after = workingCapital({ ...base, profitUsd: 32, debtUsd: 136, stockUsd: 20, stockCount: 1 });
    expect(after.netCashUsd).toBe(before.netCashUsd);
  });

  it("a cash sale brings in exactly its price", () => {
    const withStock = workingCapital({ ...base, profitUsd: 32, debtUsd: 136, stockUsd: 20, stockCount: 1 });
    // Sold for $15: stock out at $20, profit −$5.
    const sold = workingCapital({ ...base, profitUsd: 27, debtUsd: 136, stockUsd: 0, stockCount: 0 });
    expect(Math.round((sold.netCashUsd - withStock.netCashUsd) * 100) / 100).toBe(15);
  });

  it("the profit rule and the capital rule both read the stock", () => {
    expect(root("server/db/reports.db.ts")).toContain("getStockProfitBetween(startDate, endDate)");
    expect(root("server/db/reports.db.ts")).toContain("pkgs.profit + stock.profitUsd");
    expect(root("server/db/workingCapital.db.ts")).toContain("getStockHeld()");
    expect(root("shared/workingCapital.ts")).toContain("- f.stockUsd + f.creditUsd");
  });
});

describe("every step is on the books, and the main admin's", () => {
  const db = root("server/db/refusedGoods.db.ts");
  const refuse = db.slice(db.indexOf("export async function refuseOrderGoods"), db.indexOf("export async function listCompanyStock"));
  const router = root("server/routers/finance.router.ts");

  it("the charge comes off through the ledger's own corrections, never by a silent edit", () => {
    expect(refuse.length).toBeGreaterThan(1500);
    expect(refuse).toContain("reverseCharge(order.chargeTransactionId, why, userId");
    expect(refuse).toContain("adjustCharge(order.chargeTransactionId");
    expect(refuse).toContain('"debit", keptLedgerReason(order.orderCode)');
  });

  it("the goods go into stock in the same act", () => {
    expect(refuse).toContain("db.insert(companyStock)");
    expect(refuse).toContain("costUsd: plan.costUsd.toFixed(2)");
  });

  it("a refused order is refused once", () => {
    expect(db).toContain("if (!isLiveSale(order))");
  });

  it("stock is closed by a claim, so one piece is never sold twice", () => {
    expect(db.match(/eq\(companyStock\.status, "held"\)\)\);/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("nothing is ever deleted", () => {
    expect(db).not.toContain("db.delete(");
  });

  it("refusing, selling, writing off and listing are the main admin's", () => {
    for (const route of ["refuseGoods", "sellStock", "writeOffStock", "listStockInStore", "previewRefusal"]) {
      expect(router, route).toContain(`${route}: superAdminProcedure`);
    }
  });
});

describe("told where it matters", () => {
  const NONE: RiskFacts = { staleDepotDays: [], volumetric: [], debtOverLimit: 0, ordersWithoutTracking: 0, unclaimed: 0, emptyBoxes: 0 };

  it("old stock reaches the bell and clicks to the list", () => {
    expect(buildRiskItems({ ...NONE, stockOld: 2 })).toEqual([{ id: "stock-old", level: "notice", count: 2 }]);
    expect(riskPath("stock-old")).toBe("/finance/company-stock");
  });

  it("a customer who refused before is flagged where their next order is typed", () => {
    for (const form of ["client/src/pages/CommissionForm.tsx", "client/src/pages/FullPackageForm.tsx"]) {
      expect(root(form), form).toContain("<RefusalWarning customerId={Number(formData.customerId) || null} />");
    }
  });

  it("the page is on the menu and both finance pages link to it", () => {
    expect(root("client/src/App.tsx")).toContain('path="/finance/company-stock"');
    expect(root("client/src/pages/WorkingCapital.tsx")).toContain('href="/finance/company-stock"');
    expect(root("client/src/pages/CompanyFinanceDashboard.tsx")).toContain('href="/finance/company-stock"');
  });
});
