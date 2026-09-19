import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Everything a customer can choose is on the screen — nothing cut at the
 * sides, nothing to swipe sideways to find.
 *
 * The owner, 2026-09-19, with two phone screenshots: the stage chips on "My
 * shipments" and the order types on "My goods" ran off the side of the
 * screen, the last one half-cut, and a customer may never guess that the row
 * slides. Measured at 320px and 360px, with the phone's text at 115% too:
 * five rows of buttons scrolled sideways. Now the stages and the order types
 * are equal cells in a grid (a long name takes two lines), and the filters,
 * the sorting and the news categories wrap onto a second line.
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

/**
 * The one row allowed to slide: the thumbnails under a photo in the photo
 * viewer, where swiping through pictures is what a customer expects.
 */
const MAY_SLIDE = new Set(["pages/portal/PortalBatchDetail.tsx"]);

describe("nothing in the portal is a row to swipe", () => {
  it("no portal screen scrolls a row sideways, save the photo viewer's thumbnails", () => {
    const offenders: string[] = [];
    for (const rel of [...files("pages/portal"), ...files("components/portal")]) {
      const src = read(rel);
      const hits = src.match(/overflow-x-(auto|scroll)|snap-x/g) ?? [];
      if (MAY_SLIDE.has(rel)) {
        expect(hits.length, `${rel} may slide one row, the thumbnails`).toBeLessThanOrEqual(1);
        continue;
      }
      if (hits.length) offenders.push(`${rel}: ${hits.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });

  it("the stages on My shipments are three equal cells", () => {
    const src = read("pages/portal/PortalShipments.tsx");
    const at = src.indexOf("{statusFilters.map((filter) => {");
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at - 400, at)).toContain('"grid grid-cols-3 transition-all duration-300"');
  });

  it("the order types on My goods are equal cells — three, or four when there are own purchases", () => {
    const src = read("pages/portal/PortalFullPackage.tsx");
    expect(src).toContain('"sticky top-14 z-20 grid gap-1 p-1 rounded-xl mb-4",');
    expect(src).toContain('allSelfOrders.length > 0 ? "grid-cols-4" : "grid-cols-3",');
    // No cell insists on one line: a long name takes two.
    const bar = src.slice(src.indexOf('"sticky top-14 z-20 grid gap-1 p-1 rounded-xl mb-4",'), src.indexOf("{/* Search Bar + Filter Toggle */}"));
    expect(bar.length).toBeGreaterThan(200);
    expect(bar).not.toContain("whitespace-nowrap");
  });

  it("the filters, the sorting and the news categories wrap onto a second line", () => {
    expect((read("pages/portal/PortalFullPackage.tsx").match(/"flex flex-wrap gap-2 pb-1"/g) ?? []).length).toBe(2);
    expect(read("pages/portal/PortalBlog.tsx")).toContain('"px-4 pt-3 -mb-2 flex flex-wrap gap-1.5"');
  });

  it("a card's photos all show, in a grid", () => {
    expect(read("pages/portal/PortalProhibitedPackages.tsx")).toContain('<div className="grid grid-cols-3 gap-2 mb-3">');
  });
});
