import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildManifestHtml, manifestSummary, sortManifest, type ManifestRow } from "./manifestPrint";

const row = (over: Partial<ManifestRow>): ManifestRow => ({
  trackingNumber: "YT0001",
  customerCode: "AZ002(Aram Karim)",
  customerName: "Aram Karim",
  weightKg: "1.25",
  volumeCbm: null,
  orderCode: null,
  productName: null,
  ...over,
});

const ROWS: ManifestRow[] = [
  row({ trackingNumber: "YT0003", customerCode: "AZ010", customerName: "Dilan", weightKg: "0.10" }),
  row({ trackingNumber: "YT0002", weightKg: "0.20", orderCode: "FP-7", productName: "<b>shoes</b>" }),
  row({ trackingNumber: "YT0001", weightKg: "1.20" }),
  row({ trackingNumber: "YT0009", customerCode: null, customerName: null, weightKg: null }),
];

describe("the manifest's figures", () => {
  it("adds weights exactly and counts each customer once", () => {
    expect(manifestSummary(ROWS)).toEqual({ pieces: 4, customers: 3, weightKg: 1.5, volumeCbm: 0 });
  });

  it("lists customer by customer, then tracking by tracking", () => {
    expect(sortManifest(ROWS).map((r) => r.trackingNumber)).toEqual(["YT0009", "YT0001", "YT0002", "YT0003"]);
  });
});

describe("the printed page", () => {
  const html = buildManifestHtml({
    batch: { batchCode: "AIR-2026-041", shippingType: "air_regular" },
    rows: ROWS,
    companyName: "Wazn Express",
    // Absolute, as the print window needs it (a relative path resolves only in a browser).
    logoUrl: "https://waznexpress.com/brand/wazn-logo.png",
    language: "ku",
    printedAt: new Date(Date.UTC(2026, 8, 16, 10, 5)),
  });

  it("reads right to left in Kurdish and names the batch", () => {
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("AIR-2026-041");
    expect(html).toContain("مانیفێستی باچ");
  });

  it("prints text a customer typed as text", () => {
    expect(html).not.toContain("<b>shoes</b>");
    expect(html).toContain("&lt;b&gt;shoes&lt;/b&gt;");
  });

  it("groups by customer with each group's piece count, and totals at the foot", () => {
    expect(html).toContain("AZ002 · Aram Karim");
    expect(html).toMatch(/AZ002 · Aram Karim — <span dir="ltr">2<\/span>/);
    expect(html).toContain('<span dir="ltr">1.5 kg</span>');
  });

  it("carries the mark and runs no script", () => {
    expect(html).toContain('<img src="https://waznexpress.com/brand/wazn-logo.png"');
    expect(html).not.toMatch(/<script[\s>]/);
  });

  it("a sea batch is measured in cubic metres", () => {
    const sea = buildManifestHtml({
      batch: { batchCode: "SEA-1", shippingType: "sea" },
      rows: [row({ volumeCbm: "0.125" })],
      companyName: "Wazn Express",
      language: "en",
      printedAt: new Date(),
    });
    expect(sea).toContain('dir="ltr"');
    expect(sea).toContain("0.125 m³");
  });
});

describe("printing follows the house rules", () => {
  const src = fs.readFileSync(path.join(__dirname, "manifestPrint.ts"), "utf8");

  it("prints from the opener, and closes after the dialog", () => {
    expect(src).toContain("printWhenReady(w)");
    expect(src).toContain('w.addEventListener("afterprint", () => w.close())');
  });

  it("puts the logo in the header", () => {
    expect(src).toContain("reportLogoHtml(");
  });
});
