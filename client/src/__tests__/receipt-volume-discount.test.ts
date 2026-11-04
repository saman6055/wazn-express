import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { buildBoxReceiptHtml, volumeDiscountOf } from "../lib/deliveryBoxPrintUtils";

/** This test's old home: paths below are read from here. */
const ROOT_DIR = path.resolve(__dirname, "..");

const read = (rel: string) => fs.readFileSync(path.resolve(ROOT_DIR, "../..", rel), "utf8").replace(/\r\n/g, "\n");

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

  it("a buy-at-cost row is let off at its freight rate, not goods + freight (2026-11-04)", () => {
    // 3.67 kg by volume charged as 2.2: goods $15.69 + freight $24.20 on the row.
    const cm = { ...row, itemType: "commission", weightKg: "2.20", calculatedCostUsd: "39.89", volumetric: { volumetricKg: 3.6667, billedKg: 2.2, rateUsd: 11 } };
    expect(volumeDiscountOf(cm)?.offUsd).toBe(16.13);
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

  it("explains volume weight under the receipt, with each number named, only when a parcel has it (2026-11-04)", () => {
    const t = (k: string, p?: Record<string, unknown>) => (p ? `${k}:${JSON.stringify(p)}` : k);
    const box = { boxCode: "B", status: "open", deliveryMethod: "warehouse_pickup", totalPackages: 1, totalValueUsd: "77.00", shippingType: "air_regular" } as any;
    const html = buildBoxReceiptHtml(box, [row] as any, null, t as any, { direction: "rtl" } as any);
    expect(html).toContain('data-volume-note="1"');
    expect(html).toContain('delivery.volNoteCount:{"n":1}');
    expect(html).toContain('delivery.volNoteGift:{"kg":"2.32","usd":"$25.52"}');
    const plain = buildBoxReceiptHtml(box, [{ ...row, volumetric: null }] as any, null, t as any, { direction: "rtl" } as any);
    expect(plain).not.toContain("data-volume-note");
    const ku = JSON.parse(read("client/src/locales/ku.json").replace(/^﻿/, "")).delivery;
    expect(ku.volNoteHow).toContain("درێژییەکەی 40 سم، پانییەکەی 30 سم، بەرزییەکەی 20 سم");
    expect(html).toContain('40 × 30 × 20 ÷ 6000 = 4 kg</bdi>');
  });

  it("every door that prints the box's receipt carries the rows' discount", () => {
    expect(read("client/src/components/delivery/BoxDetailPanel.tsx")).toContain("volumetric: i.volumetric ?? null,");
    expect(read("client/src/components/delivery/BoxTable.tsx")).toContain("(await trpcUtils.deliveryBox.getItems.fetch({ boxId: box.id }).catch(() => null)) ?? box.items ?? []) as any[], tillView?.parcels);");
  });

  it("a full package's carton takes no discount at registration either", () => {
    expect(read("server/routers/packages.router.ts")).toContain('input.shippingType !== "sea" && !forFullPackage && Number(input.billedWeightKg) > 0');
  });
});
