import { describe, expect, it } from "vitest";
import {
  DEFAULT_VOLUMETRIC_DIVISOR,
  chargeableWeight,
  exceedsVolumetricThreshold,
  isAirShipping,
  volumeCbm,
  volumetricWeightKg,
} from "./chargeableWeight";

/**
 * This decides what every air customer is charged, and had no tests.
 *
 * The failure it exists to prevent already happened once: the price written
 * at registration ignored volumetric weight, so a 2 kg carton measuring 12 kg
 * by volume was stored at a sixth of what its invoice would later charge —
 * and the customer saw the small number first. These pin the arithmetic and,
 * more importantly, the edges where a missing measurement could quietly turn
 * into a charge of zero or a charge of everything.
 */

describe("volume", () => {
  it("converts centimetres to cubic metres", () => {
    // 100 × 100 × 100 cm is exactly one cubic metre.
    expect(volumeCbm({ lengthCm: 100, widthCm: 100, heightCm: 100 })).toBe(1);
    expect(volumeCbm({ lengthCm: 50, widthCm: 40, heightCm: 30 })).toBeCloseTo(0.06, 10);
  });

  it("is zero when any side is missing", () => {
    // Two sides of a box describe nothing. Guessing here would invent a
    // charge out of an incomplete measurement.
    for (const dims of [
      { lengthCm: 50, widthCm: 40, heightCm: null },
      { lengthCm: 50, widthCm: null, heightCm: 30 },
      { lengthCm: null, widthCm: 40, heightCm: 30 },
      { lengthCm: 50, widthCm: 40 },
      {},
    ]) {
      expect(volumeCbm(dims as never), JSON.stringify(dims)).toBe(0);
    }
  });

  it("treats zero, negative and nonsense as missing", () => {
    for (const bad of [0, -10, "", "abc", NaN, Infinity]) {
      expect(volumeCbm({ lengthCm: bad as never, widthCm: 40, heightCm: 30 }), String(bad)).toBe(0);
    }
  });

  it("accepts the strings the database hands back", () => {
    // Decimal columns arrive as strings through the driver.
    expect(volumeCbm({ lengthCm: "100", widthCm: "100", heightCm: "100" })).toBe(1);
    expect(volumeCbm({ lengthCm: "50.5", widthCm: "40", heightCm: "30" })).toBeCloseTo(0.0606, 10);
  });
});

describe("volumetric weight", () => {
  it("divides the box by the carrier's divisor", () => {
    // 60 × 40 × 30 = 72,000 cm³; at 6000 that is 12 kg.
    expect(volumetricWeightKg({ lengthCm: 60, widthCm: 40, heightCm: 30 })).toBe(12);
    expect(DEFAULT_VOLUMETRIC_DIVISOR).toBe(6000);
  });

  it("honours an install's own divisor", () => {
    expect(volumetricWeightKg({ lengthCm: 60, widthCm: 40, heightCm: 30 }, 5000)).toBe(14.4);
  });

  it("falls back to the standard divisor rather than dividing by zero", () => {
    // A misconfigured setting must not produce Infinity and bill a customer
    // for it.
    for (const divisor of [0, -1, NaN]) {
      expect(volumetricWeightKg({ lengthCm: 60, widthCm: 40, heightCm: 30 }, divisor), String(divisor))
        .toBe(12);
    }
  });

  it("is zero when the box was never measured", () => {
    expect(volumetricWeightKg({})).toBe(0);
  });
});

