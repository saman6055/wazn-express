import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

/**
 * Deleting a parcel takes its charge off the account with it (2026-10-02).
 * It used to remove the row and leave the debt. Proved on a real MySQL:
 * charged 22.55, corrected to 20, deleted → exactly 20 handed back; a parcel
 * paid on a box receipt is refused and nothing moves.
 */
describe("a deleted parcel leaves no debt behind", () => {
  const src = read("server/db/parcelDeletion.db.ts");

  it("the delete door goes through the function that reverses the charge", () => {
    const router = read("server/routers/packages.router.ts");
    expect(router).toContain("await db.deleteParcelWithItsCharges(input.id, ctx.user.id)");
    expect(router, "the bare delete must not come back to this door").not.toContain("await db.deletePackage(input.id)");
  });

  it("reverses and deletes in one transaction", () => {
    const tx = src.slice(src.indexOf("return db.transaction(async (tx) => {"));
    expect(tx).toContain("await reverseCharge(");
    expect(tx).toContain("await tx.delete(packages)");
    expect(tx.indexOf("await reverseCharge(")).toBeLessThan(tx.indexOf("await tx.delete(packages)"));
  });

  it("reads only this parcel's charges on its own customer's account", () => {
    expect(src).toContain("eq(ledgerTransactions.accountId, account.id)");
    expect(src).toContain('eq(ledgerTransactions.referenceType, "package")');
    // Commission freight carries the order's id in the same field.
    expect(src).toContain("startsWith(ORDER_FREIGHT_PREFIX)) continue;");
  });

  it("refuses a parcel already paid on a standing box receipt, before anything moves", () => {
    const refusal = src.indexOf('eq(boxSettlements.status, "confirmed")');
    expect(refusal).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(src.indexOf("return db.transaction(async (tx) => {"));
  });
});
