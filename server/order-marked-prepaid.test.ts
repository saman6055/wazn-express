/**
 * An old order ticked "paid before" whose money never reached the books
 * (owner, 2026-10-28): the main admin clears the tick and its goods are
 * charged through the one charge path - never twice, never inside a box its
 * receipt closed.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("charging an order wrongly marked prepaid", () => {
  const src = read("server/db/orderCharging.db.ts");
  const fn = src.slice(src.indexOf("export async function chargeOrderMarkedPrepaid("));

  it("refuses goods already on the account", () => {
    expect(fn).toContain('inArray(ledgerTransactions.referenceType, ["commission", "full_package", "purchase_request"])');
    expect(fn).toContain("پێشتر لەسەر حیسابەکە نووسراوە");
  });

  it("refuses an order in a box its receipt closed - the box decides", () => {
    expect(fn).toContain("await goodsInReceiptedBoxes({ orderIds: [order.id]");
  });

  it("clears the prepaid tick, then charges through chargeOrderAtCreation", () => {
    expect(fn.indexOf("isPrepaid: false,")).toBeGreaterThan(0);
    expect(fn.indexOf("isPrepaid: false,")).toBeLessThan(fn.indexOf("await chargeOrderAtCreation(fresh as never, userId)"));
  });

  it("is the main admin's, with a reason, audited", () => {
    const router = read("server/routers/finance.router.ts");
    expect(router).toContain("chargeOrderMarkedPrepaid: superAdminProcedure");
    expect(router).toContain('action: "charge_order_marked_prepaid"');
  });
});

describe("the main admin has the button on both order lists", () => {
  it("shown only on an order carrying the prepaid tick", () => {
    const ui = read("client/src/components/orders/OrderOutcome.tsx");
    expect(ui).toContain("if (!isMainAdmin || !order.isPrepaid || ENDED.includes(order.status)) return null;");
    expect(ui).toContain("trpc.ledger.chargeOrderMarkedPrepaid.useMutation(");
    expect(read("client/src/pages/CommissionOrders.tsx")).toContain("<PrepaidFixMenuItem order={order as any}");
    expect(read("client/src/pages/FullPackageDashboard.tsx")).toContain("<PrepaidFixMenuItem order={order as any}");
  });
});
