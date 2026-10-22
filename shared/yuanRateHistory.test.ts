import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildYuanRateHistory, rateGainUsd } from "./yuanRateHistory";

const order = (o: Partial<Parameters<typeof buildYuanRateHistory>[1][number]>) => ({
  orderType: "commission", quantity: 1, itemPriceUsd: null, itemPriceCny: null, purchasePriceUsd: null, purchasePriceCny: null, createdAt: "2026-10-01T00:00:00.000Z", ...o,
});

describe("yuan rate history (owner, 2026-10-22)", () => {
  const rates = [
    { id: 1, rate: 7, effectiveFrom: "2026-09-01T00:00:00.000Z", createdByName: "A" },
    { id: 2, rate: 6.4, effectiveFrom: "2026-10-21T00:00:00.000Z", createdByName: "B" },
  ];

  it("each order counts in the period it was entered in, newest first", () => {
    const h = buildYuanRateHistory(rates, [
      order({ itemPriceUsd: 10, itemPriceCny: 70, quantity: 2, createdAt: "2026-10-01T00:00:00.000Z" }),
      order({ orderType: "full_package", purchasePriceUsd: 5, createdAt: "2026-10-22T00:00:00.000Z" }),
      order({ itemPriceUsd: 1, createdAt: "2026-08-01T00:00:00.000Z" }),
    ]);
    expect(h.map((p) => p.rateId)).toEqual([2, 1, null]);
    expect(h[0]).toMatchObject({ orders: 1, usd: 5, yuan: 32, estimatedOrders: 1, to: null, setBy: "B" });
    expect(h[1]).toMatchObject({ orders: 1, usd: 20, yuan: 140, estimatedOrders: 0, to: "2026-10-21T00:00:00.000Z" });
    expect(h[2]).toMatchObject({ orders: 1, usd: 1, yuan: 7, estimatedOrders: 1 });
  });

  it("an order with no price is not counted", () => {
    expect(buildYuanRateHistory(rates, [order({})]).every((p) => p.orders === 0)).toBe(true);
  });

  it("gain = dollars charged less the yuan at its real rate", () => {
    expect(rateGainUsd({ usd: 100, yuan: 640 }, 6.4)).toBe(0);
    expect(rateGainUsd({ usd: 100, yuan: 700 }, 6.4)).toBe(-9.37);
    expect(rateGainUsd({ usd: 100, yuan: 700 }, 0)).toBeNull();
  });

  it("the three order forms send the yuan with a new order", () => {
    expect(readFileSync("client/src/pages/CommissionForm.tsx", "utf8")).toContain("itemPriceCny: parseFloat(rmbPerUnit) > 0");
    expect(readFileSync("client/src/pages/FullPackageForm.tsx", "utf8")).toContain("purchasePriceCny: parseFloat(rmbPerUnit) > 0");
    expect(readFileSync("client/src/pages/BulkOrderForm.tsx", "utf8")).toContain("itemPriceCny: isCommission && parseFloat(item.itemPriceCny) > 0");
  });

  it("the page is registered, gated and linked from Settings", () => {
    expect(readFileSync("client/src/App.tsx", "utf8")).toContain('<Route path="/finance/yuan-rates" component={YuanRateHistory} />');
    expect(readFileSync("shared/permissions.ts", "utf8")).toContain('"/finance/yuan-rates": "balance_sheet"');
    expect(readFileSync("shared/financeAccess.ts", "utf8")).toContain('"/finance/yuan-rates"');
    expect(readFileSync("client/src/pages/Settings.tsx", "utf8")).toContain('href="/finance/yuan-rates"');
  });

  it("the history only reads: it never writes an order", () => {
    const src = readFileSync("server/db/yuanRateHistory.db.ts", "utf8");
    expect(src).not.toMatch(/\.(update|insert|delete)\(/);
  });
});
