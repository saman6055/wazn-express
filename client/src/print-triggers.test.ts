import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

/**
 * The production security policy runs scripts from this site's files only.
 * A <script> written into a print window, or inline in index.html, never runs
 * there: the box receipt's print dialog never opened by itself, and a saved
 * dark theme painted light first on every visit.
 */
describe("no inline script where the policy forbids it", () => {
  const PRINT = [
    "lib/deliveryBoxPrintUtils.ts",
    "lib/labelPrintUtils.ts",
    "lib/batchLabelPrintUtils.ts",
    "pages/InvoiceReports.tsx",
    "pages/portal/PortalInvoiceReports.tsx",
    "pages/Finance.tsx",
    "pages/CustomerFinance.tsx",
  ];

  for (const file of PRINT) {
    it(`${file} writes no <script> into its print window, and prints from the opener`, () => {
      const src = read(file);
      expect(src).not.toMatch(/<script[\s>]/);
      expect(src).toContain("printWhenReady(");
    });
  }

  it("the invoice closes its window after the dialog, not straight after asking for it", () => {
    const src = read("pages/InvoiceView.tsx");
    expect(src).not.toContain("w.print(); w.close();");
    expect(src).toContain('w.addEventListener("afterprint", () => w.close())');
  });

  it("index.html has no inline script; the theme comes from its own file, before the first paint", () => {
    const html = read("../index.html");
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)].map((m) => m[0]);
    expect(inline).toEqual([]);
    expect(html).toContain('<script src="/theme-init.js"></script>');
    expect(html.indexOf("/theme-init.js")).toBeLessThan(html.indexOf("</head>"));
    expect(read("../public/theme-init.js")).toContain('localStorage.getItem("theme") === "dark"');
  });
});

describe("printWhenReady", () => {
  it("waits for the page's fonts as well as its images, never longer than its limit", () => {
    const src = read("lib/printWindow.ts");
    expect(src).toContain("fonts?.ready");
    expect(src).toContain("setTimeout(print, maxWaitMs)");
  });
});
