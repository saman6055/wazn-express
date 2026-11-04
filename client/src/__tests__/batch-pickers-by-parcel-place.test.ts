import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Erbil staff assigning Guangzhou parcels saw only Erbil batches, and the
 * server refused every one (audit 2026-11-05). The parcel's warehouse decides.
 */
const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("batch pickers follow the parcel's place", () => {
  it("the assignment scanner lists every open batch, own desk first, each with its place", () => {
    const src = read("pages/scanning/BatchAssignmentScanner.tsx");
    expect(src).toContain(".filter((b: any) => batchOpenForRegistration(b))\n      .sort(");
    expect(src).toContain('data-testid="batch-place"');
  });

  it("the parcel edit dialog asks with the parcel's warehouse", () => {
    const src = read("pages/packages/Packages.tsx");
    expect(src).toContain("selectedPackage?.originWarehouseId ? { warehouseId: selectedPackage.originWarehouseId } : undefined");
  });
});
