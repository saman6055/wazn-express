import { describe, expect, it } from "vitest";
import { carrierCostBase, CARRIER_BASE_KG_SQL, CARRIER_BASE_CBM_SQL, deriveCostRate, resolveBatchCost } from "./batchCost";

describe("resolveBatchCost", () => {
  it("an explicit per-unit rate wins, even when a total is also recorded", () => {
    const r = resolveBatchCost({
      shippingType: "air_regular",
      costPerKg: "7.00",
      shippingCost: "9999",
      chargeableKg: 100,
    });
    expect(r).toEqual({ totalCostUsd: 700, effectiveRate: 7, unit: "kg", source: "rate" });
  });

  it("falls back to the carrier's total and divides it over the base", () => {
    const r = resolveBatchCost({
      shippingType: "air_regular",
      shippingCost: "2000",
      chargeableKg: 118,
    });
    expect(r.source).toBe("total");
    expect(r.totalCostUsd).toBe(2000);
    expect(r.effectiveRate).toBeCloseTo(16.9491, 3);
  });

  it("a sea batch divides over CBM, not kilograms", () => {
    const r = resolveBatchCost({
      shippingType: "sea",
      shippingCost: 1800,
      totalCbm: 5,
      chargeableKg: 99999,
    });
    expect(r.unit).toBe("cbm");
    expect(r.effectiveRate).toBe(360);
    expect(r.totalCostUsd).toBe(1800);
  });

  it("a total with no base yet is still the true cost — the rate just waits", () => {
    const r = resolveBatchCost({ shippingType: "air_regular", shippingCost: "2000" });
    expect(r.totalCostUsd).toBe(2000);
    expect(r.effectiveRate).toBe(0);
    expect(r.source).toBe("total");
  });

  it("says honestly when no cost was recorded at all", () => {
    expect(resolveBatchCost({ shippingType: "sea", totalCbm: 4 })).toEqual({
      totalCostUsd: 0,
      effectiveRate: 0,
      unit: "cbm",
      source: "none",
    });
  });

  it("treats zero, blank and junk the same as absent", () => {
    const r = resolveBatchCost({
      shippingType: "air_regular",
      costPerKg: "0",
      shippingCost: "abc",
      chargeableKg: 50,
    });
    expect(r.source).toBe("none");
  });
});

describe("deriveCostRate", () => {
  it("divides the total over the billed base, rounded to cents", () => {
    expect(
      deriveCostRate({ shippingType: "air_regular", shippingCost: "2000", chargeableKg: 118 })
    ).toBe(16.95);
  });

  it("derives nothing when a rate is already set", () => {
    expect(
      deriveCostRate({
        shippingType: "air_regular",
        costPerKg: "7",
        shippingCost: "2000",
        chargeableKg: 118,
      })
    ).toBeNull();
  });

  it("derives nothing without a total or without a base", () => {
    expect(deriveCostRate({ shippingType: "sea", totalCbm: 5 })).toBeNull();
    expect(deriveCostRate({ shippingType: "sea", shippingCost: "1800" })).toBeNull();
  });
});

describe("a rate without its weight", () => {
  it("falls back to the carrier's total instead of costing nothing", () => {
    // AIR-2026-035: 9.40/kg, no billed weight, $70.59 recorded.
    const r = resolveBatchCost({ shippingType: "air_regular", costPerKg: "9.40", shippingCost: "70.59" });
    expect(r.totalCostUsd).toBe(70.59);
    expect(r.source).toBe("total");
  });

  it("says the cost is not known yet when there is no total either", () => {
    const r = resolveBatchCost({ shippingType: "air_regular", costPerKg: "9.40" });
    expect(r.totalCostUsd).toBe(0);
    expect(r.source).toBe("none");
  });
});


/*
 * Owner, 2026-10-04: the old batches were given a rate and the carrier's
 * "actual weight" only — and the reports still said they cost nothing, while
 * the batch's own page multiplied the rate by our parcels' volume weight.
 * One rule now, in code and SQL alike (proved equal on a real MySQL).
 */
describe("what the carrier's rate multiplies", () => {
  it("its billed weight, then its scale weight, then our parcels' plain weight", () => {
    expect(carrierCostBase("air_regular", { chargedWeightKg: "20", actualWeightKg: "25" }, { weightKg: 99, cbm: 0 })).toBe(20);
    expect(carrierCostBase("air_regular", { chargedWeightKg: null, actualWeightKg: "69.12" }, { weightKg: 60.4, cbm: 0 })).toBe(69.12);
    expect(carrierCostBase("air_regular", {}, { weightKg: 13, cbm: 0 })).toBe(13);
    expect(carrierCostBase("sea", { chargedCbm: "", actualCbm: "1.09" }, { weightKg: 0, cbm: 1.326 })).toBe(1.09);
  });

  it("the reports use the same order", () => {
    for (const s of [CARRIER_BASE_KG_SQL, CARRIER_BASE_CBM_SQL]) {
      expect(s.indexOf("charged")).toBeLessThan(s.indexOf("actual"));
      expect(s.indexOf("actual")).toBeLessThan(s.indexOf("FROM packages"));
    }
  });
});
