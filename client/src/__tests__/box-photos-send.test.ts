import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { boxPhotosWhatsAppMessage } from "@shared/receiptWhatsApp";
import { buildBoxPhotoSheetHtml, buildBoxPhotoSheetPages, PHOTOS_PER_PAGE } from "./lib/boxPhotoSheet";
import { buildImagesPdf } from "./lib/imagePdf";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-24: beside the receipt's print and send, the box sends its
 * parcels' photos - photo first, then the tracking, then the kilos - as a
 * picture or a PDF, in the customer's language, with a short greeting.
 */
describe("the box's parcel photos, to the customer", () => {
  it("a short greeting by first name, the box, the count - no money", () => {
    const ku = boxPhotosWhatsAppMessage("ku", { boxCode: "BOX-1", parcelCount: 3, customerName: "خەرمان عەلی" });
    expect(ku.split("\n")[0]).toBe("سڵاو بەڕێز خەرمان، ئەمە وێنەی ئەو پاکەتانەیە کە گەیشتوون.");
    expect(ku).toContain("BOX-1 · 3 پاکەت");
    for (const lang of ["ku", "ar", "en"] as const) {
      expect(boxPhotosWhatsAppMessage(lang, { boxCode: "BOX-1", parcelCount: 3 })).not.toMatch(/\$|دینار|IQD/);
    }
  });

  it("the sheet: the photo, then the tracking, then the kilos; no photo said so; no prices", () => {
    const html = buildBoxPhotoSheetHtml(
      [{ trackingNumber: "JT1", productImage: "data:image/png;base64,AA", weightKg: "1.50" }, { trackingNumber: "JT2", productImage: null, weightKg: "2" }],
      { lang: "ku", boxCode: "BOX-1", isSea: false },
    );
    const card = html.slice(html.indexOf('<div class="card">'));
    expect(card.indexOf('class="ph"')).toBeLessThan(card.indexOf('class="tr"'));
    expect(card.indexOf('class="tr"')).toBeLessThan(card.indexOf('class="kg"'));
    expect(html).toContain("1.5 kg");
    expect(html).toContain("وێنەی نییە");
    expect(html).not.toContain("$");
    expect(buildBoxPhotoSheetHtml([{ trackingNumber: "S1", productImage: null, volumeCbm: "0.25" }], { lang: "en", boxCode: "B", isSea: true })).toContain("0.250 CBM");
  });

  it("a button beside the receipt's, through the receipt's own sending", () => {
    const panel = read("client/src/components/delivery/BoxDetailPanel.tsx");
    expect(panel).toContain('data-testid="box-send-photos"');
    expect(panel).toContain("onPick={(format, destination) => { void sharePhotosNow(format, destination); }}");
    expect(panel).toContain("fileName: `${box.boxCode}-photos`,");
  });
});

describe("a big box goes as a page per A4, all in one PDF (owner, 2026-10-31)", () => {
  const item = (n: number) => ({ trackingNumber: `T${n}`, productImage: "/p.jpg", weightKg: 1 });
  const opts = { lang: "en" as const, boxCode: "B", isSea: false };

  it("every one of 25 parcels is on a page, and each page says which", () => {
    const pages = buildBoxPhotoSheetPages(Array.from({ length: 25 }, (_, i) => item(i)), opts);
    expect(pages).toHaveLength(Math.ceil(25 / PHOTOS_PER_PAGE));
    const all = pages.join("");
    for (let i = 0; i < 25; i++) expect(all).toContain(`>T${i}<`);
    expect(pages[0]).toContain("25 parcel(s)");
    expect(pages[1]).toContain(`2/${pages.length}`);
  });

  it("a small box stays one page with no page number", () => {
    const pages = buildBoxPhotoSheetPages([item(1), item(2)], opts);
    expect(pages).toHaveLength(1);
    expect(pages[0]).not.toContain("1/1");
  });

  it("the PDF lists every page", () => {
    const page = { jpeg: new Uint8Array([1, 2, 3]), widthPx: 100, heightPx: 140 };
    const text = new TextDecoder("latin1").decode(buildImagesPdf([page, page, page]));
    expect(text).toContain("/Kids [3 0 R 6 0 R 9 0 R] /Count 3");
    expect(text).toContain("/XObject << /Im0 10 0 R >>");
  });
});
