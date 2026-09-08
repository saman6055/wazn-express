import { describe, expect, it } from "vitest";
import { orderTrackingWarnings } from "./orderTrackingSanity";

describe("orderTrackingWarnings", () => {
  it("a normal pair raises nothing", () => {
    // A Taobao-length order number and an SF courier code.
    expect(orderTrackingWarnings("2412345678901234567", "SF1234567890123")).toEqual([]);
  });

  it("empty boxes raise nothing — required-ness is the form's job", () => {
    expect(orderTrackingWarnings("", "")).toEqual([]);
    expect(orderTrackingWarnings(null, undefined)).toEqual([]);
    expect(orderTrackingWarnings("2412345678901234567", "")).toEqual([]);
  });

  it("tracking longer than order = likely swapped", () => {
    expect(orderTrackingWarnings("SF1234567890123", "2412345678901234567")).toEqual([
      "swapped",
    ]);
  });

  it("a courier-shaped code in the order box is flagged even alone", () => {
    expect(orderTrackingWarnings("YT75651234567890", "")).toEqual([
      "orderLooksLikeTracking",
    ]);
  });

  it("a long pure-digit number in the tracking box is flagged even when order is empty", () => {
    expect(orderTrackingWarnings("", "2412345678901234567")).toEqual([
      "trackingLooksLikeOrder",
    ]);
  });

  it("equal-length pair with order-shaped tracking still gets the shape warning", () => {
    // Not "swapped" (tracking is not longer), but the tracking box holds
    // sixteen bare digits — that's a shop order number's shape.
    expect(orderTrackingWarnings("abcdefgh12345678", "1234567890123456")).toEqual([
      "trackingLooksLikeOrder",
    ]);
  });

  it("short numbers are flagged per box", () => {
    expect(orderTrackingWarnings("1234567", "")).toEqual(["orderTooShort"]);
    expect(orderTrackingWarnings("", "SF123")).toEqual(["trackingTooShort"]);
    // Both short, tracking not longer → two short warnings, no swap noise.
    expect(orderTrackingWarnings("1234567", "1234")).toEqual([
      "orderTooShort",
      "trackingTooShort",
    ]);
  });

  it("swapped and short can co-occur", () => {
    expect(orderTrackingWarnings("1234", "SF1234567890123")).toEqual([
      "swapped",
      "orderTooShort",
    ]);
  });

  it("whitespace is not length", () => {
    expect(orderTrackingWarnings("  2412345678901234567  ", " SF1234567890123 ")).toEqual([]);
  });
});
