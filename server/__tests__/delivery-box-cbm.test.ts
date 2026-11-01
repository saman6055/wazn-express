import { describe, it, expect } from "vitest";
import { resolveBoxShippingType } from "./db/deliveryBoxes.db";

/**
 * Delivery-box receipts are billed in CBM for sea (دەریایی) goods and in kg
 * for air. Which unit a given box prints in is decided by
 * `resolveBoxShippingType`.
 *
 * The case that regressed in production: boxes created BY HAND carry no
 * batchId (scanning.deliveryBox.create takes no batch), so a batch-only
 * lookup returned null and those receipts printed "kg 0.00" for sea packages
 * that are priced per CBM. The fallback to the box's own items fixes that.
 */
describe("resolveBoxShippingType", () => {
  it("uses the batch shipping type when the box belongs to a batch", () => {
    expect(resolveBoxShippingType("sea", [])).toBe("sea");
    expect(resolveBoxShippingType("air_regular", [])).toBe("air_regular");
  });

  it("lets the batch win even if the items disagree", () => {
    // The batch is the authoritative billing unit for boxes built from one.
    expect(
      resolveBoxShippingType("sea", [{ shippingType: "air_regular" }]),
    ).toBe("sea");
  });

  it("falls back to the packages for a hand-made box with no batch", () => {
    // The regression: this used to return null → receipt printed kg.
    expect(
      resolveBoxShippingType(null, [
        { shippingType: "sea" },
        { shippingType: "sea" },
      ]),
    ).toBe("sea");
  });

  it("treats a single sea package with no batch as sea", () => {
    expect(resolveBoxShippingType(undefined, [{ shippingType: "sea" }])).toBe("sea");
  });

  it("stays on kg for an air-only box with no batch", () => {
    expect(
      resolveBoxShippingType(null, [
        { shippingType: "air_regular" },
        { shippingType: "air_irregular" },
      ]),
    ).toBeNull();
  });

  it("stays on kg for a MIXED box — no single honest unit for the total", () => {
    expect(
      resolveBoxShippingType(null, [
        { shippingType: "sea" },
        { shippingType: "air_regular" },
      ]),
    ).toBeNull();
  });

  it("stays on kg when nothing knows its shipping type", () => {
    expect(resolveBoxShippingType(null, [])).toBeNull();
    expect(
      resolveBoxShippingType(null, [{ shippingType: null }, { shippingType: undefined }]),
    ).toBeNull();
  });

  it("ignores items with an unknown type when the rest are sea", () => {
    // A package row that never recorded a shipping type must not drag a
    // genuinely-sea box back to kg.
    expect(
      resolveBoxShippingType(null, [
        { shippingType: "sea" },
        { shippingType: null },
      ]),
    ).toBe("sea");
  });
});
