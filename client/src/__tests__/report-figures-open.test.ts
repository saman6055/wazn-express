import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { monthWindow, orderHref, yearWindow } from "@/components/reports/OrderProfitDrill";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

/*
 * The owner's standing rule (2026-11-02): a figure on a report opens the
 * records it came from. A static stat card is a defect.
 */
describe("a report's figures open what they were added up from", () => {
  const PAGES = [
    "pages/reports/CustomerPricingReport.tsx",
    "pages/reports/MonthlyProfitReport.tsx",
    "pages/reports/UnifiedProfitDashboard.tsx",
    "pages/reports/ScanReports.tsx",
    "pages/reports/ServiceProfitReport.tsx",
    "pages/reports/FinancialReports.tsx",
    "pages/reports/BusinessAnalytics.tsx",
    "pages/reports/ProfitDashboard.tsx",
    "pages/reports/ProfitLossReport.tsx",
    "pages/reports/ProfitReports.tsx",
    "pages/reports/InvoiceReports.tsx",
    "pages/reports/BatchReports.tsx",
    "pages/reports/BatchFinancialReportFull.tsx",
    "pages/reports/BatchFinancialReport.tsx",
    "pages/dashboard/AccountantDashboard.tsx",
    "pages/dashboard/StaffDashboard.tsx",
  ];

  it.each(PAGES)("%s has clickable cards", (page) => {
    expect(read(page)).toContain("DRILL_CARD");
  });

  it("every link out of a report opens a new tab", () => {
    const sheet = read("components/reports/ReportDrillSheet.tsx");
    const link = sheet.slice(sheet.indexOf("export function RecordLink"), sheet.indexOf("export interface DrillColumn"));
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
    expect(link).not.toContain("<Link");
    // wouter's Link ignores target, so a record link must stay a plain anchor.
    for (const page of ["pages/reports/ProfitDashboard.tsx", "pages/reports/BatchReports.tsx", "pages/dashboard/StaffDashboard.tsx"]) {
      expect(read(page), page).not.toContain("<Link href={`/batches");
      expect(read(page), page).not.toContain("<Link href={`/reports/batch-financial");
    }
  });

  it("a total comes from the rows on the sheet, never from elsewhere", () => {
    const sheet = read("components/reports/ReportDrillSheet.tsx");
    expect(sheet).toContain("c.total?.(rows)");
  });

  it("a sheet read from a second query says so when it disagrees with the card", () => {
    expect(read("components/reports/OrderProfitDrill.tsx")).toContain("order-profit-drill-differs");
    expect(read("components/reports/ExpensesDrill.tsx")).toContain("expenses-drill-differs");
    expect(read("components/reports/InvoiceDrill.tsx")).toContain("invoice-drill-differs");
  });

  it("the orders sheet keeps the live sales the totals counted", () => {
    expect(read("components/reports/OrderProfitDrill.tsx")).toContain("isLiveSale(o)");
  });
});

describe("the window the orders are read over", () => {
  it("is the server's month, not the browser's", () => {
    const { startDate, endDate } = monthWindow(2026, 2);
    expect(startDate.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(endDate.toISOString()).toBe("2026-02-28T23:59:59.000Z");
  });

  it("is the server's year", () => {
    const { startDate, endDate } = yearWindow(2026);
    expect(startDate.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(endDate.toISOString()).toBe("2026-12-31T23:59:59.000Z");
  });
});

describe("an order's address", () => {
  it("follows its type", () => {
    expect(orderHref({ id: 7, orderType: "commission" })).toBe("/commission/7");
    expect(orderHref({ id: 7, orderType: "full_package" })).toBe("/full-package/7");
  });
});
