import { describe, expect, it } from "vitest";
import { RATE_SOURCE_NOTE, billingUnit, resolveBatchRate } from "./batchRate";

/**
 * The bug this was written for: a customer with an agreed rate on a shipment
 * saw that rate in the portal and on the profit report, and was then invoiced
 * at the shipment default. The agreed rate was stored, displayed, and never
 * once used to charge anybody.
 */

const air = (over: Record<string, unknown> = {}) => ({
  unit: "kg" as const,
  batchPricePerKg: "11.00",
  ...over,
});

const sea = (over: Record<string, unknown> = {}) => ({
  unit: "cbm" as const,
  batchPricePerCbm: "363.00",
  ...over,
});

describe("which unit a shipment is billed in", () => {
  it("bills sea by volume and everything else by weight", () => {
    expect(billingUnit("sea")).toBe("cbm");
    for (const type of ["air_regular", "air_irregular", null, undefined, ""]) {
      expect(billingUnit(type as string), String(type)).toBe("kg");
    }
  });
});

describe("the agreed rate comes first", () => {
  it("beats the shipment default", () => {
    // This is the whole fix. $9 was agreed; $11 was being charged.
    expect(resolveBatchRate(air({ customerPricePerKg: "9.00" })))
      .toEqual({ rate: 9, source: "customer" });
  });

  it("beats a tier the customer would otherwise fall into", () => {
    const r = resolveBatchRate(air({
      customerPricePerKg: "9.00",
      useTieredPricing: true,
      tierRate: 10,
    }));
    expect(r).toEqual({ rate: 9, source: "customer" });
  });

  it("applies by volume on a sea shipment", () => {
    expect(resolveBatchRate(sea({ customerPricePerCbm: "300.00" })))
      .toEqual({ rate: 300, source: "customer" });
  });

  it("ignores the rate belonging to the other unit", () => {
    // A per-kg agreement says nothing about a shipment billed by volume.
    expect(resolveBatchRate(sea({ customerPricePerKg: "9.00" })).source).toBe("batch");
    expect(resolveBatchRate(air({ customerPricePerCbm: "300.00" })).source).toBe("batch");
  });

  it("treats an empty field as no agreement", () => {
    // A blank row must not bill the customer nothing.
    for (const v of [null, undefined, "", "0", 0, "abc"]) {
      const r = resolveBatchRate(air({ customerPricePerKg: v }));
      expect(r, String(v)).toEqual({ rate: 11, source: "batch" });
    }
  });
});

describe("then the tier", () => {
  it("applies when the shipment is priced in tiers", () => {
    expect(resolveBatchRate(air({ useTieredPricing: true, tierRate: 10 })))
      .toEqual({ rate: 10, source: "tier" });
  });

  it("is ignored when tiered pricing is switched off", () => {
    // Tier rows outlive the setting. Honouring them anyway would quietly
    // re-price every shipment whose tiers were abandoned.
    expect(resolveBatchRate(air({ useTieredPricing: false, tierRate: 10 })))
      .toEqual({ rate: 11, source: "batch" });
  });

  it("falls through when no tier matched", () => {
    expect(resolveBatchRate(air({ useTieredPricing: true, tierRate: null })))
      .toEqual({ rate: 11, source: "batch" });
    expect(resolveBatchRate(air({ useTieredPricing: true, tierRate: 0 })))
      .toEqual({ rate: 11, source: "batch" });
  });
});

describe("then the shipment's own rate", () => {
  it("applies when nothing else does", () => {
    expect(resolveBatchRate(air())).toEqual({ rate: 11, source: "batch" });
    expect(resolveBatchRate(sea())).toEqual({ rate: 363, source: "batch" });
  });

  it("reads it however the database hands it over", () => {
    expect(resolveBatchRate(air({ batchPricePerKg: 11 })).rate).toBe(11);
    expect(resolveBatchRate(air({ batchPricePerKg: "11.00" })).rate).toBe(11);
  });
});

describe("when nothing has been decided", () => {
  it("says so instead of inventing a figure", () => {
    // The caller must be able to tell "free" from "not priced yet".
    expect(resolveBatchRate({ unit: "kg" })).toEqual({ rate: 0, source: "none" });
    expect(resolveBatchRate(air({ batchPricePerKg: null })))
      .toEqual({ rate: 0, source: "none" });
    expect(resolveBatchRate(sea({ batchPricePerCbm: "" })))
      .toEqual({ rate: 0, source: "none" });
  });

  it("still honours an agreement on an otherwise unrated shipment", () => {
    const r = resolveBatchRate(air({ batchPricePerKg: null, customerPricePerKg: "9.00" }));
    expect(r).toEqual({ rate: 9, source: "customer" });
  });
});

describe("the order itself", () => {
  it("holds whichever combination is present", () => {
    // Every combination of the three, so the precedence cannot be reordered
    // by accident.
    const cases: Array<[Record<string, unknown>, number, string]> = [
      [{ customerPricePerKg: "9", useTieredPricing: true, tierRate: 10 }, 9, "customer"],
      [{ customerPricePerKg: "9", useTieredPricing: false, tierRate: 10 }, 9, "customer"],
      [{ useTieredPricing: true, tierRate: 10 }, 10, "tier"],
      [{ useTieredPricing: false, tierRate: 10 }, 11, "batch"],
      [{}, 11, "batch"],
    ];
    for (const [over, rate, source] of cases) {
      expect(resolveBatchRate(air(over)), JSON.stringify(over)).toEqual({ rate, source });
    }
  });
});

describe("what an invoice line calls the rate", () => {
  it("names every source a charge can come from", () => {
    for (const source of ["customer", "tier", "batch"] as const) {
      expect(RATE_SOURCE_NOTE[source]?.ku?.trim(), source).toBeTruthy();
      expect(RATE_SOURCE_NOTE[source]?.en?.trim(), source).toBeTruthy();
    }
  });
});
