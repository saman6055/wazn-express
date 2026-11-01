import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's audit (2026-09-16, AZ002): the staff profile, the portal and the
 * statement PDF each worked out "paid" and "sales" their own way, and none of
 * them added up to the balance. They now read one statement
 * (shared/accountStatement.ts via getAccountStatementForCustomer). These fail
 * if a screen goes back to summing on its own.
 */
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

function body(source: string, start: string, length = 2500): string {
  const at = source.indexOf(start);
  expect(at, `"${start}" is gone — update this test, do not delete it`).toBeGreaterThan(-1);
  return source.slice(at, at + length);
}

describe("every screen reads the one statement", () => {
  it("the portal's summary", () => {
    const summary = body(read("db/portal.db.ts"), "export async function getCustomerFinancialSummary");
    expect(summary).toContain("getAccountStatementForCustomer(customerId)");
    expect(summary).toContain("totalPaid: statement.paymentsUsd");
    expect(summary).not.toMatch(/SUM\(\$\{paymentRecords\.amountUsd\}/);
  });

  it("the statement PDF's summary strip", () => {
    const report = body(read("services/pdfReports.ts"), "export async function getCustomerReportData", 12000);
    expect(report).toContain("getAccountStatementForCustomer(customerId)");
    expect(report).toContain("totalPayments: statement.paymentsUsd");
    expect(report).not.toContain("LIKE 'DEBIT_%'");
  });

  it("the staff profile, its print and its spreadsheet", () => {
    const page = read("../client/src/pages/CustomerFinance.tsx");
    expect(page).toContain("trpc.ledger.getAccountStatement.useQuery(");
    expect(page).not.toContain("trpc.ledger.getAccountBreakdown.useQuery(");
    expect(page).toContain("<AccountStatementSummary statement={breakdown.statement}");
    // print and spreadsheet print the same line as the screen
    expect(page.match(/statementTerms\(breakdown\.statement\)/g)?.length).toBe(2);
    // and no card re-adds the old "every credit is a payment" figure
    expect(page).not.toMatch(/creditBalance|totalDebt\b/);

    const summary = read("../client/src/components/finance/AccountStatementSummary.tsx");
    expect(summary).toContain("statementTerms(statement)");
    expect(summary).toContain('data-testid="statement-equation"');
  });

  it("the old breakdown answers from the statement too", () => {
    const breakdown = body(read("db/finance.db.ts"), "export async function calculateAccountBreakdown");
    expect(breakdown).toContain("getAccountStatementForCustomer(account.customerId)");
  });
});

describe("checking a balance counts every row that moved it", () => {
  it("adjustments included, so a correct account is never 'repaired' into a wrong one", () => {
    const validate = body(read("db/finance.db.ts"), "export async function validateAccountBalance");
    expect(validate).toContain("[...CHARGE_TX_TYPES]");
    expect(validate).toContain("[...PAYMENT_TX_TYPES]");
    expect(validate).not.toContain("LIKE 'DEBIT%'");
    expect(validate).not.toContain("LIKE 'CREDIT%'");
  });
});
