import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", "..", p), "utf8");

/**
 * Owner, 2026-11-07: «باری بەحری بە سی بی ئێمە ئاگادار بە». A sea batch is
 * billed by volume, so its strip on the scan screens speaks CBM, never kilos.
 */
describe("a sea batch's strip compares CBM", () => {
  it("the server answers in CBM for a sea batch, from the batch's own carrier CBM", () => {
    const db = read("server/db/carrierGroup.db.ts");
    expect(db).toContain('if (billingUnit(batch.shippingType) === "cbm") {');
    expect(db).toContain("const billedCbm = Number(batch.chargedCbm);");
    // Each parcel's volume by the rule registration stores it with.
    expect(db).toContain("storedVolumeCbm(p.volumeCbm, p.lengthCm, p.widthCm, p.heightCm)");
  });

  it("the strip draws the CBM line for it and never the kilo sentence", () => {
    const card = read("client/src/components/batches/CarrierGroupCard.tsx");
    expect(card).toContain('if (g.unit === "cbm") return <CbmStrip');
    const strip = card.slice(card.indexOf("function CbmStrip"), card.indexOf("export function CarrierGroupStrip"));
    expect(strip).toContain("CBMـی کۆمپانیای گواستنەوە هێشتا نەنووسراوە");
    expect(strip).not.toContain("kg");
  });
});
