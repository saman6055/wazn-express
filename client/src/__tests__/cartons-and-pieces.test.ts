import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { cartonsMultiplyWeight, cartonWeightTotal } from "@shared/parcelCost";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-21: an air tracking of several cartons is all of them - «ئەبێ
 * کە کرتە دوو دانە یا زیاتر کیلۆ و یا ئەگەر کێشی قەبارەیی بوو دووقاتی بکاتەوە
 * نرخی گواستنەوەکەش دووقات ببتەوە». The weight and sides typed are one
 * carton's; the parcel stores the totals; sea's weight stays as typed.
 */
describe("air cartons multiply the weight and the volume, and so the price", () => {
  it("one carton's weight times the count on air; as typed on sea or for one", () => {
    expect(cartonWeightTotal("3", 2, "air_regular")).toBe("6.000");
    expect(cartonWeightTotal("2.5", 4, "air_irregular")).toBe("10.000");
    expect(cartonWeightTotal("3", 1, "air_regular")).toBe("3");
    expect(cartonWeightTotal("3", 2, "sea")).toBe("3");
    expect(cartonWeightTotal(undefined, 2, "air_regular")).toBeUndefined();
    expect(cartonsMultiplyWeight("sea")).toBe(false);
  });

  it("register, the quote and the correction store the totals", () => {
    const router = read("server/routers/packages.router.ts");
    expect(router.split("const weightKg = cartonWeightTotal(input.weightKg, input.cartonCount, input.shippingType);").length - 1).toBe(2);
    expect(router.split("if (cartons && cartons.perCartonCbm > 0 && cartons.count > 1) volumeCbm = cartons.totalCbm.toFixed(6);").length - 1).toBe(2);
    const correct = read("server/lib/correctRegisteredParcel.ts");
    expect(correct).toContain("measures.weightKg = cartonWeightTotal(measures.weightKg, cartons.count, pkg.shippingType)");
  });

  it("Quick Register has the field for air and shows the total kilos", () => {
    const page = read("client/src/pages/QuickRegister.tsx");
    expect(page).toContain('data-testid="qr-carton-count-air"');
    expect(page).toContain('data-testid="qr-air-carton-sum"');
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
