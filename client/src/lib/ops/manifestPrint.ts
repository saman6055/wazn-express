/**
 * The batch manifest, on paper: every parcel in one shipment, grouped by
 * customer, with the totals a loader checks the pallet against.
 *
 * Asked for by name from the quick action hub ("print manifest"). The data is
 * the arrival scanner's own manifest (`packages.batchManifest`), so the paper
 * and the scanner can never list different parcels.
 *
 * Kept compact on purpose — the owner's rule for anything printed: a slim
 * header, each figure once, and as many rows to an A4 page as stay readable.
 *
 * The window is opened by the caller inside the key press or click, before
 * the manifest is fetched: a window opened after an `await` is a popup the
 * browser blocks. It is printed from here (printWhenReady), never by a script
 * inside it — production runs no inline script.
 */
import { escapeHtml } from "@/lib/html";
import { printWhenReady } from "@/lib/printWindow";
import { reportLogoHtml } from "@/lib/brand";
import { fmtNumber } from "@/lib/portalFormat";
import { splitCustomerCode } from "@shared/customerCode";

export type ManifestLang = "ku" | "en" | "ar" | "zh";

export interface ManifestRow {
  trackingNumber: string | null;
  customerCode: string | null;
  customerName: string | null;
  weightKg: string | number | null;
  volumeCbm: string | number | null;
  orderCode: string | null;
  productName: string | null;
}

export interface ManifestBatch {
  batchCode: string;
  shippingType?: string | null;
}

type Words = Record<ManifestLang, string>;

const W = {
  title: { ku: "مانیفێستی باچ", en: "Batch manifest", ar: "بيان الدفعة", zh: "批次清单" },
  pieces: { ku: "پارچە", en: "pieces", ar: "قطعة", zh: "件" },
  customers: { ku: "کڕیار", en: "customers", ar: "عميل", zh: "位客户" },
  customer: { ku: "کڕیار", en: "Customer", ar: "العميل", zh: "客户" },
  tracking: { ku: "تراکینگ", en: "Tracking", ar: "رقم التتبع", zh: "运单号" },
  order: { ku: "ئۆردەر", en: "Order", ar: "الطلب", zh: "订单" },
  weight: { ku: "کێش", en: "Weight", ar: "الوزن", zh: "重量" },
  total: { ku: "کۆ", en: "Total", ar: "المجموع", zh: "合计" },
  unclaimed: { ku: "بێ خاوەن", en: "Unclaimed", ar: "بلا مالك", zh: "无主" },
  printed: { ku: "چاپکرا", en: "Printed", ar: "طُبع", zh: "打印于" },
  loading: { ku: "مانیفێست ئامادە دەکرێت…", en: "Preparing the manifest…", ar: "جارٍ تجهيز البيان…", zh: "正在准备清单…" },
  empty: { ku: "هیچ پاکەتێک لەم باچەدا نییە", en: "This batch has no parcels", ar: "لا توجد طرود في هذه الدفعة", zh: "该批次没有包裹" },
} satisfies Record<string, Words>;

const say = (words: Words, lang: ManifestLang) => words[lang] ?? words.en;

const num = (v: string | number | null | undefined): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export interface ManifestSummary {
  pieces: number;
  customers: number;
  weightKg: number;
  volumeCbm: number;
}

/** Totals added in grams and cubic centimetres, so no rounding creeps in over a long list. */
export function manifestSummary(rows: readonly ManifestRow[]): ManifestSummary {
  let grams = 0;
  let cc = 0;
  const customers = new Set<string>();
  for (const r of rows) {
    grams += Math.round(num(r.weightKg) * 1000);
    cc += Math.round(num(r.volumeCbm) * 1_000_000);
    customers.add(splitCustomerCode(r.customerCode).code || "—");
  }
  return { pieces: rows.length, customers: customers.size, weightKg: grams / 1000, volumeCbm: cc / 1_000_000 };
}

/** Customer, then tracking — the order a loader works through a pallet. */
export function sortManifest(rows: readonly ManifestRow[]): ManifestRow[] {
  const key = (r: ManifestRow) => splitCustomerCode(r.customerCode).code;
  return [...rows].sort((a, b) => {
    const byCustomer = key(a).localeCompare(key(b), "en", { numeric: true });
    if (byCustomer !== 0) return byCustomer;
    return String(a.trackingNumber ?? "").localeCompare(String(b.trackingNumber ?? ""), "en");
  });
}

