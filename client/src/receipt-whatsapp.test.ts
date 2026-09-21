import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Sending the receipt to the customer's WhatsApp (owner, 2026-09-21).
 *
 * "When you click, it goes straight into the customer's chat with the PDF,
 * with a stamp on it — only Send is left, and the admin does that."
 *
 * A browser cannot put a file into a WhatsApp chat by itself, so the share
 * sheet does the attaching and the admin presses Send. What this pins is the
 * rest of it: one receipt for paper and for the phone, the stamp on both, the
 * customer's own language, and a path that never leaves the counter guessing
 * whether anything happened.
 */

const SRC = __dirname;
const read = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r\n/g, "\n");

const print = read("lib/deliveryBoxPrintUtils.ts");
const share = read("lib/receiptShare.ts");
const panel = read("components/delivery/BoxDetailPanel.tsx");

describe("one receipt, two ways out", () => {
  it("the document is built once and printed by a wrapper", () => {
    expect(print).toContain("export function buildBoxReceiptHtml(");
    expect(print).toContain("const html = buildBoxReceiptHtml(box, items, customer, t, options);");
    // The builder returns the paper; only the wrapper opens a window.
    const builder = print.slice(print.indexOf("export function buildBoxReceiptHtml("), print.indexOf("export function printBoxReceipt("));
    expect(builder).not.toContain("window.open(");
    expect(builder).toContain("return html;");
  });

  it("carries the house's stamp, named for this box and this day", () => {
    expect(print).toContain("function electronicStampHtml(boxCode: string): string {");
    expect(print).toContain("${electronicStampHtml(box.boxCode)}");
    const stamp = print.slice(print.indexOf("function electronicStampHtml"), print.indexOf("function dinarRowsHtml"));
    expect(stamp).toContain("WAZN EXPRESS");
    expect(stamp).toContain("وەزن ئێکسپرێس");
    expect(stamp).toContain("escapeHtml(boxCode)");
    // Drawn, not fetched: an uploaded mark has gone missing before.
    expect(stamp).not.toContain("<img");
  });
});

describe("the file and the chat", () => {
  it("draws the receipt in a frame of its own, then wraps it in a PDF", () => {
    // Loaded on use, not in every screen's bundle.
    expect(share).toContain('const { toJpeg } = await import("html-to-image");');
    expect(share).toContain('document.createElement("iframe")');
    expect(share).toContain("jpegDataUrlToPdfFile(");
    // Whatever happens, the frame does not stay behind in the page.
    expect(share).toContain("} finally {\n    frame.remove();\n  }");
  });

  it("waits for the mark and the fonts before photographing", () => {
    expect(share).toContain("await doc.fonts?.ready");
    expect(share).toContain("Array.from(doc.images)");
  });

  it("hands the sheet the file and the message, and falls back to saving it", () => {
    expect(share).toContain("canShare?.({ files: [file] })");
    expect(share).toContain("await share({ files: [file], text: request.message })");
    expect(share).toContain('if (error instanceof DOMException && error.name === "AbortError") return "cancelled";');
    expect(share).toContain("saveFile(file);");
    expect(share).toContain('window.open(request.chatUrl, "_blank", "noopener")');
  });
});

describe("the button at the counter", () => {
  it("sends the same receipt, in the customer's own language", () => {
    expect(panel).toContain("const handleSendOnWhatsApp = () =>");
    expect(panel).toContain("askBeforePrinting(receiptLanguageFor((customer as any)?.nationality) as Language, shareReceiptNow)");
    expect(panel).toContain("receiptWhatsAppMessage(receiptLanguageFor((customer as any)?.nationality), {");
    expect(panel).toContain("fileName: `${box.boxCode}.pdf`");
  });

  it("asks the day's rate first, like every other way to a receipt", () => {
    const handler = panel.slice(panel.indexOf("const shareReceiptNow"), panel.indexOf("const handlePrintReceipt"));
    expect(handler).toContain("dinar,");
    expect(handler).toContain("settlement: settlementForPrint,");
  });

  it("says which of the two happened, and says it in four languages", () => {
    for (const outcome of ["shared", "chatOpened", "noNumber", "failed"]) {
      expect(panel, outcome).toContain(`${outcome}: {`);
    }
    expect(panel).toContain("toast.success(pickLang(language, SHARE_WORDS.shared))");
    expect(panel).toContain("toast.error(pickLang(language, SHARE_WORDS.failed)");
    // The button cannot be pressed twice while the picture is being drawn.
    expect(panel).toContain("disabled={sharing}");
  });
});
