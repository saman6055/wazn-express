import { describe, it, expect } from "vitest";
import {
  commissionGoodsTotal,
  commissionProfit,
  computeOrderChargeAmount,
} from "./db/fullPackage.db";

/**
 * A commission order's item price AND its commission are both PER UNIT.
 *
 * The owner's rule: buy a bag at $20, sell it at $25 — that is $5 earned on
 * one bag and $10 on two. The customer therefore owes $25 per bag.
 *
 * The charge used to be computed as `(itemPrice × qty) + commission`, adding
 * the commission only ONCE per order. Every commission order with qty > 1 was
 * billed short by `commission × (qty - 1)`.
 */
describe("commissionGoodsTotal", () => {
  it("charges buy + commission for a single unit", () => {
    expect(commissionGoodsTotal("20", "5", 1)).toBe(25);
  });

  it("doubles for two units — the reported case", () => {
    // $20 buy, $5 commission, 2 bags → customer owes $50, we earn $10.
    expect(commissionGoodsTotal("20", "5", 2)).toBe(50);
    expect(commissionProfit("5", 2)).toBe(10);
  });

  it("scales the commission with quantity, not just the item price", () => {
    // The old formula gave (20 * 5) + 5 = 105 here; the shortfall was $20.
    expect(commissionGoodsTotal("20", "5", 5)).toBe(125);
  });

  it("is unchanged for qty = 1, so existing single-unit orders are unaffected", () => {
    // Both formulas agree at qty 1 — this is why the bug stayed hidden.
    const oldFormula = (i: number, c: number, q: number) => i * q + c;
    for (const [item, comm] of [[20, 5], [39.56, 5.44], [100, 15]] as const) {
      expect(commissionGoodsTotal(item, comm, 1)).toBe(oldFormula(item, comm, 1));
    }
  });

  it("handles the real order from the report ($39.56 + $5.44)", () => {
    expect(commissionGoodsTotal("39.56", "5.44", 1)).toBeCloseTo(45.0, 2);
    expect(commissionGoodsTotal("39.56", "5.44", 3)).toBeCloseTo(135.0, 2);
  });

  it("treats a missing quantity as one", () => {
    expect(commissionGoodsTotal("20", "5", null)).toBe(25);
    expect(commissionGoodsTotal("20", "5", undefined)).toBe(25);
  });

  it("treats missing money as zero rather than NaN", () => {
    expect(commissionGoodsTotal(null, null, 3)).toBe(0);
    expect(commissionGoodsTotal("20", null, 2)).toBe(40);
    expect(commissionGoodsTotal(undefined, "5", 2)).toBe(10);
    expect(commissionGoodsTotal("", "", 2)).toBe(0);
  });

  it("accepts numbers as well as decimal strings", () => {
    expect(commissionGoodsTotal(20, 5, 2)).toBe(50);
  });

  it("still bills a loss-making order (sell below cost)", () => {
    // Negative commission is allowed by design; it must not be clamped.
    expect(commissionGoodsTotal("20", "-3", 2)).toBe(34);
    expect(commissionProfit("-3", 2)).toBe(-6);
  });
});

describe("commissionProfit", () => {
  it("is the commission per unit", () => {
    expect(commissionProfit("5", 1)).toBe(5);
    expect(commissionProfit("5", 4)).toBe(20);
  });

  it("defaults a missing quantity to one", () => {
    expect(commissionProfit("7.5", null)).toBe(7.5);
  });
});

/**
 * computeOrderChargeAmount is the ledger's single source of truth; the
 * commission branch must agree with commissionGoodsTotal exactly, or an edit
 * would post a delta against a different baseline than the original charge.
 */
describe("computeOrderChargeAmount", () => {
  it("matches commissionGoodsTotal for commission orders", () => {
    const order = {
      orderType: "commission",
      itemPriceUsd: "20",
      commissionFeeUsd: "5",
      quantity: 3,
    };
    expect(computeOrderChargeAmount(order)).toBe(75);
    expect(computeOrderChargeAmount(order))
      .toBe(commissionGoodsTotal(order.itemPriceUsd, order.commissionFeeUsd, order.quantity));
  });

  it("leaves full-package orders on selling price × quantity", () => {
    // Untouched by this change — guards against over-applying the fix.
    expect(computeOrderChargeAmount({
      orderType: "full_package",
      sellingPriceUsd: "50",
      quantity: 2,
    })).toBe(100);
  });

  it("leaves purchase requests on selling price × quantity", () => {
    expect(computeOrderChargeAmount({
      orderType: "purchase_request",
      sellingPriceUsd: "30",
      quantity: 4,
    })).toBe(120);
  });

  it("returns 0 for an unknown order type", () => {
    expect(computeOrderChargeAmount({ orderType: "something_else", quantity: 2 })).toBe(0);
  });

  it("does not read commission fields for a full-package order", () => {
    // A stray commissionFeeUsd must not leak into an FP charge.
    expect(computeOrderChargeAmount({
      orderType: "full_package",
      sellingPriceUsd: "50",
      commissionFeeUsd: "999",
      quantity: 1,
    })).toBe(50);
  });
});
