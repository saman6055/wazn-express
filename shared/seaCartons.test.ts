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
  smallParcelBreakdown,
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
 * follows the size - 100% at nothing, none from the line (0.20 m³ since the
 * owner moved it from 0.25 the same day) - measured on
 * everything the customer has in the batch, with a $5 least per tracking;
 * the batch only says on or off.
 */
describe("small sea parcels: each measured by itself (2026-11-07)", () => {
  const on = (v: number, waived = false) => ({ on: true, parcelCbm: v, waived });

  it("follows the size: the smaller, the more; none from 0.20", () => {
    expect(SMALL_PARCEL_CBM).toBe(0.2);
    expect(smallParcelAutoPercent(0.05)).toBeCloseTo(75, 6);
    expect(smallParcelAutoPercent(0.1)).toBeCloseTo(50, 6);
    expect(smallParcelAutoPercent(0.19)).toBeCloseTo(5, 6);
    expect(smallParcelAutoPercent(0.2)).toBe(0);
    expect(smallParcelAutoPercent(0.25)).toBe(0);
    expect(smallParcelAutoPercent(0.3)).toBe(0);
  });

  it("the table he was shown, at $350", () => {
    const row = (v: number) => smallParcelPrice(350 * v, on(v)).toFixed(2);
    expect(row(0.005)).toBe("5.00"); // the least
    expect(row(0.03)).toBe("19.43");
    expect(row(0.06)).toBe("35.70");
    expect(row(0.1)).toBe("52.50");
    expect(row(0.15)).toBe("65.63");
    expect(row(0.19)).toBe("69.83");
    expect(row(0.2)).toBe("70.00");
  });

  it("the owner's example at $365: 0.50 has no extra, 0.048 has +76%", () => {
    expect(smallParcelPrice(365 * 0.5, on(0.5)).toFixed(2)).toBe("182.50");
    const small = smallParcelBreakdown(365 * 0.048, on(0.048));
    expect(small.baseUsd.toFixed(2)).toBe("17.52");
    expect(small.percent).toBe(76);
    // 17.52 × 1.76 = 30.8352, to the cent 30.84 (the message said 30.83).
    expect(small.finalUsd.toFixed(2)).toBe("30.84");
    expect(small.extraUsd.toFixed(2)).toBe("13.32");
  });

  it("a bigger parcel always pays more: no step at the line", () => {
    let last = 0;
    for (let t = 0.001; t <= 0.4; t += 0.001) {
      const paid = smallParcelPrice(350 * t, on(t));
      expect(paid + 0.006, `at ${t.toFixed(3)}`).toBeGreaterThanOrEqual(last);
      last = paid;
    }
  });

  it("one tracking of five 0.06 cartons is one 0.30 parcel: no extra; five trackings of 0.06 each carry it", () => {
    expect(smallParcelPrice(350 * 0.3, on(0.3)).toFixed(2)).toBe("105.00");
    expect(smallParcelPrice(350 * 0.06, on(0.06)).toFixed(2)).toBe("35.70");
  });

  it("a parcel's price does not move as its owner's other parcels arrive", () => {
    // Nothing about the owner enters the rule any more: only the parcel.
    expect(smallParcelPrice(350 * 0.06, on(0.06)).toFixed(2)).toBe("35.70");
  });

  it("a tiny tracking pays at least $5", () => {
    expect(SMALL_PARCEL_MIN_USD).toBe(5);
    expect(smallParcelPrice(350 * 0.003, on(0.003))).toBe(5);
    expect(smallParcelBreakdown(350 * 0.003, on(0.003)).minimum).toBe(true);
  });

  it("waived on one parcel: the plain price, and the office can see it was waived", () => {
    const w = smallParcelBreakdown(365 * 0.048, on(0.048, true));
    expect(w.finalUsd.toFixed(2)).toBe("17.52");
    expect(w.eligible).toBe(true);
    expect(w.waived).toBe(true);
    expect(w.extraUsd).toBe(0);
    expect(smallParcelPrice(365 * 0.048, on(0.048, true)).toFixed(2)).toBe("17.52");
  });

  it("off, or no rule, is the plain price - as every batch before it", () => {
    expect(smallParcelPrice(45.01, null)).toBe(45.01);
    expect(smallParcelPrice(1.05, { on: false, parcelCbm: 0.003 })).toBe(1.05);
  });

  it("reaches the price through parcelCost, and never a weight", () => {
    expect(parcelCost({ rate: 350, unit: "cbm", volumeCbm: "0.1286", smallParcel: on(0.1286) }).amountUsd.toFixed(2)).toBe("61.08"); // +35.7%
    const air = { rate: 11, unit: "kg" as const, weightKg: "2", lengthCm: "10", widthCm: "10", heightCm: "10" };
    expect(parcelCost({ ...air, smallParcel: on(0.01) }).amountUsd).toBe(parcelCost(air).amountUsd);
    expect(parcelCost({ rate: 350, unit: "cbm", volumeCbm: null, smallParcel: on(0.1) }).amountUsd).toBe(0);
  });
});
