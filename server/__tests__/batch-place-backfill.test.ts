import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * A batch with no place was China to the stages and Erbil to the close check
 * and the dispatch page (audit 2026-11-05). The last unstamped rows take their
 * origin warehouse's country, after the older backfills, never overwriting.
 */
const src = readFileSync(resolve(__dirname, "../_core/migrations.ts"), "utf8");

describe("batch place backfill from the warehouse", () => {
  it("stamps only unstamped batches, after the creator rule", () => {
    const creator = src.indexOf('name: "backfill.batches.createdInLocation"');
    const wh = src.indexOf('name: "backfill.batches.placeFromWarehouse"');
    expect(creator).toBeGreaterThan(-1);
    expect(wh).toBeGreaterThan(creator);
    const body = src.slice(wh, src.indexOf("},", wh));
    expect(body).toContain("JOIN warehouses w ON w.id = b.originWarehouseId");
    expect(body).toContain("WHERE b.createdInCountryId IS NULL");
  });
});
