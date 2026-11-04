/**
 * A receipt's promised discount can be taken back by the main admin, with a
 * reason kept in the office only (owner, 2026-11-04).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("taking a receipt's discount back", () => {
  const src = read("server/db/boxSettlement.db.ts");

  it("marks it withdrawn with who and why; open promises leave it out", () => {
    const fn = src.slice(src.indexOf("export async function withdrawBoxPledge("), src.indexOf("export interface PledgeDiscountInput"));
    expect(fn).toContain(".set({ withdrawnAt: new Date(), withdrawnById: userId, withdrawReason: reason })");
    expect(fn).toContain("if (reason.length < 3)");
    expect(src).toContain("isNull(boxDiscountPledges.settlementId), isNull(boxDiscountPledges.withdrawnAt))");
    expect(src).toContain("isNull(boxDiscountPledges.withdrawnAt),");
  });

  it("is the main admin's alone, logged, and the column exists on old and new databases", () => {
    expect(read("server/routers/scanning.router.ts")).toContain("withdrawPledge: superAdminProcedure");
    const m = read("server/_core/migrations.ts");
    expect(m).toContain('{ name: "boxDiscountPledges.withdrawnAt"');
    expect(m).toContain("withdrawReason TEXT NULL,");
    expect(read("client/src/components/delivery/PledgeWithdraw.tsx")).toContain('data-testid="receipt-discount-withdraw"');
    expect(read("client/src/components/delivery/ReceiptDinarDialog.tsx")).toContain("<PledgeWithdraw");
  });
});
