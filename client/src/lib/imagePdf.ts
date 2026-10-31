/**
 * One picture, wrapped in a PDF — no library.
 *
 * The receipt is an HTML document; WhatsApp takes a file. The browser cannot
 * hand us the PDF its own print dialog makes, so the receipt is drawn onto a
 * canvas and that picture is put inside a PDF, which is what the customer
 * receives and can keep.
 *
 * A PDF holding one JPEG is a small, fixed thing: five objects, the picture
 * stored exactly as it came (DCTDecode — the viewer decodes the JPEG itself),
 * and a cross-reference table of byte offsets. It is written here rather than
 * pulled in as a dependency because that is the whole file, and a megabyte of
 * library to write forty lines of it is not a trade worth making.
 *
 * Everything below counts BYTES, never characters: a JPEG is binary and the
 * offsets in the table must land on the objects they name, or no reader will
 * open the file.
 */

/** A4's width in points (72 per inch). The height follows the picture. */
export const A4_WIDTH_PT = 595.28;

const ascii = (text: string): Uint8Array => {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
};

const join = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** 12 → "0000000012", which is what a cross-reference entry must be. */
const offset10 = (n: number): string => String(n).padStart(10, "0");

export interface ImagePdfOptions {
  /** The page's width in points; the height keeps the picture's shape. */
  pageWidthPt?: number;
  /** Shown as the document's title in a viewer's tab. */
  title?: string;
}

/**
 * A single-page PDF holding one JPEG, filling the page.
 *
 * `widthPx` and `heightPx` are the picture's own size; they set the page's
 * shape, so nothing is cropped and no white band is left at the bottom.
 */
export function buildImagePdf(
  jpeg: Uint8Array,
  widthPx: number,
  heightPx: number,
  options?: ImagePdfOptions,
): Uint8Array {
  return buildImagesPdf([{ jpeg, widthPx, heightPx }], options);
}

/** One PDF, one JPEG to a page, in the order given. */
export function buildImagesPdf(
  pages: Array<{ jpeg: Uint8Array; widthPx: number; heightPx: number }>,
  options?: ImagePdfOptions,
): Uint8Array {
  const pageWidth = options?.pageWidthPt && options.pageWidthPt > 0 ? options.pageWidthPt : A4_WIDTH_PT;
  // Objects 1 and 2 are the catalog and the page list; each page then takes
  // three: the page, its picture, and the line that draws it.
  const pageObject = (i: number) => 3 + i * 3;
  const kids = pages.map((_, i) => `${pageObject(i)} 0 R`).join(" ");

  const objects: Uint8Array[] = [
    ascii("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    ascii(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`),
  ];
  pages.forEach(({ jpeg, widthPx, heightPx }, i) => {
    const w = Math.max(1, Math.round(widthPx));
    const h = Math.max(1, Math.round(heightPx));
    const pageHeight = Math.round((pageWidth * h) / w * 100) / 100;
    const n = pageObject(i);
    // The picture is drawn once, filling the page: scale, no rotation, at the
    // origin — which in PDF is the bottom-left corner.
    const content = `q\n${pageWidth.toFixed(2)} 0 0 ${pageHeight.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
    objects.push(
      ascii(
        `${n} 0 obj\n<< /Type /Page /Parent 2 0 R ` +
          `/MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] ` +
          `/Resources << /XObject << /Im0 ${n + 1} 0 R >> >> /Contents ${n + 2} 0 R >>\nendobj\n`,
      ),
      join([
        ascii(
          `${n + 1} 0 obj\n<< /Type /XObject /Subtype /Image ` +
            `/Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
            `/Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
        ),
        jpeg,
        ascii("\nendstream\nendobj\n"),
      ]),
      join([ascii(`${n + 2} 0 obj\n<< /Length ${content.length} >>\nstream\n`), ascii(content), ascii("endstream\nendobj\n")]),
    );
  });

  const header = ascii("%PDF-1.4\n%âãÏÓ\n");
  const offsets: number[] = [];
  let at = header.length;
  for (const object of objects) {
    offsets.push(at);
    at += object.length;
  }

  const xrefAt = at;
  const xref =
    `xref\n0 ${objects.length + 1}\n` +
    "0000000000 65535 f \n" +
    offsets.map((o) => `${offset10(o)} 00000 n \n`).join("");
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${options?.title ? ` /Title (${pdfText(options.title)})` : ""} >>\n` +
    `startxref\n${xrefAt}\n%%EOF\n`;

  return join([header, ...objects, ascii(xref), ascii(trailer)]);
}

/** Parentheses and backslashes end a PDF string early unless escaped. */
function pdfText(text: string): string {
  return text.replace(/[\\()]/g, (c) => `\\${c}`);
}

/** "data:image/jpeg;base64,…" → the bytes themselves. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** The file to hand to WhatsApp, or to save. */
/** Several pictures as one PDF file, a page each. */
export function jpegPagesToPdfFile(
  pages: Array<{ dataUrl: string; width: number; height: number }>,
  fileName: string,
  options?: ImagePdfOptions,
): File {
  const pdf = buildImagesPdf(pages.map((p) => ({ jpeg: dataUrlToBytes(p.dataUrl), widthPx: p.width, heightPx: p.height })), options);
  return new File([pdf.slice().buffer as ArrayBuffer], fileName, { type: "application/pdf" });
}

export function jpegDataUrlToPdfFile(
  dataUrl: string,
  widthPx: number,
  heightPx: number,
  fileName: string,
  options?: ImagePdfOptions,
): File {
  const pdf = buildImagePdf(dataUrlToBytes(dataUrl), widthPx, heightPx, options);
  // A fresh ArrayBuffer: some browsers refuse a view that shares memory.
  return new File([pdf.slice().buffer as ArrayBuffer], fileName, { type: "application/pdf" });
}
