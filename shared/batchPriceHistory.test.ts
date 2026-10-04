import { describe, expect, it } from "vitest";
import {
  diffPriceFields,
  isBatchEditLocked,
  mayEditLockedBatch,
  sellingSideChanged,
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


/*
 * Owner, 2026-10-04: "the main admin must have the power to edit whenever he
 * wants." Before this, the only way was to move a delivered batch's status
 * back, which told every customer in it "your goods have arrived" again.
 */
describe("the main admin may correct a delivered batch", () => {
  it("only the main admin", () => {
    expect(mayEditLockedBatch("super_admin")).toBe(true);
    for (const role of ["admin", "accountant", "employee", null]) expect(mayEditLockedBatch(role)).toBe(false);
  });

  it("cost, weights and details are his to fix; the selling side stays as charged", () => {
    const stored = { pricePerKg: "11.00", pricePerCbm: null, useTieredPricing: false };
    expect(sellingSideChanged({}, stored)).toBe(false);
    expect(sellingSideChanged({ pricePerKg: "11" }, stored), "the same price is not a change").toBe(false);
    expect(sellingSideChanged({ pricePerKg: "12" }, stored)).toBe(true);
    expect(sellingSideChanged({ pricePerCbm: "300" }, stored)).toBe(true);
    expect(sellingSideChanged({ useTieredPricing: true }, stored)).toBe(true);
    expect(sellingSideChanged({ customerPricing: [] }, stored), "a customer's agreed price is the selling side").toBe(true);
  });
});
