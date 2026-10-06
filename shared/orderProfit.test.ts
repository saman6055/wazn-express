import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { orderProfitUsd, isLiveSale, ORDER_PROFIT_SQL, LIVE_SALE_SQL, NOT_A_SALE_STATUSES } from "./orderProfit";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

/**
 * One rule for what an order earns (2026-10-02). The stored figure counted a
 * commission order's fee for one unit; the reports summed it for every order
 * ever entered, cancelled and deleted ones included. Proved on a real MySQL:
 * 18 report figures, each to the cent.
 */
describe("what one order earns", () => {
  it("a commission order earns its fee on every unit", () => {
    expect(orderProfitUsd({ orderType: "commission", quantity: 5, commissionFeeUsd: "2" })).toBe(10);
    // The freight the customer was charged is income, not a cost of the goods
    // (on 1,321 real orders it equals the freight debit to the cent).
    expect(orderProfitUsd({ orderType: "commission", quantity: 5, commissionFeeUsd: "2", shippingCostUsd: "3.85" })).toBe(10);
    expect(orderProfitUsd({ orderType: "commission", quantity: 1, commissionFeeUsd: 2 })).toBe(2);
    expect(orderProfitUsd({ orderType: "commission", commissionFeeUsd: 2 }), "no quantity means one").toBe(2);
  });

  it("a full package earns the margin on every unit, less our shipping", () => {
    expect(orderProfitUsd({ orderType: "full_package", quantity: 2, sellingPriceUsd: 100, purchasePriceUsd: 70, shippingCostUsd: 10 })).toBe(50);
    expect(orderProfitUsd({ orderType: "purchase_request", quantity: 1, sellingPriceUsd: "30", purchasePriceUsd: "45" }), "a loss stays a loss").toBe(-15);
  });

  it("the SQL says the same thing", () => {
    expect(ORDER_PROFIT_SQL).toContain("commissionFeeUsd, 0) * GREATEST(COALESCE(quantity, 1), 1)");
    expect(ORDER_PROFIT_SQL).toContain("(COALESCE(sellingPriceUsd, 0) - COALESCE(purchasePriceUsd, 0)) * GREATEST(COALESCE(quantity, 1), 1)");
    expect(ORDER_PROFIT_SQL).toContain("- COALESCE(shippingCostUsd, 0)");
    // …and only on the full-package side.
    expect(ORDER_PROFIT_SQL.indexOf("- COALESCE(shippingCostUsd, 0)")).toBeGreaterThan(ORDER_PROFIT_SQL.indexOf("ELSE"));
  });
});

describe("what counts as a sale", () => {
  it("not an order that was undone, deleted, or only quoted", () => {
    for (const status of NOT_A_SALE_STATUSES) expect(isLiveSale({ status })).toBe(false);
    expect(isLiveSale({ status: "ordered", deletedAt: new Date() })).toBe(false);
    for (const status of ["pending", "ordered", "in_transit", "delivered"]) expect(isLiveSale({ status })).toBe(true);
  });

  it("the SQL filter names every one of them", () => {
    expect(LIVE_SALE_SQL).toContain("deletedAt IS NULL");
    for (const status of NOT_A_SALE_STATUSES) expect(LIVE_SALE_SQL).toContain(`'${status}'`);
  });
});

describe("every profit report uses the one rule", () => {
  const reports = read("server/db/reports.db.ts");

  it("no report sums the stored profit figure any more", () => {
    expect(reports).not.toMatch(/SUM\(profitUsd\)/);
    expect(reports).not.toContain("THEN profitUsd ELSE");
    expect(reports).not.toContain("parseFloat(order.profitUsd");
    expect(reports.match(/SUM\(\$\{sql\.raw\(ORDER_PROFIT_SQL\)\}\)/g)?.length).toBe(9);
  });

  it("every by-type selection leaves out what is not a sale", () => {
    const all = reports.match(/eq\(fullPackageOrders\.orderType, '(full_package|purchase_request|commission)'\),/g) ?? [];
    const filtered = reports.match(/eq\(fullPackageOrders\.orderType, '(full_package|purchase_request|commission)'\),\s*sql\.raw\(LIVE_SALE_SQL\),/g) ?? [];
    expect(all.length).toBe(7);
    expect(filtered.length, "a by-type selection without the live-sale filter").toBe(all.length);
  });

  it("parcel freight is profit only after the batch's cost, total or per unit", () => {
    // Refused goods are the last term (shared/refusedGoods): what was kept and how each piece ended.
    expect(reports).toContain("profit: fullPackage.profit + purchaseRequest.profit + commission.profit + pkgs.profit + stock.profitUsd,");
    expect(reports).not.toContain("commission.profit + pkgs.revenue,");
    // The batch's cost used to be worked out here in SQL, with the total as
    // the fallback. It is asked of the one rule now (shared/batchCost through
    // getBatchCostsByRule) — the total first, since 2026-10-05 — so a batch
    // recorded only by its total is still a cost, and the SQL copy is gone.
    expect(reports).toContain("const costsByRule = await getBatchCostsByRule(batchIds);");
    expect(reports).toContain("costByBatch.set(r.id, costsByRule.get(r.id)?.totalCostUsd ?? 0);");
    expect(reports).not.toContain("ELSE CAST(COALESCE(${batches.shippingCost}, 0) AS DECIMAL(12,2))");
  });

  it("money received is net of what was handed back, and reads a real column", () => {
    expect(reports).not.toContain("SUM(amount)");
    expect(reports.match(/COALESCE\(reversedAmountUsd, 0\) AS DECIMAL\(12,2\)\)\), 0\) as revenue/g)?.length).toBe(2);
  });

  it("the stored figure is written from the same rule", () => {
    const orders = read("server/db/fullPackage.db.ts");
    expect(orders.match(/profit = orderProfitUsd\(\{ orderType, quantity, commissionFeeUsd/g)?.length).toBe(2);
    expect(orders).not.toContain("profit = commissionFee - shippingCost;");
  });
});
