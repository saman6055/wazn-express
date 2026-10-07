import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { foldedCorrectionIds, type FoldableRow } from "./ledgerFold";

/**
 * Corrections are kept and folded (owner, 2026-10-07: "do that"). What would
 * undo it: folding a row whose absence changes a balance in view — a partial
 * correction, a correction with no charge beside it, a hand adjustment — or
 * the page losing the button that brings them back.
 */

const row = (id: number, type: string, usd: number, description = ""): FoldableRow =>
  ({ id, transactionNumber: `T${id}`, transactionType: type, amountUsd: usd.toFixed(2), description });

describe("what folds away", () => {
  it("a charge taken back whole, and the row that took it back", () => {
    const ids = foldedCorrectionIds([row(1, "DEBIT_COMMISSION", 100), row(2, "ADJUSTMENT_CREDIT", 100, "why [REV:T1]"), row(3, "DEBIT_COMMISSION", 40)]);
    expect(Array.from(ids).sort()).toEqual([1, 2]);
  });

  it("a charge edited down and then cancelled: every step of it", () => {
    const ids = foldedCorrectionIds([row(1, "DEBIT_PACKAGE", 100), row(2, "ADJUSTMENT_CREDIT", 30, "[ADJ:T1]"), row(3, "ADJUSTMENT_CREDIT", 70, "[REV:T1]")]);
    expect(Array.from(ids).sort()).toEqual([1, 2, 3]);
  });
});

describe("what stays in view", () => {
  it("a charge that still stands in part, with its correction", () => {
    expect(foldedCorrectionIds([row(1, "DEBIT_COMMISSION", 100), row(2, "ADJUSTMENT_CREDIT", 30, "[ADJ:T1]")]).size).toBe(0);
  });

  it("a correction whose charge is not in the list", () => {
    expect(foldedCorrectionIds([row(2, "ADJUSTMENT_CREDIT", 100, "[REV:T1]")]).size).toBe(0);
  });

  it("an adjustment made by hand, and a payment", () => {
    expect(foldedCorrectionIds([row(1, "DEBIT_COMMISSION", 100), row(2, "ADJUSTMENT_CREDIT", 100, "[ڕێکخستنی دەستی] ڕاستکردنەوە"), row(3, "CREDIT_PAYMENT", 100, "BOX-20260901-001")]).size).toBe(0);
  });

  it("hiding a folded set changes no balance: the set adds up to nothing", () => {
    const rows = [row(1, "DEBIT_COMMISSION", 55.5), row(2, "ADJUSTMENT_DEBIT", 4.5, "[ADJ:T1]"), row(3, "ADJUSTMENT_CREDIT", 60, "[REV:T1]")];
    const ids = foldedCorrectionIds(rows);
    const net = rows.filter((r) => ids.has(r.id)).reduce((s, r) => s + (r.transactionType === "ADJUSTMENT_CREDIT" ? -1 : 1) * Number(r.amountUsd), 0);
    expect(ids.size).toBe(3);
    expect(Math.abs(net)).toBeLessThan(0.005);
  });
});

describe("the profile folds them and can show them", () => {
  const page = fs.readFileSync(path.resolve(__dirname, "..", "client/src/pages/CustomerFinance.tsx"), "utf8").replace(/\r\n/g, "\n");

  it("by the shared rule, never one of its own", () => {
    expect(page).toContain('import { foldedCorrectionIds } from "@shared/ledgerFold";');
    expect(page).toContain("foldedCorrectionIds(transactions ?? [])");
  });

  it("with a button that says how many, and brings them back", () => {
    expect(page).toContain('data-testid="ledger-show-corrections"');
    expect(page).toContain("setShowCorrections((v) => !v)");
  });

  it("the exports still carry every row", () => {
    const fold = page.indexOf("const viewTransactions");
    expect(fold).toBeGreaterThan(-1);
    for (const name of ["const exportToExcel", "const exportToPDF"]) {
      const at = page.indexOf(name);
      expect(at, name).toBeGreaterThan(-1);
      expect(page.slice(at, at + 3000), name).not.toContain("viewTransactions");
    }
  });
});
