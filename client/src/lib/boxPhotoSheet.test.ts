import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBoxPhotoSheetHtml, photoCountLine } from "./boxPhotoSheet";

/** Owner, 2026-11-10: a tracking of two pieces says so on the customer's photo sheet. */
describe("the photo sheet says when a tracking is more than one thing", () => {
  it("in each language, and nothing for one carton and one piece", () => {
    expect(photoCountLine("ku", 2, 1)).toBe("ئەم تراکە 2 کارتۆنە");
    expect(photoCountLine("ku", 1, 2)).toBe("ئەم تراکە 2 پارچەیە");
    expect(photoCountLine("ku", 3, 2)).toBe("ئەم تراکە 3 کارتۆن · 2 پارچەیە");
    expect(photoCountLine("ar", 2, 1)).toBe("هذا التتبع 2 كراتين");
    expect(photoCountLine("en", 1, 4)).toBe("This tracking is 4 pieces");
    expect(photoCountLine("ku", 1, 1)).toBe("");
    expect(photoCountLine("ku", null, undefined)).toBe("");
  });

  it("prints the line under the photo, only where it applies", () => {
    const html = buildBoxPhotoSheetHtml(
      [
        { trackingNumber: "T-ONE", productImage: null, weightKg: 1 },
        { trackingNumber: "T-TWO", productImage: null, weightKg: 2, cartonCount: 2 },
      ],
      { lang: "ku", boxCode: "BOX-1", isSea: false },
    );
    expect(html.match(/class="cnt"/g)?.length).toBe(1);
    expect(html).toContain("ئەم تراکە 2 کارتۆنە");
  });

  it("the box hands the counts to the sheet", () => {
    const panel = readFileSync(resolve(__dirname, "..", "components", "delivery", "BoxDetailPanel.tsx"), "utf8");
    expect(panel).toContain("cartonCount: i.cartonCount,");
    expect(panel).toContain("pieceCount: i.pieceCount,");
  });
});
