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
