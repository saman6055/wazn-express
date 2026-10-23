import { describe, expect, it } from "vitest";
import { chargeableWeight } from "./chargeableWeight";
import { parcelCost } from "./parcelCost";

/**
 * Owner, 2026-10-23: a parcel of 5 kg on the scale and 12 kg by volume can be
 * charged as 7 kg - the sides stay as measured, so the volumetric figures stay
 * true, and the kilos charged are written beside them. Proven on real MySQL
 * (account, box, till and batch charge all follow).
 */
describe("a volumetric discount", () => {
  const box = { weightKg: "5", lengthCm: "50", widthCm: "40", heightCm: "36" }; // 12 kg by volume

  it("charges the kilos chosen, keeps the volume and says what was taken off", () => {
    const w = chargeableWeight({ ...box, billedWeightKg: "7" }, 6000);
    expect(w.volumetricKg).toBeCloseTo(12);
    expect(w.chargeableKg).toBeCloseTo(7);
    expect(w.fullKg).toBeCloseTo(12);
    expect(w.discountKg).toBeCloseTo(5);
    expect(parcelCost({ rate: 10, unit: "kg", ...box, billedWeightKg: "7", divisor: 6000 }).amountUsd).toBeCloseTo(70);
  });

  it("never below the scale, never above the volume", () => {
    expect(chargeableWeight({ ...box, billedWeightKg: "3" }, 6000).chargeableKg).toBeCloseTo(5);
    expect(chargeableWeight({ ...box, billedWeightKg: "20" }, 6000).chargeableKg).toBeCloseTo(12);
  });

  it("no discount, or no volumetric excess: charged as measured", () => {
    expect(chargeableWeight(box, 6000).chargeableKg).toBeCloseTo(12);
    expect(chargeableWeight(box, 6000).discountKg).toBe(0);
    const heavy = { weightKg: "20", lengthCm: "30", widthCm: "30", heightCm: "30", billedWeightKg: "10" };
    expect(chargeableWeight(heavy, 6000).chargeableKg).toBeCloseTo(20);
  });
});
