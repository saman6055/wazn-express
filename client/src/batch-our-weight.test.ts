import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { batchMissingCost } from "@shared/batchPricing";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");

/*
 * Owner, 2026-10-04: our weight is counted from the trackings themselves and
 * never typed; the carrier's billed weight is compared against it; a batch
 * without its cost or price keeps taking parcels, asks in red, and its profit
 * waits.
 */
describe("our weight, the carrier's, and a batch that waits", () => {
  const page = read("pages/Batches.tsx");

  it("our weight is shown, not typed, in the edit form", () => {
    expect(page).not.toContain('<Input name="actualWeightKg"');
    expect(page).not.toContain('<Input name="actualCbm"');
    expect(page).toContain('data-testid="our-weight"');
    expect(page).toContain("<CarrierDifferenceLine difference={editFinancialQ.data?.carrierDifference ?? null} />");
  });

  it("every place a batch's profit is shown says when it is waiting", () => {
    expect(page).toContain("<BatchWaitingFor waitingFor={financialSummary.waitingFor} />");
    expect(read("pages/BatchFinancialReport.tsx")).toContain("<BatchWaitingFor waitingFor={financial.waitingFor} />");
    expect(read("pages/BatchFinancialReportFull.tsx")).toContain("<BatchWaitingFor waitingFor={financial.waitingFor} />");
  });

  it("the list asks for a missing cost in red, beside the price", () => {
    expect(page).toContain('data-testid="batch-missing-cost"');
    expect(read("pages/BatchAssignmentScanner.tsx")).toContain("batchMissingCost(batch)");
  });

  it("a cost is a rate or the carrier's total", () => {
    expect(batchMissingCost({ shippingType: "air_regular" })).toBe(true);
    expect(batchMissingCost({ shippingType: "air_regular", costPerKg: "8.8" })).toBe(false);
    expect(batchMissingCost({ shippingType: "sea", costPerKg: "8.8" }), "a kilo rate does not cost a sea batch").toBe(true);
    expect(batchMissingCost({ shippingType: "sea", shippingCost: "353" })).toBe(false);
  });

  it("the server reports no profit and no loss while waiting", () => {
    const db = fs.readFileSync(path.resolve(__dirname, "..", "..", "server/db/batches.db.ts"), "utf8");
    expect(db).toContain("profit: waitingFor ? 0 : totalRevenue - totalCost,");
    const reports = fs.readFileSync(path.resolve(__dirname, "..", "..", "server/db/reports.db.ts"), "utf8");
    expect(reports).toContain("if (waitingForCost.has(batchId) || totalBatchRevenue <= 0) continue;");
  });
});
