import { describe, expect, it } from "vitest";
import {
  SMALL_PARCEL_CBM,
  cartonCountOf,
  cartonVolume,
  cartonVolumeText,
  parcelCost,
  SMALL_PARCEL_MIN_USD,
  smallParcelAutoPercent,
  smallParcelPrice,
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

/**
 * The rule became automatic the same day (owner, 2026-10-18): the percent
 * follows the size - 100% at nothing, none from 0.25 m³ - measured on
 * everything the customer has in the batch, with a $5 least per tracking;
 * the batch only says on or off.
 */
describe("small sea customers: the system sets the percent", () => {
  const on = (t: number) => ({ on: true, customerTotalCbm: t });

  it("follows the size: the smaller, the more; none from 0.25", () => {
    expect(SMALL_PARCEL_CBM).toBe(0.25);
    expect(smallParcelAutoPercent(0.05)).toBeCloseTo(80, 6);
    expect(smallParcelAutoPercent(0.1)).toBeCloseTo(60, 6);
    expect(smallParcelAutoPercent(0.24)).toBeCloseTo(4, 6);
    expect(smallParcelAutoPercent(0.25)).toBe(0);
    expect(smallParcelAutoPercent(0.3)).toBe(0);
  });

  it("the table he was shown, at $350", () => {
    const row = (v: number) => smallParcelPrice(350 * v, on(v)).toFixed(2);
    expect(row(0.005)).toBe("5.00"); // the least
    expect(row(0.03)).toBe("19.74");
    expect(row(0.06)).toBe("36.96");
    expect(row(0.1)).toBe("56.00");
    expect(row(0.18)).toBe("80.64");
    expect(row(0.24)).toBe("87.36");
    expect(row(0.25)).toBe("87.50");
  });

  it("a customer with more always pays more in all: no step at 0.25", () => {
    let last = 0;
    for (let t = 0.001; t <= 0.4; t += 0.001) {
      const paid = smallParcelPrice(350 * t, on(t));
      expect(paid + 0.006, `at ${t.toFixed(3)}`).toBeGreaterThanOrEqual(last);
      last = paid;
    }
  });

  it("five cartons of 0.06 are one customer with 0.30: no extra on any", () => {
    const each = smallParcelPrice(350 * 0.06, on(0.3));
    expect(each.toFixed(2)).toBe("21.00");
    expect((each * 5).toFixed(2)).toBe("105.00");
  });

  it("while they arrive: 0.06, then 0.18, then 0.30 in the batch", () => {
    expect(smallParcelPrice(350 * 0.06, on(0.06)).toFixed(2)).toBe("36.96");
    expect(smallParcelPrice(350 * 0.06, on(0.18)).toFixed(2)).toBe("26.88");
    expect(smallParcelPrice(350 * 0.06, on(0.3)).toFixed(2)).toBe("21.00");
  });

  it("a tiny tracking pays at least $5, even when its customer is big", () => {
    expect(SMALL_PARCEL_MIN_USD).toBe(5);
    expect(smallParcelPrice(350 * 0.003, on(2))).toBe(5);
  });

  it("off, or no rule, is the plain price - as every batch before it", () => {
    expect(smallParcelPrice(45.01, null)).toBe(45.01);
    expect(smallParcelPrice(1.05, { on: false, customerTotalCbm: 0.003 })).toBe(1.05);
  });

  it("reaches the price through parcelCost, and never a weight", () => {
    expect(parcelCost({ rate: 350, unit: "cbm", volumeCbm: "0.1286", smallParcel: on(0.1286) }).amountUsd.toFixed(2)).toBe("66.87"); // +48.6%
    const air = { rate: 11, unit: "kg" as const, weightKg: "2", lengthCm: "10", widthCm: "10", heightCm: "10" };
    expect(parcelCost({ ...air, smallParcel: on(0.01) }).amountUsd).toBe(parcelCost(air).amountUsd);
    expect(parcelCost({ rate: 350, unit: "cbm", volumeCbm: null, smallParcel: on(0.1) }).amountUsd).toBe(0);
  });
});
