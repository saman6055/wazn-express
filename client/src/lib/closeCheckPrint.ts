import { printWhenReady } from "./printWindow";
import type { CloseCheckParcel } from "@shared/batchCloseCheck";

/**
 * One section of the pre-delivery check, on paper.
 *
 * The owner, 2026-09-26: «هەر بەشێک لەو بەشانە بە جیا بنتوارێ بکرێتە فایلی
 * پی دی ئێف و بنێردرێ و شێر بکرێ بۆ چیک کردنەوە، نمونە لە چین یا لەگەڵ هەر
 * کەسێکێ تر.»
 *
 * The dialog already knows which cartons have no box, which were never
 * checked in, which have no weight. What it could not do was hand that list
 * to somebody who is not sitting at this screen — and the person who can
 * answer "where is this carton?" is usually in the China depot, on WhatsApp.
 *
 * So each section prints on its own: the browser's print dialog saves it as
 * a PDF, and the PDF goes into the chat. One section per sheet, because a
 * question about cartons with no box is not the same question as one about
 * money, and the person answering should not have to find their half of a
 * long document.
 *
 * Ink-light by the owner's standing print rule: black on white, one thin
 * rule under the header, no blocks of colour, and photographs small — they
 * are there to be recognised, not admired.
 */

type Lang = string;

const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const WORDS = {
  parcel: { ku: "کۆدی پاکەت", en: "Parcel code", ar: "رمز الطرد", zh: "包裹编号" },
  tracking: { ku: "تراکینگ", en: "Tracking", ar: "التتبع", zh: "运单号" },
  customer: { ku: "کڕیار", en: "Customer", ar: "الزبون", zh: "客户" },
  size: { ku: "کێش / قەبارە", en: "Weight / size", ar: "الوزن / الحجم", zh: "重量 / 尺寸" },
  photo: { ku: "وێنە", en: "Photo", ar: "صورة", zh: "照片" },
  count: { ku: "ژمارە", en: "Count", ar: "العدد", zh: "数量" },
  printed: { ku: "چاپکراوە", en: "Printed", ar: "طُبع", zh: "打印于" },
} as const;

const say = (language: Lang, w: { ku: string; en: string; ar: string; zh: string }): string =>
  language === "en" ? w.en : language === "ar" ? w.ar : language === "zh" ? w.zh : w.ku;

/** The size a carton was measured at, in one cell, or nothing. */
function sizeOf(p: CloseCheckParcel): string {
  const kg = Number(p.weightKg ?? 0);
  const cbm = Number(p.volumeCbm ?? 0);
  const parts: string[] = [];
  if (kg > 0) parts.push(`${kg} kg`);
  if (cbm > 0) parts.push(`${cbm} cbm`);
  const l = Number(p.lengthCm ?? 0);
  const w = Number(p.widthCm ?? 0);
  const h = Number(p.heightCm ?? 0);
  if (l > 0 && w > 0 && h > 0) parts.push(`${l}×${w}×${h}`);
  return parts.join(" · ");
}

export interface CloseCheckSheet {
  language: Lang;
  /** The section's own heading, already in the reader's language. */
  title: string;
  /** Its one line of explanation, so the sheet says why it exists. */
  hint?: string;
  batchCode: string;
  parcels: CloseCheckParcel[];
}

/**
 * Write the sheet and open the print dialog.
 *
 * The page carries no script of its own: production runs scripts from this
 * site's files only, so the print is driven from here (lib/printWindow).
 */
export function printCloseCheckSection(sheet: CloseCheckSheet): boolean {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return false;

  const rtl = sheet.language !== "en";
  const today = new Date().toLocaleDateString("en-CA");
  const rows = sheet.parcels
    .map((p) => {
      const photo = typeof p.photo === "string" && p.photo.trim() ? p.photo.trim() : "";
      return `<tr>
        <td class="img">${photo ? `<img src="${esc(photo)}" alt="" />` : ""}</td>
        <td class="mono">${esc(p.packageCode)}</td>
        <td class="mono">${esc(p.trackingNumber ?? "")}</td>
        <td>${esc([p.customerCode, p.customerName].filter(Boolean).join(" · "))}</td>
        <td class="mono">${esc(sizeOf(p))}</td>
      </tr>`;
    })
    .join("");

  w.document.write(`<!doctype html>
<html lang="${rtl ? "ku" : "en"}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${esc(sheet.title)} — ${esc(sheet.batchCode)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Noto Kufi Arabic", "Segoe UI", system-ui, sans-serif;
         color: #111; font-size: 11px; }
  header { display: flex; align-items: baseline; gap: 10px;
           border-bottom: 1px solid #111; padding-bottom: 5px; margin-bottom: 8px; }
  h1 { font-size: 14px; margin: 0; }
  .code { font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 700; }
  .meta { margin-inline-start: auto; font-size: 10px; color: #444; }
  .hint { font-size: 10px; color: #444; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #ddd; padding: 4px 6px; text-align: start;
           vertical-align: middle; }
  th { font-size: 10px; color: #444; border-bottom: 1px solid #999; }
  .mono { font-family: ui-monospace, Menlo, Consolas, monospace; }
  td.img { width: 34px; padding: 2px; }
  td.img img { width: 30px; height: 30px; object-fit: cover; border: 1px solid #ccc; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
</style>
</head>
<body>
  <header>
    <h1>${esc(sheet.title)}</h1>
    <span class="code">${esc(sheet.batchCode)}</span>
    <span class="meta">${esc(say(sheet.language, WORDS.count))}: ${sheet.parcels.length} · ${esc(say(sheet.language, WORDS.printed))} ${today}</span>
  </header>
  ${sheet.hint ? `<p class="hint">${esc(sheet.hint)}</p>` : ""}
  <table>
    <thead>
      <tr>
        <th>${esc(say(sheet.language, WORDS.photo))}</th>
        <th>${esc(say(sheet.language, WORDS.parcel))}</th>
        <th>${esc(say(sheet.language, WORDS.tracking))}</th>
        <th>${esc(say(sheet.language, WORDS.customer))}</th>
        <th>${esc(say(sheet.language, WORDS.size))}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`);
  w.document.close();
  printWhenReady(w);
  return true;
}
