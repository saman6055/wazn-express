import { describe, expect, it } from "vitest";
import {
  ESTIMATE_EXCLUDES,
  PRICE_NOT_SET_YET,
  batchHasRate,
  parcelPriceDisplay,
  ratedBy,
} from "./parcelPrice";

/**
 * The complaint this was written for: a parcel showing $1.65 to two decimal
 * places, in a batch whose rate had not been decided — its price column read
 * "—". The figure came from the general route rule, which is not what the
 * customer is charged, and a customer who has seen $1.65 will argue for
 * $1.65 whatever the invoice later says.
 */

const air = (over: Record<string, unknown> = {}) => ({
  isCharged: false,
  calculatedCostUsd: "1.65",
  shippingType: "air_regular",
  batchId: 39,
  batchPricePerKg: "11.00",
  batchPricePerCbm: null,
  ...over,
});

describe("which rate a batch is priced by", () => {
  it("takes sea by volume and everything else by weight", () => {
    expect(ratedBy("sea")).toBe("cbm");
    for (const type of ["air_regular", "air_irregular", null, undefined, ""]) {
      expect(ratedBy(type as string), String(type)).toBe("kg");
    }
  });
});

describe("whether the shipment has been given a rate", () => {
  it("says yes when the batch carries the rate its type is priced by", () => {
    expect(batchHasRate(air())).toBe(true);
    expect(batchHasRate(air({ shippingType: "sea", batchPricePerCbm: "363.00" }))).toBe(true);
  });

  it("ignores the rate belonging to the other unit", () => {
    // A sea batch with only a per-kg rate has not been priced.
    expect(batchHasRate(air({ shippingType: "sea", batchPricePerCbm: null }))).toBe(false);
    expect(batchHasRate(air({ batchPricePerKg: null, batchPricePerCbm: "363.00" }))).toBe(false);
  });

  it("treats zero, blank and nonsense as unrated", () => {
    for (const rate of [null, undefined, "", "0", 0, "abc"]) {
      expect(batchHasRate(air({ batchPricePerKg: rate })), String(rate)).toBe(false);
    }
  });

  it("says no when the parcel is in no batch at all", () => {
    expect(batchHasRate(air({ batchId: null }))).toBe(false);
  });
});

describe("what the customer may be shown", () => {
  it("offers an estimate once the shipment has a rate", () => {
    expect(parcelPriceDisplay(air())).toEqual({ kind: "estimate", amount: 1.65 });
  });

  it("says nothing while the shipment has no rate", () => {
    // The case from the screenshot: batch AIR-2026-039, price column "—",
    // and the portal printing $1.65 as though it were settled.
    const unrated = parcelPriceDisplay(air({ batchPricePerKg: null }));
    expect(unrated.kind).toBe("pending");
    expect(unrated.amount).toBeUndefined();
  });

  it("says nothing for a parcel not yet in a shipment", () => {
    expect(parcelPriceDisplay(air({ batchId: null })).kind).toBe("pending");
  });

  it("shows the real figure once it has been charged", () => {
    // Charged is charged. Whatever the estimate said, this is the invoice.
    const charged = parcelPriceDisplay(air({ isCharged: true, calculatedCostUsd: "2.55" }));
    expect(charged).toEqual({ kind: "final", amount: 2.55 });
  });

  it("shows a charged figure even when the batch lost its rate", () => {
    // The charge already happened; the rate is no longer what decides this.
    const charged = parcelPriceDisplay(air({ isCharged: true, batchPricePerKg: null }));
    expect(charged.kind).toBe("final");
    expect(charged.amount).toBe(1.65);
  });

  it("says nothing when there is no figure to show", () => {
    for (const cost of [null, undefined, "", "0", 0]) {
      expect(parcelPriceDisplay(air({ calculatedCostUsd: cost })).kind, String(cost)).toBe("pending");
    }
  });

  it("reads the amount however the driver hands it over", () => {
    expect(parcelPriceDisplay(air({ calculatedCostUsd: 1.65 })).amount).toBe(1.65);
    expect(parcelPriceDisplay(air({ calculatedCostUsd: "1.65" })).amount).toBe(1.65);
  });

  it("never returns an amount it is not willing to stand behind", () => {
    // Every pending result must be silent about the number, or the whole
    // point is lost.
    for (const input of [
      air({ batchPricePerKg: null }),
      air({ batchId: null }),
      air({ calculatedCostUsd: null }),
    ]) {
      const shown = parcelPriceDisplay(input);
      if (shown.kind === "pending") expect(shown.amount).toBeUndefined();
    }
  });
});

describe("what the customer is told about the estimate", () => {
  it("names the things that can still change it, in every language", () => {
    for (const key of ["ku", "en", "ar", "zh"] as const) {
      expect(ESTIMATE_EXCLUDES[key]?.trim(), key).toBeTruthy();
      expect(PRICE_NOT_SET_YET[key]?.trim(), key).toBeTruthy();
    }
    // Customs is the one that surprises people most, so it is named.
    expect(ESTIMATE_EXCLUDES.en.toLowerCase()).toContain("customs");
  });
});
