import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fitScale, MIN_PRINT_SCALE } from "./printFit";

/**
 * The owner, 2026-09-24, holding the second page of a receipt — two signature
 * lines, the stamp, the contact line, and nothing else: "make it so the stamp
 * and the information underneath are brought back up, intelligently, so the
 * first A4 is not wasted and we protect the environment. Never let the stamp
 * and the footer alone waste an A4."
 */

const PAGE = 1000; // one page, in the round numbers a test should use

describe("how much to shrink a receipt", () => {
  it("leaves alone what already fits", () => {
    expect(fitScale(400, PAGE)).toBe(1);
    expect(fitScale(1000, PAGE)).toBe(1);
  });

  it("saves the sheet that would carry only the stamp", () => {
    // A page and a tenth: 91% of it is one page, and 91% is readable.
    const s = fitScale(1120, PAGE);
    expect(s).toBeLessThan(1);
    expect(s).toBeGreaterThanOrEqual(MIN_PRINT_SCALE);
    expect(1120 * s).toBeLessThanOrEqual(PAGE + 0.5);
  });

  it("does not squeeze a page and a third onto one, which nobody could read", () => {
    // It would take 75%. Two pages, unshrunk, is the honest answer.
    expect(fitScale(1330, PAGE)).toBe(1);
  });

  it("makes two full pages out of two and a bit, not three", () => {
    const s = fitScale(2400, PAGE);
    expect(s).toBeLessThan(1);
    expect(2400 * s).toBeLessThanOrEqual(2 * PAGE + 0.5);
    expect(s).toBeGreaterThanOrEqual(MIN_PRINT_SCALE);
    // Two and a half would take 80% to fit in two, which is under the floor,
    // so that one is left as the three pages it honestly is.
    expect(fitScale(2500, PAGE)).toBe(1);
  });

  it("never goes under the floor, whatever the arithmetic says", () => {
    for (let px = 1001; px < 6000; px += 7) {
      const s = fitScale(px, PAGE);
      expect(s, `${px}px`).toBeGreaterThanOrEqual(MIN_PRINT_SCALE);
      expect(s, `${px}px`).toBeLessThanOrEqual(1);
      // Whatever it chose, the result lands on a whole number of pages.
      const pages = (px * s) / PAGE;
      expect(Math.abs(pages - Math.round(pages)) < 0.02 || s === 1, `${px}px → ${pages}`).toBe(true);
    }
  });

  it("answers 1 to nonsense rather than dividing by it", () => {
    expect(fitScale(0, PAGE)).toBe(1);
    expect(fitScale(500, 0)).toBe(1);
    expect(fitScale(NaN, PAGE)).toBe(1);
  });
});

describe("where it is used", () => {
  const read = (p: string) => fs.readFileSync(path.resolve(__dirname, "../../..", p), "utf8").replace(/\r\n/g, "\n");

  it("runs after the stamp has loaded, and before the dialog", () => {
    // The stamp is 42mm of the height being measured; measuring before it
    // arrives measures the wrong document.
    const waiter = read("client/src/lib/printWindow.ts");
    expect(waiter).toContain("beforePrint?: (w: Window) => void,");
    const printFn = waiter.slice(waiter.indexOf("const print = () => {"), waiter.indexOf("const images ="));
    expect(printFn).toContain("beforePrint?.(w);");
    expect(printFn.indexOf("beforePrint?.(w);")).toBeLessThan(printFn.indexOf("w.print();"));
  });

  it("is asked for by the receipt, and not by the label roll", () => {
    const utils = read("client/src/lib/deliveryBoxPrintUtils.ts");
    expect(utils).toContain("printWhenReady(w, undefined, (win) => fitToWholePages(win));");
    // The 105mm label is already the size of its own paper.
    const label = utils.slice(utils.indexOf("export function printBoxLabel"), utils.indexOf("export function buildBoxReceiptHtml"));
    expect(label).toContain("printWhenReady(w);");
    expect(label).not.toContain("fitToWholePages");
  });

  it("re-lays the page out rather than drawing it smaller in the same boxes", () => {
    // A transform leaves the original boxes where they are and the page
    // breaks with them — the one thing this must not do.
    const fit = read("client/src/lib/printFit.ts");
    expect(fit).toContain("sheet.style.zoom = String(scale);");
    expect(fit).not.toContain("transform: scale");
  });
});
