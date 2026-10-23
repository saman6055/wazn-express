import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

/** Owner, 2026-10-23: the volumetric discount reaches every price, the account and the box. */
describe("the volumetric discount reaches every door", () => {
  it("the column is added at boot", () => {
    expect(read("server/_core/migrations.ts")).toContain('{ name: "packages.billedWeightKg", sql: "ALTER TABLE packages ADD COLUMN billedWeightKg DECIMAL(10,3) NULL" },');
  });

  it("every repricing keeps it", () => {
    expect(read("server/services/parcelPricing.service.ts")).toContain("billedWeightKg: facts.billedWeightKg,");
    expect(read("server/lib/linkDeclaredParcel.ts")).toContain("billedWeightKg: pkg.billedWeightKg,");
    expect(read("server/routers/packages.router.ts").split("billedWeightKg: pkg.billedWeightKg,").length - 1).toBe(2);
    expect(read("server/lib/correctRegisteredParcel.ts")).toContain("billedWeightKg,\n    });");
  });

  it("the box prices a parcel by the kilos charged, and follows a discount given inside it", () => {
    expect(read("server/routers/scanning.router.ts")).toContain("weightKg = chargeableWeight(pkg, (await db.getVolumetricDivisor()) || DEFAULT_VOLUMETRIC_DIVISOR).chargeableKg.toFixed(2);");
    const corr = read("server/db/parcelCorrection.db.ts");
    expect(corr).toContain("set({ calculatedCostUsd: facts.calculatedCostUsd, weightKg: kg })");
    expect(read("server/lib/correctRegisteredParcel.ts")).toContain("weightKg: chargeableWeight({ ...pkg, billedWeightKg: billed }, divisor).chargeableKg.toFixed(2),");
    expect(corr).toContain("for (const boxId of result.boxIds) await recalculateBoxTotals(boxId);");
  });

  it("a receipt still refuses: money taken is not moved from here", () => {
    expect(read("server/db/parcelCorrection.db.ts")).toContain('if (refusal && !(opts?.boxFollows && hold?.kind === "box")) throw new Error(refusal);');
  });

  it("the batch's real cost per kilo counts the space, not the discounted kilos", () => {
    expect(read("server/db/batches.db.ts")).toContain("return sum + (w.fullKg ?? w.chargeableKg);");
  });
});

/**
 * Owner, 2026-10-23, "does it fit every part of the accounts?" - seven doors
 * worked a parcel's kilos out by their own arithmetic and would have put the
 * full volume back: the old batch-delivery charge, the claim charge, the
 * status update, the delivery recalculation, the customer portal. Each ends
 * with afterVolumetricDiscount now; the batch's cost is measured on the space
 * carried, never on the discounted kilos. Proven on real MySQL: account line,
 * invoice, revenue, batch profit, portal, batch delivery, commission till.
 */
describe("no door works a parcel's kilos out around the discount", () => {
  it("every hand-written max(scale, volume) for a parcel ends with the discount", () => {
    const raw = "const chargeableKg = Math.max(actualKg, volumetricKg);";
    // The one left is an order's own sizes, not a parcel's (batches.router order freight line).
    expect(read("server/routers/batches.router.ts").split(raw).length - 1).toBe(1);
    expect(read("server/routers/packages.router.ts")).not.toContain(raw);
    expect(read("server/db/portal.db.ts")).not.toContain(raw);
    expect(read("server/routers/batches.router.ts").split("afterVolumetricDiscount(actualKg, volumetricKg, pkg.billedWeightKg)").length - 1).toBe(3);
  });

  it("the batch's cost base and carrier comparison use the space carried", () => {
    const src = read("server/db/batches.db.ts");
    expect(src).toContain("const costBase = carrierCostBase(batchData.shippingType, batchData, { billedKg: totalSpaceWeight, cbm: packageTotalCbm });");
    expect(src).toContain("ourBilledKg: totalSpaceWeight,");
  });

  it("an order's parcel: a full package refuses, a commission order whose freight is charged refuses", () => {
    const src = read("server/lib/correctRegisteredParcel.ts");
    expect(src).toContain('const fullPackage = orders.find((o) => o.orderType !== "commission");');
    expect(src).toContain("const freightCharged = orders.find((o) => o.isShippingCharged);");
  });
});
