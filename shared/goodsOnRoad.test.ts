import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { paidBeforeReason, roadAgeKey, roadByAge, roadTotals, type RoadRow } from "./goodsOnRoad";

/**
 * Goods on the road, one by one (owner, 2026-10-07) — and closing one never
 * makes a false debt: "if it arrived and the customer has it, the money was
 * taken too, especially an old one".
 *
 * What would undo it: the close button charging without asking, a default
 * answer, a cancelled order becoming a debt, "paid before" showing up as
 * money received today, or the list and the working-capital figure counting
 * different orders.
 */

const root = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

const row = (over: Partial<RoadRow>): RoadRow => ({
  orderId: 1, orderCode: "CM-1", orderType: "commission", status: "ordered", createdAt: null, days: 0,
  customerId: 1, customerCode: "AZ001", customerName: "A", productName: "x", quantity: 1,
  buyUsd: 10, sellUsd: 12, onAccount: false, trackingNumber: null, ...over,
});

describe("totals by age", () => {
  it("puts each order in one bucket by the days since it was entered", () => {
    expect([0, 7, 8, 30, 31, 90, 91, 400].map(roadAgeKey)).toEqual(["week", "week", "month", "month", "quarter", "quarter", "older", "older"]);
  });

  it("the buckets add up to the whole", () => {
    const rows = [row({ days: 3, buyUsd: 10, sellUsd: 12 }), row({ days: 20, buyUsd: 30.1, sellUsd: 36.2 }), row({ days: 75, buyUsd: 816.3, sellUsd: 924.3 }), row({ days: 200, buyUsd: 5, sellUsd: 6 })];
    const whole = roadTotals(rows);
    const parts = roadByAge(rows);
    expect(parts.map((p) => p.count)).toEqual([1, 1, 1, 1]);
    expect(Math.round(parts.reduce((s, p) => s + p.sellUsd, 0) * 100) / 100).toBe(whole.sellUsd);
    expect(whole).toEqual({ count: 4, buyUsd: 861.4, sellUsd: 978.5 });
  });
});

describe("closing an order asks whether it was paid", () => {
  const db = root("server/db/goodsOnRoad.db.ts");
  const close = db.slice(db.indexOf("export async function closeOrderOnRoad"));
  const page = root("client/src/pages/GoodsOnRoad.tsx");

  it("charges through the one door, so nothing is billed twice", () => {
    expect(close).toContain("chargeOrderAtCreation(order, userId)");
    expect(close).toContain("if (order.isCharged || order.chargeTransactionId)");
  });

  it("refuses an order that is not a live sale", () => {
    expect(close).toContain("if (!isLiveSale(order))");
    expect(close.indexOf("if (!isLiveSale(order))")).toBeLessThan(close.indexOf("chargeOrderAtCreation(order, userId)"));
  });

  it("paid before: the same amount comes straight off, with a line that says why", () => {
    expect(close).toContain('adjustCustomerBalance(order.customerId, customer.customerCode, charge.amount, "credit", paidBeforeReason(order.orderCode), userId)');
    expect(paidBeforeReason("CM-9")).toContain("پێشتر دراوە");
    expect(paidBeforeReason("CM-9")).toContain("CM-9");
  });

  it("is never money received today: no payment record is written", () => {
    expect(db).not.toContain("paymentRecords");
    expect(db).not.toContain("recordPaymentReceived");
  });

  it("no answer is chosen for him, and not knowing changes nothing", () => {
    expect(page).toContain("setClosing({ row: r, paid: null })");
    expect(page).toContain("disabled={!closing.paid || close.isPending}");
    expect(page).toContain("onClick={() => setClosing(null)}");
  });

  it("only the main admin can close one", () => {
    expect(root("server/routers/finance.router.ts")).toContain("closeOrderOnRoad: superAdminProcedure");
    expect(page).toContain("isMainAdmin && !r.onAccount");
  });
});

describe("the list is the working-capital figure's own", () => {
  it("both count live orders that are not on an account, priced by the same rule", () => {
    const list = root("server/db/goodsOnRoad.db.ts");
    const capital = root("server/db/workingCapital.db.ts");
    for (const src of [list, capital]) {
      expect(src).toContain("LIVE_SALE_SQL");
      expect(src).toContain("isCharged}, 0) = 0");
    }
    expect(root("client/src/pages/WorkingCapital.tsx")).toContain('href="/finance/goods-on-road"');
    expect(root("client/src/App.tsx")).toContain('path="/finance/goods-on-road"');
  });
});
