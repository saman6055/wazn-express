import { escapeHtml } from "@/lib/html";
import { absoluteLogoUrl } from "@/lib/absoluteLogoUrl";
import type { ReceiptLanguage } from "@shared/receiptWhatsApp";

export interface PhotoSheetItem {
  trackingNumber: string | null;
  packageCode?: string | null;
  /** The order's own photo first, the depot's second (the portal's rule, resolved by the box). */
  productImage: string | null;
  weightKg?: string | number | null;
  volumeCbm?: string | number | null;
}

const WORDS: Record<ReceiptLanguage, { title: string; box: string; parcels: string; noPhoto: string; dir: "rtl" | "ltr" }> = {
  ku: { title: "وێنەی پاکەتە گەیشتووەکانت", box: "بۆکس", parcels: "پاکەت", noPhoto: "وێنەی نییە", dir: "rtl" },
  ar: { title: "صور طرودك التي وصلت", box: "الصندوق", parcels: "طرد", noPhoto: "لا توجد صورة", dir: "rtl" },
  en: { title: "Photos of your parcels that arrived", box: "Box", parcels: "parcel(s)", noPhoto: "No photo", dir: "ltr" },
};

const num = (v: unknown) => {
  const x = parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};

/**
 * The box's parcels as one page of photos, for the customer (owner,
 * 2026-10-24: «زیاتر گرنگی بە پاکەتەکان بدات ئینجا تراک ئینجا کێش»): each
 * parcel's photo large, its tracking under it, its kilos (or CBM by sea)
 * under that. No prices - that is the receipt's. Turned into a picture or a
 * PDF by the receipt's own sharing (lib/receiptShare).
 */
export function buildBoxPhotoSheetHtml(
  items: PhotoSheetItem[],
  opts: { lang: ReceiptLanguage; boxCode: string; customerName?: string | null; isSea: boolean; logoUrl?: string | null; companyName?: string | null },
): string {
  const w = WORDS[opts.lang];
  const cards = items.map((item) => {
    const src = item.productImage ? absoluteLogoUrl(item.productImage) : undefined;
    const photo = src
      ? `<img src="${escapeHtml(src)}" alt="" class="ph" />`
      : `<div class="ph none">${escapeHtml(w.noPhoto)}</div>`;
    const measure = opts.isSea
      ? (num(item.volumeCbm) > 0 ? `${num(item.volumeCbm).toFixed(3)} CBM` : "")
      : (num(item.weightKg) > 0 ? `${Number(num(item.weightKg).toFixed(2))} kg` : "");
    return `<div class="card">${photo}<div class="tr" dir="ltr">${escapeHtml(item.trackingNumber || item.packageCode || "")}</div>${measure ? `<div class="kg" dir="ltr">${escapeHtml(measure)}</div>` : ""}</div>`;
  }).join("");
  const logo = absoluteLogoUrl(opts.logoUrl);
  return `<!doctype html><html dir="${w.dir}"><head><meta charset="utf-8" />
<style>
*{box-sizing:border-box}
body{margin:0;padding:22px;font-family:"Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif;color:#111;background:#fff;width:794px}
.head{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:2px solid #0f766e;padding-bottom:10px;margin-bottom:14px}
.head h1{font-size:19px;margin:0}
.head .sub{font-size:13px;color:#444;margin-top:3px}
.head img{height:34px;width:auto}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.card{border:1px solid #ddd;border-radius:10px;overflow:hidden;break-inside:avoid}
.ph{display:block;width:100%;height:220px;object-fit:contain;background:#f4f4f4}
.ph.none{display:flex;align-items:center;justify-content:center;color:#999;font-size:13px}
.tr{font-family:Consolas,"Courier New",monospace;font-size:13px;font-weight:700;padding:7px 9px 2px;text-align:center}
.kg{font-size:13px;color:#555;padding:0 9px 8px;text-align:center}
</style></head><body>
<div class="head"><div><h1>${escapeHtml(w.title)}</h1><div class="sub">${opts.customerName ? `${escapeHtml(opts.customerName)} · ` : ""}${escapeHtml(w.box)} <span dir="ltr">${escapeHtml(opts.boxCode)}</span> · ${items.length} ${escapeHtml(w.parcels)}</div></div>${logo ? `<img src="${escapeHtml(logo)}" alt="" />` : `<b>${escapeHtml(opts.companyName ?? "")}</b>`}</div>
<div class="grid">${cards}</div>
</body></html>`;
}
