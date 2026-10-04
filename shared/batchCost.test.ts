import { describe, expect, it } from "vitest";
import { carrierCostBase, carrierDifference, carrierBaseKgSql, CARRIER_BASE_CBM_SQL, deriveCostRate, resolveBatchCost } from "./batchCost";

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
 * Owner, 2026-10-04: "profit and loss on the basis of OUR weight — the weight
 * and size measured tracking by tracking, the same the customer paid on. If
 * the carrier's billed weight is there, cost is worked from that and compared
 * with ours." The hand-typed "actual weight" is no longer part of it.
 * Proved on a real MySQL: the SQL bills the same kilos as chargeableWeight.
 */
describe("what the carrier's rate multiplies", () => {
  it("the carrier's billed weight, else ours as the customer was charged", () => {
    expect(carrierCostBase("air_regular", { chargedWeightKg: "20" }, { billedKg: 99, cbm: 0 })).toBe(20);
    expect(carrierCostBase("air_regular", { chargedWeightKg: null }, { billedKg: 69.1, cbm: 0 })).toBe(69.1);
    expect(carrierCostBase("sea", { chargedCbm: "" }, { billedKg: 0, cbm: 1.326 })).toBe(1.326);
    // The batch's typed "actual weight" is not read at all any more.
    expect(carrierCostBase("air_regular", { chargedWeightKg: null, actualWeightKg: "88.89" } as never, { billedKg: 38.2, cbm: 0 })).toBe(38.2);
  });

  it("ours against the carrier's: fewer billed is extra profit, more is less", () => {
    expect(carrierDifference("air_regular", { chargedWeightKg: "60", costPerKg: "8.8" }, { billedKg: 69.1, cbm: 0 }))
      .toEqual({ ours: 69.1, carrier: 60, units: expect.closeTo(9.1, 5), usd: 80.08, unit: "kg" });
    expect(carrierDifference("air_regular", { chargedWeightKg: "58", costPerKg: "8.8" }, { billedKg: 50, cbm: 0 })?.usd).toBe(-70.4);
    expect(carrierDifference("air_regular", { chargedWeightKg: null, costPerKg: "8.8" }, { billedKg: 50, cbm: 0 }), "no carrier figure, nothing to compare").toBeNull();
  });

  it("the reports use the same order, with the divisor in force", () => {
    const kg = carrierBaseKgSql(5000);
    expect(kg.indexOf("chargedWeightKg")).toBeLessThan(kg.indexOf("FROM packages"));
    expect(kg).toContain("GREATEST(");
    expect(kg).toContain("/ 5000");
    expect(kg).not.toContain("actualWeightKg");
    expect(CARRIER_BASE_CBM_SQL).not.toContain("actualCbm");
  });
});
