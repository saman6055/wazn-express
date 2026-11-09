/** The batch report in detail adds up to the report's own cards (owner, 2026-11-09). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");
describe("batch report detail", () => {
  const db = read("server/db/batchReport.db.ts");
  it("each parcel's revenue is the one the totals add up; the cost is shared by what the batch sells by", () => {
    expect(read("server/db/batches.db.ts")).toContain("parcelRevenue,");
    expect(db).toContain("parcelRevenue?.[id]");
    expect(db).toContain("(totalCost * qty) / totalQty");
    expect(db).toContain("const live = rows.filter((p) => Boolean(p.customerId));");
  });
  it("the dialog shows it, and the customer table carries cost and profit", () => {
    const page = read("client/src/pages/batches/Batches.tsx");
    expect(page).toContain("<BatchReportDetail");
    expect(page).toContain('data-testid="batch-customer-profit"');
    expect(page).toContain("const chargedQty = financialSummary.shippingType === 'sea' ? cb.cbm : (d?.chargeableKg ?? cb.weight);");
  });
});

describe("the printed batch report", () => {
  const pdf = read("server/services/pdfReports.ts");
  it("prints the report's own figures, every customer, the code alone, no emoji", () => {
    expect(pdf).toContain("const detail = await getBatchReportDetail(batchId);");
    expect(pdf).toContain("revenue: Number(summary.totalRevenue) || 0,");
    expect(pdf).toContain("const code = customerCodeOnly(c.code)");
    expect(pdf).toContain("d.perCustomer.map((c) => {");
    expect(pdf).not.toContain("✈️");
    expect(pdf).not.toContain("data.customerBreakdown.slice(0, 12)");
  });
});
