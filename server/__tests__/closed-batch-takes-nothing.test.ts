import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** A closed batch takes no new parcel on the server, by any way in (audit 2026-11-05). */
const guard = readFileSync(resolve(__dirname, "../db/carrierGroup.db.ts"), "utf8");
const pk = readFileSync(resolve(__dirname, "../routers/packages.router.ts"), "utf8");
const sc = readFileSync(resolve(__dirname, "../routers/scanning.router.ts"), "utf8");

describe("closed batch takes nothing", () => {
  it("the one guard refuses a closed batch with the cure", () => {
    const start = guard.indexOf("export async function assertBatchMatchesDesk");
    const body = guard.slice(start, guard.indexOf("const desk = await placeInChina", start));
    expect(body).toContain('if (batch.status === "closed")');
    expect(body).toContain("کردنەوەی باچ");
  });

  it("create, assign, scan-register and the edit form all pass through it", () => {
    expect(pk).toContain("await db.assertBatchMatchesDesk(input.batchId, ctx.user.id, input.originWarehouseId);");
    expect(pk).toContain("await db.assertBatchMatchesDesk(input.batchId, ctx.user.id, parcel?.originWarehouseId);");
    expect(pk).toContain("await db.assertBatchMatchesDesk(data.batchId, ctx.user.id, pkg.originWarehouseId);");
    expect(sc).toContain("await db.assertBatchMatchesDesk(input.batchId, ctx.user.id, input.warehouseId);");
  });
});
