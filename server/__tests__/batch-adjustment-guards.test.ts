import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The post-delivery adjustment must stay an accountant's correction: a NEW
 * ledger row beside the invoice, never a rewrite of it.
 *
 * These read source text, like batch-rate-guards.test.ts and for the same
 * reason — the path needs a live database to run, so the cheap way to keep
 * it honest is to check the code still says what the money rules require.
 */

const ROOT = path.resolve(__dirname, "../..");

const read = (rel: string) =>
  fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

/** The source between two markers, with both ends proven to exist. */
function slice(src: string, from: string, to: string): string {
  const start = src.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const end = src.indexOf(to, start + from.length);
  expect(end, `marker not found: ${to}`).toBeGreaterThan(start);
  const out = src.slice(start, end);
  expect(out.length, "slice is empty").toBeGreaterThan(100);
  return out;
}

/** From a proven marker to the end of the file. */
function tail(src: string, from: string): string {
  const start = src.indexOf(from);
  expect(start, `marker not found: ${from}`).toBeGreaterThan(-1);
  const out = src.slice(start);
  expect(out.length, "slice is empty").toBeGreaterThan(100);
  return out;
}

describe("a price changed after delivery", () => {
  const db = read("server/db/batches.db.ts");
  const apply = tail(db, "export async function applyBatchCustomerAdjustment");

  it("posts a ledger row, in the two allowed types only", () => {
    expect(apply).toContain('"CREDIT_DISCOUNT"');
    expect(apply).toContain('"ADJUSTMENT_DEBIT"');
    // Both sides of the same ternary — a discount credits, a correction
    // debits, and nothing else is ever written.
    expect(apply).toMatch(/isDiscount \? "CREDIT_DISCOUNT" : "ADJUSTMENT_DEBIT"/);
  });

  it("never touches an issued invoice", () => {
    // The whole point: the invoice in the customer's hand stays as printed.
    expect(apply).not.toContain("update(invoices)");
    expect(apply).not.toContain("insert(invoices)");
    expect(apply).not.toContain(".delete(invoices)");
  });

  it("recomputes the figure server-side instead of trusting the screen", () => {
    expect(apply).toContain("previewBatchCustomerAdjustment(args.input)");
  });

  it("refuses a batch that has not been delivered", () => {
    const preview = slice(
      db,
      "export async function previewBatchCustomerAdjustment",
      "export async function applyBatchCustomerAdjustment"
    );
    expect(preview).toContain('"not_delivered"');
    expect(preview).toContain('batch.status === "delivered" || batch.status === "closed"');
  });

  it("requires a reason, because next year somebody will ask why", () => {
    expect(apply).toContain("هۆکار پێویستە");
  });
});

describe("who may do it", () => {
  it("both procedures sit behind the accountant gate", () => {
    const router = read("server/routers/batches.router.ts");
    expect(router).toContain("previewCustomerAdjustment: accountantProcedure");
    expect(router).toContain("applyCustomerAdjustment: accountantProcedure");
  });
});

describe("the carrier's total becomes a per-unit cost at delivery", () => {
  it("the delivered branch derives before invoicing", () => {
    const router = read("server/routers/batches.router.ts");
    const branch = slice(
      router,
      'input.status === "delivered" || input.status === "closed"',
      "// ===== PHASE 1: COLLECT ====="
    );
    expect(branch).toContain("deriveBatchCostRateIfMissing");
  });

  it("the financial summary asks the one shared cost rule", () => {
    const db = read("server/db/batches.db.ts");
    const summary = slice(
      db,
      "export async function getBatchFinancialSummary",
      "export async function getBatchStatusHistory"
    );
    expect(summary).toContain("resolveBatchCost(");
    // The old hand-written multiplication must not come back beside it.
    expect(summary).not.toMatch(/totalCost = chargedCbm \* costPerCbm/);
    expect(summary).not.toMatch(/totalCost = totalChargeableWeight \* costPerKg/);
  });
});
