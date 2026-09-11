import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { pageOf } from "./hooks/useClientPagination";

/**
 * The owner's list, item 3 (2026-09-11): the long lists draw a page at a
 * time, the Accounting balances come in one request instead of one per row,
 * and the customer search waits for a pause in typing.
 */
describe("a page of a list", () => {
  it("starts and ends where it should", () => {
    expect(pageOf(120, 50, 1)).toEqual({ page: 1, pageCount: 3, from: 1, to: 50 });
    expect(pageOf(120, 50, 3)).toEqual({ page: 3, pageCount: 3, from: 101, to: 120 });
  });

  it("never points past the end when the list gets shorter", () => {
    expect(pageOf(30, 50, 4)).toEqual({ page: 1, pageCount: 1, from: 1, to: 30 });
    expect(pageOf(0, 50, 2)).toEqual({ page: 1, pageCount: 1, from: 0, to: 0 });
    expect(pageOf(10, 50, Number.NaN).page).toBe(1);
  });
});

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

describe("the long lists", () => {
  it.each([
    ["pages/Customers.tsx", "customerPage.pageRows.map("],
    ["pages/Accounting.tsx", "balancePage.pageRows.map("],
    ["pages/FullPackageDashboard.tsx", "orderPage.pageRows.map("],
    ["pages/CommissionDashboard.tsx", "orderPage.pageRows.map("],
    ["pages/UnifiedOrdersDashboard.tsx", "orderPage.pageRows.map("],
  ])("%s draws one page and offers the next", (file, rows) => {
    const src = read(file);
    expect(src).toContain("useClientPagination(");
    expect(src).toContain(rows);
    expect(src).toContain("<ListPager");
  });

  it("Accounting asks for a page of balances at once, not one per row", () => {
    const src = read("pages/Accounting.tsx");
    expect(src).toContain("trpc.customers.getBalances.useQuery(");
    expect(src).not.toContain("trpc.customers.getBalance.useQuery(");
  });

  it("the customer search filters after a pause, while the box shows every keystroke", () => {
    const src = read("pages/Customers.tsx");
    expect(src).toContain("useDebouncedValue(search, 250)");
    expect(src).toContain("search: debouncedSearch,");
    expect(src).toContain("value={search}");
  });
});