describe("what the customer is actually charged", () => {
  it("bills the greater of the scale and the box", () => {
    // Light and bulky: the box wins.
    const bulky = chargeableWeight({ weightKg: 2, lengthCm: 60, widthCm: 40, heightCm: 30 });
    expect(bulky.actualKg).toBe(2);
    expect(bulky.volumetricKg).toBe(12);
    expect(bulky.chargeableKg).toBe(12);
    expect(bulky.billedOnVolume).toBe(true);
    expect(bulky.extraKg).toBe(10);
    expect(bulky.ratio).toBe(6);

    // Heavy and small: the scale wins.
    const dense = chargeableWeight({ weightKg: 30, lengthCm: 20, widthCm: 20, heightCm: 20 });
    expect(dense.volumetricKg).toBeCloseTo(1.333, 3);
    expect(dense.chargeableKg).toBe(30);
    expect(dense.billedOnVolume).toBe(false);
    expect(dense.extraKg).toBe(0);
    expect(dense.ratio).toBe(1);
  });

  it("does not call a tie a surprise", () => {
    // 6000 cm³ at divisor 6000 is exactly 1 kg. Nothing surprising happened,
    // so nobody needs warning about it.
    const tied = chargeableWeight({ weightKg: 1, lengthCm: 10, widthCm: 20, heightCm: 30 });
    expect(tied.volumetricKg).toBe(1);
    expect(tied.chargeableKg).toBe(1);
    expect(tied.billedOnVolume).toBe(false);
    expect(tied.extraKg).toBe(0);
  });

  it("charges the weight when the box was never measured", () => {
    const unmeasured = chargeableWeight({ weightKg: 5 });
    expect(unmeasured.chargeableKg).toBe(5);
    expect(unmeasured.billedOnVolume).toBe(false);
    expect(unmeasured.ratio).toBe(1);
  });

  it("charges the box when it was never weighed", () => {
    const unweighed = chargeableWeight({ weightKg: null, lengthCm: 60, widthCm: 40, heightCm: 30 });
    expect(unweighed.actualKg).toBe(0);
    expect(unweighed.chargeableKg).toBe(12);
    // Ratio is undefined against a zero scale reading, and must not be
    // Infinity — a threshold comparing against it would fire on everything.
    expect(unweighed.ratio).toBe(0);
    expect(Number.isFinite(unweighed.ratio)).toBe(true);
  });

  it("charges nothing when there is nothing to go on", () => {
    const nothing = chargeableWeight({});
    expect(nothing.chargeableKg).toBe(0);
    expect(nothing.ratio).toBe(0);
    expect(nothing.extraKg).toBe(0);
  });
});

describe("which routes are billed by weight", () => {
  it("counts both air services and nothing else", () => {
    expect(isAirShipping("air_regular")).toBe(true);
    expect(isAirShipping("air_irregular")).toBe(true);
    // Sea is billed on volume outright; running it through a weight
    // comparison would invent a number nobody charges.
    expect(isAirShipping("sea")).toBe(false);
    for (const other of ["", "SEA", "air", "Air_Regular", "land"]) {
      expect(isAirShipping(other), other).toBe(false);
    }
  });
});

describe("when somebody has to be told before the invoice", () => {
  const limits = { minExtraKg: 2, minRatio: 1.5 };
  const check = (weightKg: number, l: number, w: number, h: number) =>
    exceedsVolumetricThreshold(
      chargeableWeight({ weightKg, lengthCm: l, widthCm: w, heightCm: h }),
      limits
    );

  it("flags a light box billed like a heavy one", () => {
    // 2 kg billed as 12 kg: ten kilos more, six times over.
    expect(check(2, 60, 40, 30)).toBe(true);
  });

  it("ignores a small absolute gap however dramatic the ratio", () => {
    // 0.2 kg envelope measuring 0.6 kg is three times over — and nobody
    // cares about four hundred grams. A ratio alone would flag this.
    expect(check(0.2, 20, 20, 9)).toBe(false);
  });

  it("ignores a heavy parcel whose volume merely nudges past its weight", () => {
    // 100 kg billed as 101.25: more than two kilos extra, but a ratio of
    // 1.01. A floor alone would flag this.
    expect(check(100, 150, 90, 45)).toBe(false);
  });

  it("says nothing when the scale is what is being billed", () => {
    expect(check(30, 20, 20, 20)).toBe(false);
  });

  it("says nothing about a parcel that was never weighed", () => {
    // With no scale reading there is no gap to explain, and the ratio is
    // meaningless. Warning here would mean warning about every unweighed
    // parcel in the warehouse.
    const unweighed = chargeableWeight({ weightKg: 0, lengthCm: 60, widthCm: 40, heightCm: 30 });
    expect(exceedsVolumetricThreshold(unweighed, limits)).toBe(false);
  });

  it("treats the limits as inclusive", () => {
    // Exactly at both limits should fire: 4 kg billed as 6 kg is +2 and 1.5.
    const atLimit = chargeableWeight({ weightKg: 4, lengthCm: 60, widthCm: 30, heightCm: 20 });
    expect(atLimit.chargeableKg).toBe(6);
    expect(atLimit.extraKg).toBe(2);
    expect(atLimit.ratio).toBe(1.5);
    expect(exceedsVolumetricThreshold(atLimit, limits)).toBe(true);
  });
});
