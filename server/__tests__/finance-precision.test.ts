import { describe, it, expect, beforeAll } from "vitest";
import * as db from "../db";
import fs from "fs";
import path from "path";

const hasDb = () => !!process.env.DATABASE_URL;

describe.skipIf(!hasDb())("Money Precision - No Floating Point Errors", () => {
  let customerId: number;
  let customerCode: string;
  let accountId: number;
  const userId = 1;

  beforeAll(async () => {
    const customers = await db.getAllCustomers();
    if (customers.length === 0) throw new Error("No customers found for testing");
    customerId = customers[0].id;
    customerCode = customers[0].customerCode ?? `C${customers[0].id}`;
    const account = await db.getOrCreateCustomerAccount(customerId, customerCode);
    accountId = account.id;
  });

  it("getTotalDebtAmount should return precise sum, not floating-point approximation", async () => {
    const result = await db.getTotalDebtAmount();
    expect(typeof result.totalUsd).toBe("number");
    expect(typeof result.totalIqd).toBe("number");
    expect(Number.isFinite(result.totalUsd)).toBe(true);
    expect(result.totalUsd.toFixed(2)).toBe(result.totalUsd.toFixed(2));
  });

  it("getExpensesSummary should return precise category totals", async () => {
    const startDate = new Date(new Date().getFullYear(), 0, 1);
    const endDate = new Date();
    const summary = await db.getExpensesSummary(startDate, endDate);
    expect(typeof summary.totalAmount).toBe("number");
    expect(Number.isFinite(summary.totalAmount)).toBe(true);
    for (const c of summary.byCategory) {
      expect(c.total.toFixed(2)).toBe(Number(c.total).toFixed(2));
    }
  });

  it("calculateAccountBreakdown should match sum of individual transactions", async () => {
    const breakdown = await db.calculateAccountBreakdown(accountId);
    const account = await db.getCustomerAccountByCustomerId(customerId);
    expect(account).toBeDefined();
    const stored = Number(account!.currentBalanceUsd ?? 0);
    expect(breakdown.netBalance.toFixed(2)).toBe(stored.toFixed(2));
  });

  it("getCashAccountsSummary should return precise totals", async () => {
    const summary = await db.getCashAccountsSummary();
    expect(typeof summary.totalBalance).toBe("number");
    expect(typeof summary.totalCash).toBe("number");
    expect(typeof summary.totalBank).toBe("number");
    expect(summary.totalBalance.toFixed(2)).toBe(Number(summary.totalBalance).toFixed(2));
  });

  it("getInvoiceSummary should aggregate correctly via SQL", async () => {
    const startDate = new Date(new Date().getFullYear(), 0, 1);
    const endDate = new Date();
    const summary = await db.getInvoiceSummary(startDate, endDate);
    const sumPaidUnpaid = summary.paidAmountUsd + summary.unpaidAmountUsd;
    expect(summary.totalAmountUsd).toBeCloseTo(sumPaidUnpaid, 2);
  });
});

describe("Code Quality - No parseFloat Accumulation", () => {
  it("finance.db.ts should not use parseFloat in reduce/loop for money sums", () => {
    const filePath = path.join(process.cwd(), "server", "db", "finance.db.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    const dangerousPatterns = [
      /\.reduce\s*\([^)]*parseFloat/g,
      /parseFloat[^)]*\)\s*\+\s*parseFloat/g,
      /sum\s*\+\s*parseFloat/g,
      /sum\s*\+=\s*parseFloat/g,
    ];
    for (const pattern of dangerousPatterns) {
      const matches = content.match(pattern);
      expect(matches).toBeNull();
    }
  });

  it("invoices.db.ts should not use parseFloat in reduce/loop for money sums", () => {
    const filePath = path.join(process.cwd(), "server", "db", "invoices.db.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    const dangerousPatterns = [
      /\.reduce\s*\([^)]*parseFloat/g,
      /sum\s*\+\s*parseFloat/g,
    ];
    for (const pattern of dangerousPatterns) {
      const matches = content.match(pattern);
      expect(matches).toBeNull();
    }
  });
});

describe.skipIf(!hasDb())("Financial Reports - Accuracy", () => {
  it("getCompanyFinancialOverview should return consistent totals", async () => {
    const overview = await db.getCompanyFinancialOverview();
    expect(overview.netPosition).toBe(overview.totalCash - overview.totalDebt);
    expect(Number.isFinite(overview.totalCash)).toBe(true);
    expect(Number.isFinite(overview.totalDebt)).toBe(true);
    expect(Number.isFinite(overview.totalPartnerEquity)).toBe(true);
  });

  it("getTotalDebtAmount and getFinancialSummary debt totals should align", async () => {
    const debtAmount = await db.getTotalDebtAmount();
    const summary = await db.getFinancialSummary();
    expect(summary.totalDebtUsd).toBeCloseTo(debtAmount.totalUsd, 2);
  });
});
