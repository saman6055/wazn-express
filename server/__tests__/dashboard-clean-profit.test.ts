/**
 * «قازانجی خاوێن» on the dashboard is the work's profit by the one rule less
 * the expenses (owner, 2026-11-05) — never money received less expenses.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("the dashboard's clean profit", () => {
  const src = read("server/db/reports.db.ts");
  const chart = src.slice(src.indexOf("export async function getDashboardProfitLossChart("), src.indexOf("export async function getDashboardActiveBatches("));

  it("the daily chart takes the one profit rule less the day's expenses", () => {
    expect(src).toContain("getProfitForPeriod(w.start, w.end)");
    expect(chart).toContain("workProfitByWindows(");
    expect(chart).toContain("profit: Math.round((workProfit - expenses) * 100) / 100");
    expect(chart).not.toContain("profit: revenue - expenses");
  });

  it("the weekly highlight uses the same rule, not the received-money chart", () => {
    const weekly = src.slice(src.indexOf("export async function getWeeklyHighlights"));
    expect(weekly).toContain("await workProfitByWindows(windows)");
    expect(weekly).not.toContain("getDashboardProfitLossChart(91)");
  });
});
