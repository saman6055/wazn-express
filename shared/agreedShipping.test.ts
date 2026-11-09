/** «نرخی ڕێککەوتوو»: the agreed amount IS the charge, on every path (owner-approved 2026-11-07). */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { agreedUsd, agreedPriceView, withAgreedPrice } from "./agreedShipping";
const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");
describe("agreed shipping price", () => {
  it("overrides the computed price, above or below; empty keeps it", () => {
    expect(withAgreedPrice(5, "10")).toBe(10);
    expect(withAgreedPrice(109.5, 80)).toBe(80);
    expect(withAgreedPrice(5, null)).toBe(5);
    expect(withAgreedPrice(5, "0")).toBe(5);
    expect(agreedUsd("10.005")).toBe(10.01);
  });
  it("the office's line: profit green, loss red", () => {
    expect(agreedPriceView(10, 5)).toEqual({ agreedUsd: 10, computedUsd: 5, differenceUsd: 5 });
    expect(agreedPriceView(80, 109.5)?.differenceUsd).toBe(-29.5);
    expect(agreedPriceView(null, 5)).toBeNull();
  });
  it("every pricing path asks it", () => {
    expect(read("server/db/batchCharging.db.ts")).toContain("const amount = withAgreedPrice(computed, pkg.agreedShippingUsd);");
    expect(read("server/services/parcelPricing.service.ts")).toContain("const computed = await resolveComputedParcelCost(facts);");
    expect(read("server/db/deliveryBoxes.db.ts")).toContain("freshShippingCost = withAgreedPrice(freshShippingCost,");
    expect(read("server/db/batches.db.ts")).toContain("const final = withAgreedPrice(computed, v.agreed);");
    expect(read("server/routers/packages.router.ts")).toContain("chargeAmount = withAgreedPrice(chargeAmount, pkg.agreedShippingUsd);");
  });
  it("changes only while the box is not receipted, in place, logged", () => {
    const db = read("server/db/agreedPrice.db.ts");
    expect(db).toContain('if (hold?.kind === "receipt")');
    expect(db).toContain("await repriceOne(fresh, actor, reason);");
    expect(db).toContain('action: "agreed_shipping_price"');
    expect(db).toContain("await createStatusHistory({");
  });
  it("the customer never sees it: the portal's parcel fields are an allow-list without it", () => {
    expect(read("server/db/portal.db.ts")).not.toContain("agreedShippingUsd");
  });
});
