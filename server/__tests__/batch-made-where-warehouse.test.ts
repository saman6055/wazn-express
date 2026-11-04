import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * A batch is China's or Erbil's by its origin warehouse, not by the desk of
 * whoever made it (owner, 2026-11-03). Made in Erbil for Guangzhou cartons,
 * it must still read «ئامادەکردن لە چین», never «لە کۆگای هەولێر».
 */
const router = readFileSync(resolve(__dirname, "../routers/batches.router.ts"), "utf8");

function createBlock(): string {
  const start = router.indexOf("create: staffProcedure");
  const end = router.indexOf("delete: adminProcedure", start);
  expect(start, "batches.create").toBeGreaterThan(-1);
  expect(end, "end of batches.create").toBeGreaterThan(start);
  return router.slice(start, end);
}

describe("a batch is made where its warehouse is", () => {
  it("reads the origin warehouse", () => {
    expect(createBlock()).toContain("db.getWarehouseById(input.originWarehouseId)");
  });

  it("stamps the warehouse's country first, the creator's office only as a fallback", () => {
    const create = createBlock();
    expect(create).toContain("createdInCountryId: originWarehouse?.countryId ?? workLocation.countryId");
    expect(create).toContain("createdInCity: originWarehouse?.city ?? workLocation.city");
  });
});
