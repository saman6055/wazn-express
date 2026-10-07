import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  ORDER_REFUSAL_REASONS,
  PARCEL_REASONS,
  REFUSAL_FAULT,
  REFUSAL_REASONS,
  REFUSAL_REASON_WORDS,
  clampKeep,
  parcelFreightCostUsd,
  planRefusal,
  stockHeldUsd,
  stockLossSoFarUsd,
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
      expect(["customer", "office", "nobody"]).toContain(REFUSAL_FAULT[r]);
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

  it("a refusal is a loss that day: off the customer, off profit, and cash where it was", () => {
    const before = workingCapital(base);
    // Two of five refused: $24 off the debt; the $4 margin and the $20 cost out of profit.
    const after = workingCapital({ ...base, profitUsd: 12, debtUsd: 136, stockUsd: 20, stockCount: 1 });
    expect(after.netCashUsd).toBe(before.netCashUsd);
    expect(after.shouldHoldUsd).toBe(before.shouldHoldUsd - 24);
  });

  it("a cash sale brings in exactly its price, and takes that much off the loss", () => {
    const refused = workingCapital({ ...base, profitUsd: 12, debtUsd: 136, stockUsd: 20, stockCount: 1 });
    const sold = workingCapital({ ...base, profitUsd: 27, debtUsd: 136, stockUsd: 0, stockCount: 0 });
    expect(Math.round((sold.netCashUsd - refused.netCashUsd) * 100) / 100).toBe(15);
  });

  it("what a piece has cost so far: cost, less what was kept, less what a sale brought back", () => {
    const row = { status: "held" as const, costUsd: 22, keptUsd: 0, soldPriceUsd: null };
    expect(stockLossSoFarUsd(row)).toBe(22);
    expect(stockLossSoFarUsd({ ...row, keptUsd: 10 })).toBe(12);
    expect(stockLossSoFarUsd({ ...row, keptUsd: 10, status: "sold", soldPriceUsd: 15 })).toBe(-3);
    expect(stockLossSoFarUsd({ ...row, status: "written_off" })).toBe(22);
  });

  it("the profit rule counts the cost on the day of refusal and the price on the day of sale", () => {
    const db = root("server/db/refusedGoods.db.ts");
    const fn = db.slice(db.indexOf("export async function getStockProfitBetween"), db.indexOf("/** Goods still on our hands and what they cost"));
    expect(fn.length).toBeGreaterThan(600);
    expect(fn).toContain("gte(companyStock.createdAt, start)");
    expect(fn).toContain('eq(companyStock.status, "sold"), gte(companyStock.closedAt, start)');
    expect(fn).toContain("cents(keptUsd + recoveredUsd - lostUsd)");
    expect(root("server/db/reports.db.ts")).toContain("pkgs.profit + stock.profitUsd");
  });

  it("stock is shown and not summed, so nothing is counted twice", () => {
    expect(root("shared/workingCapital.ts")).toContain("cents(shouldHoldUsd - f.debtUsd - f.goodsOnRoadUsd + f.creditUsd)");
    expect(root("server/db/workingCapital.db.ts")).toContain("getStockHeld()");
  });
});

describe("found by its tracking, both times", () => {
  const db = root("server/db/refusedGoods.db.ts");
  const page = root("client/src/pages/CompanyStock.tsx");

  it("the search reads the order's code, its own trackings, its list of trackings and its parcel", () => {
    const fn = db.slice(db.indexOf("export async function searchOrdersForRefusal"), db.indexOf("export async function refuseOrderGoods"));
    for (const piece of ["fullPackageOrders.orderCode, q", "fullPackageOrders.trackingNumber, q", "fullPackageOrders.supplierTrackingNumber, q", "fullPackageOrderTrackings.trackingNumber, q", "packages.trackingNumber, q"]) {
      expect(fn, piece).toContain(piece);
    }
    expect(fn).toContain("isLiveSale(r)");
  });

  it("the tracking stays on the stock, and the stock list is searched by it", () => {
    expect(db).toContain('trackingNumber: (input.trackingNumber ?? "").trim() || order.trackingNumber || null');
    expect(page).toContain("r.trackingNumber");
    expect(page).toContain('data-testid="stock-search"');
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

describe("a parcel the company only carried", () => {
  const db = root("server/db/refusedGoods.db.ts");
  const abandon = db.slice(db.indexOf("export async function abandonParcel"), db.indexOf("/** Ownerless parcels still waiting for somebody"));

  it("has its own two reasons, and an order's form never offers them", () => {
    expect([...PARCEL_REASONS]).toEqual(["abandoned", "ownerless"]);
    for (const r of PARCEL_REASONS) expect(ORDER_REFUSAL_REASONS as readonly string[]).not.toContain(r);
    expect(REFUSAL_FAULT.abandoned).toBe("customer");
    expect(REFUSAL_FAULT.ownerless).toBe("nobody");
    expect(root("client/src/pages/CompanyStock.tsx")).toContain("{ORDER_REFUSAL_REASONS.map((r) => (");
  });

  it("what carrying it cost is the batch's rate on its own weight or volume", () => {
    const air = { unit: "kg" as const, ratePerUnit: 6, weightKg: 4, lengthCm: 0, widthCm: 0, heightCm: 0, volumeCbm: 0, divisor: 6000 };
    expect(parcelFreightCostUsd(air)).toBe(24);
    // Bulky and light: the carrier is paid on the volume.
    expect(parcelFreightCostUsd({ ...air, weightKg: 1, lengthCm: 60, widthCm: 50, heightCm: 40 })).toBe(120);
    expect(parcelFreightCostUsd({ ...air, unit: "cbm", ratePerUnit: 200, volumeCbm: 0.12 })).toBe(24);
    // A batch with no cost yet says nothing rather than a made-up figure.
    expect(parcelFreightCostUsd({ ...air, ratePerUnit: 0 })).toBe(0);
  });

  it("goes into stock with no buying cost, its freight beside it", () => {
    expect(abandon.length).toBeGreaterThan(1500);
    expect(abandon).toContain('costUsd: "0.00"');
    expect(abandon).toContain("freightCostUsd: freightCostUsd.toFixed(2)");
    expect(abandon).toContain("packageId: Number(pkg.id)");
  });

  it("the freight is counted once: in its batch, never again from the stock", () => {
    // The batch shares its cost out by each parcel's price, so the price is cleared with the charge.
    expect(abandon).toContain('set({ isCharged: false, status: "returned", calculatedCostUsd: "0" })');
    const profit = db.slice(db.indexOf("export async function getStockProfitBetween"), db.indexOf("/** Goods still on our hands and what they cost"));
    expect(profit).not.toContain("freightCostUsd");
  });

  it("one already paid for on a receipt is not a loss and is refused", () => {
    expect(abandon).toContain("parcelReceipt(input.packageId)");
    expect(abandon.indexOf("parcelReceipt(input.packageId)")).toBeLessThan(abandon.indexOf("reverseCharge(charge.id"));
  });

  it("a parcel with an order behind it goes through the order's door", () => {
    expect(db).toContain("if (Number(pkg.fullPackageOrderId) > 0)");
  });

  it("ownerless parcels still waiting are counted with what carrying them cost", () => {
    expect(db).toContain("export async function getOwnerlessFreight");
    expect(root("client/src/pages/CompanyStock.tsx")).toContain('data-testid="ownerless-freight"');
    expect(root("server/routers/finance.router.ts")).toContain("abandonParcel: superAdminProcedure");
  });
});
