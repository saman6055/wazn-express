import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Where a parcel is, said plainly, and a list short enough to read.
 *
 * The owner's brief (2026-09-19), third part, and the four decisions that
 * came with it: green «گەیشتە هەولێر — ئامادەیە بۆ وەرگرتن», blue «لە
 * ڕێگادایە (لە فڕۆکە یان کەشتیدایە)», grey «تۆمارکراوە لە کۆگای چین»;
 * delivered leaves the green tab; packed into a shipment still in China is
 * grey; customs stays blue as «لە گومرگ». The rules and their words are
 * tested in lib/portalSearch.test.ts and lib/packageStatus.test.ts; this
 * checks that every list of parcels reads them, and opens the same sheet.
 */

const SRC = __dirname;
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

describe("one card, one sheet, wherever a parcel is listed", () => {
  it("the search and a shipment's parcel list draw the same compact card", () => {
    for (const file of ["components/portal/PortalUniversalSearch.tsx", "pages/portal/PortalBatchDetail.tsx"]) {
      const src = read(file);
      expect(src, file).toContain("<PortalSearchCard");
      expect(src, file).toMatch(/searchStatusWords\(item, (origins|parcelSheet\.origins)\)/);
    }
  });

  it("a shipment's parcel card no longer carries the weight, size and photo strip — its sheet does", () => {
    const page = read("pages/portal/PortalBatchDetail.tsx");
    const list = page.slice(page.indexOf('<ul className="space-y-2">'), page.indexOf("</ul>", page.indexOf('<ul className="space-y-2">')));
    expect(list.length).toBeGreaterThan(100);
    expect(list).not.toContain("fmtKg(");
    expect(list).not.toContain("fmtDims(");
    expect(list).toContain("parcelSheet.openParcel(");
    // The photos and the share link moved into the sheet, not away.
    expect(list).toContain('key: "photos"');
    expect(list).toContain("<ShareParcelButton packageId={pkg.id}");
    expect(page).toContain("{parcelSheet.sheet}");
  });

  it("the China depot's rows open the same sheet, and a row is one button, not a button in a button", () => {
    const src = read("components/portal/ChinaDepotList.tsx");
    expect(src).toContain("const parcelSheet = usePortalParcelSheet();");
    expect(src).toContain("if (item.parcel) parcelSheet.openParcel(item.parcel);");
    expect(src).toContain("{parcelSheet.sheet}");
    expect(src).not.toContain("<PackageThumb");
  });

  it("the sheet is one step: Back closes it, and leaving from it returns to the list", () => {
    const src = read("components/portal/PortalParcelSheet.tsx");
    expect(src).toContain("useBackCloses(openItem != null, close);");
    expect(src).toContain('window.addEventListener("popstate", go);');
  });

  it("the search's chip and the sheet's say the same words", () => {
    const chip = read("components/portal/portalSearchChip.ts");
    expect(chip).toContain("return parcelStatusWords(item.parcel ?? { status: item.status }, originCountries);");
    const sheet = read("components/portal/PortalParcelSheet.tsx");
    expect(sheet).toContain("words: searchStatusWords(shownItem, origins)");
  });
});

describe("the balance card", () => {
  it("a customer who owes sees it in amber with the WhatsApp pay button, big enough for a thumb", () => {
    const home = read("pages/portal/PortalHome.tsx");
    expect(home).toContain("const hasDebt = isDebt(balance);");
    expect(home).toContain('ku: "پارەدان لە واتساپ"');
    expect(home).toContain('className="relative tap-44 flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500');
  });
});
