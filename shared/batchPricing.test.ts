import { describe, expect, it } from "vitest";
import { batchMissingSellingPrice, batchSellsBy } from "./batchPricing";

/**
 * A parcel put into a batch with no selling price is invoiced at nothing
 * when the batch is delivered. Nobody notices at the counter — the receipt
 * comes out short, the customer pays what it says, and the difference is
 * gone. It is the one omission on the shipping side that costs money in
 * silence, which is why it is worth stopping the operator for.
 */
describe("a batch that cannot be charged for", () => {
  it("sells air by the kilo and sea by the cubic metre", () => {
    expect(batchSellsBy("air_regular")).toBe("kg");
    expect(batchSellsBy("air_irregular")).toBe("kg");
    expect(batchSellsBy("sea")).toBe("cbm");
    // An unknown or missing type is treated as air, which is the common case
    // and the pessimistic one: it demands a per-kg price.
    expect(batchSellsBy(null)).toBe("kg");
  });

  it("wants a per-kg price on an air batch", () => {
    expect(batchMissingSellingPrice({ shippingType: "air_regular", pricePerKg: "5.50" })).toBe(false);
    expect(batchMissingSellingPrice({ shippingType: "air_regular", pricePerKg: null })).toBe(true);
    // A CBM price on an air batch charges nothing: wrong axis.
    expect(batchMissingSellingPrice({ shippingType: "air_regular", pricePerCbm: "300" })).toBe(true);
  });

  it("wants a per-cbm price on a sea batch", () => {
    expect(batchMissingSellingPrice({ shippingType: "sea", pricePerCbm: "300" })).toBe(false);
    expect(batchMissingSellingPrice({ shippingType: "sea", pricePerKg: "5.50" })).toBe(true);
  });

  it("treats zero and empty as no price at all", () => {
    // A price of zero and no price are the same receipt.
    for (const value of ["0", "0.00", 0, "", null, undefined]) {
      expect(
        batchMissingSellingPrice({ shippingType: "air_regular", pricePerKg: value as never }),
        `"${String(value)}" should count as unpriced`,
      ).toBe(true);
    }
  });

  it("accepts tiers or a customer price as a price", () => {
    // Neither lives on the batch row, so the caller answers for them.
    expect(batchMissingSellingPrice({ shippingType: "air_regular" }, { hasTiers: true })).toBe(false);
    expect(batchMissingSellingPrice({ shippingType: "sea" }, { hasCustomerPricing: true })).toBe(false);
  });

  it("assumes the worst when told nothing", () => {
    // A warning that only fires when it is certain is a warning that misses
    // the case it exists for.
    expect(batchMissingSellingPrice({})).toBe(true);
  });
});
