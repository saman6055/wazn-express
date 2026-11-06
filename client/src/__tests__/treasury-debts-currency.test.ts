/** Treasury and company debts never add dinar to a dollar figure (2026-11-07). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");
describe("currency kept apart", () => {
  it("treasury totals come from the dollar-only server summary", () => {
    const page = read("client/src/pages/finance/Treasury.tsx");
    expect(page).toContain("const totalBalance = summary?.totalBalance ?? 0;");
    expect(page).not.toContain("accounts.reduce((sum, a) => sum + Number(a.currentBalance), 0)");
  });
  it("company debts sum each currency by itself", () => {
    const page = read("client/src/pages/finance/CompanyDebts.tsx");
    expect(page).toContain('const totalRemaining = sumIn("USD", "remainingAmount");');
    expect(page).not.toContain("debts.reduce((sum, d) => sum + Number(d.remainingAmount), 0)");
  });
  it("a debt payment is counted in the debt's own currency", () => {
    const db = read("server/db/finance.db.ts");
    expect(db).toContain("const paidInDebtCurrency = payCurrency === debtCurrency ? Number(data.amount) : Number(data.amountUsd);");
    expect(db).toContain("const newPaid = currentPaid + paidInDebtCurrency;");
  });
});
