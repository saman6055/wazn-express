import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { cartonsMultiplyVolume } from "@shared/parcelCost";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-21: an air tracking of several cartons must say so - «زۆر
 * گرنگە ... ئێستا تووشی کێشەیەکی لەو جۆرە بووم». Air Quick Register counts
 * cartons too; only sea multiplies the volume, so an air price never moves.
 */
describe("air parcels count their cartons, and are priced as before", () => {
  it("only sea multiplies the volume", () => {
    expect(cartonsMultiplyVolume("sea")).toBe(true);
    expect(cartonsMultiplyVolume("air_regular")).toBe(false);
    expect(cartonsMultiplyVolume("air_irregular")).toBe(false);
  });

  it("register, the quote, the edit and the correction all ask it", () => {
    const router = read("server/routers/packages.router.ts");
    expect(router.split("cartonsMultiplyVolume(input.shippingType)").length - 1).toBe(2);
    expect(router).toContain("cartonsMultiplyVolume(stored?.shippingType)");
    const correct = read("server/lib/correctRegisteredParcel.ts");
    expect(correct).toContain("cartonsMultiplyVolume(pkg.shippingType)) measures.volumeCbm");
    expect(correct).toContain("const count = cartonsMultiplyVolume(pkg.shippingType) ? cartonCountOf(pkg.cartonCount) : 1;");
  });

  it("Quick Register has the field for air", () => {
    const page = read("client/src/pages/QuickRegister.tsx");
    expect(page).toContain('data-testid="qr-carton-count-air"');
    expect(page).toContain("const cartons = cartonCountOf(cartonCount);");
  });
});

describe("cartons and pieces show where a parcel is counted out", () => {
  it("the parcel list and the box say «2 کارتۆن» and «×3 پارچە»", () => {
    expect(read("server/db/packages.db.ts")).toContain("orderQuantity: fullPackageOrders.quantity,");
    expect(read("client/src/pages/Packages.tsx").split("<CountBadges cartons={(pkg as any).cartonCount} pieces={(pkg as any).orderQuantity}").length - 1).toBe(2);
    const panel = read("client/src/components/delivery/BoxDetailPanel.tsx");
    expect(panel).toContain("<CountBadges cartons={item.cartonCount} pieces={item.pieceCount}");
    expect(panel).toContain('data-testid="box-carton-total"');
    expect(read("server/db/deliveryBoxes.db.ts")).toContain("cartonCount, pieceCount, hasOrder, orderNumbers, orderNote };");
  });
});
