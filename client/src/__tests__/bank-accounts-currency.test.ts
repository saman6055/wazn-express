/** Bank accounts: a dinar wallet is never added to a dollar figure; every balance wears its own currency (2026-11-07). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const page = fs.readFileSync(path.resolve(__dirname, "../../..", "client/src/pages/finance/BankAccounts.tsx"), "utf8");
describe("bank accounts currency", () => {
  it("wallet total counts dollar wallets only", () => {
    expect(page).toContain("walletAccounts.filter(a => (a.currency ?? 'USD') === 'USD')");
  });
  it("balances are shown in their own currency", () => {
    expect(page).toContain("formatCurrency(acc.currentBalance, acc.currency)");
    expect(page).not.toContain("formatCurrency(acc.currentBalance)}");
  });
});
