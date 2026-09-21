import { jpegDataUrlToPdfFile } from "./imagePdf";

/**
 * Sending the receipt to the customer on WhatsApp (owner, 2026-09-21).
 *
 * "When you click, it goes straight into the customer's chat with the PDF —
 * only Send is left, and the admin does that."
 *
 * A web page cannot put a file into a WhatsApp chat by itself; that is
 * WhatsApp's own rule, not ours. What a browser does give is the share sheet:
 * the file and the message are handed to it, the admin picks WhatsApp and the
 * customer, and the chat opens with everything already attached — Send is all
 * that is left. That is this path, and on a phone it is the whole of it.
 *
 * Where the browser has no share sheet — a desktop without the WhatsApp app —
 * the receipt is saved instead and the customer's chat opens with the message
 * typed, so the file only has to be dragged in. The caller is told which of
 * the two happened, and says so.
 *
 * The receipt itself is the same document the printer gets
 * (buildBoxReceiptHtml): drawn onto a canvas, and that picture put inside a
 * PDF (lib/imagePdf). One receipt, whether it goes to paper or to a phone.
 */

/** Roughly A4's width in CSS pixels, so the receipt lays out as it prints. */
const A4_WIDTH_PX = 794;
/** Twice the size, so the text is still sharp on a phone that zooms in. */
const SHARPNESS = 2;

export type ReceiptShareOutcome =
  /** Handed to the share sheet: the admin picks the chat and presses Send. */
  | "shared"
  /** No share sheet: the file was saved and the chat opened with the message. */
  | "chat_opened"
  /** The admin closed the share sheet. Nothing was sent, and nothing is wrong. */
  | "cancelled"
  /** The picture could not be drawn — nothing was saved and no chat opened. */
  | "failed";

export interface ReceiptShareRequest {
  /** The receipt document, exactly as it would be printed. */
  html: string;
  /** What the file is called: "BOX-20260921-002.pdf". */
  fileName: string;
  /** The message that travels with it (shared/receiptWhatsApp). */
  message: string;
  /** The customer's chat with the message already typed, or null with no number. */
  chatUrl: string | null;
}

/**
 * Lay the receipt out off-screen and photograph it.
 *
 * In its own frame rather than in the page: the receipt's stylesheet is
 * written for a document of its own, and letting it loose in the app would
 * restyle the screen behind it.
 */
async function receiptPicture(html: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_WIDTH_PX}px;height:10px;border:0;opacity:0;`;
  document.body.appendChild(frame);

  try {
    const doc = frame.contentDocument;
    const view = frame.contentWindow;
    if (!doc || !view) throw new Error("receipt frame did not open");

    doc.open();
    doc.write(html);
    doc.close();

    // The logo and the fonts arrive after the markup does; photographing
    // before they land gives a receipt with a hole where the mark should be.
    await new Promise<void>((resolve) => {
      if (doc.readyState === "complete") resolve();
      else view.addEventListener("load", () => resolve(), { once: true });
    });
    try {
      await doc.fonts?.ready;
    } catch {
      /* a browser without the font API draws with what it has */
    }
    await Promise.all(
      Array.from(doc.images).map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
      ),
    );

    const body = doc.body;
    const width = Math.max(A4_WIDTH_PX, body.scrollWidth);
    const height = Math.max(1, body.scrollHeight);
    frame.style.height = `${height}px`;

    // Loaded only when a receipt is actually sent: the drawing library is
    // the biggest thing on this path and no other screen needs it.
    const { toJpeg } = await import("html-to-image");
    const dataUrl = await toJpeg(body, {
      quality: 0.92,
      backgroundColor: "#ffffff",
      pixelRatio: SHARPNESS,
      width,
      height,
      // The frame is off to the left; the picture must not be.
      style: { margin: "0", left: "0", top: "0" },
    });
    return { dataUrl, width: width * SHARPNESS, height: height * SHARPNESS };
  } finally {
    frame.remove();
  }
}

/** Saved to the machine, for the path with no share sheet. */
function saveFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  // Long enough for the download to start, short enough not to hold memory.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function shareReceiptOnWhatsApp(request: ReceiptShareRequest): Promise<ReceiptShareOutcome> {
  let file: File;
  try {
    const picture = await receiptPicture(request.html);
    file = jpegDataUrlToPdfFile(picture.dataUrl, picture.width, picture.height, request.fileName, {
      title: request.fileName.replace(/\.pdf$/i, ""),
    });
  } catch {
    return "failed";
  }

  const share = navigator.share?.bind(navigator);
  const canShare = navigator.canShare?.bind(navigator);
  if (share && canShare?.({ files: [file] })) {
    try {
      await share({ files: [file], text: request.message });
      return "shared";
    } catch (error) {
      // The admin closing the sheet is not a fault; anything else falls
      // through to the saved copy so the receipt is never simply lost.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }

  saveFile(file);
  if (request.chatUrl) window.open(request.chatUrl, "_blank", "noopener");
  return "chat_opened";
}
