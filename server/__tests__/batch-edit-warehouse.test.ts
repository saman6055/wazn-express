import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * A batch's warehouse is put right on the edit form, not by deleting the
 * batch (owner, 2026-11-04), and its place follows the warehouse as on create.
 */
const router = readFileSync(resolve(__dirname, "../routers/batches.router.ts"), "utf8");
const page = readFileSync(resolve(__dirname, "../../client/src/pages/batches/Batches.tsx"), "utf8");

function updateBlock(): string {
  const start = router.indexOf("    update: staffProcedure");
  const end = router.indexOf("db.updateBatch(id, { ...data, ...placeChange }", start);
  expect(start, "batches.update").toBeGreaterThan(-1);
  expect(end, "the save with the place").toBeGreaterThan(start);
  return router.slice(start, end);
}

describe("editing a batch's warehouse", () => {
  it("takes the warehouse and stamps the batch's place from it", () => {
    const update = updateBlock();
    expect(update).toContain("originWarehouseId: z.number().int().positive().optional()");
    expect(update).toContain("placeChange.createdInCountryId = warehouse.countryId");
    expect(update).toContain("placeChange.createdInCity = warehouse.city");
  });

  it("refuses on a delivered or closed batch", () => {
    expect(updateBlock()).toContain("ناگۆڕدرێت، چونکە باچەکە گەیشتووە یان داخراوە");
  });

  it("sends a China batch that never left back to being prepared", () => {
    expect(updateBlock()).toContain('existing.status === "at_depot" && !batchHasShipmentNumber(existing)');
  });

  it("offers the warehouses on the edit form", () => {
    expect(page).toContain('data-testid="batch-edit-warehouse"');
    expect(page).toContain('originWarehouseId: parseInt(String(formData.get("originWarehouseId") ?? ""), 10) || undefined');
  });
});
