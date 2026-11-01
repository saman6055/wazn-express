import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * On the finance page everything opens its details (owner, 2026-09-10: "I
 * want to click anything and get its details, not just see it").
 *
 * The trap is the destination: a figure that opens a list which does not add
 * up to it is worse than no link. So each figure opens the list built on the
 * same rule as the figure, with the page's other filters cleared, and this
 * test reads both sides.
 */

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const page = read("client/src/pages/Finance.tsx");

function between(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  expect(a, `marker not found: ${start}`).toBeGreaterThan(-1);
  const b = src.indexOf(end, a + start.length);
  expect(b, `end marker not found after ${start}: ${end}`).toBeGreaterThan(-1);
  return src.slice(a, b);
}

describe("each figure opens the list that adds up to it", () => {
  const summary = between(read("server/db/finance.db.ts"), "export async function getFinancialSummary(", "\n}\n");

  it("total debt opens the debtors: balance above zero, both sides", () => {
    expect(page).toContain("{...clickable(() => openAccounts('debtors'))} data-testid=\"finance-card-debt\"");
    expect(page).toContain("case 'debtors':\n          return balanceUsd > 0;");
    expect(summary).toMatch(/totalDebtUsd: sql<string>`COALESCE\(SUM\(CASE WHEN CAST\(\$\{customerAccounts\.currentBalanceUsd\} AS DECIMAL\(12,2\)\) > 0/);
  });

  it("total credit opens the credit customers: balance below zero, both sides", () => {
    expect(page).toContain("{...clickable(openCredit)} data-testid=\"finance-card-credit\"");
    expect(page).toContain("if (balanceUsd >= 0) return false;");
    expect(summary).toMatch(/totalCreditUsd: sql<string>`COALESCE\(SUM\(CASE WHEN CAST\(\$\{customerAccounts\.currentBalanceUsd\} AS DECIMAL\(12,2\)\) < 0/);
  });

  it("total accounts opens every account", () => {
    expect(page).toContain("{...clickable(() => openAccounts('all'))} data-testid=\"finance-card-accounts\"");
  });

  it("net balance shows its two parts, each opening its own list", () => {
    const net = between(page, 'data-testid="finance-net-breakdown"', "</PopoverContent>");
    expect(net).toContain("openAccounts('debtors')");
    expect(net).toContain("openCredit()");
  });

  it("nothing else is left narrowing the list a figure opens", () => {
    const accountsOpen = between(page, "const openAccounts = (filter: AccountFilter) => {", "};");
    expect(accountsOpen).toContain('setSearchQuery("")');
    const creditOpen = between(page, "const openCredit = () => {", "};");
    for (const reset of ['setCreditSearch("")', 'setCreditMinAmount("")', 'setCreditMaxAmount("")']) expect(creditOpen).toContain(reset);
  });
});

describe("each figure says what it counts", () => {
  it("the credit figure is not called payments", () => {
    expect(page).not.toContain('ku: "کۆی پارەدان", en: "Total paid"');
    expect(page).toContain("{summary?.creditorsCount || 0}");
  });

  it("all accounts are not called active", () => {
    expect(page).not.toContain('ku: "حسابی چالاک"');
  });

  it("the latest transactions are not called the total balance", () => {
    expect(page).not.toContain('ku: "کۆی باڵانس", en: "Recent transactions"');
  });
});

describe("customers and transactions open", () => {
  it("every customer row and debtor card opens the customer's account", () => {
    const rows = page.split("{...clickable(() => openCustomer(account.customerId))}").length - 1;
    expect(rows, "overview, accounts tab and credit tab rows").toBe(3);
    expect(page).toContain("{...clickable(() => openCustomer(debtor.customerId))}");
    expect(page).toContain("setLocation(`/finance/customer/${customerId}`)");
    expect(page).not.toContain("<Link href={`/customers/${account.customer?.id}`}>");
  });

  it("every transaction and payment opens its details", () => {
    expect(page).toContain("{...clickable(() => setOpenTx({ ...tx,");
    expect(page).toContain("{...clickable(() => setOpenTx({ ...payment, customer }))}");
    expect(page).toContain("<TransactionDetailDialog");
  });

  it("the detail window leads on to the customer's whole account", () => {
    const dialog = read("client/src/components/finance/TransactionDetailDialog.tsx");
    expect(dialog).toContain("<Link href={`/finance/customer/${customer.id}`}");
    expect(dialog).toContain("balanceBeforeUsd");
    expect(dialog).toContain("balanceAfterUsd");
  });

  it("a keyboard opens what a mouse opens", () => {
    const helper = between(page, "const clickable = (open: () => void) => ({", "});");
    expect(helper).toContain('e.key === "Enter"');
    expect(helper).toContain("tabIndex: 0");
  });
});