export function buildManifestHtml(input: {
  batch: ManifestBatch;
  rows: readonly ManifestRow[];
  companyName: string;
  logoUrl?: string | null;
  language: ManifestLang;
  printedAt: Date;
}): string {
  const lang = input.language;
  const rtl = lang === "ku" || lang === "ar";
  const rows = sortManifest(input.rows);
  const sum = manifestSummary(rows);
  const isSea = input.batch.shippingType === "sea";
  const ltr = (text: string) => `<span dir="ltr">${text}</span>`;

  const customerOf = (r: ManifestRow) => splitCustomerCode(r.customerCode).code || say(W.unclaimed, lang);
  const piecesByCustomer = new Map<string, number>();
  for (const r of rows) piecesByCustomer.set(customerOf(r), (piecesByCustomer.get(customerOf(r)) ?? 0) + 1);

  let body = "";
  let lastCustomer: string | null = null;
  rows.forEach((r, i) => {
    const { name } = splitCustomerCode(r.customerCode);
    const customer = customerOf(r);
    if (customer !== lastCustomer) {
      body += `<tr class="group"><td colspan="5">${escapeHtml(customer)}${
        name || r.customerName ? ` · ${escapeHtml(name || r.customerName)}` : ""
      } — ${ltr(String(piecesByCustomer.get(customer) ?? 0))} ${escapeHtml(say(W.pieces, lang))}</td></tr>`;
      lastCustomer = customer;
    }
    const measure = isSea
      ? num(r.volumeCbm) > 0 ? `${fmtNumber(num(r.volumeCbm), 3)} m³` : "—"
      : num(r.weightKg) > 0 ? `${fmtNumber(num(r.weightKg), 2)} kg` : "—";
    body += `<tr>
      <td class="n">${ltr(String(i + 1))}</td>
      <td class="mono">${ltr(escapeHtml(customer))}</td>
      <td class="mono">${ltr(escapeHtml(r.trackingNumber ?? "—"))}</td>
      <td>${r.orderCode ? `${ltr(escapeHtml(r.orderCode))}${r.productName ? ` <small>${escapeHtml(r.productName)}</small>` : ""}` : ""}</td>
      <td class="n">${ltr(measure)}</td>
    </tr>`;
  });

  const totals = [
    `${ltr(String(sum.pieces))} ${escapeHtml(say(W.pieces, lang))}`,
    `${ltr(String(sum.customers))} ${escapeHtml(say(W.customers, lang))}`,
    ltr(`${fmtNumber(sum.weightKg, 2)} kg`),
    ltr(`${fmtNumber(sum.volumeCbm, 3)} m³`),
  ].join(" · ");

  const printedAt = input.printedAt.toLocaleString("en-GB", { hour12: false });

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(say(W.title, lang))} — ${escapeHtml(input.batch.batchCode)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #111; margin: 0; font-size: 11px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 6px; }
  h1 { font-size: 16px; margin: 0; }
  .code { font-family: Consolas, "Courier New", monospace; font-size: 16px; font-weight: 700; }
  .meta { color: #444; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: start; font-size: 10px; color: #444; border-bottom: 1px solid #999; padding: 3px 4px; }
  td { border-bottom: 1px solid #e5e5e5; padding: 3px 4px; vertical-align: top; }
  tr.group td { background: #f2f2f2; font-weight: 700; border-bottom: 1px solid #bbb; padding-top: 5px; }
  td.n { text-align: end; white-space: nowrap; }
  td.mono { font-family: Consolas, "Courier New", monospace; white-space: nowrap; }
  small { color: #555; }
  tfoot td { font-weight: 700; border-top: 2px solid #111; border-bottom: 0; }
  tr { break-inside: avoid; }
</style>
</head>
<body>
<header>
  <div>
    <h1>${escapeHtml(say(W.title, lang))} <span class="code" dir="ltr">${escapeHtml(input.batch.batchCode)}</span></h1>
    <div class="meta">${totals}</div>
  </div>
  <div style="text-align:end">
    ${reportLogoHtml(input.logoUrl, 30)}
    <div class="meta">${escapeHtml(input.companyName)} · ${escapeHtml(say(W.printed, lang))} ${ltr(escapeHtml(printedAt))}</div>
  </div>
</header>
${
  rows.length === 0
    ? `<p>${escapeHtml(say(W.empty, lang))}</p>`
    : `<table>
  <thead><tr>
    <th>#</th><th>${escapeHtml(say(W.customer, lang))}</th><th>${escapeHtml(say(W.tracking, lang))}</th>
    <th>${escapeHtml(say(W.order, lang))}</th><th>${isSea ? "CBM" : escapeHtml(say(W.weight, lang))}</th>
  </tr></thead>
  <tbody>${body}</tbody>
  <tfoot><tr><td colspan="5">${escapeHtml(say(W.total, lang))}: ${totals}</td></tr></tfoot>
</table>`
}
</body>
</html>`;
}

/**
 * Open the window the manifest will be written into. Call this inside the
 * key press or click — see the note at the top of the file.
 */
export function openManifestWindow(language: ManifestLang): Window | null {
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body style="font-family:Tahoma,Arial,sans-serif;padding:24px">${escapeHtml(
        say(W.loading, language),
      )}</body></html>`,
    );
  }
  return w;
}

export function writeManifestAndPrint(w: Window, html: string): void {
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.addEventListener("afterprint", () => w.close());
  printWhenReady(w);
}
