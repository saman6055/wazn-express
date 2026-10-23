import { describe, expect, it } from "vitest";
import { addFigures, carrierVolumetric, NO_FIGURES, roundFigures, volumetricOf } from "./volumetricReport";

/**
 * Owner, 2026-10-23: per batch, what the customers paid for volume beyond the
 * scale, what the carrier charged us for its own, and what is left. Proven on
 * real MySQL with the same figures as below.
 */
describe("volumetric figures", () => {
  // 5 kg on the scale, 12 kg by volume, $10/kg.
  const box = { weightKg: "5", lengthCm: "50", widthCm: "40", heightCm: "36" };

  it("one parcel: the volume extra and what it was paid, the discount apart", () => {
    const full = volumetricOf({ ...box, calculatedCostUsd: "120.00" }, 6000);
    expect(full.extraKg).toBeCloseTo(7);
    expect(full.paidForVolumeUsd).toBeCloseTo(70);
    const off = volumetricOf({ ...box, billedWeightKg: "7", calculatedCostUsd: "70.00" }, 6000);
    expect(off.extraKg).toBeCloseTo(7);
    expect(off.discountKg).toBeCloseTo(5);
    expect(off.discountUsd).toBeCloseTo(50);
    expect(off.paidForVolumeUsd).toBeCloseTo(20);
  });

  it("no price yet: the batch's rate", () => {
    expect(volumetricOf(box, 6000, 10).paidForVolumeUsd).toBeCloseTo(70);
  });

  it("the batch against its carrier: 9 kg paid for at $10, 8 kg charged at $6, $42 left", () => {
    const ours = roundFigures(addFigures(addFigures(
      volumetricOf({ ...box, billedWeightKg: "7", calculatedCostUsd: "70" }, 6000),
      volumetricOf({ ...box, calculatedCostUsd: "120" }, 6000)),
      volumetricOf({ weightKg: "20", lengthCm: "30", widthCm: "30", heightCm: "30", calculatedCostUsd: "200" }, 6000)));
    expect(ours.paidForVolumeUsd).toBe(90);
    const c = carrierVolumetric(ours, { actualWeightKg: "30", chargedWeightKg: "38" }, 6);
    expect(c.extraKg).toBe(8);
    expect(c.extraCostUsd).toBe(48);
    expect(c.leftForUsUsd).toBe(42);
  });

  it("the carrier's weight not typed: unknown, never a guess", () => {
    const c = carrierVolumetric(NO_FIGURES, { actualWeightKg: null, chargedWeightKg: null }, 6);
    expect(c.chargedKg).toBeNull();
    expect(c.leftForUsUsd).toBeNull();
  });
});
