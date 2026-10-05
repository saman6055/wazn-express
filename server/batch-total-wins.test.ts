import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

/**
 * The carrier's invoice decides a batch's cost (owner, 2026-10-05).
 *
 * «کۆی ئەو بڕە پارەی داومانە بە شەریکەی نەقل، لەگەڵ خزمەتگوزاریی زیادە، ئەبێ
 * ئەوە ڕاستی بێت و سیستەم تێچووی ڕاستەقینەی هەر کیلۆیەک نیشان بدات.» And:
 * «ئەگەر هەم نرخی کیلۆ و هەم کۆی پسووڵە نووسرابن، کۆی پسووڵە وەرگرێ، ئەوەی
 * تر پشتگوێ بخات».
 *
 * The rule itself is pinned in shared/batchCost.test.ts. Proved on a real
 * MySQL through the functions the screens read:
 *
 *   quoted $7/kg, paid $2,400 on 300 kg   cost 2,400 — $8.00 a kilo, the $7
 *                                         named as not counted; profit 900,
 *                                         where the rate had said 1,200
 *   the total alone, $800 on 100 kg       800 — $8.00 a kilo
 *   a rate alone, $7 on 100 kg            700 — unchanged
 *   sea, quoted $100, paid $650 on 5 CBM  650 — $130.00 a cubic metre
 *   the carrier billed 250 of our 300 kg  2,400 ÷ 250 = $9.60; the 50 kg
 *                                         difference valued at it ($480)
 *   the profit report                     the same five costs
 *   the self-order report                 each parcel at its batch's real
 *                                         rate; a total-only batch no longer
 *                                         costs nothing there
 *   a typed rate                          never written over; an empty one
 *                                         is still filled at delivery
 *
 * What these guards keep is the thing that made every page agree: the rule
 * is written once, and nothing costs a batch from the typed rate alone.
 */
describe("the rule is written once", () => {
  const batchesDb = read("server/db/batches.db.ts");
  const reports = read("server/db/reports.db.ts");

  it("many batches at once are costed by the same function as one", () => {
    const start = batchesDb.indexOf("export async function getBatchCostsByRule(");
    expect(start).toBeGreaterThan(-1);
    const fn = batchesDb.slice(start, batchesDb.indexOf("export async function deriveBatchCostRateIfMissing("));
    expect(fn).toContain("const cost = resolveBatchCost({");
    expect(fn).toContain("shippingCost: row.shippingCost,");
    // The base is the carrier's billed weight, else ours with the divisor in force.
    expect(fn).toContain("carrierBaseKgSql(await getVolumetricDivisor())");
    expect(fn).toContain("CARRIER_BASE_CBM_SQL");
  });

  it("the profit report no longer writes the rule out again in SQL", () => {
    const start = reports.indexOf("export async function getBatchProfitRowsInPeriod(");
    expect(start).toBeGreaterThan(-1);
    const fn = reports.slice(start, reports.indexOf("async function getPackageNetProfitFromBatches("));
    expect(fn).toContain("const costsByRule = await getBatchCostsByRule(batchIds);");
    expect(fn).toContain("costByBatch.set(r.id, costsByRule.get(r.id)?.totalCostUsd ?? 0);");
    // A rate multiplied in SQL here is the second copy that went out of step.
    expect(fn).not.toContain("* CAST(${batches.costPerKg}");
    expect(fn).not.toContain("* CAST(${batches.costPerCbm}");
  });

  it("the self-order report costs a parcel at its batch's real rate", () => {
    const start = reports.indexOf("export async function getSelfOrderReport(");
    expect(start).toBeGreaterThan(-1);
    const fn = reports.slice(start, reports.indexOf("const topCustomers ="));
    expect(fn).toContain("await getBatchCostsByRule(");
    expect(fn).toContain("computePkgCost(r.weightKg, r.volumeCbm, r.batchId != null ? batchCosts.get(r.batchId) : undefined)");
    expect(fn).not.toContain("costPerKg: batches.costPerKg");
  });

  it("a typed rate is never written over by the one derived from the total", () => {
    const shared = read("shared/batchCost.ts");
    const start = shared.indexOf("export function deriveCostRate(");
    expect(start).toBeGreaterThan(-1);
    const fn = shared.slice(start, shared.indexOf("export interface BatchCostWords"));
    expect(fn).toContain("if (typed > 0) return null;");
    expect(fn.indexOf("if (typed > 0) return null;")).toBeLessThan(fn.indexOf("resolveBatchCost(inputs)"));
  });
});

describe("every screen shows the real cost of a kilo, and how it was reached", () => {
  it("the batch's summary carries the explanation, made once", () => {
    const batchesDb = read("server/db/batches.db.ts");
    expect(batchesDb).toContain("costWorking: batchCostWorking(resolvedCost, costBase),");
    expect(batchesDb).toContain("ignoredCostRate: resolvedCost.ignoredRate,");
  });

  it("one line draws it, with the arithmetic left to right in its own span", () => {
    const notes = read("client/src/components/batches/BatchCostNotes.tsx");
    const start = notes.indexOf("export function BatchCostWorkingLine(");
    expect(start).toBeGreaterThan(-1);
    const line = notes.slice(start, notes.indexOf("export function BatchRealCostPreview("));
    expect(line).toContain('<bdi dir="ltr" className="font-mono tabular-nums text-foreground">{working.math}</bdi>');
    expect(line).toContain("pickLang(language, IGNORED_RATE_WORDS)");
    // Its own direction: the batch dialog's tabs are a left-to-right island.
    expect(line).toContain('dir={language === "en" || language === "zh" ? "ltr" : "rtl"}');
  });

  it("the batch screen uses it, and previews the total while it is typed", () => {
    const page = read("client/src/pages/Batches.tsx");
    expect(page).toContain("<BatchCostWorkingLine working={financialSummary.costWorking}");
    expect(page).toContain("<BatchRealCostPreview");
    expect(page).toContain("total={costDraft.total ?? editingBatch.shippingCost}");
    // The old hand-built line read the typed rate.
    expect(page).not.toContain("kg × $${financialSummary.costPerKg}");
  });

  it("the financial pages and the printed report show the real rate, not the typed one", () => {
    for (const file of ["client/src/pages/BatchFinancialReport.tsx", "client/src/pages/BatchFinancialReportFull.tsx"]) {
      const page = read(file);
      expect(page, file).toContain("${Number(financial.effectiveCostRate || 0).toFixed(2)}/{unit}");
      expect(page, file).toContain("<BatchCostWorkingLine working={financial.costWorking}");
      expect(page, file).not.toContain("financial.costPerCbm : financial.costPerKg");
    }
    expect(read("server/routers/batches.router.ts")).toContain("costPerUnit: Math.round(summary.effectiveCostRate * 100) / 100,");
  });

  it("the old profit dashboard costs a batch by the same rule", () => {
    const page = read("client/src/pages/ProfitDashboard.tsx");
    expect(page).toContain("const cost = resolveBatchCost({");
    expect(page).not.toContain("const cost = chargedVolume * costPerUnit;");
  });
});
