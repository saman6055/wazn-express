import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");

/*
 * 2026-10-03: five pages, five profits for the same month. Proved on a real
 * MySQL: the profit report, the expenses page's window and the company
 * dashboard give the same September ($65), a batch with no cost waits, a sea
 * batch opened this month is not a loss, and expenses come off once.
 */
describe("one profit rule for every page", () => {
  const reports = read("server/db/reports.db.ts");

  it("the monthly report reads the period function", () => {
    expect(reports).toContain("const { fullPackage, purchaseRequest, commission, pkgs, total } = await getProfitForPeriod(startDate, endDate);");
  });

  it("the company dashboard reads the same rows and the same orders", () => {
    const dash = reports.slice(reports.indexOf("export async function getBatchProfitByShippingType"), reports.indexOf("export async function getFullPackageProfitBreakdown"));
    expect(dash).toContain("await getBatchProfitRowsInPeriod(db, startDate, endDate)");
    expect(dash).not.toContain("gte(batches.createdAt, startDate)");
    expect(reports).toContain("const p = await getProfitForPeriod(startDate, endDate);");
  });

  it("the trend subtracts expenses from profit, not from turnover", () => {
    const trend = reports.slice(reports.indexOf("export async function getMonthlyTrendData"), reports.indexOf("export async function getActivityStats"));
    expect(trend).toContain("const p = await getProfitForPeriod(m.startDate, m.endDate);");
    expect(trend).not.toContain("LIKE 'DEBIT_%'");
  });

  it("the expenses page and the two report pages in the browser use it too", () => {
    expect(read("server/routers/finance.router.ts")).toContain("db.getProfitForPeriod(startDate, endDate),");
    expect(read("client/src/pages/MonthlyProfitReport.tsx")).toContain("trpc.fullPackage.getMonthlyProfitReport.useQuery({ year: selectedYear })");
    expect(read("client/src/pages/MonthlyProfitReport.tsx")).not.toContain("trpc.fullPackage.list.useQuery");
    const batchReports = read("client/src/pages/BatchReports.tsx");
    expect(batchReports).toContain("carrierCostBase(batch.shippingType, batch, ours)");
    expect(batchReports).not.toContain("totalCost = totalChargeableWeight * costPerKg;");
  });
});
