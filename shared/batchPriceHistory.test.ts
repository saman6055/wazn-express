import { describe, expect, it } from "vitest";
import {
  diffPriceFields,
  isBatchEditLocked,
  normalizePriceValue,
} from "./batchPriceHistory";

describe("normalizePriceValue", () => {
  it("normalizes to two decimals", () => {
    expect(normalizePriceValue("9.1")).toBe("9.10");
    expect(normalizePriceValue(562)).toBe("562.00");
  });

  it("treats empty and garbage as null", () => {
    expect(normalizePriceValue("")).toBeNull();
    expect(normalizePriceValue(null)).toBeNull();
    expect(normalizePriceValue(undefined)).toBeNull();
    expect(normalizePriceValue("abc")).toBeNull();
  });
});

describe("diffPriceFields", () => {
  const before = {
    costPerKg: "9.10",
    costPerCbm: null,
    shippingCost: "550.00",
    pricePerKg: "11.00",
    pricePerCbm: null,
  };

  it("a field the form never sent is not a change", () => {
    expect(diffPriceFields(before, {})).toEqual([]);
    expect(diffPriceFields(before, { costPerKg: undefined })).toEqual([]);
  });

  it("clearing a recorded rate is a change to null", () => {
    expect(diffPriceFields(before, { costPerKg: null })).toEqual([
      { field: "costPerKg", oldValue: "9.10", newValue: null },
    ]);
  });

  it("the same number in a different spelling is not a change", () => {
    expect(diffPriceFields(before, { costPerKg: "9.1" })).toEqual([]);
    expect(diffPriceFields(before, { shippingCost: 550 })).toEqual([]);
  });

  it("records every field that actually moved, in field order", () => {
    expect(
      diffPriceFields(before, {
        costPerKg: null,
        shippingCost: "562.00",
        pricePerKg: "11.00",
      }),
    ).toEqual([
      { field: "costPerKg", oldValue: "9.10", newValue: null },
      { field: "shippingCost", oldValue: "550.00", newValue: "562.00" },
    ]);
  });

  it("filling a field that was empty records null → value", () => {
    expect(diffPriceFields(before, { costPerCbm: "120.00" })).toEqual([
      { field: "costPerCbm", oldValue: null, newValue: "120.00" },
    ]);
  });
});

describe("isBatchEditLocked", () => {
  it("locks delivered and closed, nothing else", () => {
    expect(isBatchEditLocked("delivered")).toBe(true);
    expect(isBatchEditLocked("closed")).toBe(true);
    expect(isBatchEditLocked("arrived")).toBe(false);
    expect(isBatchEditLocked("preparing")).toBe(false);
    expect(isBatchEditLocked(null)).toBe(false);
    expect(isBatchEditLocked(undefined)).toBe(false);
  });
});
