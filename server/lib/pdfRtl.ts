import fs from "fs";
import path from "path";

/**
 * Setting Kurdish and Arabic on a PDF page, one word at a time.
 *
 * pdfkit lays words out left to right. A Kurdish phrase came out with its
 * words in reverse — «کۆی قەرزەکان» printed as «قەرزەکانکۆی» — and lost the
 * space before its last word; a customer's name reversed with it. So
 * right-to-left text is set here by hand: right to left, the gaps measured,
 * wrapped a line at a time. Latin text goes through pdfkit as before.
 *
 * This was written inside the account statement and is lifted out because
 * the pre-delivery check sheets need exactly the same thing (the owner,
 * 2026-09-26: he wants a real PDF file he can save and share, not a print
 * dialog). Two copies of a rule this fiddly would become two behaviours the
 * first time either was touched.
 */

/** Anything in the Arabic block: Kurdish, Arabic, Farsi. */
export const ARABIC_SCRIPT = /[؀-ۿ]/;

export interface RtlPen {
  /** True when the Arabic-script font is on disk and registered. */
  hasFont: boolean;
  /** The regular and bold faces to ask pdfkit for. */
  regular: string;
  bold: string;
  /** Write text, setting it right to left when it is Arabic script. */
  write: (
    text: string,
    x: number,
    y: number,
    opts?: PDFKit.Mixins.TextOptions & { maxLines?: number },
  ) => void;
  /** How tall that text will be once wrapped. */
  height: (text: string, width: number, maxLines: number) => number;
  /** The width of a set of words with single spaces between them. */
  widthOfWords: (words: string[]) => number;
}

/**
 * Register the fonts on a document and hand back a pen that can write in
 * either direction.
 *
 * A missing font file is not an error: the sheet falls back to Helvetica and
 * prints, because a plain page always beats a crashed one.
 */
export function rtlPen(doc: PDFKit.PDFDocument, rtl: boolean): RtlPen {
  const fontsDir = path.join(process.cwd(), "server", "assets", "fonts");
  const regularFile = path.join(fontsDir, "Vazirmatn-Regular.ttf");
  const boldFile = path.join(fontsDir, "Vazirmatn-Bold.ttf");
  const hasFont = fs.existsSync(regularFile) && fs.existsSync(boldFile);
  if (hasFont) {
    doc.registerFont("Vazir", regularFile);
    doc.registerFont("Vazir-Bold", boldFile);
  }
  const useRtl = rtl && hasFont;
  const regular = useRtl ? "Vazir" : "Helvetica";
  const bold = useRtl ? "Vazir-Bold" : "Helvetica-Bold";

  /** Break a run of words into lines that fit, measuring as pdfkit will. */
  const lines = (text: string, width: number): string[][] => {
    const space = doc.widthOfString(" ");
    const out: string[][] = [];
    let line: string[] = [];
    let lineW = 0;
    for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
      const w = doc.widthOfString(word);
      if (line.length && lineW + space + w > width) {
        out.push(line);
        line = [];
        lineW = 0;
      }
      lineW += (line.length ? space : 0) + w;
      line.push(word);
    }
    if (line.length) out.push(line);
    return out;
  };

  const widthOfWords = (words: string[]) =>
    words.reduce((sum, w) => sum + doc.widthOfString(w), 0) +
    doc.widthOfString(" ") * Math.max(0, words.length - 1);

  const write: RtlPen["write"] = (text, x, y, opts = {}) => {
    const { maxLines = 1, ...pdfOpts } = opts;
    if (!hasFont || !ARABIC_SCRIPT.test(text)) {
      doc.text(text, x, y, pdfOpts);
      return;
    }
    const width = opts.width ?? 515;
    const all = lines(text, width);
    const shown = all.slice(0, maxLines);
    if (all.length > maxLines) shown[shown.length - 1] = [...shown[shown.length - 1], "…"];
    const space = doc.widthOfString(" ");
    const lineH = doc.currentLineHeight(true);
    shown.forEach((words, li) => {
      const total = widthOfWords(words);
      let right =
        opts.align === "left" ? x + total : opts.align === "center" ? x + (width + total) / 2 : x + width;
      for (const word of words) {
        right -= doc.widthOfString(word);
        doc.text(word, right, y + li * lineH, { lineBreak: false });
        right -= space;
      }
    });
  };

  const height: RtlPen["height"] = (text, width, maxLines) =>
    hasFont && ARABIC_SCRIPT.test(text)
      ? Math.min(lines(text, width).length, maxLines) * doc.currentLineHeight(true)
      : doc.heightOfString(text, { width });

  return { hasFont, regular, bold, write, height, widthOfWords };
}

/**
 * Mirror a box designed left-to-right.
 *
 * A4 is 595 points wide. A column at x with width w sits at the same
 * distance from the other edge when the page reads right to left.
 */
export function mirrorX(rtl: boolean, x: number, w: number, pageWidth = 595): number {
  return rtl ? pageWidth - x - w : x;
}
