/**
 * Closing a batch writes no order freight for a carton whose own freight is
 * already on the account (2026-11-05: 28 cartons charged twice on 2 Nov).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

describe("order freight at batch close", () => {
  it("asks whether the carton's own freight is charged before splitting it over orders", () => {
    const src = read("server/routers/batches.router.ts");
    const ask = src.indexOf("await db.parcelFreightAlreadyCharged(pkg.id, pkg.customerId)");
    const split = src.indexOf("// 3. Split shipping across orders by weight/CBM");
    expect(ask).toBeGreaterThan(0);
    expect(ask).toBeLessThan(split);
    expect(src.slice(ask, split)).toContain("shippingCost = 0;");
  });
  it("reads only the parcel's own rows, never an order's", () => {
    const src = read("server/db/batchCharging.db.ts");
    const fn = src.slice(src.indexOf("export async function parcelFreightAlreadyCharged("));
    expect(fn).toContain("parcelOwnCharges(db, account, packageId)");
  });
});
