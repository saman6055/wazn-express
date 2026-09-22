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

  it("carries the owner's own stamp, in the build, with the day under it", () => {
    expect(print).toContain("function electronicStampHtml(): string {");
    expect(print).toContain("${electronicStampHtml()}");
    const stamp = print.slice(print.indexOf("function electronicStampHtml"), print.indexOf("function dinarRowsHtml"));
    // His stamp, photographed and cleaned — not a drawing of one.
    expect(stamp).toContain("absoluteLogoUrl(BRAND_STAMP_URL)");
    expect(stamp).toContain('class="receipt-stamp-img"');
    expect(stamp).toContain('class="receipt-stamp-day"');
    // Absolute, or the print window fetches it against nothing.
    expect(stamp).toContain('if (!src) return "";');
    // In the build, never in uploads: that folder has vanished on a redeploy.
    const brand = fs.readFileSync(path.join(SRC, "lib", "brand.ts"), "utf8");
    expect(brand).toContain('export const BRAND_STAMP_URL = "/brand/wazn-stamp.png";');
    expect(fs.existsSync(path.resolve(SRC, "..", "public", "brand", "wazn-stamp.png"))).toBe(true);
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

  it("goes straight to WhatsApp, and keeps the sheet for other apps", () => {
    // Owner, 2026-09-21: WhatsApp direct; the sheet and plain saving there
    // for whatever else comes up.
    expect(share).toContain('const sheetWanted = destination === "share" || (destination === "whatsapp" && isTouchDevice());');
    expect(share).toContain('if (destination === "save") {');
    expect(share).toContain('return "saved";');
    expect(share).toContain('const toWhatsApp = destination === "whatsapp";');
    // Nothing opens a chat the person did not ask for.
    expect(share).toContain("if (toWhatsApp && request.chatUrl) window.open(");
  });

  it("uses a phone's share sheet, and never the computer's", () => {
    // The owner tried Windows' sheet: "that way is not nice; the second one
    // is much faster" (2026-09-21). A computer goes straight to the chat.
    expect(share).toContain("function isTouchDevice(): boolean {");
    expect(share).toContain('window.matchMedia("(pointer: coarse)").matches');
    expect(share).toContain("if (sheetWanted && share && canShare?.({ files: [file] })) {");
  });

  it("on a computer, puts the picture on the clipboard for Ctrl+V", () => {
    expect(share).toContain("const copied = asImage && toWhatsApp ? await copyPicture(dataUrl) : false;");
    expect(share).toContain('new ClipboardItem({ "image/png": png })');
    expect(share).toContain('return copied ? "copied" : "chat_opened";');
    // A refused clipboard is not a failure: the file is saved either way.
    expect(share).toContain("saveFile(file);");
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
    expect(panel).toContain("const handleSendOnWhatsApp = (format: ReceiptShareFormat, destination: ReceiptShareDestination = \"whatsapp\") =>");
    expect(panel).toContain("receiptLanguageFor((customer as any)?.nationality) as Language,");
    expect(panel).toContain("receiptWhatsAppMessage(receiptLanguageFor((customer as any)?.nationality), {");
    expect(panel).toContain("fileName: box.boxCode,");
  });

  it("offers it as a PDF to keep or as a picture that opens in the chat", () => {
    // The owner, after sending the first one: "as an image too, good quality".
    expect(panel).toContain('handleSendOnWhatsApp("pdf")');
    expect(panel).toContain('handleSendOnWhatsApp("image")');
    expect(panel).toContain('handleSendOnWhatsApp("image", "share")');
    expect(panel).toContain('handleSendOnWhatsApp("image", "save")');
    expect(panel).toContain('handleSendOnWhatsApp("pdf", "save")');
    expect(share).toContain('const SHARPNESS = { pdf: 2, image: 3 } as const;');
    expect(share).toContain('const asImage = request.format === "image";');
    expect(share).toContain('`${request.fileName}.jpg`');
    expect(share).toContain('`${request.fileName}.pdf`');
    // A picture is compressed on its way through WhatsApp; the original is
    // drawn large and saved at high quality so that survives.
    expect(share).toContain("quality: 0.95,");
  });

  it("the window says Send, not Print, when it is sending", () => {
    // Owner, 2026-09-21: "in the send flow, Send is better than Print".
    const dialog = read("components/delivery/ReceiptDinarDialog.tsx");
    expect(dialog).toContain('const sending = request?.action === "send";');
    expect(dialog).toContain("{L(sending ? TXT.send : TXT.print)}");
    expect(dialog).toContain("{L(sending ? TXT.sendTitle : TXT.title)}");
    expect(panel).toContain('(lang, dinar) => shareReceiptNow(lang, dinar, format, destination),');
    expect(panel).toContain('"send",');
  });

  it("carries the dinars into the message, not only onto the paper", () => {
    // Owner, 2026-09-22: "the amount worked out in dinars is not written in
    // the chat — it matters, put it there too."
    expect(panel).toContain("const figures = receiptDinar(totalUsd, dinar);");
    expect(panel).toContain("totalIqd: figures?.totalIqd ?? null,");
    const shared = fs.readFileSync(path.resolve(SRC, "../..", "shared/receiptWhatsApp.ts"), "utf8");
    expect(shared).toContain("const dinars = Number.isFinite(iqd) && iqd > 0 ? Math.round(iqd).toLocaleString(\"en-GB\") : null;");
    expect(shared).toContain("`${total} دۆلار (${dinars} دینار)`");
  });

  it("asks the day's rate first, like every other way to a receipt", () => {
    const handler = panel.slice(panel.indexOf("const shareReceiptNow"), panel.indexOf("const handlePrintReceipt"));
    expect(handler).toContain("dinar,");
    expect(handler).toContain("settlement: settlementForPrint,");
  });

  it("says which of the two happened, and says it in four languages", () => {
    for (const outcome of ["shared", "copied", "chatOpened", "noNumber", "saved", "failed"]) {
      expect(panel, outcome).toContain(`${outcome}: {`);
    }
    expect(panel).toContain("toast.success(pickLang(language, SHARE_WORDS.shared))");
    expect(panel).toContain("toast.error(pickLang(language, SHARE_WORDS.failed)");
    // The button cannot be pressed twice while the picture is being drawn.
    expect(panel).toContain("disabled={sharing}");
  });
});
