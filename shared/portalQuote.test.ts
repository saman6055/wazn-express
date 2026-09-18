import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { quoteShipping } from "./portalQuote";

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

describe("a quote, as the invoice charges it", () => {
  it("air: a 60×40×40 carton of 12 kg is billed on its size — 16 kg at the 6000 divisor", () => {
    const q = quoteShipping({ shippingType: "air_regular", pricePerUnit: 6.5, weightKg: 12, lengthCm: 60, widthCm: 40, heightCm: 40 }, 6000);
    expect(q.volumetricKg).toBe(16);
    expect(q.chargeableKg).toBe(16);
    expect(q.billedOnVolume).toBe(true);
    expect(round(q.total)).toBe(104);
  });

  it("air: a heavy small carton is billed on the scale", () => {
    const q = quoteShipping({ shippingType: "air_irregular", pricePerUnit: 8, weightKg: 20, lengthCm: 30, widthCm: 30, heightCm: 30 }, 6000);
    expect(q.chargeableKg).toBe(20);
    expect(q.billedOnVolume).toBe(false);
    expect(q.total).toBe(160);
  });

  it("air: another divisor, tried before it is saved, changes the size weight", () => {
    const q = quoteShipping({ shippingType: "air_regular", pricePerUnit: 6.5, weightKg: 12, lengthCm: 60, widthCm: 40, heightCm: 40 }, 5000);
    expect(round(q.volumetricKg)).toBe(19.2);
  });

  it("sea: the volume, from the sizes or typed", () => {
    expect(round(quoteShipping({ shippingType: "sea", pricePerUnit: 180, lengthCm: 60, widthCm: 40, heightCm: 40 }).total)).toBe(17.28);
    expect(round(quoteShipping({ shippingType: "sea", pricePerUnit: 180, cbm: 0.5 }).total)).toBe(90);
  });

  it("no minimum kg and no sea surcharge — no charge on the server applies them", () => {
    expect(quoteShipping({ shippingType: "air_regular", pricePerUnit: 10, weightKg: 0.4 }).total).toBe(4);
    expect(round(quoteShipping({ shippingType: "sea", pricePerUnit: 100, cbm: 0.1 }).total)).toBe(10);
  });

  it("works the way the customer's calculator in the portal works", () => {
    const portal = fs.readFileSync(path.resolve(__dirname, "../client/src/components/portal/PriceListSection.tsx"), "utf8");
    expect(portal).toContain("const air = chargeableWeight(");
    expect(portal).toContain("calc.volumetricDivisor,");
    expect(portal).toContain("const seaTotal = cbm > 0 ? cbm * price : 0;");
    expect(portal).toContain("const total = isSea ? seaTotal : airChargeable * price;");
  });
});
