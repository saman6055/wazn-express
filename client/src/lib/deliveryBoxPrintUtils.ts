/**
 * Delivery Box Print Utilities
 * Professional label and receipt printing for delivery boxes.
 * Supports RTL (Kurdish/Arabic) and LTR layouts.
 */

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
   *  full-package `advancePaidUsd`). Summed across items and shown as a
   *  negative line on the receipt; subtracted from grand total to
   *  produce the balance still owed at delivery. */
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
  const sea = item.shippingType ? item.shippingType === "sea" : isSeaBox(box);
  return sea
    ? `${formatNum(item.volumeCbm, 3)} CBM`
    : `${formatNum(item.weightKg)} kg`;
}

function totalMeasure(box: BoxForPrint, items: BoxItemForPrint[]): string {
  if (isSeaBox(box)) {
    const totalCbm = items.reduce((s, i) => s + Number(i.volumeCbm || 0), 0);
    return `${totalCbm.toFixed(3)} CBM`;
  }
  return `${formatNum(box.totalWeightKg)} kg`;
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

// ==================== LABEL TEMPLATE ====================

export function printBoxLabel(
  box: BoxForPrint,
  items: BoxItemForPrint[],
  customer: CustomerForPrint | null,
  t: TFunc,
): void {
  const totalValue = formatNum(box.totalValueUsd);
  const deliveryCharge = formatNum(box.deliveryChargeUsd);
  const grandTotal = (Number(box.totalValueUsd || 0) + Number(box.deliveryChargeUsd || 0)).toFixed(2);

  const itemsRows = items.map((item, idx) => `
    <tr>
      <td style="border:1px solid #d1d5db; padding:4px 8px; font-size:11px; text-align:center;">${idx + 1}</td>
      <td style="border:1px solid #d1d5db; padding:4px 8px; font-size:11px; font-family:monospace; direction:ltr; text-align:left;">${item.trackingNumber || "-"}</td>
      <td style="border:1px solid #d1d5db; padding:4px 8px; font-size:11px; text-align:center;">${itemTypeLabel(item.itemType, t)}</td>
      <td style="border:1px solid #d1d5db; padding:4px 8px; font-size:11px; text-align:center;">${itemMeasure(box, item)}</td>
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
      <div style="font-weight:700; font-size:14px;">Wazn Express</div>
      <div style="font-size:10px;">${deliveryMethodIcon(box.deliveryMethod)} ${deliveryMethodLabel(box.deliveryMethod, t)}</div>
    </div>

    <!-- Box Code + QR -->
    <div class="box-code-block">
      <div class="box-code-text">${box.boxCode}</div>
      <div class="qr-placeholder">QR</div>
    </div>

    <!-- Customer Info -->
    <div class="info-grid">
      <span class="info-label">${t("delivery.customer")}:</span>
      <span class="info-value">${customer?.fullName || "-"}</span>

      <span class="info-label">${t("delivery.customerCode")}:</span>
      <span class="info-value" style="font-family:monospace; direction:ltr;">${customer?.customerCode || "-"}</span>

      <span class="info-label">${t("delivery.phone")}:</span>
      <span class="info-value" style="direction:ltr;">${box.recipientPhone || customer?.mobileNumber || "-"}</span>

      ${box.destinationCity ? `
      <span class="info-label">${t("delivery.city")}:</span>
      <span class="info-value">${box.destinationCity}</span>
      ` : ""}

      ${box.destinationAddress ? `
      <span class="info-label">${t("delivery.address")}:</span>
      <span class="info-value">${box.destinationAddress}</span>
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
          <th>${isSeaBox(box) ? "CBM" : t("delivery.weight")}</th>
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
      <div class="total-cell">
        <div style="font-size:9px; color:#6b7280;">${isSeaBox(box) ? t("delivery.totalVolume") : t("delivery.totalWeight")}</div>
        <div style="font-weight:700;">${totalMeasure(box, items)}</div>
      </div>
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
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

// ==================== RECEIPT TEMPLATE ====================

export function printBoxReceipt(
  box: BoxForPrint,
  items: BoxItemForPrint[],
  customer: CustomerForPrint | null,
  t: TFunc,
  options?: { documentTitle?: string; direction?: 'ltr' | 'rtl' },
): void {
  // Direction follows the chosen receipt language (rtl for ku/ar, ltr for
  // en/zh). Defaults to rtl for back-compat with callers that don't pass it.
  const direction = options?.direction || 'rtl';
  const totalValue = formatNum(box.totalValueUsd);
  const deliveryCharge = formatNum(box.deliveryChargeUsd);
  const grandTotalNum = Number(box.totalValueUsd || 0) + Number(box.deliveryChargeUsd || 0);
  const grandTotal = grandTotalNum.toFixed(2);
  // Sum of advance / prepaid amounts already paid by the customer for
  // commission and full-package items in this box. When > 0, the receipt
  // shows it as a negative line and a separate "remaining due" total.
  const advanceTotalNum = items.reduce(
    (sum, item) => sum + (Number(item.advanceAppliedUsd || 0) || 0),
    0,
  );
  const hasAdvance = advanceTotalNum > 0;
  const advanceTotal = advanceTotalNum.toFixed(2);
  const remainingDue = Math.max(0, grandTotalNum - advanceTotalNum).toFixed(2);

  const itemsRows = items.map((item, idx) => {
    const description = item.itemType === "commission"
      ? normalizeCommissionDescription(item.description, t)
      : (item.description || "-");
    return `
    <tr style="${idx % 2 === 0 ? "background:#f9fafb;" : ""}">
      <td style="border:1px solid #e5e7eb; padding:8px 12px; text-align:center; font-size:12px;">${idx + 1}</td>
      <td style="border:1px solid #e5e7eb; padding:8px 12px; font-size:12px; font-family:monospace; direction:ltr; text-align:left;">${item.trackingNumber || "-"}</td>
      <td style="border:1px solid #e5e7eb; padding:8px 12px; text-align:center; font-size:12px;">${itemTypeLabel(item.itemType, t)}</td>
      <td style="border:1px solid #e5e7eb; padding:8px 12px; font-size:12px;">${description}</td>
      <td style="border:1px solid #e5e7eb; padding:8px 12px; text-align:center; font-size:12px;">${itemMeasure(box, item)}</td>
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
  <title>${documentTitle}</title>
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
      justify-content: space-between;
      gap: 12px;
    }
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
    .receipt-footer {
      border-top: 1px dashed #d1d5db;
      padding-top: 10px;
      margin-top: 12px;
      text-align: center;
    }
    .thank-you {
      font-size: 13px;
      font-weight: 600;
      color: ${PRIMARY_COLOR};
      margin-bottom: 4px;
    }
    .footer-note {
      font-size: 10px;
      color: #9ca3af;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 16px;
      padding: 0 20px;
    }
    .signature-block {
      text-align: center;
      width: 40%;
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
      <div>
        <div class="company-name">Wazn Express</div>
        <div class="company-subtitle">${t("delivery.companyTagline") || "Shipping & Logistics Services"}</div>
      </div>
      <div class="header-receipt-meta">
        <div class="header-receipt-title">${t("delivery.receipt")}</div>
        <div class="receipt-code">${box.boxCode}</div>
      </div>
    </div>

    <div class="receipt-body">
      <!-- Customer & Delivery Info -->
      <div class="info-section">
        <div class="info-block">
          <div class="info-block-title">${t("delivery.customerDetails")}</div>
          <div class="info-row">
            <span class="info-row-label">${t("delivery.customer")}:</span>
            <span class="info-row-value">${customer?.fullName || "-"}</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">${t("delivery.customerCode")}:</span>
            <span class="info-row-value" style="font-family:monospace; direction:ltr;">${customer?.customerCode || "-"}</span>
          </div>
          <div class="info-row">
            <span class="info-row-label">${t("delivery.phone")}:</span>
            <span class="info-row-value" style="direction:ltr;">${box.recipientPhone || customer?.mobileNumber || "-"}</span>
          </div>
          ${customer?.city ? `
          <div class="info-row">
            <span class="info-row-label">${t("delivery.city")}:</span>
            <span class="info-row-value">${customer.city}</span>
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
            <span class="info-row-value">${box.destinationCity}</span>
          </div>
          ` : ""}
          ${box.destinationAddress ? `
          <div class="info-row">
            <span class="info-row-label">${t("delivery.address")}:</span>
            <span class="info-row-value">${box.destinationAddress}</span>
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
            <th>${isSeaBox(box) ? "CBM" : t("delivery.weight")}</th>
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
        <div class="financial-row">
          <span>${isSeaBox(box) ? t("delivery.totalVolume") : t("delivery.totalWeight")}:</span>
          <span style="font-weight:600;">${totalMeasure(box, items)}</span>
        </div>
        <div class="financial-row">
          <span>${t("delivery.packageValue")}:</span>
          <span style="font-weight:600;">$${totalValue}</span>
        </div>
        ${box.deliveryMethod !== "warehouse_pickup" ? `<div class="financial-row">
          <span>${t("delivery.deliveryCharge")}:</span>
          <span style="font-weight:600; color:${PRIMARY_COLOR};">$${deliveryCharge}</span>
        </div>` : ""}
        ${hasAdvance ? `
        <div class="financial-row" style="border-top:1px solid #e5e7eb; padding-top:8px; margin-top:4px;">
          <span>${t("delivery.grandTotal")}:</span>
          <span style="font-weight:700;">$${grandTotal}</span>
        </div>
        <div class="financial-row" style="color:#059669;">
          <span>💰 ${t("delivery.advancePaid")}:</span>
          <span style="font-weight:600;">−$${advanceTotal}</span>
        </div>
        <div class="financial-row total">
          <span>${t("delivery.remainingDue")}:</span>
          <span>$${remainingDue}</span>
        </div>
        ` : `
        <div class="financial-row total">
          <span>${t("delivery.grandTotal")}:</span>
          <span>$${grandTotal}</span>
        </div>
        `}
      </div>

      ${box.notes ? `
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:10px 14px; margin-bottom:16px; font-size:12px;">
        <span style="font-weight:600; color:#92400e;">${t("delivery.notes")}:</span> ${box.notes}
      </div>
      ` : ""}

      <!-- Signatures -->
      <div class="signatures">
        <div class="signature-block">
          <div class="signature-line-receipt"></div>
          <div class="signature-label">${t("delivery.staffSignature")}</div>
        </div>
        <div class="signature-block">
          <div class="signature-line-receipt"></div>
          <div class="signature-label">${t("delivery.customerSignature")}</div>
        </div>
      </div>

      <!-- Footer -->
      <div class="receipt-footer">
        <div class="thank-you">${t("delivery.thankYou")}</div>
        <div class="footer-note">${t("delivery.receiptNote") || "This receipt is a proof of delivery. Please keep it for your records."}</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
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
  options?: { direction?: 'ltr' | 'rtl' },
): void {
  printBoxReceipt(box, items, customer, t, {
    documentTitle: `${box.boxCode}.pdf`,
    direction: options?.direction,
  });
}
