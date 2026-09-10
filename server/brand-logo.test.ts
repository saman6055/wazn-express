import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { brandLogoBytes, brandLogoDataUri, brandLogoWidth, drawBrandLogo } from "./lib/brandLogo";

/**
 * Every PDF the server draws carries the mark — the owner's request.
 *
 * Twelve pdfkit documents, from the customer's statement to the dashboard
 * export, printed "WAZN EXPRESS" in letters or the name alone. A PDF cannot
 * lean on a browser to fetch /brand/wazn-logo.png, so the server finds the
 * file itself.
 */
describe("the mark, for server-drawn documents", () => {
  it("is found and is a real PNG", () => {
    const bytes = brandLogoBytes();
    expect(bytes, "client/public/brand/wazn-logo.png was not found").not.toBeNull();
    expect(bytes!.subarray(1, 4).toString("latin1")).toBe("PNG");
    expect(bytes!.length).toBeGreaterThan(1000);
  });

  it("embeds as a data URI, so an HTML-drawn document needs no network", () => {
    expect(brandLogoDataUri()).toMatch(/^data:image\/png;base64,iVBOR/);
  });

  it("keeps its proportions — a wordmark, wider than tall", () => {
    expect(brandLogoWidth(40)).toBeGreaterThan(70);
    expect(brandLogoWidth(40)).toBeLessThan(110);
  });

  it("draws into a real pdfkit page without moving the text cursor", async () => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

    const before = { x: doc.x, y: doc.y };
    const width = drawBrandLogo(doc, 40, 16, { height: 26, tile: true });
    expect(width).toBeGreaterThan(0);
    expect({ x: doc.x, y: doc.y }).toEqual(before);
    doc.end();
    await done;

    const pdf = Buffer.concat(chunks).toString("latin1");
    expect(pdf.startsWith("%PDF")).toBe(true);
    expect(pdf).toContain("/Subtype /Image");
  });
});

describe("every server PDF draws it", () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "services", rel), "utf8");
  const calls = (src: string) => src.split("drawBrandLogo(doc").length - 1;

  it("the customer statement, the batch report and the filtered dashboard", () => {
    expect(calls(read("pdfReports.ts"))).toBe(3);
  });

  it("the invoice and every report in the finance generator", () => {
    // Six finance reports, the (unused) customer statement, and the invoice.
    expect(calls(read("pdf-generator.ts"))).toBe(8);
  });

  it("the package invoice and payment receipt, and the dashboard export", () => {
    expect(calls(read("invoice.service.ts"))).toBe(1);
    expect(calls(read("pdfGenerator.ts"))).toBe(1);
  });

  it("prints the old lettering only as a fallback, never beside the mark", () => {
    const src = read("pdfReports.ts").replace(/\r\n/g, "\n");
    for (const at of src.split("'WAZN EXPRESS'").slice(0, -1)) {
      expect(at.slice(-400)).toContain("if (!drawBrandLogo(");
    }
  });
});
