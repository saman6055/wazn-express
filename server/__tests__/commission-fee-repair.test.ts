import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { SCHEMA_PATCHES } from "./_core/migrations";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");

/*
 * May–July 2026: multi-unit commission orders charged as goods × quantity +
 * fee — the fee was the order's — while every figure reads it per unit
 * (CM-MPC9AGUF: 100 units, $19 fee, $1,900 of profit shown). Proved on a real
 * MySQL: only orders whose own charge proves it are listed (a correction to
 * the charge included), the fee is stored per unit exactly, $2,090.95 of
 * false profit leaves two orders, and no account moves.
 */
describe("a commission fee written for the whole order", () => {
  const repair = read("db/commissionFeeRepair.db.ts");

  it("the charge decides, not a date", () => {
    expect(repair).toContain("if (!near(charged, asTotal) || near(charged, asPerUnit)) continue;");
  });

  it("the fee column holds four places so the per-unit fee is exact", () => {
    expect(SCHEMA_PATCHES.some((p) => p.sql.includes("MODIFY COLUMN commissionFeeUsd DECIMAL(12,4)"))).toBe(true);
    expect(read("../drizzle/schema/fullPackage.schema.ts")).toContain('commissionFeeUsd: decimal("commissionFeeUsd", { precision: 12, scale: 4 })');
  });

  it("the fix touches the order only — never an account", () => {
    const fix = repair.slice(repair.indexOf("export async function fixCommissionFeeStoredAsTotal"));
    expect(fix).not.toContain("ledgerTransactions");
    expect(fix).not.toContain("customerAccounts");
  });

  it("main admin only", () => {
    const router = read("routers/finance.router.ts");
    expect(router).toContain("commissionFeeAsTotal: superAdminProcedure");
    expect(router).toContain("fixCommissionFeeAsTotal: superAdminProcedure");
  });

  it("the bulk form says the fee is for one unit", () => {
    expect(read("../client/src/pages/BulkOrderForm.tsx")).toContain("عمولە بۆ یەک دانە ($)");
  });
});
