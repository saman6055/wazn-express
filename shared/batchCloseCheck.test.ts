import { describe, expect, it } from "vitest";
import {
  batchAtLoss,
  closeCheckWarns,
  lacksBillingMeasure,
  needsArrivalCheck,
  parcelEnded,
  type CloseCheckMoney,
} from "./batchCloseCheck";

const money = (over: Partial<CloseCheckMoney> = {}): CloseCheckMoney => ({
  priceMissing: false,
  costMissing: false,
  revenueUsd: 2460,
  costUsd: 2340,
  profitUsd: 120,
  ...over,
});

const quiet = {
  unboxed: [],
  notArrivalChecked: [],
  unmeasured: [],
  ownerless: [],
  unpaidBoxes: [],
  missingNumber: [],
  money: money(),
};

describe("which cartons the check still counts", () => {
  it("leaves out a carton whose journey ended without it", () => {
    expect(parcelEnded("returned")).toBe(true);
    expect(parcelEnded("cancelled")).toBe(true);
    expect(parcelEnded("in_transit")).toBe(false);
    expect(parcelEnded(null)).toBe(false);
  });

  it("asks for an arrival check only of a carton that is still here and not handed over", () => {
    expect(needsArrivalCheck("ready_for_delivery")).toBe(true);
    expect(needsArrivalCheck("in_transit")).toBe(true);
    // Handed over: it arrived, scanned in or not.
    expect(needsArrivalCheck("delivered")).toBe(false);
    expect(needsArrivalCheck("returned")).toBe(false);
  });
});

describe("a carton with nothing to bill it by", () => {
  it("air: neither a weight nor a size", () => {
    expect(lacksBillingMeasure({ shippingType: "air_regular", weightKg: null })).toBe(true);
    expect(lacksBillingMeasure({ shippingType: "air_regular", weightKg: "0" })).toBe(true);
    expect(lacksBillingMeasure({ shippingType: "air_regular", weightKg: "2.4" })).toBe(false);
    // A size alone gives it a chargeable weight.
    expect(lacksBillingMeasure({ shippingType: "air_regular", weightKg: null, lengthCm: 40, widthCm: 30, heightCm: 30 })).toBe(false);
  });

  it("sea: no volume, whatever it weighs", () => {
    expect(lacksBillingMeasure({ shippingType: "sea", volumeCbm: null, weightKg: "41" })).toBe(true);
    expect(lacksBillingMeasure({ shippingType: "sea", volumeCbm: "0.34" })).toBe(false);
  });
});

describe("a loss", () => {
  it("is said when the cost is known and exceeds what the batch brings in", () => {
    expect(batchAtLoss(money({ profitUsd: -120 }))).toBe(true);
    expect(batchAtLoss(money({ profitUsd: 0 }))).toBe(false);
    expect(batchAtLoss(money({ profitUsd: 120 }))).toBe(false);
  });

  it("is not said when no cost was recorded — that is its own warning", () => {
    expect(batchAtLoss(money({ costMissing: true, profitUsd: -500 }))).toBe(false);
    expect(batchAtLoss(null)).toBe(false);
  });
});

describe("whether the check has anything to say", () => {
  it("is quiet for a batch with nothing open", () => {
    expect(closeCheckWarns(quiet)).toBe(false);
  });

  it("speaks up for each thing the owner asked about, and each one suggested", () => {
    expect(closeCheckWarns({ ...quiet, unboxed: [1] })).toBe(true);
    expect(closeCheckWarns({ ...quiet, notArrivalChecked: [1] })).toBe(true);
    expect(closeCheckWarns({ ...quiet, unmeasured: [1] })).toBe(true);
    expect(closeCheckWarns({ ...quiet, ownerless: [1] })).toBe(true);
    expect(closeCheckWarns({ ...quiet, unpaidBoxes: [1] })).toBe(true);
    expect(closeCheckWarns({ ...quiet, missingNumber: ["container"] })).toBe(true);
    expect(closeCheckWarns({ ...quiet, money: money({ priceMissing: true }) })).toBe(true);
    expect(closeCheckWarns({ ...quiet, money: money({ costMissing: true }) })).toBe(true);
    expect(closeCheckWarns({ ...quiet, money: money({ profitUsd: -1 }) })).toBe(true);
  });
});
