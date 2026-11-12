import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Owner, 2026-11-13: the «قازانج بۆ هەر kg» card was a white block in dark mode. */
describe("the batch report's price cards read in dark mode", () => {
  const page = readFileSync(resolve(__dirname, "..", "pages", "reports", "BatchFinancialReport.tsx"), "utf8");

  it("the profit-per-unit card has its dark colours, as its two neighbours do", () => {
    expect(page).toContain("'bg-blue-50/80 border-blue-200/50 dark:bg-blue-950/80 dark:border-blue-800/60'");
    expect(page).toContain("'bg-red-50/80 border-red-200/50 dark:bg-red-950/80 dark:border-red-800/60'");
    expect(page).toContain("'bg-blue-200/80 dark:bg-blue-900/80'");
  });

  it("no light-only fill is left on the page", () => {
    const lightOnly = page.split("\n").filter((l) => /(^|\s|')(hover:)?bg-[a-z]+-50(\/\d+)?(\s|'|")/.test(l) && !/dark:(hover:)?bg-/.test(l));
    expect(lightOnly).toEqual([]);
  });
});
