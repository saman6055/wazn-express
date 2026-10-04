import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { unbilledOnReceiptUsd, accountCover } from "@shared/boxSettlement";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");

/*
 * 2026-10-04, AZ274 BOX-20260908-001: the $220 order was charged (goods
 * only), its $12.10 freight waits for the batch to be marked delivered — and
 * paying the box in full looked like $12.10 of credit. Proved on a real MySQL
 * with the real till: the box asks $249.24, takes it, posts the freight under
 * its order, marks the order, and the account ends at $0.00 with no credit.
 */
describe("an order's freight is charged at the till when its carton is paid", () => {
  it("the receipt counts it as a charge it posts itself", () => {
    const parcels = [
      { lineId: 1, packageId: 4540, fromOrder: true, notChargedYet: false, chargedUsd: 17.14, pendingFreightUsd: 0 },
      { lineId: 2, packageId: 5094, fromOrder: true, notChargedYet: false, chargedUsd: 232.1, pendingFreightUsd: 12.1 },
    ];
    expect(unbilledOnReceiptUsd(parcels, [])).toBe(12.1);
    expect(accountCover({ dueUsd: 249.24, balanceUsd: 237.14, toChargeUsd: unbilledOnReceiptUsd(parcels, []) }).cashDueUsd).toBe(249.24);
  });

  it("the till posts it under the order and marks the order, so the batch skips it", () => {
    const settle = read("db/boxSettlement.db.ts");
    expect(settle).toContain("if (only && onAccount && only.orderType === \"commission\" && !only.isShippingCharged && freight > 0) {");
    expect(settle).toContain("isShippingCharged: true,");
    // The batch's delivery charges an order's freight only when it is not.
    expect(read("routers/batches.router.ts")).toContain("if (fpOrder.orderType === 'commission' && share > 0 && !fpOrder.isShippingCharged) {");
  });
});

describe("the credit question says when an extra is not an extra", () => {
  it("both questions warn not to confirm a 'credit' on a box paid exactly", async () => {
    const { creditQuestion, creditHoldQuestion, CREDIT_NOT_EXTRA_HINT } = await import("@shared/creditGuard");
    const facts = { customerCode: "AZ274", owesUsd: 237.14, creditUsd: 12.1 } as never;
    expect(creditQuestion(facts)).toContain(CREDIT_NOT_EXTRA_HINT);
    expect(creditHoldQuestion(facts)).toContain(CREDIT_NOT_EXTRA_HINT);
    expect(CREDIT_NOT_EXTRA_HINT).toContain("«بەڵێ» مەکە");
  });
});

/*
 * A parcel with no price because its batch has none would leave the till at
 * $0 — the goods handed over free. Proved on a real MySQL: refused with the
 * parcel and batch named; held back, the rest of the box is paid and the
 * unpriced parcel stays uncharged, waiting for its price.
 */
describe("a parcel waiting for its batch's price is not handed over for nothing", () => {
  it("the receipt refuses it, naming the cure", () => {
    const settle = read("db/boxSettlement.db.ts");
    expect(settle).toContain("batchMissingSellingPrice(b, { hasTiers: !!b.useTieredPricing })");
    expect(settle).toContain("یان ئەم پاکەتانە «تەحدید» بکە (بمێننەوە) و پاکەتەکانی تر واصڵ بکە");
  });
});
