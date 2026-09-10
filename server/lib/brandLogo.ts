import fs from "fs";
import path from "path";

/**
 * The Wazn Express mark, for documents the server draws itself (PDFs).
 *
 * The same file the client ships in client/public/brand. In production the
 * build copies it into dist/public beside the server bundle; in development
 * and in tests it is read from the repository. Read once, then kept.
 */
const CANDIDATES = [
  path.resolve(import.meta.dirname ?? "", "public", "brand", "wazn-logo.png"),
  path.resolve(process.cwd(), "dist", "public", "brand", "wazn-logo.png"),
  path.resolve(process.cwd(), "client", "public", "brand", "wazn-logo.png"),
];

let cached: Buffer | null | undefined;

export function brandLogoBytes(): Buffer | null {
  if (cached !== undefined) return cached;
  const found = CANDIDATES.find((candidate) => fs.existsSync(candidate));
  cached = found ? fs.readFileSync(found) : null;
  return cached;
}

export function brandLogoDataUri(): string | null {
  const bytes = brandLogoBytes();
  return bytes ? `data:image/png;base64,${bytes.toString("base64")}` : null;
}

/** Width in points of the mark drawn `height` points tall — 0 if it cannot be found. */
export function brandLogoWidth(height: number): number {
  const bytes = brandLogoBytes();
  if (!bytes || bytes.length < 24) return 0;
  // PNG header: width and height are the two big-endian words of IHDR.
  const w = bytes.readUInt32BE(16);
  const h = bytes.readUInt32BE(20);
  return h ? (height * w) / h : 0;
}

/**
 * Draw the mark at (x, y), `height` points tall, into a pdfkit document, and
 * return the width it took — 0 when the file could not be found, so a caller
 * can fall back to the lettering it used to print.
 *
 * `tile` puts a white rounded tile behind it for the dark header bands, where
 * black ink would vanish. The text cursor is left exactly where it was, so the
 * header code around it does not move.
 */
export function drawBrandLogo(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  opts: { height: number; tile?: boolean },
): number {
  const bytes = brandLogoBytes();
  const width = brandLogoWidth(opts.height);
  if (!bytes || !width) return 0;
  const cursorX = doc.x;
  const cursorY = doc.y;
  if (opts.tile) {
    const pad = Math.round(opts.height * 0.16);
    doc.save();
    doc.roundedRect(x - pad, y - pad, width + pad * 2, opts.height + pad * 2, 4).fill("#ffffff");
    doc.restore();
  }
  doc.image(bytes, x, y, { height: opts.height });
  doc.x = cursorX;
  doc.y = cursorY;
  return width;
}
