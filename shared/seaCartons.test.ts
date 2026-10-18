import { describe, expect, it } from "vitest";
import {
  SMALL_PARCEL_CBM,
  cartonCountOf,
  cartonVolume,
  cartonVolumeText,
  parcelCost,
  smallParcelExtraPercent,
  withSmallParcelExtra,
} from "./parcelCost";

/**
 * Sea, owner 2026-10-17/18 - his own example from Quick Register: one carton
 * 47.5 × 47.5 × 57 cm = 0.1286 m³.
 *
 *   «عەدەد»: the size typed once, how many cartons of it; the box must say
 *   four cartons, each one's CBM, and the total.
 *   «بەریدی بچووک»: under 0.25 m³ a parcel pays the batch's rate plus a
 *   percent (1 to 100) the batch sets.
 */
const ONE = { lengthCm: "47.5", widthCm: "47.5", heightCm: "57" };

describe("cartons of one size", () => {
  it("four of his carton are 0.5144 m³", () => {
    const v = cartonVolume({ ...ONE, cartonCount: 4 });
    expect(v.count).toBe(4);
    expect(v.perCartonCbm.toFixed(4)).toBe("0.1286");
    expect(v.totalCbm.toFixed(4)).toBe("0.5144");
  });

  it("a volume typed for one carton is multiplied the same way", () => {
    expect(cartonVolume({ volumeCbm: "0.2", cartonCount: 3 }).totalCbm).toBe(0.6);
  });

  it("no count, or a nonsense count, is one carton", () => {
    for (const c of [undefined, null, "", 0, -2, "abc"]) expect(cartonCountOf(c as never), String(c)).toBe(1);
    expect(cartonVolume(ONE).totalCbm.toFixed(4)).toBe("0.1286");
  });

  it("is written the way the box and the receipt write it", () => {
    expect(cartonVolumeText(0.5144, 4)).toBe("4 × 0.129 = 0.514");
    expect(cartonVolumeText(0.5144, 4, 4)).toBe("4 × 0.1286 = 0.5144");
    expect(cartonVolumeText(0.1286, 1)).toBe("0.129");
    expect(cartonVolumeText(0.1286, null)).toBe("0.129");
  });

  it("four cartons at $350 are four times one carton", () => {
    const four = parcelCost({ rate: 350, unit: "cbm", volumeCbm: cartonVolume({ ...ONE, cartonCount: 4 }).totalCbm });
    const one = parcelCost({ rate: 350, unit: "cbm", volumeCbm: cartonVolume(ONE).totalCbm });
    expect(four.amountUsd.toFixed(2)).toBe("180.05");
    // The total volume is kept to six places, so the two agree to the cent.
    expect(Math.abs(four.amountUsd - one.amountUsd * 4)).toBeLessThan(0.005);
  });
});

describe("small parcels pay the batch's extra", () => {
  it("his example: 0.1286 m³ at $350 with 20% is $54.01", () => {
    const priced = parcelCost({ rate: 350, unit: "cbm", volumeCbm: "0.1286", smallParcelPercent: 20 });
    expect(priced.amountUsd.toFixed(2)).toBe("54.01");
  });

  it("is judged on the whole tracking: four of his cartons are not small", () => {
    const total = cartonVolume({ ...ONE, cartonCount: 4 }).totalCbm;
    expect(smallParcelExtraPercent(total, 20)).toBe(0);
    expect(parcelCost({ rate: 350, unit: "cbm", volumeCbm: total, smallParcelPercent: 20 }).amountUsd.toFixed(2)).toBe("180.05");
  });

  it("0.25 itself is not small; just under is", () => {
    expect(SMALL_PARCEL_CBM).toBe(0.25);
    expect(smallParcelExtraPercent(0.25, 20)).toBe(0);
    expect(smallParcelExtraPercent(0.2499, 20)).toBe(20);
  });

  it("a batch with no percent adds nothing, and 100 is the most", () => {
    expect(withSmallParcelExtra(45.01, 0.1286, null)).toBe(45.01);
    expect(withSmallParcelExtra(45.01, 0.1286, "")).toBe(45.01);
    expect(withSmallParcelExtra(10, 0.1, 250)).toBe(20);
  });

  it("never touches weight: an air parcel's price is the same with or without it", () => {
    const air = { rate: 11, unit: "kg" as const, weightKg: "2", lengthCm: "10", widthCm: "10", heightCm: "10" };
    expect(parcelCost({ ...air, smallParcelPercent: 50 }).amountUsd).toBe(parcelCost(air).amountUsd);
  });

  it("an unmeasured parcel is still nothing, extra or not", () => {
    expect(parcelCost({ rate: 350, unit: "cbm", volumeCbm: null, smallParcelPercent: 20 }).amountUsd).toBe(0);
  });
});
