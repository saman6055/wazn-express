import { dataUrlToBytes, jpegDataUrlToPdfFile } from "./imagePdf";

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
/**
 * How many pixels are drawn per CSS pixel.
 *
 * Twice over for the PDF, which a viewer can zoom into by itself; three times
 * for the picture, because WhatsApp compresses a photo on its way out and a
 * sharper original is what survives that (owner, 2026-09-21: "as an image
 * too, and let the quality be good").
 */
const SHARPNESS = { pdf: 2, image: 3 } as const;

/** What the customer receives: a document, or a picture in the chat. */
export type ReceiptShareFormat = "pdf" | "image";

/**
 * Where the receipt goes (owner, 2026-09-21).
 *
 * WhatsApp is the everyday one and must be direct — no sheet in the way. The
 * other two are there for whatever else comes up: the sheet for any app on
 * the machine, and plain saving for a receipt that is wanted as a file.
 */
export type ReceiptShareDestination = "whatsapp" | "share" | "save";

export type ReceiptShareOutcome =
  /** Handed to the share sheet: the admin picks the chat and presses Send. */
  | "shared"
  /** On the counter's computer: the picture is on the clipboard and the chat
   *  is open — Ctrl+V, Enter. */
  | "copied"
  /** The file was saved and the chat opened with the message. */
  | "chat_opened"
  /** Saved to the machine, and nothing else asked for. */
  | "saved"
  /** The admin closed the share sheet. Nothing was sent, and nothing is wrong. */
  | "cancelled"
  /** The picture could not be drawn — nothing was saved and no chat opened. */
  | "failed";

export interface ReceiptShareRequest {
  /** The receipt document, exactly as it would be printed. */
  html: string;
  /** A PDF to keep, or a picture that opens in the chat itself. */
  format: ReceiptShareFormat;
  /** WhatsApp by default; the share sheet or the machine on request. */
  destination?: ReceiptShareDestination;
  /** The box's code; the extension follows the format. */
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
async function receiptPicture(
  html: string,
  sharpness: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
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
      quality: 0.95,
      backgroundColor: "#ffffff",
      pixelRatio: sharpness,
      width,
      height,
      // The frame is off to the left; the picture must not be.
      style: { margin: "0", left: "0", top: "0" },
    });
    return { dataUrl, width: width * sharpness, height: height * sharpness };
  } finally {
    frame.remove();
  }
}

/**
 * Whose share sheet is worth using.
 *
 * A phone's is one tap to the chat with the file attached. Windows' is a
 * dialog, then an app, then a contact — the owner tried it and said so
 * (2026-09-21): "that way is not nice; the second one is much faster." So a
 * computer skips it and goes straight to the chat instead.
 */
function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

/**
 * The picture on the clipboard, so the chat takes it with Ctrl+V.
 *
 * The clipboard holds PNG and nothing else, so the drawing is re-encoded
 * rather than drawn again. Browsers refuse this without a recent click, and
 * that is fine: the saved file is still there.
 */
async function copyPicture(dataUrl: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return false;
    context.drawImage(image, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return true;
  } catch {
    return false;
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
  const asImage = request.format === "image";
  let file: File;
  let dataUrl: string;
  try {
    const picture = await receiptPicture(request.html, asImage ? SHARPNESS.image : SHARPNESS.pdf);
    dataUrl = picture.dataUrl;
    file = asImage
      ? new File([dataUrlToBytes(picture.dataUrl).slice().buffer as ArrayBuffer], `${request.fileName}.jpg`, {
          type: "image/jpeg",
        })
      : jpegDataUrlToPdfFile(picture.dataUrl, picture.width, picture.height, `${request.fileName}.pdf`, {
          title: request.fileName,
        });
  } catch {
    return "failed";
  }

  const destination = request.destination ?? "whatsapp";
  const share = navigator.share?.bind(navigator);
  const canShare = navigator.canShare?.bind(navigator);
  const sheetWanted = destination === "share" || (destination === "whatsapp" && isTouchDevice());

  if (destination === "save") {
    saveFile(file);
    return "saved";
  }

  if (sheetWanted && share && canShare?.({ files: [file] })) {
    try {
      await share({ files: [file], text: request.message });
      return "shared";
    } catch (error) {
      // The admin closing the sheet is not a fault; anything else falls
      // through to the saved copy so the receipt is never simply lost.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }

  // The counter's computer: the picture on the clipboard and the chat open —
  // Ctrl+V and Enter, which is the fastest this can be made. A sheet that was
  // asked for and is not there leaves the file saved, with no chat opened.
  const toWhatsApp = destination === "whatsapp";
  const copied = asImage && toWhatsApp ? await copyPicture(dataUrl) : false;
  // Saved only when the clipboard would not take it. A receipt that is one
  // paste away does not also need to land in the downloads folder — the
  // owner ended up attaching that copy by hand, which is the slow way round
  // (2026-09-22).
  if (!copied) saveFile(file);
  if (toWhatsApp && request.chatUrl) window.open(request.chatUrl, "_blank", "noopener");
  if (!toWhatsApp) return "saved";
  return copied ? "copied" : "chat_opened";
}
