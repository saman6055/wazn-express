import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { cacheClear, dropFreshFigures, freshGetOrSet } from "../db/cache";

const ROOT_DIR = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT_DIR, p), "utf8");

/**
 * The finance cards are kept between looks (owner, 2026-11-05: open in the
 * blink of an eye) — and must never show a figure older than the last save.
 */
describe("fresh figures", () => {
  it("answers a second look from memory", async () => {
    cacheClear();
    let runs = 0;
    const work = async () => ++runs;
    expect(await freshGetOrSet("t:a", work)).toBe(1);
    expect(await freshGetOrSet("t:a", work)).toBe(1);
    expect(runs).toBe(1);
  });

  it("works the figure out again after a save", async () => {
    cacheClear();
    let runs = 0;
    const work = async () => ++runs;
    await freshGetOrSet("t:b", work);
    dropFreshFigures();
    expect(await freshGetOrSet("t:b", work)).toBe(2);
  });

  it("does not keep a figure that a save overtook while it was being worked out", async () => {
    cacheClear();
    let runs = 0;
    const slow = async () => {
      const n = ++runs;
      if (n === 1) dropFreshFigures(); // a payment lands mid-sum
      return n;
    };
    expect(await freshGetOrSet("t:c", slow)).toBe(1);
    expect(await freshGetOrSet("t:c", slow)).toBe(2);
  });

  it("every procedure drops them after a successful mutation", () => {
    const src = read("_core/trpc.ts");
    expect(src).toContain('if (type === "mutation" && result.ok) dropFreshFigures();');
    expect(src).toContain("export const publicProcedure = t.procedure.use(dropFreshAfterSave);");
    expect(src).toContain("export const protectedProcedure = publicProcedure.use(requireUser);");
    // Nothing else may start from the bare t.procedure and skip the drop.
    expect(src.match(/=\s*t\.procedure\b/g)?.length).toBe(1);
  });

  it("the heavy finance cards are the ones kept", () => {
    const finance = read("routers/finance.router.ts");
    for (const key of ["ledger.getSummary", "ledger.getAllAccounts", "ledger.debtAges", "ledger.financeDashboard", "ledger.workingCapital", "ledger.goodsOnRoad", "ledger.getDebtors"]) {
      expect(finance).toMatch(new RegExp(`freshGetOrSet\\(["\`]${key.replace(".", "\\.")}`));
    }
    expect(read("routers/scanning.router.ts")).toContain('freshGetOrSet("deliveryBox.overview"');
  });

  it("the payments page draws thirty rows and an outline while loading", () => {
    const src = fs.readFileSync(path.join(ROOT_DIR, "../client/src/pages/finance/Payments.tsx"), "utf8");
    expect(src).toContain("useClientPagination(filteredPayments, 30, search)");
    expect(src).toContain("pager.pageRows.map((payment)");
    expect(src).toContain("seesHistory && paymentsLoading ?");
  });
});
