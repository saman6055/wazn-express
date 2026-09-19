import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The portal on a small phone: nothing under the bottom bar, nothing too
 * small for a thumb, nothing running into its neighbour, and every number
 * reading left to right inside Kurdish.
 *
 * The owner's brief (2026-09-19), second part. Measured in a browser before
 * the change, at 375px and 320px across the portal's 27 pages: the bottom
 * bar's height ignored the iPhone's home-indicator strip (up to 30px of a
 * list hidden under it), about fifty controls took a tap on less than
 * 44×44px, the stage chips on "My shipments" squeezed into each other, the
 * six stage names of a shipment's journey ran together, and a weight read
 * "kg 2.4".
 */

const SRC = __dirname;
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

function files(dir: string): string[] {
  return fs.readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return files(rel);
    return /\.tsx$/.test(entry.name) && !/\.test\./.test(entry.name) ? [rel] : [];
  });
}

const PORTAL = [...files("pages/portal"), ...files("components/portal"), "components/PortalNavButtons.tsx"];

describe("the bottom bar", () => {
  it("never covers the end of a page: the room under the content counts the home-indicator strip", () => {
    const layouts = {
      "components/CustomerPortalLayout.tsx": '"pb-[calc(6rem+env(safe-area-inset-bottom))]"',
      "components/ModernPortalLayout.tsx": '"pb-[calc(6rem+env(safe-area-inset-bottom))]"',
      "components/Skin3PortalLayout.tsx": '"pb-[calc(7rem+env(safe-area-inset-bottom))]"',
    };
    for (const [file, room] of Object.entries(layouts)) {
      const src = read(file);
      expect(src, file).toContain(room);
      expect(src, file).not.toMatch(/isInstalled \? "pb-\d+" : "pb-\d+"/);
      // The bar itself is still lifted over the strip.
      expect(src, file).toContain('"pb-safe"');
    }
  });

  it("keeps what floats above it clear of it too", () => {
    expect(read("components/portal/PortalWidthSwitch.tsx")).toContain("fixed bottom-[calc(6rem+env(safe-area-inset-bottom))]");
    expect(read("pages/portal/PortalFullPackage.tsx")).toContain(
      'widthSwitchShown ? "bottom-[calc(10rem+env(safe-area-inset-bottom))]" : "bottom-[calc(6rem+env(safe-area-inset-bottom))]"',
    );
  });
});

describe("a thumb can hit it", () => {
  it("tap-44 grows the tappable area to 44px on touch screens, without moving anything", () => {
    const css = read("index.css");
    const start = css.indexOf("@utility tap-44 {");
    expect(start).toBeGreaterThan(-1);
    const rule = css.slice(start, start + 400);
    expect(rule).toContain("@media (pointer: coarse)");
    expect(rule).toContain("width: max(100%, 44px);");
    expect(rule).toContain("height: max(100%, 44px);");
  });

  it("every tap-44 sits on a positioned element, or its area would anchor somewhere else", () => {
    const offenders: string[] = [];
    for (const rel of PORTAL) {
      const src = read(rel);
      for (const m of src.matchAll(/"[^"\n]*\btap-44\b[^"\n]*"/g)) {
        if (!/(^|[\s"])(relative|absolute|fixed|sticky)(?=[\s"])/.test(m[0])) {
          offenders.push(`${rel}:${src.slice(0, m.index).split("\n").length}: ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("covers the controls measured too small", () => {
    const expected: Record<string, number> = {
      "components/PortalNavButtons.tsx": 1,
      "components/portal/PortalBackButton.tsx": 1,
      "components/portal/WhatsAppHelpButton.tsx": 1,
      "components/portal/PortalHeaderControls.tsx": 3,
      "components/portal/ReferralCard.tsx": 2,
      "pages/portal/PortalHome.tsx": 6,
      "pages/portal/PortalMessages.tsx": 8,
      "pages/portal/PortalFullPackage.tsx": 4,
      "pages/portal/PortalProfile.tsx": 2,
      "pages/portal/PortalSecurity.tsx": 2,
      "pages/portal/PortalYuanExchange.tsx": 2,
    };
    for (const [rel, count] of Object.entries(expected)) {
      expect((read(rel).match(/\btap-44\b/g) ?? []).length, rel).toBeGreaterThanOrEqual(count);
    }
    expect(read("components/TutorialHint.tsx")).toContain("relative tap-44");
  });

  it("grows the chips inside a sideways-scrolling row instead, and keeps them whole so the row scrolls", () => {
    expect(read("pages/portal/PortalShipments.tsx")).toContain(
      '"flex shrink-0 items-center gap-2 px-4 py-2 pointer-coarse:min-h-11 rounded-full text-sm font-semibold whitespace-nowrap",',
    );
    expect((read("pages/portal/PortalFullPackage.tsx").match(/pointer-coarse:min-h-11 flex-1 whitespace-nowrap/g) ?? []).length).toBe(3);
  });
});

describe("nothing runs into its neighbour", () => {
  it("a shipment's journey names only the stage it is at when the card is too narrow for six names", () => {
    const src = read("components/portal/BatchJourneyTimeline.tsx");
    expect(src).toContain('<div className={cn("@container select-none", className)}>');
    expect((src.match(/state !== "active" && "hidden @\[18rem\]:block"/g) ?? []).length).toBe(2);
  });
});

describe("numbers read left to right", () => {
  it("every weight, volume and size in the portal sits in its own left-to-right island", () => {
    const offenders: string[] = [];
    for (const rel of PORTAL) {
      const lines = read(rel).split("\n");
      lines.forEach((line, i) => {
        if (!/\{fmt(Kg|Cbm|Chargeable|Dims)\(/.test(line)) return;
        const around = lines.slice(Math.max(0, i - 2), i + 1).join("\n");
        if (!/<bdi dir="ltr"|dir="ltr"|\btabular-nums\b|\bfont-mono\b/.test(around)) offenders.push(`${rel}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it("the weight on a shipment's parcels reads 2.4 kg, not kg 2.4", () => {
    const src = read("pages/portal/PortalBatchDetail.tsx");
    expect(src).toContain('<bdi dir="ltr">{fmtKg(pkg.weightKg)}</bdi>');
    expect(src).toContain('<bdi dir="ltr">{fmtDims(pkg.lengthCm, pkg.widthCm, pkg.heightCm)}</bdi>');
    expect(read("pages/portal/PortalUnclaimedPackages.tsx")).toContain('<bdi dir="ltr">{fmtKg(pkg.weightKg)}</bdi>');
  });

  it("phone numbers, customer codes and invoice numbers too", () => {
    expect(read("pages/portal/PortalAddresses.tsx")).toContain('<bdi dir="ltr">{address.phone}</bdi>');
    expect(read("pages/portal/PortalProfile.tsx")).toContain('<bdi dir="ltr">{account.mobileNumber}</bdi>');
    expect(read("pages/portal/PortalProfile.tsx")).toContain('<bdi dir="ltr">{account?.customerCode}</bdi>');
    expect(read("pages/portal/PortalFinancial.tsx")).toContain('<bdi dir="ltr">{invoice.invoiceNumber}</bdi>');
  });

  it("a code in a block keeps the block's side of the card: the island goes inside it", () => {
    expect(read("components/portal/MyDeliveryBoxes.tsx")).toContain(
      '<p className="text-sm font-semibold"><bdi dir="ltr" className="font-mono">{box.boxCode}</bdi></p>',
    );
  });
});
