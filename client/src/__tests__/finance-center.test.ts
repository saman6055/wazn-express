/**
 * The finance centre: one screen, a plain (i) on every figure, detail in a
 * drawer beside it (owner, 2026-11-05). Its figures come from the one report.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");

describe("finance centre", () => {
  const page = read("client/src/pages/finance/FinanceCenter.tsx");
  it("reads the one dashboard report, never its own sums", () => {
    expect(page).toContain("trpc.ledger.financeDashboard.useQuery({ period })");
    expect(page).not.toMatch(/useQuery\(\s*\{\s*customerId/);
  });
  it("every tile explains itself and opens a drawer on the same screen", () => {
    const tiles = page.match(/<Tile testId=/g) ?? [];
    const infos = page.match(/info=\{L\(/g) ?? [];
    expect(tiles.length).toBeGreaterThanOrEqual(6);
    expect(infos.length).toBe(tiles.length);
    expect(page).toContain("<Sheet open={open !== null}");
  });
  it("is routed and on the menu", () => {
    expect(read("client/src/App.tsx")).toContain('<Route path="/finance/center" component={FinanceCenter} />');
    expect(read("client/src/components/DashboardLayout.tsx")).toContain('path: "/finance/center"');
  });
  it("the work's profit is the one rule's total", () => {
    expect(read("server/db/financePulse.db.ts")).toContain("const workProfitUsd = cents(num(profit.total.profit));");
  });
});
