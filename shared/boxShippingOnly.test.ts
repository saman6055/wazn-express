import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isShippingOnly, shippingOnlyAmongOrders, shippingOnlyNotice, SHIPPING_ONLY_CHIP } from "./boxShippingOnly";

/**
 * A parcel asking only its freight, in a box of orders (owner, 2026-10-05):
 * «لەناو بۆکس، ئەگەر دانەیەک بووە سێلف ئۆردەر — تەنها کرێی گواستنەوەی لەسەر
 * بوو — ئاگادارکردنەوەیەک بێت». Its order may have been forgotten.
 */
describe("which parcels carry only their freight", () => {
  it("a plain parcel with no order behind it", () => {
    expect(isShippingOnly({ itemType: "regular", hasOrder: false })).toBe(true);
    expect(isShippingOnly({ itemType: null })).toBe(true);
  });

  it("not an order, whichever way it was scanned", () => {
    expect(isShippingOnly({ itemType: "commission" })).toBe(false);
    expect(isShippingOnly({ itemType: "full_package" })).toBe(false);
    expect(isShippingOnly({ itemType: "regular", fullPackageOrderId: 12 })).toBe(false);
    // Scanned as a parcel, but an order claims its tracking number.
    expect(isShippingOnly({ itemType: "regular", hasOrder: true })).toBe(false);
  });
});

describe("when the box says so", () => {
  const order = { id: 1, itemType: "commission", hasOrder: true };
  const fp = { id: 2, itemType: "full_package", fullPackageOrderId: 9, hasOrder: true };
  const alone = { id: 3, itemType: "regular", hasOrder: false };
  const alone2 = { id: 4, itemType: "regular", hasOrder: false };

  it("one shipping-only parcel among orders is named", () => {
    expect(shippingOnlyAmongOrders([order, fp, alone]).map((i) => i.id)).toEqual([3]);
    expect(shippingOnlyAmongOrders([alone, order, alone2]).map((i) => i.id)).toEqual([3, 4]);
  });

  it("a box of the customer's own purchases is not a warning", () => {
    // Telling a self-buying customer so on every box is how it stops being read.
    expect(shippingOnlyAmongOrders([alone, alone2])).toEqual([]);
    expect(shippingOnlyAmongOrders([alone])).toEqual([]);
  });

  it("a box of orders only, or an empty one, says nothing", () => {
    expect(shippingOnlyAmongOrders([order, fp])).toEqual([]);
    expect(shippingOnlyAmongOrders([])).toEqual([]);
  });

  it("a parcel whose order is known by its tracking is not named", () => {
    const claimed = { id: 5, itemType: "regular", hasOrder: true };
    expect(shippingOnlyAmongOrders([order, claimed])).toEqual([]);
  });
});

describe("what it says", () => {
  it("counts, explains, and says when nothing is needed", () => {
    expect(shippingOnlyNotice(1).title.ku).toBe("1 پاکەت لەم بۆکسەدا تەنها کرێی گواستنەوەی لەسەرە");
    expect(shippingOnlyNotice(3).title.ku).toBe("3 پاکەت لەم بۆکسەدا تەنها کرێی گواستنەوەیان لەسەرە");
    expect(shippingOnlyNotice(2).title.en).toBe("2 parcels in this box carry only their shipping");
    const body = shippingOnlyNotice(1).body;
    expect(body.ku).toContain("پێش وەرگرتنی پارە بیپشکنە");
    // It may be right as it stands — the notice says so, so it is not a refusal.
    expect(body.ku).toContain("ئەگەر کڕیار خۆی کڕیویەتی، هیچ پێویست نییە");
    expect(body.en).toContain("nothing is needed");
  });

  it("speaks all four languages with plain digits", () => {
    const notice = shippingOnlyNotice(12);
    for (const words of [notice.title, notice.body, SHIPPING_ONLY_CHIP]) {
      for (const lang of ["ku", "en", "ar", "zh"] as const) {
        expect(words[lang].length).toBeGreaterThan(1);
        expect(words[lang]).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
      }
    }
  });
});

describe("the box shows it, and only shows it", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8").replace(/\r\n/g, "\n");

  it("the server says whether an order stands behind each item, by both routes", () => {
    const db = read("server/db/deliveryBoxes.db.ts");
    expect(db).toContain("hasOrder: boolean;");
    expect(db).toContain("Boolean(item.trackingNumber && (fpsByTracking.get(item.trackingNumber) || []).length > 0);");
    // Every way an item is returned carries the answer.
    expect(db.split("shippingType, hasOrder, orderNumbers, orderNote }").length - 1).toBe(3);
  });

  it("the panel names the parcels, each one copyable and openable", () => {
    const panel = read("client/src/components/delivery/BoxDetailPanel.tsx");
    const start = panel.indexOf('data-testid="box-shipping-only"');
    expect(start).toBeGreaterThan(-1);
    const notice = panel.slice(start, panel.indexOf("{/* Items Table — Rich detail per item type */}", start));
    expect(notice).toContain("shippingOnlyNotice(shippingOnly.length).title");
    expect(notice).toContain("<a href={parcelListHref(name)}");
    expect(notice).toContain("<CopyButton value={name}");
    expect(panel).toContain("const shippingOnly = shippingOnlyAmongOrders(items as any[]);");
    expect(panel).toContain('data-testid="box-shipping-only-row"');
  });

  it("it is a notice: nothing in the rule refuses, charges or writes", () => {
    const rule = read("shared/boxShippingOnly.ts");
    expect(rule).not.toMatch(/throw |TRPCError|\.insert\(|\.update\(/);
    // And the panel does not gate any button on it.
    const panel = read("client/src/components/delivery/BoxDetailPanel.tsx");
    expect(panel).not.toMatch(/disabled=\{[^}]*shippingOnly/);
  });

  it("the panel computes it without a hook, below its early return", () => {
    // A hook under `if (!box) return` once made boxes impossible to open.
    const panel = read("client/src/components/delivery/BoxDetailPanel.tsx");
    expect(panel).not.toMatch(/useMemo\(\(\) => shippingOnlyAmongOrders/);
  });
});
