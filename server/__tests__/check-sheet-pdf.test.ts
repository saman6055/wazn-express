import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { CHECK_SHEET_SECTIONS } from "@shared/batchCloseCheck";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8").replace(/\r\n/g, "\n");

/**
 * The owner, 2026-09-26, on the print dialog: «خۆش نیە». «سیستەمی خۆم بیکات
 * بە پی دی ئێف و بۆ کوێی ناو کۆمپیوتەر و ئەپەکان بمەوێ بتوانم شێری بکەم، بە
 * هەر زمانێک بمەوێ، وەکو پی دی ئێفی وەسل.»
 */
describe("a check sheet is a file the system makes", () => {
  const pdf = read("server/services/closeCheckPdf.ts");

  it("is written by the server, the way the receipt is", () => {
    expect(pdf).toContain('import PDFDocument from "pdfkit"');
    expect(pdf).toContain("export async function generateCheckSheetPdf");
    expect(pdf).toContain("Promise<Buffer>");
  });

  it("sets Kurdish the right way round, through the one rule", () => {
    // pdfkit lays words left to right: «کۆی قەرزەکان» printed as
    // «قەرزەکانکۆی» until the statement started setting them by hand. That
    // machinery is now shared rather than copied (lib/pdfRtl).
    expect(pdf).toContain('import { mirrorX, rtlPen } from "../lib/pdfRtl"');
    expect(pdf).toContain("const pen = rtlPen(doc, rtl)");
    expect(pdf).toContain("pen.write(");
    const lib = read("server/lib/pdfRtl.ts");
    expect(lib).toContain("Vazirmatn-Regular.ttf");
    expect(lib).toContain("right -= doc.widthOfString(word);");
  });

  it("speaks whichever language was asked for", () => {
    expect(pdf).toContain('export type CheckSheetLang = "ku" | "en" | "ar" | "zh";');
    const router = read("server/routers/batches.router.ts");
    expect(router).toContain('language: z.enum(["ku", "en", "ar", "zh"]).default("ku")');
  });

  it("draws only a picture it can trust", () => {
    // An /uploads path is a file on a volume that has gone missing before;
    // a row with no drawable picture prints without one.
    expect(pdf).toContain("function photoBuffer");
    expect(pdf).toContain("data:image");
    expect(pdf).toContain("base64");
  });

  it("gathers its own rows, so a shortened list cannot shorten the sheet", () => {
    // The screen shows five and a "show all" button. A sheet that is short
    // because nobody expanded a list is the mistake nobody notices.
    const router = read("server/routers/batches.router.ts");
    const proc = router.slice(router.indexOf("getCheckSheetPdf: staffProcedure"), router.indexOf("getPreDeliveryAudit"));
    expect(proc.length).toBeGreaterThan(200);
    expect(proc).toContain("db.getBatchCloseFacts(input.batchId)");
    expect(proc).toContain("[input.section]");
  });

  it("is asked for by name, from one list of names", () => {
    expect([...CHECK_SHEET_SECTIONS]).toEqual(["unboxed", "notArrivalChecked", "unmeasured", "ownerless"]);
    const dialog = read("client/src/components/batches/BatchCloseCheck.tsx");
    for (const section of CHECK_SHEET_SECTIONS) {
      expect(dialog, section).toContain(`section="${section}"`);
    }
  });

  it("saves the file, or hands it to the share sheet", () => {
    const dialog = read("client/src/components/batches/BatchCloseCheck.tsx");
    expect(dialog).toContain("trpc.batches.getCheckSheetPdf.useMutation");
    expect(dialog).toContain("navigator.canShare?.({ files: [file] })");
    expect(dialog).toContain("a.download = data.filename;");
    // Closing the share sheet is not a failure.
    expect(dialog).toContain('if ((err as Error)?.name === "AbortError") return;');
  });
});
