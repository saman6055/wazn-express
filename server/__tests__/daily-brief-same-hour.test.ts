import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Today is always partial; it was compared with the whole of yesterday, so
 * every morning read as a fall and every busy morning as a jump (owner,
 * 2026-11-05: «خەرجی 54% زیادی کردووە»). Flows are measured to the same hour.
 */
const svc = readFileSync(resolve(__dirname, "../services/dailyBrief.service.ts"), "utf8");
const brief = readFileSync(resolve(__dirname, "../../shared/dailyBrief.ts"), "utf8");

describe("the brief compares like with like", () => {
  it("measures yesterday and last week up to the same clock time", () => {
    expect(svc).toContain("measureDay(dayKey(-1), clock)");
    expect(svc).toContain("measureDay(dayKey(-7), clock)");
    expect(svc).toContain("const on = (col: string) => (end ? `${col} >= ${d} AND ${col} < ${end}` : `DATE(${col}) = ${d}`);");
  });

  it("keeps the standing figures from the stored day", () => {
    expect(svc).toContain("outstandingDebtUsd: stored.outstandingDebtUsd, openBatches: stored.openBatches");
  });

  it("says the comparison is to the same hour, and kilos are registered, not shipped", () => {
    expect(svc).toContain("بەراورد بە دوێنێ تا هەمان کاتژمێر");
    expect(brief).toContain("کیلۆی تۆمارکراو");
    expect(brief).not.toContain("کیلۆی گواسترا");
  });
});

describe("the expenses row lists today's expenses", () => {
  it("biggest first, with the category, opening the expenses page", () => {
    expect(svc).toContain('signals.find((s) => s.id === "movement:expenses" || s.id === "movement:expenses:week")');
    expect(svc).toContain("ORDER BY CAST(e.amountUsd AS DECIMAL(14,2)) DESC LIMIT 10");
  });
});
