import { describe, expect, it } from "vitest";
import { chargeableWeight, volumeCbm, volumetricWeightKg, DEFAULT_VOLUMETRIC_DIVISOR } from "./chargeableWeight";
import { parcelCost } from "./parcelCost";

/**
 * A cubic metre given directly is the parcel's volume (owner, 2026-09-23).
 *
 * "Sometimes you do not need to measure — the CBM is already there." Asked
 * whether a CBM typed in should set the air price as well, or only be
 * recorded: "it must decide the volumetric price."
 *
 * It is the same arithmetic by another road. One cubic metre is 1,000,000
 * cm³, so (L × W × H) / divisor and (cbm × 1,000,000) / divisor are the same
 * sum — which is why this changes nothing for the parcels the system already
 * has: it fills their volume in from their own three sides.
 */

const DIMS = { lengthCm: 40, widthCm: 30, heightCm: 20 }; // 0.024 m³

describe("the volume", () => {
  it("is the one given, when one is given", () => {
    expect(volumeCbm({ volumeCbm: 0.5, ...DIMS })).toBe(0.5);
    expect(volumeCbm({ volumeCbm: "0.028" })).toBe(0.028);
  });

  it("is the three sides when it is not", () => {
    expect(volumeCbm(DIMS)).toBeCloseTo(0.024, 6);
    expect(volumeCbm({ volumeCbm: 0, ...DIMS })).toBeCloseTo(0.024, 6);
    expect(volumeCbm({ lengthCm: 40, widthCm: 30 })).toBe(0);
  });
});

describe("what that volume weighs", () => {
  it("reaches the divisor by the same road as the sides", () => {
    expect(volumetricWeightKg(DIMS)).toBeCloseTo((40 * 30 * 20) / DEFAULT_VOLUMETRIC_DIVISOR, 6);
    expect(volumetricWeightKg({ volumeCbm: 0.024 })).toBeCloseTo(volumetricWeightKg(DIMS), 6);
  });

  it("obeys the install's own divisor", () => {
    expect(volumetricWeightKg({ volumeCbm: 0.024 }, 5000)).toBeCloseTo(4.8, 6);
  });

  it("is nothing without a volume", () => {
    expect(volumetricWeightKg({})).toBe(0);
    expect(volumetricWeightKg({ volumeCbm: "-2" })).toBe(0);
  });
});

describe("the air price", () => {
  it("is decided by a volume typed in, with no sides at all", () => {
    const priced = parcelCost({ rate: 5, unit: "kg", weightKg: 2, volumeCbm: 0.06 });
    // 0.06 m³ → 10 volumetric kg, which beats the 2 kg on the scale.
    expect(priced.quantity).toBeCloseTo(10, 6);
    expect(priced.billedOnVolume).toBe(true);
    expect(priced.amountUsd).toBeCloseTo(50, 6);
  });

  it("still takes the greater of the scale and the volume", () => {
    const heavy = chargeableWeight({ weightKg: 30, volumeCbm: 0.024 });
    expect(heavy.chargeableKg).toBe(30);
    expect(heavy.billedOnVolume).toBe(false);
  });

  it("changes nothing for a parcel whose volume came from its own sides", () => {
    const fromSides = chargeableWeight({ weightKg: 1, ...DIMS });
    const bothStored = chargeableWeight({ weightKg: 1, ...DIMS, volumeCbm: 0.024 });
    expect(bothStored.chargeableKg).toBeCloseTo(fromSides.chargeableKg, 6);
  });

  it("sea is unaffected — it was always billed on the volume itself", () => {
    expect(parcelCost({ rate: 100, unit: "cbm", volumeCbm: 0.028 }).amountUsd).toBeCloseTo(2.8, 6);
  });
});
