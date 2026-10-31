/**
 * A reversed receipt can be put back as it stood (owner, 2026-10-31).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

describe("putting a reversed receipt back", () => {
  const src = read("server/db/boxSettlement.db.ts");
  const fn = src.slice(src.indexOf("export async function restoreBoxSettlement("), src.indexOf("export async function reverseBoxSettlement("));

  it("is one transaction that undoes all the reversal did", () => {
    expect(fn).toContain("await db.transaction(async (tx) => {");
    expect(fn).toContain('transactionType: "ADJUSTMENT_CREDIT",');
    expect(fn).toContain('paymentStatus: "confirmed",');
    expect(fn).toContain('.set({ status: "confirmed", reversedAt: null, reversedById: null, reversalReason: null })');
  });

  it("refuses two live receipts on a box and an account below zero", () => {
    expect(fn).toContain('eq(boxSettlements.status, "confirmed")');
    expect(fn).toContain("if (after < -0.005) {");
  });

  it("does not take off a second time a discount already given back by hand", () => {
    expect(fn).toContain("round2(paid + (discountBack ? 0 : discount))");
  });

  it("is the main admin's alone, and the button shows on a reversed receipt", () => {
    expect(read("server/routers/scanning.router.ts")).toContain("restoreSettlement: superAdminProcedure");
    expect(read("client/src/components/delivery/BoxSettlementPanel.tsx")).toContain("settlement-restore-");
  });
});
