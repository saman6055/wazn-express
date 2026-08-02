import { describe, it, expect } from "vitest";
import { resolveGoodsCategory, mustAskForCategory } from "./lib/goodsCategory";

/**
 * The category is what makes the registration data worth analysing, and there
 * is exactly one moment it can be captured for a parcel nobody declared: the
 * scan. These tests pin who gets asked and who gets believed.
 */
describe("resolveGoodsCategory", () => {
  it("believes the member of staff who chose one at the scanner", () => {
    expect(resolveGoodsCategory({ scanned: 3, declared: 7 })).toBe(3);
  });

  it("falls back to what the customer said when declaring it", () => {
    // They bought it; the person holding the box is guessing from the outside.
    expect(resolveGoodsCategory({ declared: 7 })).toBe(7);
    expect(resolveGoodsCategory({ scanned: null, declared: 7 })).toBe(7);
  });

  it("returns nothing rather than inventing a category", () => {
    expect(resolveGoodsCategory({})).toBeUndefined();
    expect(resolveGoodsCategory({ scanned: null, declared: null })).toBeUndefined();
  });

  it("does not mistake a zero id for a real choice", () => {
    // 0 is not a category; treating it as one would silently mislabel goods.
    expect(resolveGoodsCategory({ scanned: 0, declared: 7 })).toBe(0);
  });
});

describe("mustAskForCategory", () => {
  it("asks when the customer never declared the parcel", () => {
    // The only case where the warehouse is the sole possible source.
    expect(mustAskForCategory(undefined)).toBe(true);
    expect(mustAskForCategory(null)).toBe(true);
  });

  it("stays quiet when the customer already said what it is", () => {
    // Most scans, so most scans cost no extra taps.
    expect(mustAskForCategory(5)).toBe(false);
  });
});
