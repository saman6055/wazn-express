import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-23: the volumetric discount window in All Packages, in the
 * box before its receipt, and in Quick Register - shown only for a parcel
 * billed on its volume. One window (components/packages/VolumetricDiscount).
 */
describe("the volumetric discount window, on three screens", () => {
  it("All Packages: only a parcel billed on its volume, with the struck size beside the kilos charged", () => {
    const src = read("client/src/pages/Packages.tsx");
    expect(src).toContain("{billedOnVolume && (\n            <VolumetricDiscountButton");
    expect(src).toContain("line-through\">{volumetricKg.toFixed(2)} kg</span>");
  });

  it("the box: an air parcel billed on its volume, while the box is not delivered", () => {
    const src = read("client/src/components/delivery/BoxDetailPanel.tsx");
    expect(src).toContain('{!isSea && item.volumetric && status !== "delivered" && status !== "cancelled" && (');
    expect(read("server/db/deliveryBoxes.db.ts")).toContain("return built.map((b) => ({ ...b, volumetric: volumetricFor(b) }));");
  });

  it("Quick Register: the last registration, when due", () => {
    const src = read("client/src/pages/QuickRegister.tsx");
    expect(src).toContain("<VolumetricDiscountIfDue packageId={lastRegistered.packageId} language={language} />");
    expect(src.split("packageId:").length - 1).toBeGreaterThanOrEqual(4);
  });

  it("the list carries the kilos charged", () => {
    expect(read("server/db/packages.db.ts")).toContain("billedWeightKg: packages.billedWeightKg,");
  });

  it("the window refuses outside the scale and the volume, and a receipted parcel", () => {
    const src = read("client/src/components/packages/VolumetricDiscount.tsx");
    expect(src).toContain("n >= f.actualKg - 0.0005 && n <= f.volumetricKg + 0.0005");
    expect(src).toContain("f.receipted ? (");
  });
});
