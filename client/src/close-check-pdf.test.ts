import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The owner, 2026-09-26: «هەر بەشێک لەو بەشانە بە جیا بنتوارێ بکرێتە فایلی
 * پی دی ئێف و بنێردرێ و شێر بکرێ بۆ چیک کردنەوە، نمونە لە چین.»
 *
 * The dialog knew which cartons had no box and which were never checked in;
 * what it could not do was hand that list to the person who can answer where
 * a carton went, who is usually in the China depot, on WhatsApp.
 */
describe("each check section prints on its own", () => {
  const lib = read("client/src/lib/closeCheckPrint.ts");

  it("prints from the opener, because production runs no inline script", () => {
    expect(lib).toContain('import { printWhenReady } from "./printWindow";');
    expect(lib).toContain("printWhenReady(w);");
    expect(lib).not.toContain("<script");
  });

  it("names its shipment and its section on the sheet", () => {
    // A PDF in somebody's chat has to say what it is without the screen it
    // came from.
    expect(lib).toContain("${esc(sheet.title)}");
    expect(lib).toContain('<span class="code">${esc(sheet.batchCode)}</span>');
    expect(lib).toContain("sheet.parcels.length");
  });

  it("carries the photograph, which is what China answers with", () => {
    expect(lib).toContain('<td class="img">');
    expect(lib).toContain("td.img img { width: 30px");
  });

  it("is ink-light and fits A4, the owner's standing print rule", () => {
    expect(lib).toContain("@page { size: A4; margin: 10mm; }");
    // Black on white, one rule under the header — no blocks of colour.
    expect(lib).not.toMatch(/background:\s*#(?!fff)/i);
    // A row is never split across two sheets, and the header repeats.
    expect(lib).toContain("tr { break-inside: avoid; }");
    expect(lib).toContain("thead { display: table-header-group; }");
  });

  it("escapes what it prints", () => {
    // Tracking numbers and customer names come from the database; a name
    // with a < in it must not become markup.
    expect(lib).toContain("const esc =");
    expect(lib).toContain('.replace(/</g, "&lt;")');
  });

  it("has a button on every parcel section, with the batch code", () => {
    const dialog = read("client/src/components/batches/BatchCloseCheck.tsx");
    expect(dialog).toContain("printCloseCheckSection({ language, title, hint, batchCode: batchCode ?? \"\", parcels })");
    expect(dialog).toContain('data-testid={`${testId}-pdf`}');
    // All four parcel sections are handed the code to print.
    expect(dialog.match(/batchCode=\{batchCode\}/g)?.length ?? 0).toBe(4);
    expect(read("client/src/pages/Batches.tsx"))
      .toContain("<BatchCloseCheckSections audit={auditData} batchCode={auditData?.batchCode} />");
  });
});
