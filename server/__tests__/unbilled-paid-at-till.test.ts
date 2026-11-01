import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");

/*
 * 2026-10-04: of twenty arrived-but-unbilled orders, $250.62 sat in boxes the
 * till had already taken money for — billing them would charge the customers
 * twice. Proved on a real MySQL: the paid one names its receipt, only the
 * unpaid one is billed, the paid customer's account does not move.
 */
describe("goods paid at the till are never billed again", () => {
  const charging = read("db/orderCharging.db.ts");

  it("the list names the receipt that took the money", () => {
    expect(charging).toContain("paidOnReceipt: boxTracking ? (receiptOf.get(boxOf.get(boxTracking) ?? \"\") ?? null) : null,");
  });

  it("the bill refuses them, whatever the screen sends", () => {
    const bill = charging.slice(charging.indexOf("export async function billUnbilledOrders"));
    expect(bill.indexOf("paid_at_till:")).toBeLessThan(bill.indexOf("await chargeOrderAtCreation("));
  });

  it("the screen shows them and cannot tick them", () => {
    const section = read("../client/src/components/admin/UnbilledGoodsSection.tsx");
    expect(section).toContain("disabled={!!r.paidOnReceipt}");
    expect(section).toContain("new Set(billable.map((r) => r.orderId))");
  });

  it("the audit does not chase them as debts", () => {
    expect(read("services/auditSweep.service.ts")).toContain("JOIN boxSettlements s ON s.boxId = i2.boxId AND s.status = 'confirmed'");
  });
});
