import { describe, expect, it } from "vitest";
import { parcelCost, parcelCostUsd, affectsCost, COST_BEARING_FIELDS } from "./parcelCost";

/**
 * The multiplication that four places were each doing for themselves, and a
 * fifth — editing a parcel — was not doing at all.
 */

describe("air is sold by the space a parcel takes", () => {
  it("multiplies the rate by the scale weight when the box is dense", () => {
    const { amountUsd } = parcelCost({ rate: 11, unit: "kg", weightKg: "0.71" });
    expect(amountUsd).toBeCloseTo(7.81, 2);
  });

  it("multiplies by the volumetric weight when the box is light and large", () => {
    // 60 × 40 × 30 ÷ 6000 = 12 kg by volume against 2 kg on the scale.
    const { amountUsd, billedOnVolume } = parcelCost({
      rate: 10, unit: "kg", weightKg: "2", lengthCm: "60", widthCm: "40", heightCm: "30",
    });
    expect(billedOnVolume).toBe(true);
    expect(amountUsd).toBeCloseTo(120, 2);
  });

  it("uses the install's divisor rather than a number written into the code", () => {
    // The same carton at 5000 is dearer, and three of the four copies of this
    // arithmetic could never have known.
    const at6000 = parcelCost({ rate: 10, unit: "kg", weightKg: "2", lengthCm: "60", widthCm: "40", heightCm: "30" });
    const at5000 = parcelCost({ rate: 10, unit: "kg", weightKg: "2", lengthCm: "60", widthCm: "40", heightCm: "30", divisor: 5000 });
    expect(at5000.amountUsd).toBeGreaterThan(at6000.amountUsd);
    expect(at5000.amountUsd).toBeCloseTo(144, 2);
  });

  it("ignores dimensions when one side is missing rather than treating it as zero", () => {
    const { amountUsd } = parcelCost({
      rate: 10, unit: "kg", weightKg: "3", lengthCm: "60", widthCm: "40",
    });
    expect(amountUsd).toBeCloseTo(30, 2);
  });
});

describe("sea is sold by volume outright", () => {
  it("multiplies the rate by the cubic metres", () => {
    const { amountUsd } = parcelCost({ rate: 220, unit: "cbm", volumeCbm: "0.35", weightKg: "400" });
    expect(amountUsd).toBeCloseTo(77, 2);
  });

  it("does not fall back to weight when there is no measurement", () => {
    // A sea parcel priced off its weight would be a number nobody charges.
    expect(parcelCost({ rate: 220, unit: "cbm", weightKg: "400" }).amountUsd).toBe(0);
  });
});

describe("zero means not known, and is never a guess", () => {
  it("returns nothing when no rate has been decided", () => {
    expect(parcelCostUsd({ rate: 0, unit: "kg", weightKg: "10" })).toBeUndefined();
  });

  it("returns nothing when the parcel has not been weighed", () => {
    // This is the state the reported parcel was in: registered before anyone
    // put it on the scale.
    expect(parcelCostUsd({ rate: 11, unit: "kg", weightKg: "0" })).toBeUndefined();
  });

  it("returns a two-decimal string when it does know", () => {
    expect(parcelCostUsd({ rate: 11, unit: "kg", weightKg: "0.13" })).toBe("1.43");
  });

  it("never returns a negative or a NaN from junk input", () => {
    for (const junk of ["", "abc", "-4", null, undefined]) {
      const { amountUsd } = parcelCost({ rate: 11, unit: "kg", weightKg: junk as any });
      expect(Number.isFinite(amountUsd)).toBe(true);
      expect(amountUsd).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("only a fact behind the price sends us back to the pricing tables", () => {
  it("knows the fields that move a price", () => {
    for (const f of ["weightKg", "lengthCm", "widthCm", "heightCm", "volumeCbm", "shippingType", "batchId", "customerId"]) {
      expect(COST_BEARING_FIELDS as readonly string[]).toContain(f);
    }
  });

  it("reprices when the weight is corrected", () => {
    expect(affectsCost({ weightKg: "0.71" })).toBe(true);
  });

  it("reprices when the parcel changes hands or shipments", () => {
    expect(affectsCost({ customerId: 12 })).toBe(true);
    expect(affectsCost({ batchId: 51 })).toBe(true);
  });

  it("leaves the price alone when only a description is fixed", () => {
    // Repricing on every edit would change money behind somebody's back.
    expect(affectsCost({ description: "قوماش" })).toBe(false);
    expect(affectsCost({ trackingNumber: "YT888", categoryId: 3 })).toBe(false);
  });

  it("treats an absent field as unchanged, not as cleared", () => {
    expect(affectsCost({ weightKg: undefined })).toBe(false);
  });
});
