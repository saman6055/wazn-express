import PDFDocument from "pdfkit";
import { drawBrandLogo, brandLogoWidth } from "../lib/brandLogo";
import { mirrorX, rtlPen } from "../lib/pdfRtl";

/**
 * One section of the pre-delivery check, as a file.
 *
 * The owner, 2026-09-26: «سیستەمی خۆم بیکات بە پی دی ئێف و بۆ کوێی ناو
 * کۆمپیوتەر و ئەپەکان بمەوێ بتوانم شێری بکەم، بە هەر زمانێک بمەوێ، وەکو
 * چاپی وەسل و پی دی ئێفی وەسل.»
 *
 * The print dialog was the wrong answer. What he needs is the thing the
 * receipt already gives him: a real file, in whatever language he picks,
 * that lands in the downloads folder or goes straight into a chat — because
 * the person who can say where a carton went is in the China depot, and he
 * reaches them on WhatsApp.
 *
 * So this is made the way the account statement is made: pdfkit, the
 * Vazirmatn face for Kurdish and Arabic, and the same word-by-word setting
 * that stops «کۆی قەرزەکان» printing backwards (lib/pdfRtl).
 *
 * Ink-light by the owner's standing print rule: black on white, one rule
 * under the header, small photographs — they are there to be recognised.
 */

export type CheckSheetLang = "ku" | "en" | "ar" | "zh";

export interface CheckSheetRow {
  packageCode: string;
  trackingNumber?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  weightKg?: string | number | null;
  volumeCbm?: string | number | null;
  /** A data: URI or an /uploads path; anything else is skipped. */
  photo?: string | null;
}

export interface CheckSheet {
  lang: CheckSheetLang;
  /** The section's heading, already in the reader's language. */
  title: string;
  /** Its one line of explanation, so the sheet says why it exists. */
  hint?: string;
  batchCode: string;
  rows: CheckSheetRow[];
}

const WORDS = {
  parcel: { ku: "کۆدی پاکەت", en: "Parcel code", ar: "رمز الطرد", zh: "Parcel code" },
  tracking: { ku: "تراکینگ", en: "Tracking", ar: "التتبع", zh: "Tracking" },
  customer: { ku: "کڕیار", en: "Customer", ar: "الزبون", zh: "Customer" },
  size: { ku: "کێش / قەبارە", en: "Weight / size", ar: "الوزن / الحجم", zh: "Weight / size" },
  photo: { ku: "وێنە", en: "Photo", ar: "صورة", zh: "Photo" },
  count: { ku: "ژمارە", en: "Count", ar: "العدد", zh: "Count" },
  page: { ku: "لاپەڕە", en: "Page", ar: "صفحة", zh: "Page" },
} as const;

/** The size a carton was measured at, in one cell, or nothing. */
function sizeOf(row: CheckSheetRow): string {
  const kg = Number(row.weightKg ?? 0);
  const cbm = Number(row.volumeCbm ?? 0);
  const parts: string[] = [];
  if (kg > 0) parts.push(`${kg} kg`);
  if (cbm > 0) parts.push(`${cbm} cbm`);
  return parts.join(" · ");
}

/**
 * A photograph pdfkit can actually draw.
 *
 * Only a base64 data URI: an `/uploads/...` path is a file on the server and
 * reading it here would put the sheet at the mercy of a missing volume
 * ([[uploads-and-brand-logo]] is the scar). A row with no drawable picture
 * prints without one rather than with a broken box.
 */
