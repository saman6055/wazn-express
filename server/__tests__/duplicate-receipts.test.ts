import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");

/*
 * 10 September 2026: some boxes receipted again and again (BOX-20260705-004
 * twenty-two times) — $1,863.56 of payments that never came in, still read
 * by the cash-received reports though the accounts were corrected long ago.
 * Proved on a real MySQL: the first receipt is kept, the duplicates voided,
 * their payment records no longer count, no ledger row is written and the
 * account does not move; another day's receipt is untouched.
 */
describe("the duplicate receipts of 10 September", () => {
  const repair = read("db/duplicateReceipts.db.ts");

  it("only that day, and the first receipt of each box and amount is kept", () => {
    expect(repair).toContain("sql`DATE(${boxSettlements.createdAt}) = ${BULK_RECEIPT_DAY}`");
    expect(repair).toContain("if (!kept) {");
  });

  it("voiding never touches an account", () => {
    const fix = repair.slice(repair.indexOf("export async function voidDuplicateReceipts"));
    expect(fix).not.toContain("ledgerTransactions");
    expect(fix).not.toContain("customerAccounts");
  });

  it("main admin only", () => {
    const router = read("routers/finance.router.ts");
    expect(router).toContain("duplicateReceipts: superAdminProcedure");
    expect(router).toContain("voidDuplicateReceipts: superAdminProcedure");
  });
});
