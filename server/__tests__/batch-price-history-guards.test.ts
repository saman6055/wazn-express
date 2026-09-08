import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner's two rules from Sep 2026, kept honest the cheap way (source
 * text, like batch-adjustment-guards.test.ts — the paths need a live
 * database to run):
 *
 *   1. An overwritten price stays on the record. Every change to the five
 *      money fields writes a batchPriceHistory row — including the one the
 *      system makes when it divides the carrier's total at delivery.
 *   2. A delivered batch is settled. The edit endpoint refuses it, and the
 *      form goes read-only.
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

describe("an overwritten price stays on the record", () => {
  const db = read("server/db/batches.db.ts");

  it("updateBatch diffs the money fields and writes the history", () => {
    const update = slice(
      db,
      "export async function updateBatch",
      "export async function getActiveBatches"
    );
    expect(update).toContain("diffPriceFields");
    expect(update).toContain("insert(batchPriceHistory)");
    // History is written AFTER the update succeeds — a failed save must
    // not leave a phantom change on the record.
    const insertAt = update.indexOf("insert(batchPriceHistory)");
    const updateAt = update.indexOf("update(batches)");
    expect(updateAt, "update(batches) not found").toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(updateAt);
  });

  it("the delivery-time derivation records itself as the system", () => {
    const derive = slice(
      db,
      "export async function deriveBatchCostRateIfMissing",
      "export async function getBatchPriceHistory"
    );
    expect(derive).toContain("insert(batchPriceHistory)");
    expect(derive).toContain("changedById: null");
  });

  it("the history query is staff-only, never the portal", () => {
    const router = read("server/routers/batches.router.ts");
    expect(router).toContain("priceHistory: staffProcedure");
    // The portal router must not grow a way to read what a shipment cost.
    const portal = read("server/routers/portal.router.ts");
    expect(portal).not.toContain("priceHistory");
    expect(portal).not.toContain("batchPriceHistory");
  });

  it("the edit form sends an erased cost as null, not as untouched", () => {
    const page = read("client/src/pages/Batches.tsx");
    const handleEdit = slice(page, "const handleEdit", "const openEditDialog");
    expect(handleEdit).toContain('costPerKg: clearable("costPerKg")');
    expect(handleEdit).toContain('costPerCbm: clearable("costPerCbm")');
    expect(handleEdit).toContain('shippingCost: clearable("shippingCost")');
    // And the server-side input actually admits the null.
    const router = read("server/routers/batches.router.ts");
    const updateInput = slice(router, "update: staffProcedure", "priceHistory: staffProcedure");
    expect(updateInput).toContain("costPerKg: z.string().nullable().optional()");
    expect(updateInput).toContain("costPerCbm: z.string().nullable().optional()");
    expect(updateInput).toContain("shippingCost: z.string().nullable().optional()");
  });
});

describe("a delivered batch is settled", () => {
  it("the edit endpoint refuses delivered and closed", () => {
    const router = read("server/routers/batches.router.ts");
    const update = slice(router, "update: staffProcedure", "priceHistory: staffProcedure");
    expect(update).toContain("isBatchEditLocked(existing.status)");
    // The refusal happens BEFORE anything is written.
    const guardAt = update.indexOf("isBatchEditLocked");
    const writeAt = update.indexOf("updateBatch(");
    expect(writeAt, "updateBatch call not found").toBeGreaterThan(-1);
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(writeAt);
  });

  it("the form goes read-only instead of trusting the toast", () => {
    const page = read("client/src/pages/Batches.tsx");
    expect(page).toContain("<fieldset disabled={editLocked}");
    // Belt to the server's suspenders: a locked batch never even sends.
    const handleEdit = slice(page, "const handleEdit", "const openEditDialog");
    expect(handleEdit).toContain("if (isBatchEditLocked(editingBatch.status)) return;");
  });

  it("status moves stay possible — the lock is on the edit, not the journey", () => {
    const router = read("server/routers/batches.router.ts");
    const updateStatus = slice(router, "updateStatus: staffProcedure", 'if (input.status === "in_transit")');
    expect(updateStatus).not.toContain("isBatchEditLocked");
  });
});

describe("the table exists wherever the code deploys", () => {
  it("migrations create batchPriceHistory with the columns the code writes", () => {
    const migrations = read("server/_core/migrations.ts");
    const create = slice(migrations, "CREATE TABLE IF NOT EXISTS batchPriceHistory", "ENGINE=InnoDB");
    for (const column of ["batchId", "field", "oldValue", "newValue", "changedById", "changedAt"]) {
      expect(create).toContain(column);
    }
  });
});
