import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isOrderChargeText, planCleanup, type CleanupFacts } from "./batchCleanup";

/**
 * Owner, 2026-10-04: "tell me which ones, put a tick beside each, and let them
 * go with the batch." Proved end to end on a real MySQL with AIR-2026-007's
 * shape (receipt, charged parcels, box, invoices, an order's freight under a
 * parcel's id): 16 checks, the account ending exactly where the window said.
 */
const facts = (over: Partial<CleanupFacts> = {}): CleanupFacts => ({
  batch: { id: 31, code: "AIR-2026-007", status: "closed" },
  receipts: [{ id: 5, number: "RCP-1", boxId: 26, boxCode: "BOX-1", customerId: 1, putBackUsd: 50, eligible: true }],
  parcels: [
    { id: 101, code: "P101", tracking: "68", customerId: 1, weightKg: 3, priceUsd: 36, chargedUsd: 36, receiptIds: [5], boxIds: [26], eligible: true },
    { id: 103, code: "UNC-1", tracking: "556", customerId: 1, weightKg: 224, priceUsd: 2688, chargedUsd: 0, receiptIds: [], boxIds: [], eligible: true },
  ],
  boxes: [{ id: 26, code: "BOX-1", status: "delivered", customerId: 1, parcelIds: [101], foreignItems: 0, receiptIds: [5], eligible: true }],
  invoices: [{ id: 662, number: "INV-1", totalUsd: 36, status: "issued" }],
  liveOrders: 0,
  customers: [{ id: 1, code: "AZ003", balanceUsd: 10 }],
  ...over,
});
const none = { receiptIds: [], parcelIds: [], boxIds: [], invoiceIds: [] };

describe("what may go together", () => {
  it("nothing ticked: only the batch goes, nothing moves on any account", () => {
    expect(planCleanup(facts(), none)).toEqual({ problems: [], effects: [] });
  });

  it("a paid parcel goes only with its receipt", () => {
    expect(planCleanup(facts(), { ...none, parcelIds: [101] }).problems.join()).toContain("RCP-1");
    expect(planCleanup(facts(), { ...none, parcelIds: [101], receiptIds: [5] }).problems).toEqual([]);
  });

  it("a box goes only empty of this batch's parcels and with its receipts undone", () => {
    const p = planCleanup(facts(), { ...none, boxIds: [26] }).problems.join();
    expect(p).toContain("پاکەت");
    expect(p).toContain("وەسڵ");
  });

  it("a box holding another batch's parcels is not offered", () => {
    const mixed = facts({ boxes: [{ ...facts().boxes[0], foreignItems: 2, eligible: false, why: "x" }] });
    expect(planCleanup(mixed, { ...none, boxIds: [26] }).problems.length).toBeGreaterThan(0);
  });

  it("nothing may leave a customer in credit", () => {
    // Balance $10; deleting a $36 charge with no receipt undone would make $26 credit.
    const f = facts({ parcels: [{ ...facts().parcels[0], receiptIds: [] }] });
    const plan = planCleanup(f, { ...none, parcelIds: [101] });
    expect(plan.effects[0]).toMatchObject({ code: "AZ003", beforeUsd: 10, afterUsd: -26 });
    expect(plan.problems.join()).toContain("کریدیت");
  });

  it("every account touched shows before and after", () => {
    const plan = planCleanup(facts(), { receiptIds: [5], parcelIds: [101, 103], boxIds: [26], invoiceIds: [662] });
    expect(plan.problems).toEqual([]);
    expect(plan.effects).toEqual([{ customerId: 1, code: "AZ003", beforeUsd: 10, afterUsd: 24 }]);
  });
});

describe("an order's charge is never taken for a parcel's", () => {
  it("both wordings, and anything naming an order code", () => {
    expect(isOrderChargeText("کڕین بە عمولە CM-MOPKN7GB - کرێی گواستنەوە")).toBe(true);
    expect(isOrderChargeText("کڕین بە تێچوو CM-MR68DAYF - کرێی گواستنەوە")).toBe(true);
    expect(isOrderChargeText("پاکەت 68 - باچ AIR-2026-007")).toBe(false);
  });

  it("parcel deletion uses the same rule", () => {
    const src = readFileSync(resolve(__dirname, "..", "server/db/parcelDeletion.db.ts"), "utf8");
    expect(src).toContain("if (isOrderChargeText(charge.description)");
  });
});

describe("the server works in the one safe order, after checking the whole plan", () => {
  const router = readFileSync(resolve(__dirname, "..", "server/routers/batches.router.ts"), "utf8");
  const door = router.slice(router.indexOf("deleteWithTies: superAdminProcedure"), router.indexOf("updateStatus: staffProcedure"));

  it("main admin only, and nothing moves if the plan is refused", () => {
    expect(door).toContain("deleteWithTies: superAdminProcedure");
    expect(door.indexOf("cleanupRefusal(plan.problems)")).toBeLessThan(door.indexOf("db.reverseBoxSettlement("));
  });

  it("receipts, then parcels, then boxes, then invoices, then the batch", () => {
    const at = (s: string) => door.indexOf(s);
    expect(at("db.reverseBoxSettlement(")).toBeLessThan(at("db.deleteParcelWithItsCharges("));
    expect(at("db.deleteParcelWithItsCharges(")).toBeLessThan(at("db.deleteDeliveryBoxWithItems("));
    expect(at("db.deleteDeliveryBoxWithItems(")).toBeLessThan(at("db.cancelInvoiceForCleanup("));
    expect(at("db.cancelInvoiceForCleanup(")).toBeLessThan(at("db.deleteBatch("));
  });

  it("boxes and the batch go to the bin", () => {
    expect(door.match(/db\.recordDeletion\(/g)?.length).toBe(2);
  });
});
