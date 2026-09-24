/**
 * Never a sheet of paper for a stamp and a footer.
 *
 * The owner, 2026-09-24, holding the second page of a receipt — signature
 * lines, the stamp and the contact line, and nothing else: "if you can, make
 * it so that only the stamp and the information at the bottom coming out
 * underneath are brought back up, intelligently, so that the first A4 is not
 * wasted and we protect the environment. Never let the stamp and the footer
 * alone waste an A4."
 *
 * The closing block is already kept whole (`.receipt-close`), which stops it
 * splitting in half but not from moving to a page of its own. What is needed
 * is the other thing: when the paper is nearly enough, make it enough.
 *
 * So before the print dialog opens, the sheet is measured against the page it
 * will be printed on, and if a small reduction would save a whole sheet, the
 * whole receipt is reduced by exactly that much. Never below `MIN_PRINT_SCALE`
 * — paper saved at the cost of a receipt nobody can read is not a saving —
 * and never at all when it already fits.
 *
 * It generalises past the one case he was holding: a genuinely long parcel
 * list that runs to two pages and a quarter comes out as two full pages
 * rather than three, for the same reason and by the same arithmetic.
 */

/** A4, in millimetres. */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/**
 * Below this the type is too small to read across a counter, and a receipt
 * is read by somebody who is being asked for money.
 */
export const MIN_PRINT_SCALE = 0.82;

/**
 * How much to shrink a document of `contentPx` so it ends on a whole page.
 *
 * The content occupies `pages = contentPx / pageHeightPx` pages. Shrunk to
 * `s` it occupies `pages × s`, so it fits in P pages when `s ≤ P / pages`,
 * and P is allowed only while that stays at or above the floor. The smallest
 * P that does is `ceil(pages × minScale)`, and the scale is then whatever it
 * takes to reach it — 1 when nothing needs to move.
 *
 * Pure, because this is the part that can be wrong.
 */
export function fitScale(contentPx: number, pageHeightPx: number, minScale = MIN_PRINT_SCALE): number {
  if (!(contentPx > 0) || !(pageHeightPx > 0)) return 1;
  const pages = contentPx / pageHeightPx;
  if (pages <= 1) return 1;
  const target = Math.max(1, Math.ceil(pages * minScale));
  const scale = Math.min(1, target / pages);
  // Rounded so the style value is short; clamped because the rounding must
  // never take it under the floor.
  const rounded = Math.floor(scale * 1000) / 1000;
  return Math.max(minScale, Math.min(1, rounded));
}

export interface FitOptions {
  /** The one element the whole document lives in. */
  selector?: string;
  /** The @page margin of the document being printed. */
  marginMm?: number;
  minScale?: number;
}

/**
 * Measure a print window's sheet against A4 and shrink it if that saves a
 * page. Returns the scale applied, 1 when none was.
 *
 * Called from the window that opened it, after the images and fonts have
 * arrived — the stamp is 42mm of the height being measured — and never by a
 * script inside the page: production runs no inline script.
 *
 * `zoom` rather than `transform`, because zoom re-lays the content out and
 * the browser then paginates the smaller document. A transform leaves the
 * original boxes where they were and the page breaks with them, which is the
 * one thing this must not do.
 */
export function fitToWholePages(w: Window, options?: FitOptions): number {
  const selector = options?.selector ?? ".receipt-card";
  const marginMm = options?.marginMm ?? 7;
  const minScale = options?.minScale ?? MIN_PRINT_SCALE;

  try {
    const doc = w.document;
    const sheet = doc.querySelector(selector) as HTMLElement | null;
    if (!sheet || !doc.body) return 1;

    // What a millimetre is worth in this document's pixels. Asked rather
    // than assumed: the answer differs with the browser's zoom.
    const probe = doc.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;width:100mm;height:100mm;";
    doc.body.appendChild(probe);
    const pxPerMm = probe.getBoundingClientRect().height / 100;
    probe.remove();
    if (!(pxPerMm > 0)) return 1;

    // Measured at the paper's own width, so the answer is the paper's.
    const contentMm = A4_WIDTH_MM - marginMm * 2;
    doc.body.style.padding = "0";
    doc.body.style.margin = "0";
    sheet.style.width = `${contentMm}mm`;
    sheet.style.margin = "0 auto";

    /*
     * A page, less a hair.
     *
     * Measured against the exact page height the answer lands within a
     * fraction of a millimetre of the edge — and a fraction is all it takes
     * for the browser to paginate anyway and hand back the blank sheet this
     * exists to prevent. A millimetre and a half of cushion costs nothing.
     */
    const pageHeightPx = (A4_HEIGHT_MM - marginMm * 2) * pxPerMm * 0.995;
    const scale = fitScale(sheet.getBoundingClientRect().height, pageHeightPx, minScale);
    if (scale >= 1) return 1;

    // Widened by as much as it is about to be shrunk, so the paper is used
    // across as well as down: the reduction is in the type, not the margins.
    sheet.style.width = `${contentMm / scale}mm`;
    sheet.style.zoom = String(scale);
    return scale;
  } catch {
    // A window that closed, or a browser without what this needs: print it
    // exactly as it was, which is what happened before any of this existed.
    return 1;
  }
}
