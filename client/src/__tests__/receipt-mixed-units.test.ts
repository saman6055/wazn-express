import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * A box can hold an air carton sold per kilo and a sea carton sold per cubic
 * metre. The rows always printed each in its own unit; the total below them
 * did not — it picked one unit and added every row into it, so 0.028 CBM was
 * added to the kilograms and the sheet reported a weight nobody could weigh.
 *
 * The owner's rule (Sep 2026): write the weight and what it costs, write the
 * CBM and what it costs, and only then the grand total.
 */

const SRC = path.resolve(__dirname);
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

describe("two units are never added together", () => {
  const print = read("lib/deliveryBoxPrintUtils.ts");

  it("each row is counted in the unit it is actually sold in", () => {
    expect(print).toContain("function measureTotals");
    // The row's own shipping type decides, falling back to the box's.
    expect(print).toContain('const sea = item.shippingType ? item.shippingType === "sea" : isSeaBox(box);');
  });

  it("the old single-total helper is gone, not merely unused", () => {
    expect(print).not.toContain("function totalMeasure");
  });

  it("a mixed box prints each unit with its own amount", () => {
    expect(print).toContain("kg — $");
    expect(print).toContain("CBM — $");
  });

  it("a single-unit box prints no amount beside the measurement", () => {
    // The package-value line right below is that same figure, and a receipt
    // must not print one number twice.
    expect(print).toContain("if (!m.mixed)");
  });

  it("both layouts ask the same helper — no second opinion on paper", () => {
    expect(print.split("measureLines(box, items, t)").length - 1).toBe(2);
    expect(print.split("measureHeading(box, items, t)").length - 1).toBe(2);
  });

  it("a measurement is its own left-to-right run inside an RTL sheet", () => {
    // Without this the bidi algorithm prints "3.70 kg" as "kg 3.70".
    expect(print).toContain('dir="ltr">${itemMeasure(box, item)}</td>');
    expect(print).toContain('dir="ltr">${line.value}');
  });
});

describe("the mark on a coloured band", () => {
  it("the receipt header carries no white tile", () => {
    const print = read("lib/deliveryBoxPrintUtils.ts");
    const logoCss = print.slice(print.indexOf(".header-logo"), print.indexOf(".header-logo") + 700);
    expect(logoCss).not.toContain("background: #fff");
    expect(logoCss).toContain("background: none");
  });

  it("every box print asks for the ink its band needs", () => {
    expect(read("lib/brand.ts")).toContain("export function logoUrlOnDark");
    for (const rel of [
      "components/delivery/BoxDetailPanel.tsx",
      "components/delivery/BoxTable.tsx",
      "components/delivery/BatchPrintBoxesSection.tsx",
    ]) {
      const src = read(rel);
      expect(src, rel).toContain("logoUrlOnDark(");
      // The black-ink mark must not be the one handed to a green header.
      expect(src, rel).not.toContain("|| BRAND_LOGO_URL)");
    }
  });
});
