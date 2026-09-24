/**
 * Delivery Box Print Utilities
 * Professional label and receipt printing for delivery boxes.
 * Supports RTL (Kurdish/Arabic) and LTR layouts.
 */

import { printWhenReady } from "./printWindow";
import { fitToWholePages } from "./printFit";
import { escapeHtml } from "./html";
import { BRAND_STAMP_URL, type CompanyContact } from "./brand";
import { absoluteLogoUrl } from "./absoluteLogoUrl";
import { formatIqd, formatRate, receiptDinar, type ReceiptDinar, type ReceiptDinarInput } from "@shared/receiptDinar";

export interface BoxForPrint {
  boxCode: string;
  status: string;
  deliveryMethod: string;
  destinationCity?: string | null;
  destinationAddress?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  deliveryCostUsd?: string | number | null;
  deliveryChargeUsd?: string | number | null;
  totalPackages?: number | null;
  totalWeightKg?: string | number | null;
  totalValueUsd?: string | number | null;
  /** Batch shipping type. "sea" → the box is billed by volume (CBM) and the
   *  receipt/label show CBM instead of kg. Anything else (or null) → kg. */
  shippingType?: string | null;
  notes?: string | null;
  createdAt?: string | Date | null;
  sealedAt?: string | Date | null;
  deliveredAt?: string | Date | null;
}

export interface BoxItemForPrint {
  trackingNumber?: string | null;
  itemType: string;
  weightKg?: string | number | null;
  /** Volume in CBM for sea items (null for air). Shown in place of weight on
   *  sea-batch receipts/labels. */
  volumeCbm?: string | number | null;
  /** This package's own shipping type. Lets a single row print CBM even when
   *  it sits in a mixed box. Falls back to the box unit when absent. */
  shippingType?: string | null;
  calculatedCostUsd?: string | number | null;
  description?: string | null;
  sourceInfo?: string | null;
  /** Prepayment applied to this item (commission `totalPrepaidUsd` or
   *  full-package `advancePaidUsd`). NOT printed — the customer receipt is a
   *  plain goods document. Kept on the type because callers pass it through
   *  and the in-app box panel shows it to staff. */
  advanceAppliedUsd?: string | number | null;
}

export interface CustomerForPrint {
  fullName?: string | null;
  customerCode?: string | null;
  mobileNumber?: string | null;
  city?: string | null;
  address?: string | null;
}

type TFunc = (key: string, params?: Record<string, string | number>) => string;

// ==================== SHARED STYLES ====================

const sharedStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.5;
  }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 6px 10px; text-align: right; }
  .text-left { text-align: left; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .font-bold { font-weight: 700; }
  .font-medium { font-weight: 600; }
  .text-sm { font-size: 12px; }
  .text-xs { font-size: 10px; }
  .text-muted { color: #6b7280; }
  .border-b { border-bottom: 1px solid #e5e7eb; }
  .mt-2 { margin-top: 8px; }
  .mt-4 { margin-top: 16px; }
  .mb-1 { margin-bottom: 4px; }
  .mb-2 { margin-bottom: 8px; }
  .mb-4 { margin-bottom: 16px; }
  .p-2 { padding: 8px; }
  .p-4 { padding: 16px; }
  /* How to find us, at the foot of every receipt: address, mobile, portal, website. */
  .receipt-contact {
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 2px 14px;
    font-size: 10px;
    color: #4b5563;
    text-align: center;
  }
  .receipt-contact b { font-weight: 600; color: #6b7280; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { margin: 8mm; }
  }
`;

const PRIMARY_COLOR = "#059669";
const SECONDARY_COLOR = "#0ea5e9";

function formatNum(v: string | number | null | undefined, decimals = 2): string {
  return Number(v || 0).toFixed(decimals);
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return new Date().toLocaleDateString("en-GB");
  return new Date(d).toLocaleDateString("en-GB");
}

// Sea (دەریایی) batches are billed by volume, so the measurement column shows
// CBM; every other batch shows weight in kg. "CBM" is kept as a literal unit
// (international, identical across ku/ar/en/zh); only the total-row label is
// translated (delivery.totalVolume / delivery.totalWeight).
function isSeaBox(box: BoxForPrint): boolean {
  return box.shippingType === "sea";
}

// Each row is measured in ITS OWN package's unit. A sea package priced per
// CBM records no weight, so billing its row in kg printed a meaningless
// "kg 0.00". The item's own shippingType wins when it is known; otherwise we
// fall back to the box-level unit.
function itemMeasure(box: BoxForPrint, item: BoxItemForPrint): string {
  // A full-package carton prints no measurement at all. The customer bought
  // it at one agreed figure; its weight or volume is the other half of our
  // margin, and this paper goes into their hands.
  // See shared/fullPackagePrivacy.ts.
  if (item.itemType === "full_package") return "—";
  const sea = item.shippingType ? item.shippingType === "sea" : isSeaBox(box);
  return sea
    ? `${formatNum(item.volumeCbm, 3)} CBM`
    : `${formatNum(item.weightKg)} kg`;
}

/**
 * What the counter settled, for the sheet the customer takes home.
 *
 * A discount is nearly always agreed before the receipt is printed — the box
 * is nine hundred, call it eight-eighty — and the sheet has to say so. Not
 * only because the total must be the discounted one, but because the
 * customer should be able to see the discount they were given. A receipt that
 * quietly shows 880 with no line explaining it invites the question of what
 * the other twenty was.
 *
 * Optional throughout: a box printed before any money is taken prints exactly
 * as it always did.
 */
export interface SettlementForPrint {
  discountUsd?: number;
  /**
   * Why it was given, already in the receipt's language, and the tracking it
   * was given on when it was not given on the box as a whole.
   *
   * The owner, 2026-09-24: "the reason for the discount must be written on
   * the receipt — what it was for." A line that says only "discount: -20"
   * raises the question it was meant to answer, and a month later nobody at
   * the counter can answer it either.
   */
  discountReason?: string | null;
  paidUsd?: number;
  amountIqd?: number;
  exchangeRate?: number | null;
  settlementNumber?: string | null;
  /** Short money that stayed owed after this receipt. */
  debtUsd?: number;
}

/**
 * The dollar figure a receipt asks for: the box's goods and delivery, less
 * any discount agreed when the money was taken. The window before printing
 * counts its dinars from this, and the receipt from the same sum.
 */
export function receiptAmountUsd(
  box: Pick<BoxForPrint, "totalValueUsd" | "deliveryChargeUsd">,
  settlement?: Pick<SettlementForPrint, "discountUsd"> | null,
): number {
  const grandTotalNum = Number(box.totalValueUsd || 0) + Number(box.deliveryChargeUsd || 0);
  const discountNum = Number(settlement?.discountUsd || 0);
  return Math.max(0, grandTotalNum - discountNum);
}

/**
 * The house's own stamp on the receipt.
 *
 * The owner, 2026-09-21: the receipt that goes to the customer must carry the
 * Wazn Express stamp — "exactly like this one, in blue" — and he sent a
 * photograph of the stamp on his desk. It was lifted off the cardboard, its
 * ink made one blue and the paper made transparent, and it lives in the build
 * beside the mark (client/public/brand/wazn-stamp.png), never in uploads: a
 * redeploy without a mounted volume once took that folder with it.
 *
 * Drawn on every copy — the one printed at the counter and the one sent to
 * the phone. The day it was issued is printed under it, so a stamped receipt
 * says when it was stamped.
 */
function electronicStampHtml(): string {
  const src = absoluteLogoUrl(BRAND_STAMP_URL);
  if (!src) return "";
  const day = new Date();
  const issued = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  return `
          <div class="receipt-stamp">
            <img src="${src}" alt="" class="receipt-stamp-img">
            <div class="receipt-stamp-day">${issued}</div>
          </div>`;
}

/**
 * The receipt's lines in dinars (shared/receiptDinar), in the order the owner
 * approved (2026-09-17, example 4).
 *
 * The system keeps no advance of its own on a receipt — a customer's credit is
 * the account's business. The only advance here is one received by hand and
 * typed in just before printing, and it changes this paper only. In dinars it
 * comes off the dinar total exactly as received; in dollars it comes off the
 * dollars, and what remains is converted.
 */
function dinarRowsHtml(d: ReceiptDinar, t: TFunc): string {
  const row = (label: string, value: string, total = false) => `
          <div class="financial-row${total ? " total" : ""}">
            <span>${label}:</span>
            <span${total ? "" : ' style="font-weight:600;"'} dir="ltr">${value}</span>
          </div>`;
  const rate = row(t("delivery.dollarRate"), `1 $ = ${formatRate(d.rate)} IQD`);

  if (d.advance?.currency === "USD") {
    return `${row(t("delivery.advancePaid"), `\u2212 $${d.advance.amount.toFixed(2)}`)}${row(t("delivery.amountDue"), `$${(d.dueUsd ?? 0).toFixed(2)}`, true)}
        <div class="iqd-box">${rate}${row(t("delivery.amountDueInIqd"), formatIqd(d.dueIqd), true)}
        </div>`;
  }
  if (d.advance) {
    return `
        <div class="iqd-box">${rate}${row(t("delivery.totalInIqd"), formatIqd(d.totalIqd))}${row(t("delivery.advancePaid"), `\u2212 ${formatIqd(d.advance.amount)}`)}${row(t("delivery.amountDueInIqd"), formatIqd(d.dueIqd), true)}
        </div>`;
  }
  return `
        <div class="iqd-box">${rate}${row(t("delivery.totalInIqd"), formatIqd(d.totalIqd), true)}
        </div>`;
}

/**
 * The box's measurements, each row counted in the unit it is actually sold
 * in — and never added to the other one.
 *
 * A box can hold both: an air carton billed per kilo and a sea carton billed
 * per cubic metre. The rows already printed each in its own unit, but the
 * total below them did not: it picked ONE unit from the box and added every
 * row into it, so a sea carton's 0.028 CBM was added to the kilos and the
 * sheet reported a weight nobody could weigh. Two quantities in different
 * units have no sum; they have two totals.
 *
 * Each side carries its own money as well, because on a mixed sheet "8.34 kg
 * — $50.71" invites the customer to divide one by the other and ask why the
 * rate is wrong. Full-package cartons are left out of the measurements (the
 * customer bought them at one agreed figure — shared/fullPackagePrivacy.ts)
 * but their value still belongs to the box total, which is counted elsewhere.
 */
interface MeasureTotals {
  kg: number;
  kgValue: number;
  hasKg: boolean;
  cbm: number;
  cbmValue: number;
  hasCbm: boolean;
  /** Both units present — only then is the split worth the extra line. */
  mixed: boolean;
}

function measureTotals(box: BoxForPrint, items: BoxItemForPrint[]): MeasureTotals {
  let kg = 0, kgValue = 0, kgCount = 0;
  let cbm = 0, cbmValue = 0, cbmCount = 0;

  for (const item of items) {
    if (item.itemType === "full_package") continue;
    const value = Number(item.calculatedCostUsd || 0) || 0;
    const sea = item.shippingType ? item.shippingType === "sea" : isSeaBox(box);
    if (sea) {
      cbm += Number(item.volumeCbm || 0) || 0;
      cbmValue += value;
      cbmCount += 1;
    } else {
      kg += Number(item.weightKg || 0) || 0;
      kgValue += value;
      kgCount += 1;
    }
  }

  return {
    kg, kgValue, hasKg: kgCount > 0,
    cbm, cbmValue, hasCbm: cbmCount > 0,
    mixed: kgCount > 0 && cbmCount > 0,
  };
}

/**
 * The measurement lines to print, as label/value pairs.
 *
 * One line for a box sold in one unit — and no money on it, because the
 * package-value line directly below is that same figure and a receipt should
 * not print one number twice. Two lines for a mixed box, each with its own
 * amount, because there the split is the whole point.
 */
function measureLines(box: BoxForPrint, items: BoxItemForPrint[], t: TFunc): { label: string; value: string }[] {
  const m = measureTotals(box, items);

  if (!m.mixed) {
    // Nothing measurable at all (an all-full-package box) still prints the
    // box's own recorded weight, exactly as it always did.
    if (!m.hasKg && !m.hasCbm) {
      return [{ label: t("delivery.totalWeight"), value: `${formatNum(box.totalWeightKg)} kg` }];
    }
    return m.hasCbm
      ? [{ label: t("delivery.totalVolume"), value: `${m.cbm.toFixed(3)} CBM` }]
      : [{ label: t("delivery.totalWeight"), value: `${m.kg.toFixed(2)} kg` }];
  }

  return [
    { label: t("delivery.totalWeight"), value: `${m.kg.toFixed(2)} kg — $${m.kgValue.toFixed(2)}` },
    { label: t("delivery.totalVolume"), value: `${m.cbm.toFixed(3)} CBM — $${m.cbmValue.toFixed(2)}` },
  ];
}

/** The measurement column's heading: both units named when the box holds both. */
function measureHeading(box: BoxForPrint, items: BoxItemForPrint[], t: TFunc): string {
  const m = measureTotals(box, items);
  if (m.mixed) return `${t("delivery.weight")} / CBM`;
  return m.hasCbm || isSeaBox(box) ? "CBM" : t("delivery.weight");
}

function deliveryMethodLabel(method: string, t: TFunc): string {
  const map: Record<string, string> = {
    warehouse_pickup: "delivery.methodPickup",
    home_delivery: "delivery.methodHomeDelivery",
    city_transfer: "delivery.methodCityTransfer",
  };
  return t(map[method] || map.warehouse_pickup);
}

function itemTypeLabel(type: string, t: TFunc): string {
  const map: Record<string, string> = {
    regular: "delivery.typeRegular",
    full_package: "delivery.typeFullPackage",
    commission: "delivery.typeCommission",
  };
  return t(map[type] || map.regular);
}

/**
 * Normalize a commission box-item description so it always shows ONE
 * combined "نرخی بەرهەم" total (item + commission) plus shipping when
 * present. Box items scanned BEFORE the breakdown-fix landed still have
 * the legacy 3-part text in their stored description; this re-renders
 * them in the new shape on the fly so receipts and the in-app box panel
 * stay consistent.
 *
 * Inputs handled:
 *   1. New format (no عمولە token) → passed through unchanged.
 *   2. Legacy with shipping  ("نرخی بەرهەم: $A + عمولە: $B + گەیاندن: $C")
 *      → "نرخی بەرهەم: $(A+B) + نرخی گواستنەوە: $C"
 *   3. Legacy without shipping ("نرخی بەرهەم: $A + عمولە: $B")
 *      → "نرخی بەرهەم: $(A+B)"
 *   4. Non-breakdown descriptions (no "نرخی بەرهەم:" token) → unchanged.
 *
 * The stored description is always built in Kurdish (server-side). Pass a
 * translator `t` to re-render the breakdown labels ("نرخی بەرهەم" /
 * "نرخی گواستنەوە") and the "(N ئۆردەری هاوبەش)" suffix in another
 * language — used by the multi-language receipt. The numeric values and
 * the free-text product name are language-neutral and kept verbatim.
 */
export function normalizeCommissionDescription(description?: string | null, t?: TFunc): string {
  if (!description) return "-";
  // Strict signal: only touch strings that look like our breakdown.
  if (!description.includes("نرخی بەرهەم")) return description;

  const itemLabel = t ? t("delivery.itemPriceLabel") : "نرخی بەرهەم";
  const shipLabel = t ? t("delivery.shippingLabel") : "نرخی گواستنەوە";

  // Split on the first "|" so productName is preserved verbatim.
  const pipeIdx = description.indexOf("|");
  let productName = pipeIdx >= 0 ? description.slice(0, pipeIdx).trim() : "";
  const breakdown = pipeIdx >= 0 ? description.slice(pipeIdx + 1).trim() : description.trim();

  // Re-render the shared-orders suffix in the target language (the server
  // embeds it in Kurdish as "(N ئۆردەری هاوبەش)" within the product name).
  if (t) {
    productName = productName.replace(
      /\(\s*(\d+)\s+ئۆردەری هاوبەش\s*\)/,
      (_, count) => t("delivery.sharedOrdersSuffix", { count }),
    ).trim();
  }

  const itemMatch = breakdown.match(/نرخی\s+بەرهەم\s*:\s*\$?([\d.]+)/);
  if (!itemMatch) return description;
  const item = parseFloat(itemMatch[1]) || 0;

  const commMatch = breakdown.match(/عمولە\s*:\s*\$?([\d.]+)/);
  const comm = commMatch ? (parseFloat(commMatch[1]) || 0) : 0;

  const shipMatch = breakdown.match(/(?:گەیاندن|نرخی\s+گواستنەوە)\s*:\s*\$?([\d.]+)/);
  const ship = shipMatch ? (parseFloat(shipMatch[1]) || 0) : 0;

  const goods = (item + comm).toFixed(2);
  const prefix = productName ? `${productName} | ` : "";
  if (ship > 0) {
    return `${prefix}${itemLabel}: $${goods} + ${shipLabel}: $${ship.toFixed(2)}`;
  }
  return `${prefix}${itemLabel}: $${goods}`;
}

function deliveryMethodIcon(method: string): string {
  if (method === "home_delivery") return "&#x1F3E0;"; // house
  if (method === "city_transfer") return "&#x1F69A;"; // truck
  return "&#x1F3ED;"; // warehouse
}

/**
 * How to find us, at the foot of every receipt: address, mobile, the customer
 * portal and the website — the owner's list. Numbers and web addresses sit in
 * LTR isolates, so "0770…" and "waznexpress.com/portal" never turn round
 * inside a Kurdish or Arabic line. No company details, no block.
 */
export function receiptContactHtml(company: CompanyContact | undefined, t: TFunc): string {
  if (!company) return "";
  const line = (label: string, value: string, ltr = false) =>
    `<span><b>${label}:</b> ${ltr ? `<bdi dir="ltr">${escapeHtml(value)}</bdi>` : escapeHtml(value)}</span>`;
  return `<div class="receipt-contact">${[
    company.address ? line(t("delivery.address"), company.address) : "",
    company.phones.length ? line(t("delivery.phone"), company.phones.join(" · "), true) : "",
    company.portal ? line(t("delivery.customerPortal"), company.portal, true) : "",
    company.website ? line(t("delivery.website"), company.website, true) : "",
  ].join("")}</div>`;
}

// ==================== LABEL TEMPLATE ====================

export function printBoxLabel(
  box: BoxForPrint,
  items: BoxItemForPrint[],
  customer: CustomerForPrint | null,
  t: TFunc,
  options?: { logoUrl?: string; company?: CompanyContact },
): void {
  const totalValue = formatNum(box.totalValueUsd);
  const deliveryCharge = formatNum(box.deliveryChargeUsd);
  const grandTotalNumber = Number(box.totalValueUsd || 0) + Number(box.deliveryChargeUsd || 0);
  const grandTotal = grandTotalNumber.toFixed(2);

  const itemsRows = items.map((item, idx) => `
    <tr>
      <td style="border:1px solid #d1d5db; padding:4px 8px; font-size:11px; text-align:center;">${idx + 1}</td>
      <td style="border:1px solid #d1d5db; padding:4px 8px; font-size:11px; font-family:monospace; direction:ltr; text-align:left;">${escapeHtml(item.trackingNumber || "-")}</td>
      <td style="border:1px solid #d1d5db; padding:4px 8px; font-size:11px; text-align:center;">${itemTypeLabel(item.itemType, t)}</td>
      <td style="border:1px solid #d1d5db; padding:4px 8px; font-size:11px; text-align:center;" dir="ltr">${itemMeasure(box, item)}</td>
      <td style="border:1px solid #d1d5db; padding:4px 8px; font-size:11px; text-align:center;">$${formatNum(item.calculatedCostUsd)}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${t("delivery.printLabel")} - ${box.boxCode}</title>
  <style>
    ${sharedStyles}
    body { padding: 0; }
    .label-container {
      width: 100mm;
      min-height: 140mm;
      padding: 5mm;
      font-size: 11px;
    }
    @media print {
      @page { size: 105mm auto; margin: 2mm; }
      .label-container { width: 100%; }
    }
    .header-bar {
      background: ${PRIMARY_COLOR};
      color: white;
      padding: 8px 12px;
      border-radius: 6px 6px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .box-code-block {
      background: #f0fdf4;
      border: 2px solid ${PRIMARY_COLOR};
      border-radius: 0 0 6px 6px;
      padding: 10px;
      text-align: center;
      margin-bottom: 10px;
    }
    .box-code-text {
      font-size: 22px;
      font-weight: 800;
      color: ${PRIMARY_COLOR};
      letter-spacing: 2px;
      font-family: monospace;
      direction: ltr;
    }
    .qr-placeholder {
      display: inline-block;
      width: 60px;
      height: 60px;
      border: 2px dashed #9ca3af;
      border-radius: 4px;
      font-size: 8px;
      color: #9ca3af;
      text-align: center;
      line-height: 60px;
      margin-top: 6px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 3px 10px;
      font-size: 11px;
      margin-bottom: 10px;
    }
    .info-label { color: #6b7280; font-weight: 600; white-space: nowrap; }
    .info-value { font-weight: 500; }
    .items-table { margin-bottom: 8px; }
    .items-table th {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 700;
      text-align: center;
    }
    .totals-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      font-size: 11px;
      margin-bottom: 8px;
    }
    .total-cell {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 4px 8px;
      text-align: center;
    }
    .grand-total-cell {
      background: #f0fdf4;
      border: 2px solid ${PRIMARY_COLOR};
      border-radius: 4px;
      padding: 6px 8px;
      text-align: center;
      grid-column: span 2;
    }
    .footer {
      border-top: 1px dashed #d1d5db;
      padding-top: 8px;
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 10px;
      color: #6b7280;
    }
    .signature-line {
      border-bottom: 1px solid #1a1a1a;
      width: 80px;
      display: inline-block;
      margin-bottom: 2px;
    }
  </style>
</head>
<body>
  <div class="label-container">
    <!-- Header -->
    <div class="header-bar">
      <div style="display:flex; align-items:center; gap:6px;">
        ${options?.logoUrl ? `<img src="${escapeHtml(options.logoUrl)}" alt="" style="height:22px; width:auto; object-fit:contain;" />` : ""}
        <span style="font-weight:700; font-size:14px;">${escapeHtml(options?.company?.name || "Wazn Express")}</span>
      </div>
      <div style="font-size:10px;">${deliveryMethodIcon(box.deliveryMethod)} ${deliveryMethodLabel(box.deliveryMethod, t)}</div>
    </div>

    <!-- Box Code + QR -->
    <div class="box-code-block">
      <div class="box-code-text">${escapeHtml(box.boxCode)}</div>
      <div class="qr-placeholder">QR</div>
    </div>

    <!-- Customer Info -->
    <div class="info-grid">
      <span class="info-label">${t("delivery.customer")}:</span>
      <span class="info-value">${escapeHtml(customer?.fullName || "-")}</span>

      <span class="info-label">${t("delivery.customerCode")}:</span>
      <span class="info-value" style="font-family:monospace; direction:ltr;">${escapeHtml(customer?.customerCode || "-")}</span>

      <span class="info-label">${t("delivery.phone")}:</span>
      <span class="info-value" style="direction:ltr;">${escapeHtml(box.recipientPhone || customer?.mobileNumber || "-")}</span>

      ${box.destinationCity ? `
      <span class="info-label">${t("delivery.city")}:</span>
      <span class="info-value">${escapeHtml(box.destinationCity)}</span>
      ` : ""}

      ${box.destinationAddress ? `
      <span class="info-label">${t("delivery.address")}:</span>
      <span class="info-value">${escapeHtml(box.destinationAddress)}</span>
      ` : ""}
    </div>

    <!-- Package Table -->
    ${items.length > 0 ? `
    <table class="items-table" style="border-collapse:collapse; width:100%;">
      <thead>
        <tr>
          <th>#</th>
          <th>${t("delivery.tracking")}</th>
          <th>${t("delivery.type")}</th>
          <th>${measureHeading(box, items, t)}</th>
          <th>${t("delivery.price")}</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>
    ` : ""}

    <!-- Totals -->
    <div class="totals-grid">
      <div class="total-cell">
        <div style="font-size:9px; color:#6b7280;">${t("delivery.packageCount")}</div>
        <div style="font-weight:700;">${box.totalPackages || 0}</div>
      </div>
      ${measureLines(box, items, t).map((line) => `<div class="total-cell">
        <div style="font-size:9px; color:#6b7280;">${line.label}</div>
        <div style="font-weight:700;" dir="ltr">${line.value}</div>
      </div>`).join("")}
      <div class="total-cell">
        <div style="font-size:9px; color:#6b7280;">${t("delivery.packageValue")}</div>
        <div style="font-weight:700;">$${totalValue}</div>
      </div>
      ${box.deliveryMethod !== "warehouse_pickup" ? `<div class="total-cell">
        <div style="font-size:9px; color:#6b7280;">${t("delivery.deliveryCharge")}</div>
        <div style="font-weight:700; color:${PRIMARY_COLOR};">$${deliveryCharge}</div>
      </div>` : ""}
      <div class="grand-total-cell">
        <div style="font-size:9px; color:${PRIMARY_COLOR};">${t("delivery.grandTotal")}</div>
        <div style="font-size:16px; font-weight:800; color:${PRIMARY_COLOR};">$${grandTotal}</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div>
        <div>${formatDate(box.createdAt)}</div>
      </div>
      <div style="text-align:left;">
        <div>${t("delivery.signature")}: <span class="signature-line"></span></div>
      </div>
    </div>
    ${receiptContactHtml(options?.company, t)}
  </div>

</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    // Printed from here, not by a script inside the page: the security
    // policy runs no inline script, so the old onload never fired in production.
    w.addEventListener("afterprint", () => w.close());
    printWhenReady(w);
  }
}

// ==================== RECEIPT TEMPLATE ====================

export function buildBoxReceiptHtml(
  box: BoxForPrint,
  items: BoxItemForPrint[],
  customer: CustomerForPrint | null,
  t: TFunc,
  options?: {
    documentTitle?: string;
    direction?: 'ltr' | 'rtl';
    logoUrl?: string;
    /** Name, address, mobile, portal and website, in the receipt's language. */
    company?: CompanyContact;
    /** Present once money has been taken; absent before that. */
    settlement?: SettlementForPrint;
    /** The day's rate and any advance received by hand, given just before
     *  printing. Absent, the receipt prints without dinars. */
    dinar?: ReceiptDinarInput | null;
  },
): string {
  // Direction follows the chosen receipt language (rtl for ku/ar, ltr for
  // en/zh). Defaults to rtl for back-compat with callers that don't pass it.
  const direction = options?.direction || 'rtl';
  const totalValue = formatNum(box.totalValueUsd);
  const deliveryCharge = formatNum(box.deliveryChargeUsd);
  const grandTotalNum = Number(box.totalValueUsd || 0) + Number(box.deliveryChargeUsd || 0);
  const grandTotal = grandTotalNum.toFixed(2);
  // The discount comes off the grand total, so the figure the customer is
  // asked for is the one they agreed to — and the line above it says why it
  // is not the number they can add up from the rows.
  const settlement = options?.settlement;
  const discountNum = Number(settlement?.discountUsd || 0);
  const afterDiscountNum = Math.max(0, grandTotalNum - discountNum);
  const afterDiscount = afterDiscountNum.toFixed(2);
  // Dinars, counted from the very figure this sheet asks for in dollars.
  // No system advance comes off: a customer's credit is the account's
  // business (owner, 2026-09-17).
  const dinar = receiptDinar(afterDiscountNum, options?.dinar);

  const itemsRows = items.map((item, idx) => {
    const description = item.itemType === "commission"
      ? normalizeCommissionDescription(item.description, t)
      : (item.description || "-");
    return `
    <tr style="${idx % 2 === 0 ? "background:#f9fafb;" : ""}">
      <td style="border:1px solid #e5e7eb; padding:8px 12px; text-align:center; font-size:12px;">${idx + 1}</td>
      <td style="border:1px solid #e5e7eb; padding:8px 12px; font-size:12px; font-family:monospace; direction:ltr; text-align:left;">${escapeHtml(item.trackingNumber || "-")}</td>
      <td style="border:1px solid #e5e7eb; padding:8px 12px; text-align:center; font-size:12px;">${itemTypeLabel(item.itemType, t)}</td>
      <td style="border:1px solid #e5e7eb; padding:8px 12px; font-size:12px;">${escapeHtml(description)}</td>
      <td style="border:1px solid #e5e7eb; padding:8px 12px; text-align:center; font-size:12px;" dir="ltr">${itemMeasure(box, item)}</td>
      <td style="border:1px solid #e5e7eb; padding:8px 12px; text-align:center; font-size:12px;">$${formatNum(item.calculatedCostUsd)}</td>
    </tr>
  `;
  }).join("");

  // Document title doubles as the suggested filename when the user picks
  // "Save as PDF" from the browser's print dialog. The PDF download path
  // overrides this with `${box.boxCode}.pdf`; the print path leaves it as
  // a human-readable label.
  const documentTitle = options?.documentTitle || `${t("delivery.receipt")} - ${box.boxCode}`;
  const html = `<!DOCTYPE html>
<html dir="${direction}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    ${sharedStyles}
    body { padding: 10px; max-width: 210mm; margin: 0 auto; }
    @media print {
      @page { size: A4; margin: 7mm; }
      body { padding: 0; }
      /* Keep rows intact and repeat the header when the table spills to a
         second page, so a big box still prints cleanly. */
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      /* Never a sheet whose only content is the closing lines. */
      .receipt-close { page-break-inside: avoid; break-inside: avoid; }
      .receipt-card { break-inside: auto; }
    }
    .receipt-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    /* Slim single-row header: company name + tagline on one side, the
       receipt label + box code on the other. Replaces the old tall
       centered banner + separate title bar to save vertical space. */
    .company-header {
      background: linear-gradient(135deg, ${PRIMARY_COLOR}, ${SECONDARY_COLOR});
      color: white;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    /* Equal side blocks so the mark between them lands on the true centre of
       the sheet, not wherever two unequal columns happen to leave it. */
    .company-header > .header-side { flex: 1 1 0; min-width: 0; }
    .company-name {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.5px;
      line-height: 1.1;
    }
    .company-subtitle {
      font-size: 10px;
      opacity: 0.9;
    }
    .header-receipt-meta { text-align: end; }
    .header-receipt-title {
      font-size: 13px;
      font-weight: 700;
      opacity: 0.95;
      margin-bottom: 3px;
    }
    .receipt-code {
      font-family: monospace;
      font-size: 14px;
      font-weight: 700;
      color: white;
      direction: ltr;
      background: rgba(255,255,255,0.18);
      padding: 3px 10px;
      border-radius: 5px;
      display: inline-block;
    }
    .receipt-body { padding: 14px 18px; }
    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .info-block {
      background: #f9fafb;
      border-radius: 6px;
      padding: 9px 12px;
    }
    .info-block-title {
      font-size: 10px;
      font-weight: 700;
      color: ${PRIMARY_COLOR};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 1.5px 0;
      font-size: 12px;
    }
    .info-row-label { color: #6b7280; }
    .info-row-value { font-weight: 600; }
    .items-table-receipt { margin-bottom: 12px; }
    .items-table-receipt th {
      background: ${PRIMARY_COLOR};
      color: white;
      border: 1px solid ${PRIMARY_COLOR};
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 700;
      text-align: center;
    }
    .financial-section {
      background: #f9fafb;
      border-radius: 6px;
      padding: 10px 16px;
      margin-bottom: 12px;
    }
    .financial-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 12px;
    }
    .financial-row.total {
      border-top: 2px solid ${PRIMARY_COLOR};
      margin-top: 6px;
      padding-top: 7px;
      font-size: 15px;
      font-weight: 800;
      color: ${PRIMARY_COLOR};
    }
    /* The dinars, boxed apart from the dollar lines above them. */
    .iqd-box {
      margin-top: 8px;
      border: 1.5px dashed ${PRIMARY_COLOR};
      border-radius: 6px;
      padding: 4px 12px;
      background: #ffffff;
    }
    .iqd-box .financial-row.total {
      margin-top: 4px;
      padding-top: 6px;
      font-size: 17px;
    }
    /* The mark, centred in the header row rather than above it: a banner of
       its own costs a strip of every sheet and says nothing the row does
       not. Height is capped so a tall logo cannot push the table down. */
    .header-logo {
      max-height: 34px;
      max-width: 140px;
      object-fit: contain;
      flex-shrink: 0;
      /* No tile — the owner's September 2026 rule, which the screens got and
         the receipts did not: the mark sits straight on the band, keeping its
         own transparency. What makes it readable on a solid green is the ink,
         not a white box: callers pass the white-ink twin through
         logoUrlOnDark() (lib/brand.ts). A white tile around a transparent
         logo is the thing that looks pasted on. */
      background: none;
    }
    /*
     * The closing block, kept whole.
     *
     * Two sentences and two signature lines used to break onto a second
     * sheet of their own — a whole page of paper to say thank you, on a
     * receipt that money is collected against. They stay together now, and
     * the closing line is one line rather than two.
     */
    .receipt-close {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .receipt-footer {
      border-top: 1px dashed #d1d5db;
      padding-top: 6px;
      margin-top: 8px;
      text-align: center;
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .thank-you {
      font-size: 12px;
      font-weight: 600;
      color: ${PRIMARY_COLOR};
    }
    .footer-note {
      font-size: 10px;
      color: #9ca3af;
    }
    .signatures {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-top: 10px;
      padding: 0 20px;
      gap: 10px;
    }
    .signature-block {
      text-align: center;
      width: 34%;
    }
    /* The house's own mark on the paper (owner, 2026-09-21). Outline only —
       a filled seal is a lot of ink for something said once. Tilted a little,
       because a stamp that sits perfectly straight looks printed, not
       stamped. */
    .receipt-stamp {
      flex-shrink: 0;
      text-align: center;
      transform: rotate(-5deg);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-stamp-img {
      /* The owner's own stamp is 42mm across; the paper shows it at that
         size (2026-09-22) rather than at the thumbnail it started as. */
      width: 42mm;
      height: 42mm;
      object-fit: contain;
      display: block;
    }
    .receipt-stamp-day {
      margin-top: -6px;
      font-family: monospace;
      font-size: 8px;
      color: #1f2a6e;
    }
    .signature-line-receipt {
      border-bottom: 1px solid #374151;
      width: 100%;
      height: 22px;
      margin-bottom: 4px;
    }
    .signature-label {
      font-size: 10px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="receipt-card">
    <!-- Slim company + receipt header (company on one side, receipt label
         and box code on the other) -->
    <div class="company-header">
      <div class="header-side">
        <div class="company-name">${escapeHtml(options?.company?.name || "Wazn Express")}</div>
        <div class="company-subtitle">${t("delivery.companyTagline") || "Shipping & Logistics Services"}</div>
      </div>
      ${options?.logoUrl ? `<img class="header-logo" src="${escapeHtml(options.logoUrl)}" alt="" />` : ""}
      <div class="header-side header-receipt-meta">
        <div class="header-receipt-title">${t("delivery.receipt")}</div>
        <div class="receipt-code">${escapeHtml(box.boxCode)}</div>
      </div>
    </div>

    <div class="receipt-body">
      <!-- Customer & Delivery Info -->
      <div class="info-section">
        <div class="info-block">
          <div class="info-block-title">${t("delivery.customerDetails")}</div>
          <div class="info-row">
            <span class="info-row-label">${t("delivery.customer")}:</span>
            <span class="info-row-value">${escapeHtml(customer?.fullName || "-")}</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">${t("delivery.customerCode")}:</span>
            <span class="info-row-value" style="font-family:monospace; direction:ltr;">${escapeHtml(customer?.customerCode || "-")}</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">${t("delivery.phone")}:</span>
            <span class="info-row-value" style="direction:ltr;">${escapeHtml(box.recipientPhone || customer?.mobileNumber || "-")}</span>
          </div>
          ${customer?.city ? `
          <div class="info-row">
            <span class="info-row-label">${t("delivery.city")}:</span>
            <span class="info-row-value">${escapeHtml(customer.city)}</span>
          </div>
          ` : ""}
        </div>

        <div class="info-block">
          <div class="info-block-title">${t("delivery.deliveryDetails")}</div>
          <div class="info-row">
            <span class="info-row-label">${t("delivery.deliveryMethod")}:</span>
            <span class="info-row-value">${deliveryMethodLabel(box.deliveryMethod, t)}</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">${t("delivery.date")}:</span>
            <span class="info-row-value">${formatDate(box.createdAt)}</span>
          </div>
          ${box.destinationCity ? `
          <div class="info-row">
            <span class="info-row-label">${t("delivery.city")}:</span>
            <span class="info-row-value">${escapeHtml(box.destinationCity)}</span>
          </div>
          ` : ""}
          ${box.destinationAddress ? `
          <div class="info-row">
            <span class="info-row-label">${t("delivery.address")}:</span>
            <span class="info-row-value">${escapeHtml(box.destinationAddress)}</span>
          </div>
          ` : ""}
        </div>
      </div>

      <!-- Items Table -->
      ${items.length > 0 ? `
      <table class="items-table-receipt" style="border-collapse:collapse; width:100%;">
        <thead>
          <tr>
            <th>#</th>
            <th>${t("delivery.tracking")}</th>
            <th>${t("delivery.type")}</th>
            <th>${t("delivery.description")}</th>
            <th>${measureHeading(box, items, t)}</th>
            <th>${t("delivery.price")}</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
      ` : `
      <div style="text-align:center; padding:20px; color:#9ca3af; font-size:13px;">
        ${t("delivery.noItems")}
      </div>
      `}

      <!-- Financial Summary -->
      <div class="financial-section">
        <div class="financial-row">
          <span>${t("delivery.packageCount")}:</span>
          <span style="font-weight:600;">${box.totalPackages || 0}</span>
        </div>
        ${measureLines(box, items, t).map((line) => `<div class="financial-row">
          <span>${line.label}:</span>
          <span style="font-weight:600;" dir="ltr">${line.value}</span>
        </div>`).join("")}
        <div class="financial-row">
          <span>${t("delivery.packageValue")}:</span>
          <span style="font-weight:600;">$${totalValue}</span>
        </div>
        ${box.deliveryMethod !== "warehouse_pickup" ? `<div class="financial-row">
          <span>${t("delivery.deliveryCharge")}:</span>
          <span style="font-weight:600; color:${PRIMARY_COLOR};">$${deliveryCharge}</span>
        </div>` : ""}
        <div class="financial-row${discountNum > 0 ? "" : " total"}">
          <span>${t("delivery.grandTotal")}:</span>
          <span${discountNum > 0 ? ' style="font-weight:600;"' : ""}>$${grandTotal}</span>
        </div>
        ${discountNum > 0 ? `
        <div class="financial-row">
          <span>${t("delivery.discount")}${settlement?.discountReason ? ` — ${escapeHtml(settlement.discountReason)}` : ""}:</span>
          <span style="font-weight:600; color:#b45309;">− $${discountNum.toFixed(2)}</span>
        </div>
        <div class="financial-row total">
          <span>${t("delivery.afterDiscount")}:</span>
          <span>$${afterDiscount}</span>
        </div>` : ""}
        ${settlement?.amountIqd && settlement.exchangeRate ? `
        <div class="financial-row">
          <span>${t("delivery.paidInIqd")}:</span>
          <span style="font-weight:600;" dir="ltr">${Number(settlement.amountIqd).toLocaleString("en-GB")} @ ${Number(settlement.exchangeRate).toLocaleString("en-GB")}</span>
        </div>` : ""}
        ${settlement?.debtUsd && settlement.debtUsd > 0 ? `
        <div class="financial-row">
          <span>${t("delivery.remainingDebt")}:</span>
          <span style="font-weight:600; color:#b91c1c;">$${Number(settlement.debtUsd).toFixed(2)}</span>
        </div>` : ""}
        ${dinar ? dinarRowsHtml(dinar, t) : ""}
      </div>

      ${box.notes ? `
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:10px 14px; margin-bottom:16px; font-size:12px;">
        <span style="font-weight:600; color:#92400e;">${t("delivery.notes")}:</span> ${escapeHtml(box.notes)}
      </div>
      ` : ""}

      <!-- Signatures -->
      <!-- Signatures and the closing line travel together. Split across a
           page break they cost a whole extra sheet to say two sentences. -->
      <div class="receipt-close">
        <div class="signatures">
          <div class="signature-block">
            <div class="signature-line-receipt"></div>
            <div class="signature-label">${t("delivery.staffSignature")}</div>
          </div>
          ${electronicStampHtml()}
          <div class="signature-block">
            <div class="signature-line-receipt"></div>
            <div class="signature-label">${t("delivery.customerSignature")}</div>
          </div>
        </div>
        <div class="receipt-footer">
          <span class="thank-you">${t("delivery.thankYou")}</span>
          <span class="footer-note">${t("delivery.receiptNote") || "This receipt is a proof of delivery. Please keep it for your records."}</span>
        </div>
        ${receiptContactHtml(options?.company, t)}
      </div>
    </div>
  </div>

</body>
</html>`;

  return html;
}

/**
 * The receipt, on paper.
 *
 * The document itself is built by `buildBoxReceiptHtml`, which is also what
 * the WhatsApp copy is drawn from — one receipt, whether it is printed at the
 * counter or sent to a phone.
 */
export function printBoxReceipt(
  box: BoxForPrint,
  items: BoxItemForPrint[],
  customer: CustomerForPrint | null,
  t: TFunc,
  options?: Parameters<typeof buildBoxReceiptHtml>[4],
): void {
  const html = buildBoxReceiptHtml(box, items, customer, t, options);
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    // Printed from here, not by a script inside the page: the security
    // policy runs no inline script, so the old onload never fired in production.
    w.addEventListener("afterprint", () => w.close());
    // And measured against the page first, so a stamp and a footer never get
    // a sheet of A4 to themselves (owner, 2026-09-24).
    printWhenReady(w, undefined, (win) => fitToWholePages(win));
  }
}

/**
 * Open the box receipt and trigger the print dialog with the title set
 * to `${boxCode}.pdf` — browsers use `document.title` as the default
 * filename when the user picks "Save as PDF" from the destination
 * dropdown. Same HTML and behavior as `printBoxReceipt`; only the
 * suggested filename differs, so users get a sensible save name without
 * us shipping a bundled PDF library.
 */
export function downloadBoxReceiptPDF(
  box: BoxForPrint,
  items: BoxItemForPrint[],
  customer: CustomerForPrint | null,
  t: TFunc,
  options?: {
    direction?: 'ltr' | 'rtl';
    logoUrl?: string;
    company?: CompanyContact;
    settlement?: SettlementForPrint;
    dinar?: ReceiptDinarInput | null;
  },
): void {
  printBoxReceipt(box, items, customer, t, {
    documentTitle: `${box.boxCode}.pdf`,
    direction: options?.direction,
    logoUrl: options?.logoUrl,
    company: options?.company,
    // The saved copy carries the same discount and the same reason as the
    // one handed over at the counter; a PDF that quietly disagreed with the
    // paper would be the version somebody finds later.
    settlement: options?.settlement,
    dinar: options?.dinar,
  });
}