function photoBuffer(photo: string | null | undefined): Buffer | null {
  const value = (photo ?? "").trim();
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(value);
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

export async function generateCheckSheetPdf(sheet: CheckSheet): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 36,
        bufferPages: true,
        info: {
          Title: `${sheet.title} — ${sheet.batchCode}`,
          Author: "Wazn Express System",
          Subject: "Pre-delivery check",
          CreationDate: new Date(),
        },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const rtl = sheet.lang === "ku" || sheet.lang === "ar";
      const pen = rtlPen(doc, rtl);
      const say = (w: { ku: string; en: string; ar: string; zh: string }) =>
        sheet.lang === "en" ? w.en : sheet.lang === "ar" ? w.ar : sheet.lang === "zh" ? w.zh : w.ku;

      const LEFT = 36;
      const RIGHT = 559;
      const WIDTH = RIGHT - LEFT;
      const mx = (x: number, w: number) => mirrorX(rtl, x, w);

      // ── the header, slim: the mark, what this is, and which shipment ──
      let y = 36;
      try {
        drawBrandLogo(doc, mx(LEFT, brandLogoWidth(18)), y, { height: 18 });
      } catch {
        /* a missing mark must never cost the sheet */
      }
      doc.font(pen.bold).fontSize(13).fillColor("#111");
      pen.write(sheet.title, mx(LEFT + brandLogoWidth(18) + 8, WIDTH - 200), y + 2, {
        width: WIDTH - 200,
        align: rtl ? "right" : "left",
      });
      doc.font("Helvetica-Bold").fontSize(11);
      doc.text(sheet.batchCode, mx(RIGHT - 160, 160), y + 3, { width: 160, align: rtl ? "left" : "right" });
      y += 22;
      doc.font("Helvetica").fontSize(8).fillColor("#555");
      doc.text(
        `${say(WORDS.count)}: ${sheet.rows.length}   ·   ${new Date().toLocaleDateString("en-CA")}`,
        mx(LEFT, WIDTH),
        y,
        { width: WIDTH, align: rtl ? "right" : "left" },
      );
      y += 12;
      if (sheet.hint) {
        doc.font(pen.regular).fontSize(8).fillColor("#555");
        const h = pen.height(sheet.hint, WIDTH, 2);
        pen.write(sheet.hint, mx(LEFT, WIDTH), y, { width: WIDTH, maxLines: 2, align: rtl ? "right" : "left" });
        y += h + 4;
      }
      doc.moveTo(LEFT, y).lineTo(RIGHT, y).lineWidth(0.8).strokeColor("#111").stroke();
      y += 8;

      // ── the columns ───────────────────────────────────────────────────
      const COLS = [
        { key: "photo", w: 34, label: say(WORDS.photo) },
        { key: "code", w: 92, label: say(WORDS.parcel) },
        { key: "tracking", w: 130, label: say(WORDS.tracking) },
        { key: "customer", w: 165, label: say(WORDS.customer) },
        { key: "size", w: 102, label: say(WORDS.size) },
      ] as const;

      const head = () => {
        let x = LEFT;
        doc.fontSize(8).fillColor("#444");
        for (const col of COLS) {
          doc.font(pen.regular);
          pen.write(col.label, mx(x, col.w), y, { width: col.w, align: rtl ? "right" : "left" });
          x += col.w;
        }
        y += 12;
        doc.moveTo(LEFT, y).lineTo(RIGHT, y).lineWidth(0.5).strokeColor("#999").stroke();
        y += 4;
      };
      head();

      const ROW_H = 26;
      for (const row of sheet.rows) {
        if (y + ROW_H > 790) {
          doc.addPage();
          y = 40;
          head();
        }
        let x = LEFT;
        const img = photoBuffer(row.photo);
        if (img) {
          try {
            doc.image(img, mx(x, 22), y, { fit: [22, 22] });
          } catch {
            /* an unreadable picture is simply not drawn */
          }
        }
        x += COLS[0].w;

        doc.fontSize(8).fillColor("#111");
        doc.font("Helvetica");
        doc.text(row.packageCode, mx(x, COLS[1].w), y + 6, { width: COLS[1].w, align: rtl ? "right" : "left", lineBreak: false });
        x += COLS[1].w;
        doc.text(String(row.trackingNumber ?? ""), mx(x, COLS[2].w), y + 6, { width: COLS[2].w, align: rtl ? "right" : "left", lineBreak: false });
        x += COLS[2].w;

        doc.font(pen.regular);
        const who = [row.customerCode, row.customerName].filter(Boolean).join(" · ");
        pen.write(who, mx(x, COLS[3].w), y + 6, { width: COLS[3].w, maxLines: 1, align: rtl ? "right" : "left" });
        x += COLS[3].w;

        doc.font("Helvetica");
        doc.text(sizeOf(row), mx(x, COLS[4].w), y + 6, { width: COLS[4].w, align: rtl ? "right" : "left", lineBreak: false });

        y += ROW_H;
        doc.moveTo(LEFT, y - 4).lineTo(RIGHT, y - 4).lineWidth(0.3).strokeColor("#ddd").stroke();
      }

      // ── page numbers, once every page exists ──────────────────────────
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.font("Helvetica").fontSize(7).fillColor("#888");
        doc.text(`${say(WORDS.page)} ${i + 1} / ${range.count}`, LEFT, 806, { width: WIDTH, align: "center" });
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
