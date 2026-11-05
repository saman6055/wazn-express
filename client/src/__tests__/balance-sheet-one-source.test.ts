/**
 * The balance sheet reads the working-capital facts (owner, 2026-11-05: one
 * figure on every screen): goods on the road at cost, cash derived, equity
 * from capital, profit, expenses and withdrawals - never a plug.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const src = fs.readFileSync(path.resolve(__dirname, "../pages/finance/BalanceSheet.tsx"), "utf8").replace(/\r\n/g, "\n");

describe("balance sheet", () => {
  it("is built from working capital", () => {
    expect(src).toContain("trpc.ledger.workingCapital.useQuery(");
    expect(src).toContain("const totalAssets = round(totalReceivables + goodsAtCost + cashHeld);");
    expect(src).toContain('ku: "کاڵای ڕێگا — بە تێچووی کڕین"');
    expect(src).not.toContain('ku: "سامان − قەرز"');
  });
});
