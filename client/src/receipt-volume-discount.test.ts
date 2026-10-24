import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildBoxReceiptHtml, volumeDiscountOf } from "./lib/deliveryBoxPrintUtils";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-24: the volumetric discount is on the customer's receipt -
 * the weight by volume struck beside the kilos charged, and a line of what
 * was let off. (9.32 kg by volume charged as 7 at $11: 2.32 kg, $25.52.)
 */
describe("the receipt says the volumetric discount", () => {
  const row = { trackingNumber: "SF1", itemType: "regular", weightKg: "7.00", calculatedCostUsd: "77.00", shippingType: "air_regular", volumetric: { volumetricKg: 9.32, billedKg: 7 } };

  it("the kilos and dollars let off, at the row's own price per kilo", () => {
    const d = volumeDiscountOf(row);
    expect(d?.offKg).toBeCloseTo(2.32);
    expect(d?.offUsd).toBe(25.52);
    expect(volumeDiscountOf({ ...row, volumetric: null })).toBeNull();
    expect(volumeDiscountOf({ ...row, itemType: "full_package" })).toBeNull();
    expect(volumeDiscountOf({ ...row, shippingType: "sea" })).toBeNull();
  });

  it("struck on the row, said in the totals", () => {
    const t = (k: string) => k;
    const html = buildBoxReceiptHtml(
      { boxCode: "B", status: "open", deliveryMethod: "warehouse_pickup", totalPackages: 1, totalValueUsd: "77.00", shippingType: "air_regular" } as any,
      [row] as any, null, t as any, { direction: "rtl" } as any,
    );
    expect(html).toContain('text-decoration:line-through; color:#9ca3af; font-size:0.85em;">9.32 kg</span> 7.00 kg');
    expect(html).toContain("delivery.volumeDiscount");
    expect(html).toContain("2.32 kg — $25.52");
  });

  it("every door that prints the box's receipt carries the rows' discount", () => {
    expect(read("client/src/components/delivery/BoxDetailPanel.tsx")).toContain("volumetric: i.volumetric ?? null,");
    expect(read("client/src/components/delivery/BoxTable.tsx")).toContain("(await trpcUtils.deliveryBox.getItems.fetch({ boxId: box.id }).catch(() => null)) ?? box.items ?? [],");
  });

  it("a full package's carton takes no discount at registration either", () => {
    expect(read("server/routers/packages.router.ts")).toContain('input.shippingType !== "sea" && !forFullPackage && Number(input.billedWeightKg) > 0');
  });
});
