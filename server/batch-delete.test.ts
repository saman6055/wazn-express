import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Deleting a batch is the one operation here that destroys a record, so the
 * things that keep it safe are asserted rather than trusted to review.
 *
 * The trap this feature walks past: `batches.totalPackages` is incremented
 * when a package is assigned and is never decremented when one is moved away,
 * so it over-reports. Deciding a deletion on that counter would refuse to
 * delete a batch that has genuinely been emptied — the exact case the feature
 * exists for — and, if the drift ever went the other way, would delete a
 * batch that still had packages in it. The blockers are therefore counted
 * from the referencing tables.
 *
 * Source-text assertions rather than a live DB, because this repo's tests run
 * without one. Each slice is checked to be non-empty first — an unmatched
 * marker must fail loudly rather than silently assert against "".
 */

const ROOT = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

function slice(src: string, startMarker: string, endMarker: string, label: string): string {
  const start = src.indexOf(startMarker);
  expect(start, `${label}: start marker "${startMarker}" not found`).toBeGreaterThan(-1);
  const end = src.indexOf(endMarker, start + startMarker.length);
  expect(end, `${label}: end marker "${endMarker}" not found after start`).toBeGreaterThan(start);
  const body = src.slice(start, end);
  expect(body.length, `${label}: slice is empty`).toBeGreaterThan(50);
  return body;
}

describe("deleting a batch", () => {
  const router = read("server/routers/batches.router.ts");
  const dbLayer = read("server/db/batches.db.ts");

  const procedure = () =>
    slice(router, "delete: adminProcedure", "updateStatus: staffProcedure", "batches.delete");

  it("is restricted to admins", () => {
    // Every other batch operation is staffProcedure. This one destroys a
    // record, so it is deliberately not.
    expect(router).toContain("delete: adminProcedure");
    expect(router).not.toContain("delete: staffProcedure");
  });

  it("refuses before it deletes", () => {
    const body = procedure();
    const checkAt = body.indexOf("getBatchDeletionBlockers");
    const deleteAt = body.indexOf("db.deleteBatch");
    expect(checkAt, "must consult the blockers").toBeGreaterThan(-1);
    expect(deleteAt, "must call through to the delete").toBeGreaterThan(-1);
    expect(checkAt, "the check has to come first, or it is not a check")
      .toBeLessThan(deleteAt);
    expect(body, "a non-zero blocker count must stop the deletion")
      .toMatch(/blockers\.total\s*>\s*0/);
  });

  it("decides on real rows, never on the totalPackages counter", () => {
    const body = procedure();
    expect(body, "totalPackages over-reports — it is never decremented")
      .not.toContain("totalPackages");

    const blockers = slice(
      dbLayer,
      "export async function getBatchDeletionBlockers",
      "export async function deleteBatch",
      "getBatchDeletionBlockers"
    );
    expect(blockers).not.toContain("batches.totalPackages");
    // Everything that means real work has been done against this batch.
    for (const table of ["packages", "deliveryBoxes", "invoices", "fullPackageOrders"]) {
      expect(blockers, `${table} references a batch and must block its deletion`)
        .toContain(table);
    }
  });

  it("writes the audit entry while there is still something to record", () => {
    const body = procedure();
    const auditAt = body.indexOf("delete_batch");
    const deleteAt = body.indexOf("db.deleteBatch");
    expect(auditAt, "the deletion must be logged").toBeGreaterThan(-1);
    expect(auditAt, "logging after the row is gone loses what was deleted")
      .toBeLessThan(deleteAt);
    expect(body, "the log should carry the batch as it was").toContain("oldValues");
  });

  it("takes the batch's own children with it", () => {
    // The full signature, not a prefix: `deleteBatchPricingTier` sits earlier
    // in this file and starts with the same characters.
    const remove = slice(
      dbLayer,
      "export async function deleteBatch(batchId: number)",
      "\n}",
      "deleteBatch"
    );
    // These belong to the batch and would otherwise be orphaned rows keyed to
    // an id that no longer exists.
    for (const child of ["batchPricingTiers", "batchCustomerPricing", "batchStatusHistory"]) {
      expect(remove, `${child} must be deleted with the batch`).toContain(child);
    }
  });

  it("is offered in the UI only for a batch that looks empty", () => {
    const page = read("client/src/pages/Batches.tsx");
    // Gated on the counted number, not on batches.totalPackages — that
    // column drifts in both directions and was showing 0 for batches that
    // held parcels, putting a delete button on every one of them.
    expect(page).toContain("{!batch.packageCount && (");
    expect(page, "the drifting counter must not decide this").not.toContain("batch.totalPackages");
    expect(page, "a destructive action needs confirming").toContain("batches.deleteBatchWarning");
  });
});
